/**
 * Expense “when” (SPEC-07). Civil date in the owner’s zone → UTC instant
 * at 12:00 there. Intl offsets, not Date#getHours (server local time).
 * Expense does not import Venue — same idea, own copy.
 */

const CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function occurredAtFromCivilDate(
  yyyyMmDd: string,
  timeZone: string,
): Date {
  const match = CIVIL_DATE.exec(yyyyMmDd);
  if (!match) {
    throw new Error(
      `Invalid expense date "${yyyyMmDd}" (need YYYY-MM-DD)`,
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
      `Invalid expense date "${yyyyMmDd}" (need a real calendar day)`,
    );
  }

  return zonedLocalToUtc({ year, month, day }, 12, 0, timeZone);
}

type CivilDate = { year: number; month: number; day: number };

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
