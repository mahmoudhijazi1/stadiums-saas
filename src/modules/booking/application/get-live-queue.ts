import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import type { LiveQueueSnapshot } from "@/modules/booking/domain/live-queue";
import { countActionablePending } from "@/modules/booking/infrastructure/bookings";

/**
 * Cheap snapshot for the owner shell poll. Actionable pending only.
 * Tenant comes from the request, not from the caller.
 */
export async function getLiveQueue(now = new Date()): Promise<LiveQueueSnapshot> {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new DomainError("access.not_allowed");
  }

  try {
    const row = await countActionablePending(db, now);
    return {
      pendingCount: row.pendingCount,
      latestRequestedAt: row.latestRequestedAt
        ? row.latestRequestedAt.toISOString()
        : null,
    };
  } catch (error) {
    return await rethrowUnexpected(error, "Live queue failed", "getLiveQueue");
  }
}
