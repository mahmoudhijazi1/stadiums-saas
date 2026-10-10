import {
  addCalendarDays,
  compareCivilDate,
  type CivilDate,
} from "@/modules/venue/domain/availability";

/**
 * How many days after today a player can open on the public page and request a slot (security
 * audit N-9). The page clamps `?date=` to it and `requestPublicSlot` refuses a start beyond it,
 * so a hand-made request cannot book a year ahead. Day `today + PUBLIC_FUTURE_DAYS` is the last
 * allowed one.
 */
export const PUBLIC_FUTURE_DAYS = 60;

/** The last civil day the public page offers. */
export function lastPublicDay(today: CivilDate): CivilDate {
  return addCalendarDays(today, PUBLIC_FUTURE_DAYS);
}

/** True when `day` is not later than the last public day. Past days are the caller's business. */
export function isWithinPublicWindow(day: CivilDate, today: CivilDate): boolean {
  return compareCivilDate(day, lastPublicDay(today)) <= 0;
}

/** The day the public page shows: `?date=` when it is inside the window, else `fallback`. */
export function clampPublicDay(
  requested: CivilDate | null,
  today: CivilDate,
  fallback: CivilDate,
): CivilDate {
  if (!requested) return fallback;
  return isWithinPublicWindow(requested, today) ? requested : fallback;
}
