import { formatDisplayDate, formatLocalHm, type HourCycle } from "@/lib/format/time";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { localTimeToUtc } from "@/modules/venue/domain/availability";
import type { SeriesAnchor } from "@/modules/booking/domain/series";

const TIME_ZONE = "Asia/Beirut";

/** "Tue" and "8:00 PM" for a series' anchor, in the member's language and clock. */
export function weeklyWeekdayAndTime(
  anchor: SeriesAnchor,
  locale: UiLocale,
  hourCycle: HourCycle,
): { weekday: string; time: string } {
  const noon = new Date(Date.UTC(anchor.date.year, anchor.date.month - 1, anchor.date.day, 12));
  return {
    weekday: formatDisplayDate(noon, locale, { weekday: "short" }, TIME_ZONE),
    time: formatLocalHm(
      localTimeToUtc(anchor.date, anchor.hour, anchor.minute, TIME_ZONE),
      TIME_ZONE,
      hourCycle,
      locale,
    ),
  };
}

/** "↻ Weekly · every Tue 8:00 PM · 5 left · until Dec 1" (or "... · ended"). */
export function seriesRowLine(input: {
  anchor: SeriesAnchor;
  left: number;
  lastStart: Date | null;
  locale: UiLocale;
  hourCycle: HourCycle;
}): string {
  const { weekday, time } = weeklyWeekdayAndTime(input.anchor, input.locale, input.hourCycle);
  if (input.left <= 0 || !input.lastStart) {
    return ui("owner.seriesRowEnded", input.locale).replace("{weekday}", weekday).replace("{time}", time);
  }
  const until = formatDisplayDate(
    input.lastStart,
    input.locale,
    { day: "numeric", month: "short" },
    TIME_ZONE,
  );
  return ui("owner.seriesRowLine", input.locale)
    .replace("{weekday}", weekday)
    .replace("{time}", time)
    .replace("{left}", String(input.left))
    .replace("{until}", until);
}
