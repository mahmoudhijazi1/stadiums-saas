import { formatDisplayDate } from "@/lib/format/time";
import type { UiLocale } from "@/lib/locale";
import { nightOfLabel } from "@/lib/copy";
import { businessDate, isNightStart } from "@/modules/booking/domain/business-day";

const TIME_ZONE = "Asia/Beirut";

/**
 * "night of Friday" / "ليلة الجمعة" for a game that starts between midnight and the tenant's day start, else null.
 * The weekday is the game's business date (the evening it belongs to). Dates and clock
 * times elsewhere stay real; this is only a hint beside them.
 */
export function nightHint(
  start: Date,
  locale: UiLocale,
  dayStartHour: number,
): string | null {
  if (!isNightStart(start, dayStartHour, TIME_ZONE)) return null;
  const date = businessDate(start, dayStartHour, TIME_ZONE);
  const weekday = formatDisplayDate(
    new Date(Date.UTC(date.year, date.month - 1, date.day, 12)),
    locale,
    { weekday: "long" },
    TIME_ZONE,
  );
  return nightOfLabel(weekday, locale);
}

/**
 * The `{day}` of every WhatsApp message: the real calendar date, plus the night hint
 * for a 00:00–05:59 start ("السبت، 26 أيلول (ليلة الجمعة)").
 */
export function messageDayLabel(
  start: Date,
  locale: UiLocale,
  dayStartHour: number,
): string {
  const day = formatDisplayDate(start, locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const hint = nightHint(start, locale, dayStartHour);
  return hint ? `${day} (${hint})` : day;
}
