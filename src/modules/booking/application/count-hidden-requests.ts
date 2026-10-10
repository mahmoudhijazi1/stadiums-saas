import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { hiddenInboxCount } from "@/modules/booking/domain/pending-inbox";
import { countPendingInboxTotals } from "@/modules/booking/infrastructure/bookings";

/**
 * How many pending requests the capped inbox (`listPendingRequests`) leaves out, from the real
 * totals. 0 in every normal case. Same access rule as the list it explains.
 */
export async function countHiddenRequests(): Promise<number> {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new DomainError("access.not_allowed");
  }
  try {
    return hiddenInboxCount(await countPendingInboxTotals(db, new Date()));
  } catch (error) {
    return await rethrowUnexpected(error, "Count hidden requests failed", "countHiddenRequests");
  }
}
