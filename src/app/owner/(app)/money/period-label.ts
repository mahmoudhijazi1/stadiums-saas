import { formatDisplayDate } from "@/lib/format/time";
import type { UiLocale } from "@/lib/locale";
import { isCalendarMonth, type CivilRange, type PeriodKind } from "@/modules/ledger/domain/period";
import { ui } from "@/lib/ui-copy";

function noon(day: string): Date {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, date, 12));
}

/** "October" / "تشرين الأول" (the Levantine month names of the app's date formatter). */
export function monthName(day: string, locale: UiLocale): string {
  return formatDisplayDate(noon(day), locale, { month: "long" }, "UTC");
}

function shortDay(day: string, locale: UiLocale): string {
  return formatDisplayDate(noon(day), locale, { day: "numeric", month: "short" }, "UTC");
}

/** What the period chip says: a human label, never ISO dates. */
export function periodChipLabel(kind: PeriodKind, range: CivilRange, locale: UiLocale): string {
  if (kind === "today") return ui("owner.periodToday", locale);
  if (kind === "week") return ui("owner.periodWeek", locale);
  if (kind === "month" || kind === "last" || isCalendarMonth(range)) return monthName(range.from, locale);
  return rangeLabel(range, locale);
}

export function rangeLabel(range: CivilRange, locale: UiLocale): string {
  return range.from === range.to
    ? shortDay(range.from, locale)
    : `${shortDay(range.from, locale)} – ${shortDay(range.to, locale)}`;
}

/** What the comparison says it is compared with: "September", or "the previous period". */
export function comparedWithLabel(range: CivilRange, previous: CivilRange, locale: UiLocale): string {
  return isCalendarMonth(range) ? monthName(previous.from, locale) : ui("owner.vsPrevious", locale);
}
