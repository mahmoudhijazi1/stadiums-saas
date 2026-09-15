import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { BOOKINGS_CANCEL, can } from "@/modules/access/domain/can";
import {
  assertApprovedForCancel,
  assertNotPastUnpaidCancel,
} from "@/modules/booking/domain/decision";
import {
  findBookingForDecision,
  setApprovedCancelled,
} from "@/modules/booking/infrastructure/bookings";
import { remainingDue } from "@/modules/payment/domain/collect";
import { sumCollectedUsd } from "@/modules/payment/infrastructure/payments";

/**
 * APPROVED → CANCELLED (BR-26). Auth before $transaction. No refund / Payment write.
 * Occupied drops because exclusion is APPROVED-only. Past unpaid is refused (BR-49).
 */
export async function cancelBooking(bookingId: string): Promise<void> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, BOOKINGS_CANCEL)) {
    throw new DomainError("access.not_allowed");
  }

  try {
    await db.$transaction(async (tx) => {
      const booking = await findBookingForDecision(tx, bookingId);
      if (!booking) {
        throw new DomainError("booking.not_found");
      }
      assertApprovedForCancel(booking.status);

      const collected = await sumCollectedUsd(tx, "BOOKING", booking.id);
      assertNotPastUnpaidCancel({
        start: booking.start,
        remaining: remainingDue(booking.priceUsd, collected),
        now: new Date(),
      });

      await setApprovedCancelled(tx, booking.id);
    });

    logger.info(`Booking cancelled ${bookingId}`, undefined, {
      useCase: "cancelBooking",
      tenantId: await safeTenantId(),
    });
  } catch (error) {
    await rethrowUnexpected(error, "Cancel booking failed", "cancelBooking");
  }
}
