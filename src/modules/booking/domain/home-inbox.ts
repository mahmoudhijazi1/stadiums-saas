import Decimal from "decimal.js";
import {
  civilDateInTimeZone,
  compareCivilDate,
  type CivilDate,
} from "@/modules/venue/domain/availability";

export type PendingLike = {
  id: string;
  pitchId: string;
  pitchName: string;
  start: Date;
  end: Date;
  requestedAt: Date;
  requesterName: string;
  requesterPhone: string | null;
};

export type PendingSlotGroup<T extends PendingLike = PendingLike> = {
  pitchId: string;
  pitchName: string;
  start: Date;
  end: Date;
  requesters: T[];
};

/**
 * Group already-sorted pending rows by pitch + window. Caller sorts
 * `lower(during), requestedAt` (soonest slot, BR-17 inside a slot).
 */
export function groupPendingBySlot<T extends PendingLike>(
  rows: T[],
): PendingSlotGroup<T>[] {
  const groups: PendingSlotGroup<T>[] = [];
  const index = new Map<string, PendingSlotGroup<T>>();

  for (const row of rows) {
    const key = `${row.pitchId}|${row.start.toISOString()}|${row.end.toISOString()}`;
    let group = index.get(key);
    if (!group) {
      group = {
        pitchId: row.pitchId,
        pitchName: row.pitchName,
        start: row.start,
        end: row.end,
        requesters: [],
      };
      index.set(key, group);
      groups.push(group);
    }
    group.requesters.push(row);
  }

  return groups;
}

export type UpcomingStatus = "upcoming" | "due" | "paid";

export function upcomingStatus(
  start: Date,
  remaining: Decimal,
  now: Date,
): UpcomingStatus {
  if (remaining.lte(0)) return "paid";
  if (start.getTime() <= now.getTime()) return "due";
  return "upcoming";
}

export type SlotDateKind = "today" | "weekday" | "date";

const WEEKDAY_SPAN_DAYS = 6;

export function slotDateKind(
  start: Date,
  now: Date,
  timeZone: string,
): SlotDateKind {
  const day = civilDateInTimeZone(start, timeZone);
  const today = civilDateInTimeZone(now, timeZone);
  const delta = civilOrdinal(day) - civilOrdinal(today);
  if (delta === 0) return "today";
  if (Math.abs(delta) <= WEEKDAY_SPAN_DAYS) return "weekday";
  return "date";
}

export function partitionHomeConfirmed<T extends { start: Date; remaining: Decimal }>(
  rows: T[],
  now: Date,
  timeZone: string,
): { overdue: T[]; today: T[]; later: T[] } {
  const today = civilDateInTimeZone(now, timeZone);
  const overdue: T[] = [];
  const todayRows: T[] = [];
  const later: T[] = [];

  for (const row of rows) {
    const day = civilDateInTimeZone(row.start, timeZone);
    const cmp = compareCivilDate(day, today);
    if (cmp < 0) {
      if (row.remaining.gt(0)) overdue.push(row);
      continue;
    }
    if (cmp === 0) todayRows.push(row);
    else later.push(row);
  }

  return { overdue, today: todayRows, later };
}

function civilOrdinal(date: CivilDate): number {
  return Date.UTC(date.year, date.month - 1, date.day) / 86_400_000;
}
