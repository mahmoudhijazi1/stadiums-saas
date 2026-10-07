import type { UiLocale } from "@/lib/locale";
import { formatDisplayDate } from "@/lib/format-display-date";
import { ui } from "@/lib/ui-copy";
import { OWNER_TIME_ZONE } from "@/app/owner/shared";
import { businessDate } from "@/modules/booking/domain/business-day";
import { civilDaysBetween } from "@/modules/booking/domain/day-tabs";
import { slotDateKind } from "@/modules/booking/domain/home-inbox";

export function formatSlotDateLabel(
  start: Date,
  now: Date,
  locale: UiLocale,
): string {
  const kind = slotDateKind(start, now, OWNER_TIME_ZONE);
  if (kind === "today") return ui("public.today", locale);
  if (kind === "weekday") {
    return formatDisplayDate(start, locale, { weekday: "short" }, OWNER_TIME_ZONE);
  }
  return formatDisplayDate(
    start,
    locale,
    { day: "numeric", month: "short" },
    OWNER_TIME_ZONE,
  );
}

/**
 * Day of a game still owed from an earlier business day: "Yesterday", the weekday for the
 * last 6 days, else the date. Uses the business date, so a 00:30 game is its night's day.
 */
export function formatEarlierDayLabel(
  start: Date,
  now: Date,
  locale: UiLocale,
): string {
  const day = businessDate(start, OWNER_TIME_ZONE);
  const ago = civilDaysBetween(day, businessDate(now, OWNER_TIME_ZONE));
  if (ago <= 0) return ui("public.today", locale);
  if (ago === 1) return ui("owner.yesterday", locale);
  const noon = new Date(Date.UTC(day.year, day.month - 1, day.day, 12));
  return ago <= 6
    ? formatDisplayDate(noon, locale, { weekday: "long" }, OWNER_TIME_ZONE)
    : formatDisplayDate(noon, locale, { day: "numeric", month: "short" }, OWNER_TIME_ZONE);
}
