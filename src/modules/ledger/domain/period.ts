import { DomainError } from "@/lib/errors";

/**
 * Ledger period in the owner's zone (SPEC-08). Civil YYYY-MM-DD → UTC
 * bounds at midnight there. Inclusive start, exclusive end (day after `to`).
 * Intl offsets, not Date#getHours. Ledger does not import Expense or Venue.
 */

const CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function periodBoundsFromCivilRange(
  from: string,
  to: string,
  timeZone: string,
): { startInclusive: Date; endExclusive: Date } {
  const startDay = parseCivilDate(from);
  const endDay = parseCivilDate(to);
  if (civilCompare(startDay, endDay) > 0) {
    throw new DomainError("ledger.invalid_period");
  }

  return {
    startInclusive: zonedLocalToUtc(startDay, 0, 0, timeZone),
    endExclusive: zonedLocalToUtc(nextCivilDay(endDay), 0, 0, timeZone),
  };
}

/**
 * First and last civil day of the month that contains `now` in `timeZone`.
 */
export function currentMonthCivilRange(
  now: Date,
  timeZone: string,
): { from: string; to: string } {
  const parts = zonedParts(now, timeZone);
  const fromDay: CivilDate = {
    year: parts.year,
    month: parts.month,
    day: 1,
  };
  const lastOfMonth = new Date(Date.UTC(parts.year, parts.month, 0));
  const toDay: CivilDate = {
    year: lastOfMonth.getUTCFullYear(),
    month: lastOfMonth.getUTCMonth() + 1,
    day: lastOfMonth.getUTCDate(),
  };
  return { from: formatCivil(fromDay), to: formatCivil(toDay) };
}

type CivilDate = { year: number; month: number; day: number };

function parseCivilDate(yyyyMmDd: string): CivilDate {
  const match = CIVIL_DATE.exec(yyyyMmDd);
  if (!match) {
    throw new DomainError("ledger.invalid_period");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() + 1 !== month ||
    probe.getUTCDate() !== day
  ) {
    throw new DomainError("ledger.invalid_period");
  }

  return { year, month, day };
}

function nextCivilDay(date: CivilDate): CivilDate {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day + 1));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

function civilCompare(a: CivilDate, b: CivilDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

function formatCivil(date: CivilDate): string {
  return `${date.year}-${pad2(date.month)}-${pad2(date.day)}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function zonedLocalToUtc(
  date: CivilDate,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const asUtc = Date.UTC(date.year, date.month - 1, date.day, hour, minute, 0);
  const offsetMs = tzOffsetMs(new Date(asUtc), timeZone);
  const candidate = new Date(asUtc - offsetMs);
  const correctedOffset = tzOffsetMs(candidate, timeZone);
  return new Date(asUtc - correctedOffset);
}

function tzOffsetMs(instant: Date, timeZone: string): number {
  const parts = zonedParts(instant, timeZone);
  const wallAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return wallAsUtc - instant.getTime();
}

function zonedParts(
  instant: Date,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(instant)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

// ---------------------------------------------------------------------------
// Named periods for the Money tab (calendar days in the owner's zone).

export type PeriodKind = "today" | "week" | "month" | "last" | "custom";
export type CivilRange = { from: string; to: string };

/** `YYYY-MM-DD` plus a whole number of days (negative goes back). */
export function addCivilDays(day: string, days: number): string {
  const parsed = parseCivilDate(day);
  const utc = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  return formatCivil({
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  });
}

/** Days in a range, both ends included. */
export function civilRangeLength(range: CivilRange): number {
  const a = parseCivilDate(range.from);
  const b = parseCivilDate(range.to);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000) + 1;
}

function todayCivil(now: Date, timeZone: string): string {
  const parts = zonedParts(now, timeZone);
  return formatCivil({ year: parts.year, month: parts.month, day: parts.day });
}

function monthRange(year: number, month: number): CivilRange {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: formatCivil({ year, month, day: 1 }),
    to: formatCivil({ year, month, day: last }),
  };
}

/**
 * The range for a named period, in calendar days of `timeZone`. The week runs Monday to
 * Sunday and "this week" ends on the Sunday (future days simply hold nothing yet). Custom
 * is not named: callers pass their own from/to.
 */
export function rangeForPeriod(kind: Exclude<PeriodKind, "custom">, now: Date, timeZone: string): CivilRange {
  const today = todayCivil(now, timeZone);
  if (kind === "today") return { from: today, to: today };
  const parsed = parseCivilDate(today);
  if (kind === "week") {
    const weekday = (new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay() + 6) % 7; // Monday = 0
    const from = addCivilDays(today, -weekday);
    return { from, to: addCivilDays(from, 6) };
  }
  if (kind === "month") return monthRange(parsed.year, parsed.month);
  const previous = parsed.month === 1 ? { year: parsed.year - 1, month: 12 } : { year: parsed.year, month: parsed.month - 1 };
  return monthRange(previous.year, previous.month);
}

/** True when the range is exactly one calendar month (so it is compared with the month before). */
export function isCalendarMonth(range: CivilRange): boolean {
  const from = parseCivilDate(range.from);
  const month = monthRange(from.year, from.month);
  return range.from === month.from && range.to === month.to;
}

/**
 * The period a range is compared with. A calendar month is compared with the month before
 * it ("vs September"); anything else with the same number of days straight before it.
 */
export function previousRange(range: CivilRange): CivilRange {
  if (isCalendarMonth(range)) {
    const from = parseCivilDate(range.from);
    const previous = from.month === 1 ? { year: from.year - 1, month: 12 } : { year: from.year, month: from.month - 1 };
    return monthRange(previous.year, previous.month);
  }
  const length = civilRangeLength(range);
  return { from: addCivilDays(range.from, -length), to: addCivilDays(range.from, -1) };
}
