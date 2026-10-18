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
  assertCancelWindowOpen,
} from "@/modules/booking/domain/decision";
import {
  assertFeeInUnit,
  assertFeeWithinDue,
  confirmedFee,
  ownerInitiatorLowersFee,
  suggestFee,
  typedFeeFor,
  type FeeInitiator,
} from "@/modules/booking/domain/suggest-fee";
import {
  collapseToWhole,
  findBookingForDecision,
  findBookingForUpdate,
  findRequesterPersonId,
  lockPitchForUpdate,
  setApprovedCancelled,
} from "@/modules/booking/infrastructure/bookings";
import { collectedOn } from "@/modules/booking/application/game-collected";
import { appendDueChange, writeDueIfChanged } from "@/modules/booking/application/write-due-change";

/**
 * APPROVED → CANCELLED, and set the due to the confirmed fee, in one transaction.
 * Auth before $transaction. Past unpaid is still refused (BR-49). No refund.
 * The fee is in the game's currency (DR-007 slice 8): suggested and rounded to its money unit, typed
 * in the field of that currency (`feeUsd` or `feeLbp`, a whole multiple of the unit in pounds), compared
 * with what the game has collected in that currency, and written as a due change in that currency.
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
  /** The same, for a game priced in pounds. Only the field of the game's currency may be sent. */
  feeLbp?: Decimal;
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
      // Row lock, same as slot pay: a tap in flight finishes first, and the
      // collapse below never races an allocation insert.
      const booking = await findBookingForUpdate(tx, input.bookingId);
      if (!booking) {
        throw new DomainError("booking.not_found");
      }
      assertApprovedForCancel(booking.status);

      const { currency } = booking.due;
      const collected = await collectedOn(tx, booking);
      assertCancelWindowOpen({ start: booking.start, now });

      const suggestion = suggestFee(
        settings,
        { due: booking.due, start: booking.start },
        now,
        input.initiator,
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
      // Picking "I cancelled" must not become a way around adjust_due.
      if (
        input.initiator === "OWNER" &&
        !can(membership, BOOKINGS_ADJUST_DUE) &&
        ownerInitiatorLowersFee({
          policy: settings,
          booking: { due: booking.due, start: booking.start },
          now,
          resultingFee: confirmed.fee,
        })
      ) {
        throw new DomainError("access.not_allowed");
      }
      // A per-player booking collapses to WHOLE here, allocations included, so the
      // fee logic below runs unchanged on the booking's total collected.
      let collectionMode = booking.collectionMode;
      if (collectionMode === "PER_PLAYER") {
        await collapseToWhole(tx, { bookingId: booking.id, due: booking.due });
        collectionMode = "WHOLE";
      }
      // Note is PLAYER or OWNER so the later send row can tell the templates
      // apart from the saved row. An unchanged due still gets that row.
      const places = currency === "LBP" ? 0 : 2;
      const feeSame = confirmed.fee
        .toDecimalPlaces(places, Decimal.ROUND_HALF_UP)
        .equals(booking.due.amount.toDecimalPlaces(places, Decimal.ROUND_HALF_UP));
      if (feeSame) {
        await appendDueChange(tx, {
          bookingId: booking.id,
          currency,
          from: booking.due.amount,
          to: confirmed.fee,
          reason: confirmed.reason,
          note: input.initiator,
          actorMembershipId: membership.membershipId,
        });
      } else {
        await writeDueIfChanged(tx, {
          bookingId: booking.id,
          currency,
          from: booking.due.amount,
          to: confirmed.fee,
          collected,
          collectionMode,
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
