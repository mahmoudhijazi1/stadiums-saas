/**
 * The "paid until" date the web form starts with (DR-006). Pure: dates are YYYY-MM-DD strings, the
 * same calendar date the CLI stores (00:00 UTC) and the page shows in the owner time zone.
 */

/** Same day next month; a day that does not exist there (31 Jan) becomes the last day (28 or 29 Feb). */
export function addOneMonth(date: string): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

/** Today's calendar date in a time zone, as YYYY-MM-DD. */
export function calendarDateIn(timeZone: string, now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/**
 * One month after the later of the current paid-until and today (the calendar date in the time zone).
 * A lapsed paid-until therefore starts from today; with none, from today. YYYY-MM-DD strings compare
 * in date order.
 */
export function defaultPaidUntil(current: Date | null, now: Date, timeZone: string): string {
  const today = calendarDateIn(timeZone, now);
  const paidUntil = current ? current.toISOString().slice(0, 10) : today;
  return addOneMonth(paidUntil > today ? paidUntil : today);
}
