import type { UiLocale } from "@/lib/locale";

/** Owner and public calendar dates. Arabic uses Levantine months (أيلول). */
const DISPLAY_TIME_ZONE = "Asia/Beirut";

export function formatDisplayDate(
  instant: Date,
  locale: UiLocale,
  options: Intl.DateTimeFormatOptions,
  timeZone = DISPLAY_TIME_ZONE,
): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en" : "ar-LB", {
    ...options,
    timeZone,
    numberingSystem: "latn",
  }).format(instant);
}
