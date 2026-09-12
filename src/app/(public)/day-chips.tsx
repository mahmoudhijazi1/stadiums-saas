import { DayChips } from "@/components/day-chips";
import type { CivilDate } from "@/modules/venue/domain/availability";
import type { UiLocale } from "@/lib/locale";

/**
 * Public home date row. `?date=` on `/`. Shared DayChips owns the UI.
 */
export function PublicDayChips({
  tenantSlug,
  today,
  selectedDate,
  locale,
}: {
  tenantSlug: string;
  today: CivilDate;
  selectedDate: string;
  locale: UiLocale;
}) {
  return (
    <DayChips
      tenantSlug={tenantSlug}
      today={today}
      selectedDate={selectedDate}
      pathname="/"
      dateQueryKey="date"
      locale={locale}
    />
  );
}
