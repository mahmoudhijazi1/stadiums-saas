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

export type ClockRangeLabel = {
  /** Latin clocks and the dash, safe inside one LTR isolate. */
  digits: string;
  /**
   * Shared h12 marker after the range ("م", "ص", "PM", "AM").
   * Empty for 24-hour, and when the two clocks are different halves of the day
   * (those markers sit inside `digits` via `split`).
   */
  period: string;
  /** Noon-crossing h12: each clock keeps its own marker. */
  split?: {
    startDigits: string;
    startPeriod: string;
    endDigits: string;
    endPeriod: string;
  };
};

/**
 * One range for the screen. h12 with one period is "7:00–8:00" plus "م"
 * (or "PM"), so Arabic letters are not inside the digit run.
 */
export function formatClockRange(
  start: Date,
  end: Date,
  timeZone: string,
  hourCycle: HourCycle = "h23",
  locale: ClockLocale = "en",
): ClockRangeLabel {
  if (hourCycle === "h23") {
    return {
      digits: `${formatLocalHm(start, timeZone, "h23", locale)}–${formatLocalHm(end, timeZone, "h23", locale)}`,
      period: "",
    };
  }
  const a = clockFace(start, timeZone);
  const b = clockFace(end, timeZone);
  const startPeriod = periodMark(a.pm, locale);
  const endPeriod = periodMark(b.pm, locale);
  if (a.pm === b.pm) {
    return { digits: `${a.hm}–${b.hm}`, period: startPeriod };
  }
  return {
    digits: `${a.hm} ${startPeriod}–${b.hm} ${endPeriod}`,
    period: "",
    split: {
      startDigits: a.hm,
      startPeriod,
      endDigits: b.hm,
      endPeriod,
    },
  };
}

/** Plain string. The screen wraps `digits` in LTR isolation and leaves `period` outside. */
export function formatClockRangeText(
  start: Date,
  end: Date,
  timeZone: string,
  hourCycle: HourCycle = "h23",
  locale: ClockLocale = "en",
): string {
  const label = formatClockRange(start, end, timeZone, hourCycle, locale);
  return label.period ? `${label.digits} ${label.period}` : label.digits;
}

function clockFace(instant: Date, timeZone: string): { hm: string; pm: boolean } {
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
  const pm = (map.dayPeriod ?? "am").toLowerCase() === "pm";
  return { hm: `${map.hour ?? "0"}:${map.minute ?? "00"}`, pm };
}

function periodMark(pm: boolean, locale: ClockLocale): string {
  if (locale === "ar") return pm ? "م" : "ص";
  return pm ? "PM" : "AM";
}

/** Split a single `formatLocalHm` label so the digits can sit in an LTR isolate. */
export function splitDisplayedClock(text: string): { digits: string; period: string } {
  const match = text.match(/^(\d{1,2}:\d{2})(?: (مساءً|صباحاً|م|ص|AM|PM))?$/);
  if (!match) return { digits: text, period: "" };
  return { digits: match[1] ?? text, period: match[2] ?? "" };
}

/** Compact two already-formatted clocks into one range string. */
export function clockRangeFromLocals(startLocal: string, endLocal: string): string {
  const start = splitDisplayedClock(startLocal);
  const end = splitDisplayedClock(endLocal);
  const startPeriod = shortPeriod(start.period);
  const endPeriod = shortPeriod(end.period);
  if (startPeriod && startPeriod === endPeriod) {
    return `${start.digits}–${end.digits} ${startPeriod}`;
  }
  if (startPeriod && endPeriod) {
    return `${start.digits} ${startPeriod}–${end.digits} ${endPeriod}`;
  }
  return `${start.digits}–${end.digits}`;
}

function shortPeriod(period: string): string {
  if (period === "مساءً" || period === "م") return "م";
  if (period === "صباحاً" || period === "ص") return "ص";
  return period;
}
