import Link from "next/link";
import {
  addCalendarDays,
  compareCivilDate,
  formatCivilDate,
  type CivilDate,
} from "@/modules/venue/domain/availability";
import type { AvailabilityLevel } from "@/modules/venue/domain/availability-level";
import { dayTabClass } from "@/modules/venue/ui/day-chip-class";
import { weekdayLabel } from "@/modules/venue/ui/weekday-label";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { cn } from "cn";

/**
 * Every day from today to the last one the page offers, as stacked day tabs like the
 * owner's (weekday on top, day number below), with no box: only the selected day is a pill. A server component: the tabs
 * are Links, the row scrolls sideways. No past days. `pathname` and `dateQueryKey` are props like
 * DayChips, so the page decides the URL.
 */
export function DayStrip({
  today,
  lastDay,
  selectedDate,
  pathname,
  dateQueryKey,
  levels,
  locale = "ar",
}: {
  today: CivilDate;
  lastDay: CivilDate;
  selectedDate: string;
  pathname: string;
  dateQueryKey: string;
  /** How full each day is, by yyyy-mm-dd: dots under the number. Omitted: no dots. */
  levels?: Record<string, AvailabilityLevel>;
  locale?: UiLocale;
}) {
  const days: CivilDate[] = [];
  for (let day = today; compareCivilDate(day, lastDay) <= 0; day = addCalendarDays(day, 1)) {
    days.push(day);
  }

  return (
    <nav aria-label={ui("public.day", locale)}>
      <ul className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        {days.map((day, offset) => {
          const date = formatCivilDate(day);
          const selected = date === selectedDate;
          return (
            <li key={date} className="w-14 shrink-0">
              <Link
                href={{ pathname, query: { [dateQueryKey]: date } }}
                scroll={false}
                aria-current={selected ? "date" : undefined}
                className={dayTabClass(selected)}
              >
                <span className="flex w-full min-w-0 flex-col items-center gap-0.5">
                  <span className={cn("w-full truncate text-center", selected ? "text-selected-ink" : "text-ink-muted")}>
                    {offset === 0 ? ui("public.today", locale) : weekdayLabel(day, locale)}
                  </span>
                  <LtrIsolate
                    className={cn("text-sm leading-none font-extrabold tabular-nums", selected ? "text-selected-ink" : "text-ink")}
                  >
                    {String(day.day)}
                  </LtrIsolate>
                  {levels ? <AvailabilityDots level={levels[date] ?? 0} selected={selected} /> : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Three dots, two, one, or an empty ring for a full or closed day.. */
function AvailabilityDots({ level, selected }: { level: AvailabilityLevel; selected: boolean }) {
  const tone = selected ? "bg-selected-ink" : "bg-ink-muted";
  return (
    <span aria-hidden className="flex h-[5px] items-center gap-[3px]" data-level={level}>
      {level === 0 ? (
        <span className={cn("size-[5px] rounded-full border", selected ? "border-selected-ink" : "border-ink-muted")} />
      ) : (
        Array.from({ length: level }, (_, index) => <span key={index} className={cn("size-[3px] rounded-full", tone)} />)
      )}
    </span>
  );
}
