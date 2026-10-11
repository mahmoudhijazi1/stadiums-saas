import type { CivilDate } from "@/modules/venue/domain/availability";
import { formatDisplayDate } from "@/lib/format/time";
import type { UiLocale } from "@/lib/locale";

/** The weekday of a civil day: short in English ("Fri"), full in Arabic. No timezone shift. */
export function weekdayLabel(date: CivilDate, locale: UiLocale): string {
  return formatDisplayDate(
    new Date(Date.UTC(date.year, date.month - 1, date.day, 12)),
    locale,
    { weekday: locale === "en" ? "short" : "long" },
    "UTC",
  );
}
