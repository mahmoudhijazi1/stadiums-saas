import db from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { seriesWeekdayAndTime } from "@/modules/booking/domain/series";
import { listActiveSeries, type ActiveSeriesRow } from "@/modules/booking/infrastructure/series";

export type WeeklyBooking = ActiveSeriesRow & {
  /** 0 = Sunday ... 6 = Saturday and "HH:mm", the stadium's local clock. */
  weekday: number;
  time: string;
};

/** A series with this many games left or fewer is "ending soon". */
export const ENDING_SOON_LEFT = 2;

/**
 * Every weekly series that still has an upcoming game, soonest first, in ONE query. The More list
 * uses all of it, the Today reminder uses the ones `endingSoon` picks, and the person page asks for
 * one person. Any logged-in member may look.
 */
export async function listWeeklyBookings(input: { personId?: string; now?: Date } = {}): Promise<WeeklyBooking[]> {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new DomainError("access.not_allowed");
  }
  const rows = await listActiveSeries(db, input.now ?? new Date(), input.personId);
  return rows.map((row) => ({ ...row, ...seriesWeekdayAndTime(row.anchor) }));
}

export function endingSoon(rows: readonly WeeklyBooking[]): WeeklyBooking[] {
  return rows.filter((row) => row.left <= ENDING_SOON_LEFT);
}
