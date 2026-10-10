import db from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { seriesWeekdayAndTime } from "@/modules/booking/domain/series";
import { listSeriesInfoForBookings, type BookingSeriesInfo } from "@/modules/booking/infrastructure/series";

export type SeriesInfo = BookingSeriesInfo & {
  /** 0 = Sunday ... 6 = Saturday, from the series' anchor (the stadium's local calendar). */
  weekday: number;
  /** "HH:mm", the stadium's local clock. */
  time: string;
};

/**
 * Which of these games belong to a weekly series, and how that series stands (games left, the last
 * one). One query for the whole page. Games outside a series are absent from the map. Any
 * logged-in member may look.
 */
export async function loadSeriesInfo(
  bookingIds: readonly string[],
  now: Date = new Date(),
): Promise<Map<string, SeriesInfo>> {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new DomainError("access.not_allowed");
  }
  const rows = await listSeriesInfoForBookings(db, bookingIds, now);
  return new Map(rows.map((row) => [row.bookingId, { ...row, ...seriesWeekdayAndTime(row.anchor) }]));
}
