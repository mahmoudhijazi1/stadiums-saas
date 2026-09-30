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
  lockPendingRowsInOrder,
  setPendingStatus,
} from "@/modules/booking/infrastructure/bookings";

/**
 * Dismiss every PENDING request whose slot has already started.
 * Same status as a manual reject (REJECTED) and no stored reason — Booking
 * has no reason column; the WhatsApp line is optional and separate.
 * Future pending rows are left alone. Rows are locked in id order first
 * (`lockPendingRowsInOrder`), the order approve uses, so the two cannot deadlock.
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
      // Lock in id order (same as approve), then skip rows a concurrent
      // "They played" already decided.
      const missedIds = missedPending(pending, now).map((row) => row.id);
      const stillPending = await lockPendingRowsInOrder(tx, missedIds);
      for (const id of [...missedIds].sort()) {
        if (!stillPending.has(id)) continue;
        await setPendingStatus(tx, id, "REJECTED");
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
