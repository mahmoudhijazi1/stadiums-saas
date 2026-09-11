import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { BOOKINGS_CANCEL, can } from "@/modules/access/domain/can";
import { assertApprovedForCancel } from "@/modules/booking/domain/decision";
import {
  findBookingForDecision,
  setApprovedCancelled,
} from "@/modules/booking/infrastructure/bookings";

/**
 * APPROVED → CANCELLED (BR-26). Auth before $transaction. No refund / Payment.
 * Occupied drops because exclusion is APPROVED-only.
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
      await setApprovedCancelled(tx, booking.id);
    });

    logger.info(`Booking cancelled ${bookingId}`);
  } catch (error) {
    await rethrowUnexpected(error, "Cancel booking failed", "cancelBooking");
  }
}
