import { formatDisplayDate } from "@/lib/format-display-date";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";
import { OWNER_FUTURE_DAYS } from "@/modules/booking/domain/start-day";
import {
  addCalendarDays,
  compareCivilDate,
  formatCivilDate,
  type CivilDate,
} from "@/modules/venue/domain/availability";

/** Days shown before today in the Today date strip. */
export const DAY_TABS_BACK = 14;

const OWNER_TIME_ZONE = "Asia/Beirut";

export type DayTab = {
  /** `YYYY-MM-DD`, the `?date=` value. */
  date: string;
  kind: "yesterday" | "today" | "tomorrow" | "day";
  /** "أمس" / "اليوم" / "غداً", or weekday + number ("الجمعة 9" / "Fri 9"). */
  label: string;
  dayNumber: number;
};

/**
 * The tabs of the Today strip, oldest first: 14 days back from `today`, up to
 * OWNER_FUTURE_DAYS ahead. `today` is the business date (06:00 rule), so before 06:00
 * Beirut "today" is still the previous calendar date. A selected day older than the
 * window is kept so the strip always contains it.
 */
export function buildDayTabs(input: {
  today: CivilDate;
  selected: CivilDate;
  locale: UiLocale;
}): DayTab[] {
  const { today, selected, locale } = input;
  const backStart = addCalendarDays(today, -DAY_TABS_BACK);
  const first = compareCivilDate(selected, backStart) < 0 ? selected : backStart;
  const last = addCalendarDays(today, OWNER_FUTURE_DAYS);

  const tabs: DayTab[] = [];
  for (
    let cursor = first;
    compareCivilDate(cursor, last) <= 0;
    cursor = addCalendarDays(cursor, 1)
  ) {
    const offset = daysBetween(today, cursor);
    const kind =
      offset === -1 ? "yesterday" : offset === 0 ? "today" : offset === 1 ? "tomorrow" : "day";
    tabs.push({
      date: formatCivilDate(cursor),
      kind,
      label: tabLabel(cursor, kind, locale),
      dayNumber: cursor.day,
    });
  }
  return tabs;
}

function daysBetween(from: CivilDate, to: CivilDate): number {
  const a = Date.UTC(from.year, from.month - 1, from.day);
  const b = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((b - a) / 86_400_000);
}

function tabLabel(day: CivilDate, kind: DayTab["kind"], locale: UiLocale): string {
  if (kind === "yesterday") return ui("owner.yesterday", locale);
  if (kind === "today") return ui("public.today", locale);
  if (kind === "tomorrow") return ui("public.tomorrow", locale);
  const noon = new Date(Date.UTC(day.year, day.month - 1, day.day, 12));
  const weekday = formatDisplayDate(noon, locale, { weekday: "short" }, OWNER_TIME_ZONE);
  return `${weekday} ${day.day}`;
}
