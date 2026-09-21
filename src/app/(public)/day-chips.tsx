import { DayChips } from "@/components/day-chips";
import type { CivilDate } from "@/modules/venue/domain/availability";
import type { UiLocale } from "@/lib/locale";

/**
 * Public home date row. `?date=` on `/`. Shared DayChips owns the UI.
 */
export function PublicDayChips({
  today,
  selectedDate,
  locale,
}: {
  today: CivilDate;
  selectedDate: string;
  locale: UiLocale;
}) {
  return (
    <DayChips
      today={today}
      selectedDate={selectedDate}
      pathname="/"
      dateQueryKey="date"
      locale={locale}
    />
  );
}
