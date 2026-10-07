import {
  addCalendarDays,
  localTimeToUtc,
  localWallClock,
  type CivilDate,
} from "@/modules/venue/domain/availability";

import { DEFAULT_DAY_START_HOUR } from "@/lib/tenant-settings";

/**
 * A business day runs from `dayStartHour` to the same hour the next day, local time (a
 * tenant setting, 0..6; 6 unless the owner chose otherwise). A game at 00:30 Saturday
 * with a 6 start belongs to Friday night. Every function below takes the hour explicitly.
 * This constant is only the default for tenants that never set one.
 */
export const BUSINESS_DAY_ROLLOVER_HOUR = DEFAULT_DAY_START_HOUR;

const OWNER_TIME_ZONE = "Asia/Beirut";

/**
 * The business date of an instant: the local civil date, or the day before when the
 * local wall-clock hour is before `dayStartHour`. Uses the local hour, never "instant
 * minus N hours", so the boundary stays at that local hour on DST-change days.
 */
export function businessDate(
  instant: Date,
  dayStartHour: number,
  timeZone: string = OWNER_TIME_ZONE,
): CivilDate {
  const wall = localWallClock(instant, timeZone);
  return wall.hour < dayStartHour ? addCalendarDays(wall.date, -1) : wall.date;
}

/**
 * Half-open UTC range of business date D: [D at hour, D+1 at hour) local time.
 * Timezone-aware (no fixed offset). Callers filter `lower(during)` on it, so the
 * ("tenantId", lower(during)) index still applies.
 */
export function businessDayUtcRange(
  date: CivilDate,
  dayStartHour: number,
  timeZone: string = OWNER_TIME_ZONE,
): { start: Date; end: Date } {
  return {
    start: localTimeToUtc(date, dayStartHour, 0, timeZone),
    end: localTimeToUtc(addCalendarDays(date, 1), dayStartHour, 0, timeZone),
  };
}

/**
 * A game that starts between local midnight and the day start: its calendar date is
 * the day after its business date. The UI adds "night of <weekday>" for these.
 */
export function isNightStart(
  start: Date,
  dayStartHour: number,
  timeZone: string = OWNER_TIME_ZONE,
): boolean {
  return localWallClock(start, timeZone).hour < dayStartHour;
}

/**
 * Chosen day-start hours (0..6) that fall strictly inside an opening window, e.g. hour 1
 * inside 18:00 to 02:00. A game after that hour would show on the next day, so the
 * settings sheet warns (it never blocks). Hour 0 is the calendar day boundary.
 */
export function startHoursInsideWindows(
  windows: ReadonlyArray<{ open: string; close: string }>,
): number[] {
  const minutes = (clock: string) => {
    const [h, m] = clock.split(":").map(Number) as [number, number];
    return h * 60 + m;
  };
  const inside = new Set<number>();
  for (const window of windows) {
    const open = minutes(window.open);
    const close = minutes(window.close);
    for (let hour = 0; hour <= 6; hour += 1) {
      const at = hour * 60;
      const within = open < close ? at > open && at < close : at > open || at < close;
      if (within) inside.add(hour);
    }
  }
  return [...inside].sort((a, b) => a - b);
}
