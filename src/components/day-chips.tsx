import Link from "next/link";
import {
  compareCivilDate,
  formatCivilDate,
  type CivilDate,
} from "@/modules/venue/domain/availability";
import { DateCalendarChip } from "@/components/date-calendar-chip";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";
import { cn } from "cn";

const WINDOW_DAYS = 5;

/**
 * Same-week dates as Next.js Link (client transition, not a GET form).
 * Calendar chip is the only client child. Path + date query key are props
 * so public (`date`) and owner Book (`bookOn`) share one row.
 */
export function DayChips({
  tenantSlug,
  today,
  selectedDate,
  pathname,
  dateQueryKey,
  locale = "ar",
}: {
  tenantSlug: string;
  today: CivilDate;
  selectedDate: string;
  pathname: string;
  dateQueryKey: string;
  locale?: UiLocale;
}) {
  const days = Array.from({ length: WINDOW_DAYS }, (_, offset) =>
    addCivilDays(today, offset),
  );
  const inWindow = days.some((day) => formatCivilDate(day) === selectedDate);
  const selectedCivil = parseCivilYmd(selectedDate);
  const isPast =
    selectedCivil !== null && compareCivilDate(selectedCivil, today) < 0;
  const calendarSelected = !inWindow && !isPast;

  return (
    <nav aria-label={ui("public.day", locale)}>
      <ul className="flex gap-1.5">
        {days.map((day, offset) => {
          const date = formatCivilDate(day);
          const selected = date === selectedDate;
          return (
            <li key={date} className="min-w-0 flex-1">
              <Link
                href={{
                  pathname,
                  query: { tenant: tenantSlug, [dateQueryKey]: date },
                }}
                scroll={false}
                aria-current={selected ? "date" : undefined}
                className={dayChipClass(selected)}
              >
                {offset === 0 ? (
                  ui("public.today", locale)
                ) : offset === 1 ? (
                  ui("public.tomorrow", locale)
                ) : (
                  <span className="flex flex-col items-center gap-0.5">
                    <span className="leading-tight">
                      {weekdayName(day, locale)}
                    </span>
                    <LtrIsolate className="text-sm font-semibold leading-none">
                      {String(day.day)}
                    </LtrIsolate>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
        <li className="min-w-0 flex-1">
          <DateCalendarChip
            tenantSlug={tenantSlug}
            selectedDate={selectedDate}
            todayYmd={formatCivilDate(today)}
            isSelected={calendarSelected}
            className={dayChipClass(calendarSelected)}
            otherDateLabel={ui("public.otherDate", locale)}
            pathname={pathname}
            dateQueryKey={dateQueryKey}
          />
        </li>
      </ul>
    </nav>
  );
}

function dayChipClass(selected: boolean): string {
  return cn(
    "flex h-14 w-full min-w-0 flex-col items-center justify-center rounded-xl border bg-card px-1 py-1.5 text-xs shadow-sm outline-none transition-all",
    "hover:bg-accent/50 hover:border-primary/40",
    "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50",
    selected && "border-primary ring-2 ring-inset ring-primary",
  );
}

function addCivilDays(date: CivilDate, days: number): CivilDate {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

function parseCivilYmd(value: string): CivilDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function weekdayName(date: CivilDate, locale: UiLocale): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar", {
    weekday: locale === "en" ? "short" : "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(date.year, date.month - 1, date.day, 12)));
}
