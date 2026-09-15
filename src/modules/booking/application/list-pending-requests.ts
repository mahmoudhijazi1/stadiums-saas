import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { listPendingBookings } from "@/modules/booking/infrastructure/bookings";

/**
 * PENDING inbox for the URL tenant. Logged-in membership required; staff may look
 * without bookings.approve (BR-97). Isolation is the guard, not a passed tenant id.
 */
export async function listPendingRequests() {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new DomainError("access.not_allowed");
  }

  try {
    return await listPendingBookings(db);
  } catch (error) {
    return await rethrowUnexpected(
      error,
      "List pending requests failed",
      "listPendingRequests",
    );
  }
}
