import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { parseTenantSettings } from "@/lib/tenant-settings";
import { getCurrentTenant, safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { findTenantSettingsById } from "@/modules/access/infrastructure/tenants";
import { BOOKINGS_ADJUST_DUE, BOOKINGS_NO_SHOW, can } from "@/modules/access/domain/can";
import {
  assertApprovedForNoShow,
  assertEndedForNoShow,
} from "@/modules/booking/domain/decision";
import {
  assertFeeInUnit,
  assertFeeWithinDue,
  confirmedFee,
  suggestFee,
  typedFeeFor,
} from "@/modules/booking/domain/suggest-fee";
import {
  collapseToWhole,
  findBookingForDecision,
  findBookingForUpdate,
  lockPitchForUpdate,
  setApprovedNoShow,
} from "@/modules/booking/infrastructure/bookings";
import { collectedOn } from "@/modules/booking/application/game-collected";
import { writeDueIfChanged } from "@/modules/booking/application/write-due-change";

/**
 * APPROVED → NO_SHOW, and set the due to the confirmed fee, in one transaction.
 * Auth before $transaction. Unpaid is allowed (SPEC-14 / BR-49).
 * The fee is in the game's currency, as for a cancel (DR-007 slice 8).
 */
export async function recordNoShow(input: {
  bookingId: string;
  /** Omitted: use the suggestion. An edited amount needs bookings.adjust_due. */
  feeUsd?: Decimal;
  /** The same, for a game priced in pounds. Only the field of the game's currency may be sent. */
  feeLbp?: Decimal;
}): Promise<void> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, BOOKINGS_NO_SHOW)) {
    throw new DomainError("access.not_allowed");
  }

  const tenant = await getCurrentTenant();
  const settings = parseTenantSettings(await findTenantSettingsById(tenant.id));
  const now = new Date();

  try {
    await db.$transaction(async (tx) => {
      const loaded = await findBookingForDecision(tx, input.bookingId);
      if (!loaded) {
        throw new DomainError("booking.not_found");
      }
      await lockPitchForUpdate(tx, loaded.pitchId);
      const booking = await findBookingForUpdate(tx, input.bookingId);
      if (!booking) {
        throw new DomainError("booking.not_found");
      }
      assertApprovedForNoShow(booking.status);
      assertEndedForNoShow({ end: booking.end, now });

      const { currency } = booking.due;
      const collected = await collectedOn(tx, booking);
      const suggestion = suggestFee(
        settings,
        { due: booking.due, start: booking.start },
        now,
        "NO_SHOW",
      );
      const typedFee = typedFeeFor(currency, input);
      if (typedFee !== undefined && !typedFee.equals(suggestion.fee) && !can(membership, BOOKINGS_ADJUST_DUE)) {
        throw new DomainError("access.not_allowed");
      }
      if (typedFee !== undefined) {
        assertFeeInUnit(typedFee, currency);
        assertFeeWithinDue(typedFee, booking.due.amount);
      }

      const confirmed = confirmedFee({
        suggestion,
        collected,
        fee: typedFee,
      });
      // A per-player booking collapses to WHOLE first, allocations included, so the
      // fee logic runs unchanged on the booking's total collected (same as cancel).
      let collectionMode = booking.collectionMode;
      if (collectionMode === "PER_PLAYER") {
        await collapseToWhole(tx, { bookingId: booking.id, due: booking.due });
        collectionMode = "WHOLE";
      }
      await writeDueIfChanged(tx, {
        bookingId: booking.id,
        currency,
        from: booking.due.amount,
        to: confirmed.fee,
        collected,
        collectionMode,
        reason: confirmed.reason,
        note: null,
        actorMembershipId: membership.membershipId,
      });
      await setApprovedNoShow(tx, booking.id);
    });

    logger.info(`Booking no-show ${input.bookingId}`, undefined, {
      useCase: "recordNoShow",
      tenantId: await safeTenantId(),
    });
  } catch (error) {
    await rethrowUnexpected(error, "Record no-show failed", "recordNoShow");
  }
}
