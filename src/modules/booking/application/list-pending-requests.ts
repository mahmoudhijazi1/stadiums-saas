import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { listPendingInbox } from "@/modules/booking/infrastructure/bookings";

/**
 * PENDING inbox for the URL tenant. Logged-in membership required; staff may look
 * without bookings.approve (BR-97). Isolation is the guard, not a passed tenant id.
 * Capped for the page (S-8): the next 200 upcoming and the 50 latest missed.
 */
export async function listPendingRequests() {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new DomainError("access.not_allowed");
  }

  try {
    return await listPendingInbox(db, new Date());
  } catch (error) {
    return await rethrowUnexpected(
      error,
      "List pending requests failed",
      "listPendingRequests",
    );
  }
}
