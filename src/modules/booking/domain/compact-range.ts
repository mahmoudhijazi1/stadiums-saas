import { shortPeriodOf, splitDisplayedClock } from "@/lib/format/time";

/**
 * A time range with the period marker once, at the end, in both languages: "5:00 PM" and "6:00 PM"
 * become "5:00" and "6:00 PM"; the Arabic formatter's long markers ("4:00 مساءً", "5:00 مساءً")
 * become "4:00" and "5:00 م". Built on the shared clock helpers (`splitDisplayedClock`,
 * `shortPeriodOf`). When the markers differ ("11:00 AM", "12:00 PM") or there is none (24-hour),
 * each clock keeps its own marker (short form) or none.
 */
export function compactRange(startLocal: string, endLocal: string): { start: string; end: string } {
  const start = splitDisplayedClock(startLocal);
  const end = splitDisplayedClock(endLocal);
  const startPeriod = shortPeriodOf(start.period);
  const endPeriod = shortPeriodOf(end.period);
  if (startPeriod && startPeriod === endPeriod) return { start: start.digits, end: `${end.digits} ${endPeriod}` };
  return {
    start: startPeriod ? `${start.digits} ${startPeriod}` : start.digits,
    end: endPeriod ? `${end.digits} ${endPeriod}` : end.digits,
  };
}
