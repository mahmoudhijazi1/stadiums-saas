/**
 * Local wall-clock for a UTC instant in a named IANA zone.
 * Shared by the app and WhatsApp. h23 → "19:00" (midnight "00", not "24").
 * h12 English → "7:00 PM". h12 Arabic → "7:00 مساءً". Western digits either way.
 */

export type HourCycle = "h23" | "h12";
export type ClockLocale = "ar" | "en";

export function formatLocalHm(
  instant: Date,
  timeZone: string,
  hourCycle: HourCycle = "h23",
  locale: ClockLocale = "en",
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
    const hour = map.hour ?? "0";
    const minute = map.minute ?? "00";
    const pm = (map.dayPeriod ?? "am").toLowerCase() === "pm";
    if (locale === "ar") {
      return `${hour}:${minute} ${pm ? "مساءً" : "صباحاً"}`;
    }
    return `${hour}:${minute} ${pm ? "PM" : "AM"}`;
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
