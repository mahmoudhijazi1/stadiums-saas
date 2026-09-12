import Link from "next/link";
import type { CivilDate } from "@/modules/venue/domain/availability";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { PublicDateCalendarChip } from "@/app/public-date-calendar-chip";
import { ui } from "@/lib/ui-copy";
import { cn } from "cn";

const WINDOW_DAYS = 6;

/**
 * Same-week public dates as Next.js Link (client transition, not a GET
 * form / not a raw <a>). Calendar chip is the only client child.
 */
export function PublicDayChips({
  tenantSlug,
  today,
  selectedDate,
}: {
  tenantSlug: string;
  today: CivilDate;
  selectedDate: string;
}) {
  const days = Array.from({ length: WINDOW_DAYS }, (_, offset) =>
    addCivilDays(today, offset),
  );
  const inWindow = days.some((day) => formatCivilDate(day) === selectedDate);

  return (
    <nav aria-label={ui("public.day")}>
      <ul className="flex gap-1.5">
        {days.map((day, offset) => {
          const date = formatCivilDate(day);
          const selected = date === selectedDate;
          return (
            <li key={date} className="min-w-0 flex-1">
              <Link
                href={{ pathname: "/", query: { tenant: tenantSlug, date } }}
                scroll={false}
                aria-current={selected ? "date" : undefined}
                className={dayChipClass(selected)}
              >
                {offset === 0 ? (
                  ui("public.today")
                ) : offset === 1 ? (
                  ui("public.tomorrow")
                ) : (
                  <span className="flex flex-col items-center gap-0.5">
                    <span className="leading-tight">{weekdayName(day)}</span>
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
          <PublicDateCalendarChip
            tenantSlug={tenantSlug}
            selectedDate={selectedDate}
            isSelected={!inWindow}
            className={dayChipClass(!inWindow)}
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

function formatCivilDate(date: CivilDate): string {
  const month = String(date.month).padStart(2, "0");
  const day = String(date.day).padStart(2, "0");
  return `${date.year}-${month}-${day}`;
}

function weekdayName(date: CivilDate): string {
  return new Intl.DateTimeFormat("ar", {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(date.year, date.month - 1, date.day, 12)));
}
