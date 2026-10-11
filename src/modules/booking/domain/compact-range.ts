const MARKER = /^(.*) (م|ص|AM|PM)$/;

/**
 * A time range with the period marker once, at the end: "5:00 PM" and "6:00 PM" become "5:00" and
 * "6:00 PM". When the markers differ ("11:00 AM", "12:00 PM") or there is none (24-hour), both stay
 * as they are.
 */
export function compactRange(startLocal: string, endLocal: string): { start: string; end: string } {
  const start = MARKER.exec(startLocal);
  const end = MARKER.exec(endLocal);
  if (start && end && start[2] === end[2]) return { start: start[1]!, end: endLocal };
  return { start: startLocal, end: endLocal };
}
