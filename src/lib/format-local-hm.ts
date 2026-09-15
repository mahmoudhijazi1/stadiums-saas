/**
 * Local wall-clock HH:mm for a UTC instant in a named IANA zone.
 * Uses formatToParts + h23 so midnight is "00", not "24".
 */
export function formatLocalHm(instant: Date, timeZone: string): string {
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
