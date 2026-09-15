/**
 * Local wall-clock for a UTC instant in a named IANA zone.
 * Default hourCycle h23 → "16:00" (midnight "00", not "24").
 * Optional h12 → "4:00 PM" (Western digits + Latin AM/PM).
 */

export type HourCycle = "h23" | "h12";

export function formatLocalHm(
  instant: Date,
  timeZone: string,
  hourCycle: HourCycle = "h23",
): string {
  if (hourCycle === "h12") {
    const dtf = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      hourCycle: "h12",
    });
    const map: Record<string, string> = {};
    for (const part of dtf.formatToParts(instant)) {
      if (part.type !== "literal") map[part.type] = part.value;
    }
    const period = (map.dayPeriod ?? "am").toUpperCase();
    return `${map.hour ?? "0"}:${map.minute ?? "00"} ${period}`;
  }

  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(instant)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  let hour = map.hour ?? "00";
  if (hour === "24") hour = "00";
  return `${hour}:${map.minute ?? "00"}`;
}
