import db from "@/lib/db";
import { countActionablePending } from "@/modules/booking/infrastructure/bookings";

/**
 * How many requests are waiting, by the same rule as the live badge (PENDING, slot still ahead).
 * No membership check: it returns one number for a system alert, never a row. The tenant comes
 * from the request. Called by app/ right after a public request, to hand the count to the push alert.
 */
export async function countPendingForAlert(now = new Date()): Promise<number> {
  return (await countActionablePending(db, now)).pendingCount;
}
