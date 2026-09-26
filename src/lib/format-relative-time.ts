import { formatDisplayDate } from "@/lib/format-display-date";
import {
  formatLocalHm,
  type ClockLocale,
  type HourCycle,
} from "@/lib/format-local-hm";
import { ui, uiCount } from "@/lib/ui-copy";

const MINUTE_MS = 60_000;

export type RelativeTimeOptions = {
  locale: ClockLocale;
  timeZone: string;
  timeDisplay: HourCycle;
};

/**
 * How long ago `ts` is, in the tenant's zone.
 * Under one hour the minutes phrase wins, even across midnight.
 * A future `ts` (clock skew) is "الآن" / "Just now".
 */
export function formatRelativeTime(
  ts: Date,
  now: Date,
  options: RelativeTimeOptions,
): string {
  const { locale, timeZone, timeDisplay } = options;
  const elapsed = now.getTime() - ts.getTime();
  if (elapsed < MINUTE_MS) return ui("owner.justNow", locale);

  const minutes = Math.floor(elapsed / MINUTE_MS);
  if (minutes < 60) return uiCount("owner.agoMinutes", minutes, locale);

  const time = formatLocalHm(ts, timeZone, timeDisplay, locale);
  const days = civilDaysAfter(ts, now, timeZone);
  if (days <= 0) return `${ui("owner.today", locale)} ${time}`;
  if (days === 1) return `${ui("owner.yesterday", locale)} ${time}`;
  if (days <= 6) {
    const weekday = formatDisplayDate(ts, locale, { weekday: "long" }, timeZone);
    return `${weekday} ${time}`;
  }
  return formatDisplayDate(
    ts,
    locale,
    { day: "numeric", month: "long" },
    timeZone,
  );
}

/** Whole civil days from `ts` to `now` in `timeZone`. DST does not change the count. */
function civilDaysAfter(ts: Date, now: Date, timeZone: string): number {
  return civilDayNumber(now, timeZone) - civilDayNumber(ts, timeZone);
}

function civilDayNumber(instant: Date, timeZone: string): number {
  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
  const [year, month, day] = key.split("-").map(Number);
  return Math.round(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1) / 86_400_000);
}
