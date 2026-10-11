/** Evening first: it is when most games are played. */
export const PERIOD_ORDER = ["evening", "afternoon", "morning"] as const;
export type DayPeriod = (typeof PERIOD_ORDER)[number];

/**
 * Evening is 17:00 up to the start of the next business day (so a 00:30 game is evening),
 * afternoon is 12:00 to 16:59, morning is the rest (from the business-day start to 11:59).
 */
export function periodOf(localHour: number, dayStartHour: number): DayPeriod {
  if (localHour < dayStartHour || localHour >= 17) return "evening";
  if (localHour >= 12) return "afternoon";
  return "morning";
}

/** The non-empty periods in display order, each with its items in the order given. */
export function groupByPeriod<T>(
  items: T[],
  localHourOf: (item: T) => number,
  dayStartHour: number,
): { period: DayPeriod; items: T[] }[] {
  return PERIOD_ORDER.map((period) => ({
    period,
    items: items.filter((item) => periodOf(localHourOf(item), dayStartHour) === period),
  })).filter((group) => group.items.length > 0);
}
