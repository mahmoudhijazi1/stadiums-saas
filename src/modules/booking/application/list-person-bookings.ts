import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import {
  listPersonBookingRows,
  type PersonHistoryRow,
} from "@/modules/booking/infrastructure/bookings";

export const PERSON_BOOKING_PAGE = 20;

export type PersonBookingPage = {
  rows: PersonHistoryRow[];
  nextCursor: { start: Date; id: string } | null;
};

/**
 * Newest participations first. Keyset on (start, booking id). One extra row
 * tells the page there is more.
 */
export async function listPersonBookings(
  personId: string,
  cursor: { start: Date; id: string } | null,
): Promise<PersonBookingPage> {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new DomainError("access.not_allowed");
  }

  try {
    const loaded = await listPersonBookingRows(
      db,
      personId,
      cursor,
      PERSON_BOOKING_PAGE + 1,
    );
    const hasMore = loaded.length > PERSON_BOOKING_PAGE;
    const rows = hasMore ? loaded.slice(0, PERSON_BOOKING_PAGE) : loaded;
    const last = rows[rows.length - 1];
    return {
      rows,
      nextCursor: hasMore && last ? { start: last.start, id: last.id } : null,
    };
  } catch (error) {
    return await rethrowUnexpected(
      error,
      "List person bookings failed",
      "listPersonBookings",
    );
  }
}
