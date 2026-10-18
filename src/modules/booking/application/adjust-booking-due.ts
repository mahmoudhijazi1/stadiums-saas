import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { BOOKINGS_ADJUST_DUE, can } from "@/modules/access/domain/can";
import type { DueChangeReason } from "@/modules/booking/domain/suggest-fee";
import { assertDueAdjustableStatus } from "@/modules/booking/domain/adjust-due";
import { findBookingForUpdate } from "@/modules/booking/infrastructure/bookings";
import { collectedOn } from "@/modules/booking/application/game-collected";
import { writeDueIfChanged } from "@/modules/booking/application/write-due-change";

/**
 * Change what is collectible and log why, in one transaction.
 * No-op when the amount is already that value. The booking row is locked and collected
 * is summed after the lock, so a payment landing at the same moment cannot leave the
 * due below what was collected (audit §2.6). PENDING and REJECTED are refused.
 * The new amount is in the game's currency (DR-007 slice 8): `toUsd` for a game in dollars, `toLbp`
 * (whole pounds) for a game in pounds; the other field is refused (`form.invalid`). It can never
 * be below what the game has collected in that currency.
 */
export async function adjustBookingDue(input: {
  bookingId: string;
  toUsd?: Decimal;
  toLbp?: Decimal;
  reason: DueChangeReason;
  note: string | null;
}): Promise<void> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, BOOKINGS_ADJUST_DUE)) {
    throw new DomainError("access.not_allowed");
  }

  try {
    await db.$transaction(async (tx) => {
      const booking = await findBookingForUpdate(tx, input.bookingId);
      if (!booking) {
        throw new DomainError("booking.not_found");
      }
      assertDueAdjustableStatus(booking.status);
      const inPounds = booking.due.currency === "LBP";
      const to = inPounds ? input.toLbp : input.toUsd;
      if (to === undefined || (inPounds ? input.toUsd : input.toLbp) !== undefined) {
        throw new DomainError("form.invalid");
      }
      const collected = await collectedOn(tx, booking);
      await writeDueIfChanged(tx, {
        bookingId: booking.id,
        currency: booking.due.currency,
        from: booking.due.amount,
        to,
        collected,
        collectionMode: booking.collectionMode,
        reason: input.reason,
        note: input.note,
        actorMembershipId: membership.membershipId,
      });
    });

    logger.info(`Booking due adjusted ${input.bookingId}`, undefined, {
      useCase: "adjustBookingDue",
      tenantId: await safeTenantId(),
    });
  } catch (error) {
    await rethrowUnexpected(error, "Adjust booking due failed", "adjustBookingDue");
  }
}
