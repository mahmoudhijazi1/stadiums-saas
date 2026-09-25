import type { UiLocale } from "@/lib/locale";
import { formatDisplayDate } from "@/lib/format-display-date";
import { ui } from "@/lib/ui-copy";
import { OWNER_TIME_ZONE } from "@/app/owner/shared";
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
