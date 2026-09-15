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
import { resolveOfferedSlot } from "@/modules/booking/domain/offered-slot";
import {
  findBookingForDecision,
  listApprovedRanges,
  setPendingStatus,
  type ApprovedRangeRow,
} from "@/modules/booking/infrastructure/bookings";
import { civilDateInTimeZone } from "@/modules/venue/domain/availability";
import { findPitchById } from "@/modules/venue/infrastructure/pitches";
import { parseScheduleConfig } from "@/modules/venue/schemas/schedule-config";
import type { TenantTx } from "@/lib/db";

const TIME_ZONE = "Asia/Beirut";

export type ApproveBookingDeps = {
  /**
   * Optional seam for integration tests that force the TOCTOU exclusion path
   * (local prisma dev is single-connection, so a real race cannot).
   */
  listApprovedRanges?: (
    tx: TenantTx,
    pitchId?: string,
  ) => Promise<ApprovedRangeRow[]>;
};

/**
 * Confirm a PENDING request. Overlapping PENDING on that pitch become REJECTED
 * with a slot_interests row on the approved window (BR-20 / BR-21).
 * Authorize before $transaction — session lives on platformDb (SPEC-03 guard).
 */
export async function approveBooking(
  bookingId: string,
  deps: ApproveBookingDeps = {},
): Promise<void> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, BOOKINGS_APPROVE)) {
    throw new DomainError("access.not_allowed");
  }

  const listApproved = deps.listApprovedRanges ?? listApprovedRanges;

  try {
    await db.$transaction(async (tx) => {
      const booking = await findBookingForDecision(tx, bookingId);
      if (!booking) {
        throw new DomainError("booking.not_found");
      }
      assertPendingForDecision(booking.status);

      const pitch = await findPitchById(tx, booking.pitchId);
      if (!pitch) {
        throw new DomainError("booking.pitch_not_found");
      }
      const config = parseScheduleConfig(pitch.scheduleConfig);
      const approved = await listApproved(tx, booking.pitchId);
      resolveOfferedSlot({
        config,
        localDate: civilDateInTimeZone(booking.start, TIME_ZONE),
        timeZone: TIME_ZONE,
        start: booking.start,
        end: booking.end,
        now: new Date(),
        occupied: approved.map((row) => ({ start: row.start, end: row.end })),
      });

      await setPendingStatus(tx, booking.id, "APPROVED");

      await rejectOverlappingPending(tx, {
        id: booking.id,
        pitchId: booking.pitchId,
        start: booking.start,
        end: booking.end,
      });
    });

    logger.info(`Booking approved ${bookingId}`, undefined, {
      useCase: "approveBooking",
      tenantId: await safeTenantId(),
    });
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
