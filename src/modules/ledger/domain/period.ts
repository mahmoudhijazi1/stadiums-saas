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
    throw new Error(
      `Invalid ledger period "${from}" > "${to}"`,
    );
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
    throw new Error(
      `Invalid ledger date "${yyyyMmDd}" (need YYYY-MM-DD)`,
    );
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
    throw new Error(
      `Invalid ledger date "${yyyyMmDd}" (need a real calendar day)`,
    );
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
