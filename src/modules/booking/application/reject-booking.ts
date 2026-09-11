import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { rethrowUnexpected } from "@/lib/use-case-error";
import {
  BOOKINGS_APPROVE,
  can,
} from "@/modules/access/domain/can";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { assertPendingForDecision } from "@/modules/booking/domain/decision";
import {
  findBookingForDecision,
  setPendingStatus,
} from "@/modules/booking/infrastructure/bookings";

/**
 * Manual reject: this row only, PENDING → REJECTED. No slot_interests (BR-21 is
 * automatic on approve). Same permission as approve. Authorize before $transaction.
 */
export async function rejectBooking(bookingId: string): Promise<void> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, BOOKINGS_APPROVE)) {
    throw new DomainError("access.not_allowed");
  }

  try {
    await db.$transaction(async (tx) => {
      const booking = await findBookingForDecision(tx, bookingId);
      if (!booking) {
        throw new DomainError("booking.not_found");
      }
      assertPendingForDecision(booking.status);
      await setPendingStatus(tx, booking.id, "REJECTED");
    });

    logger.info(`Booking rejected ${bookingId}`);
  } catch (error) {
    await rethrowUnexpected(error, "Reject booking failed", "rejectBooking");
  }
}
