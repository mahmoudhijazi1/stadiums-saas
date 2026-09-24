import {
  addCalendarDays,
  civilDateInTimeZone,
  compareCivilDate,
  type CivilDate,
} from "@/modules/venue/domain/availability";

/** Owner Today may open this many civil days after today. Past days are unlimited. */
export const OWNER_FUTURE_DAYS = 60;

const OWNER_TIME_ZONE = "Asia/Beirut";
const CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The day a game belongs to: the Beirut civil day of its start.
 * The end instant is ignored, so 23:00–00:30 stays on the start day.
 */
export function bookingStartDay(
  start: Date,
  timeZone: string = OWNER_TIME_ZONE,
): CivilDate {
  return civilDateInTimeZone(start, timeZone);
}

/**
 * `?date=` for Today. Missing, unparsable, or more than OWNER_FUTURE_DAYS
 * ahead of `today` becomes `today`. Past dates stay.
 */
export function resolveOwnerDay(
  dateParam: string | undefined,
  today: CivilDate,
): CivilDate {
  const parsed = parseCivilDate(dateParam);
  if (!parsed) return today;
  const last = addCalendarDays(today, OWNER_FUTURE_DAYS);
  if (compareCivilDate(parsed, last) > 0) return today;
  return parsed;
}

function parseCivilDate(value: string | undefined): CivilDate | null {
  if (!value) return null;
  const match = CIVIL_DATE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() + 1 !== month ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}
