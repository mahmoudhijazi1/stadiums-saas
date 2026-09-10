import db from "@/lib/db";
import { logger } from "@/lib/logger";
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
    throw new Error("Not allowed");
  }

  try {
    await db.$transaction(async (tx) => {
      const booking = await findBookingForDecision(tx, bookingId);
      if (!booking) {
        throw new Error("Booking not found");
      }
      assertPendingForDecision(booking.status);
      await setPendingStatus(tx, booking.id, "REJECTED");
    });

    logger.info(`Booking rejected ${bookingId}`);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Not allowed" ||
        error.message === "Booking not found" ||
        error.message === "Only a pending request can be approved or rejected")
    ) {
      throw error;
    }
    logger.error("Reject booking failed", error);
    throw error;
  }
}
