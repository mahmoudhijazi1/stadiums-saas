import {
  addCalendarDays,
  localTimeToUtc,
  localWallClock,
  type CivilDate,
} from "@/modules/venue/domain/availability";

/**
 * A stadium's day runs from 06:00 to 06:00 local time, so a game that starts at 00:30
 * Saturday belongs to Friday night. One constant today; written so it can become a
 * tenant setting later (no column yet). Opening before 06:00 is not supported.
 */
export const BUSINESS_DAY_ROLLOVER_HOUR = 6;

const OWNER_TIME_ZONE = "Asia/Beirut";

/**
 * The business date of an instant: the local civil date, or the day before when the
 * local wall-clock hour is before the rollover. Uses the local hour, never "instant
 * minus 6 hours", so the boundary stays at 06:00 local on DST-change days.
 */
export function businessDate(
  instant: Date,
  timeZone: string = OWNER_TIME_ZONE,
  rolloverHour: number = BUSINESS_DAY_ROLLOVER_HOUR,
): CivilDate {
  const wall = localWallClock(instant, timeZone);
  return wall.hour < rolloverHour ? addCalendarDays(wall.date, -1) : wall.date;
}

/**
 * Half-open UTC range of business date D: [D rollover, D+1 rollover) local time.
 * Timezone-aware (no fixed offset). Callers filter `lower(during)` on it, so the
 * ("tenantId", lower(during)) index still applies.
 */
export function businessDayUtcRange(
  date: CivilDate,
  timeZone: string = OWNER_TIME_ZONE,
  rolloverHour: number = BUSINESS_DAY_ROLLOVER_HOUR,
): { start: Date; end: Date } {
  return {
    start: localTimeToUtc(date, rolloverHour, 0, timeZone),
    end: localTimeToUtc(addCalendarDays(date, 1), rolloverHour, 0, timeZone),
  };
}

/**
 * A game that starts between local midnight and the rollover: its calendar date is
 * the day after its business date. The UI adds "night of <weekday>" for these.
 */
export function isNightStart(
  start: Date,
  timeZone: string = OWNER_TIME_ZONE,
  rolloverHour: number = BUSINESS_DAY_ROLLOVER_HOUR,
): boolean {
  return localWallClock(start, timeZone).hour < rolloverHour;
}
