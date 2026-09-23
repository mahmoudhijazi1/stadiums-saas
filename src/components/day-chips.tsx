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

/** How many civil days the day-chip strip shows (public + Book). Not Home’s COMING_DAYS booking horizon. */
const WINDOW_DAYS = 5;

/**
 * Same-week dates as Next.js Link (client transition, not a GET form).
 * Calendar chip is the only client child. Path + date query key are props
 * so public (`date`) and owner Book (`bookOn`) share one row.
 */
export function DayChips({
  today,
  selectedDate,
  pathname,
  dateQueryKey,
  locale = "ar",
}: {
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
                  query: { [dateQueryKey]: date },
                }}
                scroll={false}
                aria-current={selected ? "date" : undefined}
                className={dayChipClass(selected)}
              >
                <span className="flex flex-col items-center gap-0.5">
                  <span
                    className={
                      selected ? "text-selected-ink" : "text-ink-muted"
                    }
                  >
                    {offset === 0
                      ? ui("public.today", locale)
                      : weekdayName(day, locale)}
                  </span>
                  <LtrIsolate
                    className={cn(
                      "font-display text-sm leading-none font-extrabold tabular-nums",
                      selected ? "text-selected-ink" : "text-ink",
                    )}
                  >
                    {String(day.day)}
                  </LtrIsolate>
                </span>
              </Link>
            </li>
          );
        })}
        <li className="min-w-0 flex-1">
          <DateCalendarChip
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
    "flex h-14 w-full min-w-0 flex-col items-center justify-center rounded-[var(--radius-md)] border px-1 py-1.5 text-xs outline-none",
    "transition-[background-color,color,border-color] duration-150 ease-out motion-reduce:transition-none",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand",
    selected
      ? "border-transparent bg-selected text-selected-ink"
      : "border-line bg-surface text-ink hover:bg-surface-2",
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
