import Link from "next/link";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";
import { OWNER_TIME_ZONE } from "@/app/owner/shared";
import { OWNER_FUTURE_DAYS } from "@/modules/booking/domain/start-day";
import {
  addCalendarDays,
  compareCivilDate,
  formatCivilDate,
  type CivilDate,
} from "@/modules/venue/domain/availability";
import { LtrIsolate } from "@/components/ui/ltr-isolate";

export function OwnerDayStrip({
  day,
  today,
  locale,
}: {
  day: CivilDate;
  today: CivilDate;
  locale: UiLocale;
}) {
  const prev = formatCivilDate(addCalendarDays(day, -1));
  const nextDay = addCalendarDays(day, 1);
  const last = addCalendarDays(today, OWNER_FUTURE_DAYS);
  const nextDisabled = compareCivilDate(nextDay, last) > 0;
  const isToday = compareCivilDate(day, today) === 0;
  const label = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: OWNER_TIME_ZONE,
  }).format(new Date(Date.UTC(day.year, day.month - 1, day.day, 12)));

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/owner/today?date=${prev}`}
        aria-label={ui("owner.prevDay", locale)}
        className="grid size-11 shrink-0 place-items-center rounded-full outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <ChevronLeft aria-hidden className="size-5 rtl:rotate-180" />
      </Link>
      <p className="min-w-0 flex-1 text-center text-sm font-medium">
        {isToday ? (
          <>
            {ui("public.today", locale)}
            <span aria-hidden> · </span>
          </>
        ) : null}
        <LtrIsolate>{label}</LtrIsolate>
      </p>
      {nextDisabled ? (
        <span
          aria-disabled="true"
          aria-label={ui("owner.nextDay", locale)}
          className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground opacity-40"
        >
          <ChevronRight aria-hidden className="size-5 rtl:rotate-180" />
        </span>
      ) : (
        <Link
          href={`/owner/today?date=${formatCivilDate(nextDay)}`}
          aria-label={ui("owner.nextDay", locale)}
          className="grid size-11 shrink-0 place-items-center rounded-full outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ChevronRight aria-hidden className="size-5 rtl:rotate-180" />
        </Link>
      )}
      {isToday ? null : (
        <Link
          href="/owner/today"
          className="inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {ui("public.today", locale)}
        </Link>
      )}
      <button
        type="button"
        disabled
        aria-label={ui("owner.monthCalendar", locale)}
        className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground opacity-40"
      >
        <Calendar aria-hidden className="size-5" />
      </button>
    </div>
  );
}
