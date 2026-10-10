import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { OWNER_FUTURE_DAYS } from "@/modules/booking/domain/start-day";
import { buildDayTabs } from "@/modules/booking/domain/day-tabs";
import {
  addCalendarDays,
  formatCivilDate,
  type CivilDate,
} from "@/modules/venue/domain/availability";
import { DayTabs } from "./day-tabs";

/** Date strip for Today (FotMob style). `today` is the business date (06:00 rule). */
export function OwnerDayStrip({
  day,
  today,
  locale,
}: {
  day: CivilDate;
  today: CivilDate;
  locale: UiLocale;
}) {
  return (
    <DayTabs
      tabs={buildDayTabs({ today, selected: day, locale })}
      todayDate={formatCivilDate(today)}
      todayNumber={today.day}
      maxDate={formatCivilDate(addCalendarDays(today, OWNER_FUTURE_DAYS))}
      calendarLabel={ui("owner.monthCalendar", locale)}
      locale={locale}
    />
  );
}
