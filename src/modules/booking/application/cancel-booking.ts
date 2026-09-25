import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { parseTenantSettings } from "@/lib/tenant-settings";
import { getCurrentTenant, safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { findTenantSettingsById } from "@/modules/access/infrastructure/tenants";
import { BOOKINGS_ADJUST_DUE, BOOKINGS_CANCEL, can } from "@/modules/access/domain/can";
import {
  assertApprovedForCancel,
  assertNotPastUnpaidCancel,
} from "@/modules/booking/domain/decision";
import {
  confirmedFee,
  suggestFee,
  type FeeInitiator,
} from "@/modules/booking/domain/suggest-fee";
import {
  findBookingForDecision,
  findRequesterPersonId,
  insertBookingDueChange,
  lockPitchForUpdate,
  setApprovedCancelled,
} from "@/modules/booking/infrastructure/bookings";
import { bookingRemaining } from "@/modules/payment/domain/collect";
import { sumCollectedUsd } from "@/modules/payment/infrastructure/payments";
import { writeDueIfChanged } from "@/modules/booking/application/write-due-change";

/**
 * APPROVED → CANCELLED, and set the due to the confirmed fee, in one transaction.
 * Auth before $transaction. Past unpaid is still refused (BR-49). No refund.
 */
export type CancelledWindow = {
  bookingId: string;
  pitchId: string;
  start: Date;
  end: Date;
  requesterPersonId: string;
};

export async function cancelBooking(input: {
  bookingId: string;
  initiator: Exclude<FeeInitiator, "NO_SHOW">;
  /** Omitted: use the suggestion. An edited amount needs bookings.adjust_due. */
  feeUsd?: Decimal;
}): Promise<CancelledWindow> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, BOOKINGS_CANCEL)) {
    throw new DomainError("access.not_allowed");
  }

  const tenant = await getCurrentTenant();
  const settings = parseTenantSettings(await findTenantSettingsById(tenant.id));
  const now = new Date();

  let cancelled: CancelledWindow | undefined;
  try {
    cancelled = await db.$transaction(async (tx) => {
      const loaded = await findBookingForDecision(tx, input.bookingId);
      if (!loaded) {
        throw new DomainError("booking.not_found");
      }
      await lockPitchForUpdate(tx, loaded.pitchId);
      const booking = await findBookingForDecision(tx, input.bookingId);
      if (!booking) {
        throw new DomainError("booking.not_found");
      }
      assertApprovedForCancel(booking.status);

      const collected = await sumCollectedUsd(tx, "BOOKING", booking.id);
      assertNotPastUnpaidCancel({
        start: booking.start,
        remaining: bookingRemaining(booking.amountDueUsd, collected),
        now,
      });

      const suggestion = suggestFee(
        settings,
        { amountDueUsd: booking.amountDueUsd, start: booking.start },
        now,
        input.initiator,
      );
      if (
        input.feeUsd !== undefined &&
        !input.feeUsd.equals(suggestion.feeUsd) &&
        !can(membership, BOOKINGS_ADJUST_DUE)
      ) {
        throw new DomainError("access.not_allowed");
      }

      const confirmed = confirmedFee({
        suggestion,
        collectedUsd: collected,
        feeUsd: input.feeUsd,
      });
      // Note is PLAYER or OWNER so the later send row can tell the templates
      // apart from the saved row. An unchanged due still gets that row.
      const feeSame = confirmed.feeUsd
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .equals(booking.amountDueUsd.toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
      if (feeSame) {
        await insertBookingDueChange(tx, {
          bookingId: booking.id,
          fromUsd: booking.amountDueUsd,
          toUsd: confirmed.feeUsd,
          reason: confirmed.reason,
          note: input.initiator,
          actorMembershipId: membership.membershipId,
        });
      } else {
        await writeDueIfChanged(tx, {
          bookingId: booking.id,
          fromUsd: booking.amountDueUsd,
          toUsd: confirmed.feeUsd,
          collectedUsd: collected,
          collectionMode: booking.collectionMode,
          reason: confirmed.reason,
          note: input.initiator,
          actorMembershipId: membership.membershipId,
        });
      }
      await setApprovedCancelled(tx, booking.id);
      const requesterPersonId = await findRequesterPersonId(tx, booking.id);
      return {
        bookingId: booking.id,
        pitchId: booking.pitchId,
        start: booking.start,
        end: booking.end,
        requesterPersonId: requesterPersonId ?? "",
      };
    });

    logger.info(`Booking cancelled ${input.bookingId}`, undefined, {
      useCase: "cancelBooking",
      tenantId: await safeTenantId(),
    });
  } catch (error) {
    await rethrowUnexpected(error, "Cancel booking failed", "cancelBooking");
  }
  if (!cancelled) {
    throw new DomainError("booking.not_found");
  }
  return cancelled;
}
