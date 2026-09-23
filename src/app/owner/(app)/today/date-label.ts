import type { UiLocale } from "@/lib/locale";
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
    return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar", {
      weekday: "short",
      timeZone: OWNER_TIME_ZONE,
    }).format(start);
  }
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar", {
    day: "numeric",
    month: "numeric",
    timeZone: OWNER_TIME_ZONE,
  }).format(start);
}
