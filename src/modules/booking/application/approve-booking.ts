import db from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  BOOKINGS_APPROVE,
  can,
} from "@/modules/access/domain/can";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { assertPendingForDecision } from "@/modules/booking/domain/decision";
import { overlappingPendingIds } from "@/modules/booking/domain/offered-slot";
import {
  findBookingForDecision,
  findRequesterPersonId,
  insertSlotInterest,
  listPendingBookings,
  setPendingStatus,
} from "@/modules/booking/infrastructure/bookings";

const EXPECTED = new Set([
  "Not allowed",
  "Booking not found",
  "Only a pending request can be approved or rejected",
]);

/**
 * Postgres exclusion (BR-24) — two APPROVED windows on the same pitch.
 * Prisma 7 + adapter-pg wraps the 23P01; walk cause / message, do not guess P2002.
 */
function isExclusionViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let i = 0; i < 8 && current; i++) {
    if (typeof current === "object" && current !== null && "code" in current) {
      const code = String((current as { code: unknown }).code);
      if (code === "23P01") return true;
    }
    const text =
      current instanceof Error
        ? `${current.message} ${current.stack ?? ""}`
        : String(current);
    if (
      text.includes("23P01") ||
      text.includes("Booking_approved_during_excl")
    ) {
      return true;
    }
    if (typeof current === "object" && current !== null && "cause" in current) {
      current = (current as { cause: unknown }).cause;
    } else {
      break;
    }
  }
  return false;
}

/**
 * Confirm a PENDING request. Overlapping PENDING on that pitch become REJECTED
 * with a slot_interests row on the approved window (BR-20 / BR-21).
 * Authorize before $transaction — session lives on platformDb (SPEC-03 guard).
 */
export async function approveBooking(bookingId: string): Promise<void> {
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

      await setPendingStatus(tx, booking.id, "APPROVED");

      const pending = await listPendingBookings(tx);
      const loserIds = overlappingPendingIds(
        { pitchId: booking.pitchId, start: booking.start, end: booking.end },
        pending
          .filter((row) => row.id !== booking.id)
          .map((row) => ({
            id: row.id,
            pitchId: row.pitchId,
            start: row.start,
            end: row.end,
          })),
      );

      for (const loserId of loserIds) {
        await setPendingStatus(tx, loserId, "REJECTED");
        const personId = await findRequesterPersonId(tx, loserId);
        if (!personId) {
          throw new Error("Requester not found");
        }
        await insertSlotInterest(tx, {
          pitchId: booking.pitchId,
          start: booking.start,
          end: booking.end,
          personId,
        });
      }
    });

    logger.info(`Booking approved ${bookingId}`);
  } catch (error) {
    if (error instanceof Error && EXPECTED.has(error.message)) {
      throw error;
    }
    if (isExclusionViolation(error)) {
      logger.error("Approve collision", error);
      throw new Error("Slot no longer available");
    }
    logger.error("Approve booking failed", error);
    throw error;
  }
}
