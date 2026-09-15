import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { BOOKINGS_NO_SHOW, can } from "@/modules/access/domain/can";
import {
  assertApprovedForNoShow,
  assertEndedForNoShow,
} from "@/modules/booking/domain/decision";
import {
  findBookingForDecision,
  setApprovedNoShow,
} from "@/modules/booking/infrastructure/bookings";

/**
 * APPROVED → NO_SHOW (BR-22). Auth before $transaction. No Payment write.
 * Unpaid is allowed — Collect still works (SPEC-14 / BR-49).
 */
export async function recordNoShow(bookingId: string): Promise<void> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, BOOKINGS_NO_SHOW)) {
    throw new DomainError("access.not_allowed");
  }

  try {
    await db.$transaction(async (tx) => {
      const booking = await findBookingForDecision(tx, bookingId);
      if (!booking) {
        throw new DomainError("booking.not_found");
      }
      assertApprovedForNoShow(booking.status);
      assertEndedForNoShow({ end: booking.end, now: new Date() });
      await setApprovedNoShow(tx, booking.id);
    });

    logger.info(`Booking no-show ${bookingId}`, undefined, {
      useCase: "recordNoShow",
      tenantId: await safeTenantId(),
    });
  } catch (error) {
    await rethrowUnexpected(error, "Record no-show failed", "recordNoShow");
  }
}
