import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { BOOKINGS_APPROVE, can } from "@/modules/access/domain/can";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { missedPending } from "@/modules/booking/domain/expired-request";
import {
  listPendingBookings,
  setPendingStatus,
} from "@/modules/booking/infrastructure/bookings";

/**
 * Dismiss every PENDING request whose slot has already started.
 * Same status as a manual reject (REJECTED) and no stored reason — Booking
 * has no reason column; the WhatsApp line is optional and separate.
 * Future pending rows are left alone.
 */
export async function dismissMissedRequests(now = new Date()): Promise<number> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, BOOKINGS_APPROVE)) {
    throw new DomainError("access.not_allowed");
  }

  let dismissed = 0;
  try {
    await db.$transaction(async (tx) => {
      const pending = await listPendingBookings(tx);
      for (const row of missedPending(pending, now)) {
        await setPendingStatus(tx, row.id, "REJECTED");
        dismissed += 1;
      }
    });

    logger.info(`Dismissed ${dismissed} missed requests`, undefined, {
      useCase: "dismissMissedRequests",
      tenantId: await safeTenantId(),
    });
    return dismissed;
  } catch (error) {
    return await rethrowUnexpected(
      error,
      "Dismiss missed requests failed",
      "dismissMissedRequests",
    );
  }
}
