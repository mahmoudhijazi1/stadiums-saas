import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import {
  BOOKINGS_APPROVE,
  can,
} from "@/modules/access/domain/can";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { rejectOverlappingPending } from "@/modules/booking/application/reject-overlapping-pending";
import { assertPendingForDecision } from "@/modules/booking/domain/decision";
import { isExclusionViolation } from "@/modules/booking/domain/exclusion";
import { findBookingForDecision, setPendingStatus } from "@/modules/booking/infrastructure/bookings";

/**
 * Confirm a PENDING request. Overlapping PENDING on that pitch become REJECTED
 * with a slot_interests row on the approved window (BR-20 / BR-21).
 * Authorize before $transaction — session lives on platformDb (SPEC-03 guard).
 */
export async function approveBooking(bookingId: string): Promise<void> {
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

      await setPendingStatus(tx, booking.id, "APPROVED");

      await rejectOverlappingPending(tx, {
        id: booking.id,
        pitchId: booking.pitchId,
        start: booking.start,
        end: booking.end,
      });
    });

    logger.info(`Booking approved ${bookingId}`);
  } catch (error) {
    if (isExclusionViolation(error)) {
      logger.error("Approve collision", error, {
        useCase: "approveBooking",
        tenantId: await safeTenantId(),
      });
      throw new DomainError("booking.slot_unavailable");
    }
    await rethrowUnexpected(error, "Approve booking failed", "approveBooking");
  }
}
