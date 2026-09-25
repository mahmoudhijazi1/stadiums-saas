import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { summarizePersonBookings, type PersonStats } from "@/modules/booking/domain/person-stats";
import { listPersonStatRows } from "@/modules/booking/infrastructure/bookings";

/**
 * Games played, no-shows, total paid, owes now. Owes now uses personOwedOnBooking.
 * Logged-in membership may look (same as the day list).
 */
export async function getPersonBookingStats(personId: string): Promise<PersonStats> {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new DomainError("access.not_allowed");
  }

  try {
    const rows = await listPersonStatRows(db, personId);
    return summarizePersonBookings(rows, new Date());
  } catch (error) {
    return await rethrowUnexpected(
      error,
      "Person booking stats failed",
      "getPersonBookingStats",
    );
  }
}
