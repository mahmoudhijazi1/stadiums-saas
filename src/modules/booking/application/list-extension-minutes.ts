import db from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { EXTENSION_STEP_MINUTES } from "@/modules/booking/domain/extension-plan";

/**
 * How many minutes each of these games was extended by (30 per EXTENSION due change), for the
 * indicator next to the time range. Games never extended are absent from the map. Any logged-in
 * member may look; the tenant comes from the request.
 */
export async function listExtensionMinutes(bookingIds: readonly string[]): Promise<Map<string, number>> {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new DomainError("access.not_allowed");
  }
  const minutes = new Map<string, number>();
  if (bookingIds.length === 0) return minutes;

  const rows = await db.bookingDueChange.groupBy({
    by: ["bookingId"],
    where: { bookingId: { in: [...bookingIds] }, reason: "EXTENSION" },
    _count: { _all: true },
  });
  for (const row of rows) {
    minutes.set(row.bookingId, row._count._all * EXTENSION_STEP_MINUTES);
  }
  return minutes;
}
