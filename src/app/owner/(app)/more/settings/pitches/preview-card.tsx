"use client";

import { useState } from "react";
import Decimal from "decimal.js";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import type { UiLocale } from "@/lib/locale";
import {
  gameLongerLabel,
  previewSummaryLabel,
  ui,
  unusedTimeLabel,
} from "@/lib/ui-copy";
import { cn } from "cn";
import {
  civilDateInTimeZone,
  addCalendarDays,
  generateSlotsForDay,
  localWallClock,
} from "@/modules/venue/domain/availability";
import {
  formatClock,
  type DayRow,
  type HourCycleChoice,
} from "@/modules/venue/domain/pitch-form-model";
import { WEEKDAYS, type ScheduleConfig, type Weekday } from "@/modules/venue/schemas/schedule-config";

const TIME_ZONE = "Asia/Beirut";

function weekdayOf(date: { year: number; month: number; day: number }): Weekday {
  const utcDay = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  return (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const)[utcDay]!;
}

function windowMinutes(row: DayRow): number {
  const [fh, fm] = row.from.split(":").map(Number) as [number, number];
  const [th, tm] = row.to.split(":").map(Number) as [number, number];
  const from = fh * 60 + fm;
  const to = th * 60 + tm;
  return to > from ? to - from : to + 24 * 60 - from;
}

/**
 * What a player would see on the next date of the chosen weekday: the real slots from
 * `generateSlotsForDay` (same function the booking pages use), computed here from the
 * form's current state. No query.
 */
export function PreviewCard({
  locale,
  config,
  rows,
  hourCycle,
  slotMinutes,
}: {
  locale: UiLocale;
  /** Null while the form is not valid yet (blank price, zero length). */
  config: ScheduleConfig | null;
  rows: DayRow[];
  hourCycle: HourCycleChoice;
  slotMinutes: number;
}) {
  const [today] = useState(() => civilDateInTimeZone(new Date(), TIME_ZONE));
  const [picked, setPicked] = useState<Weekday | null>(null);

  const nextOpen = Array.from({ length: 7 }, (_, offset) => weekdayOf(addCalendarDays(today, offset))).find(
    (day) => rows.find((row) => row.day === day)?.open,
  );
  const selected =
    picked && rows.find((row) => row.day === picked)?.open ? picked : (nextOpen ?? null);
  if (!config || !selected) return null;

  const offset = Array.from({ length: 7 }, (_, i) => i).find((i) => weekdayOf(addCalendarDays(today, i)) === selected) ?? 0;
  const date = addCalendarDays(today, offset);
  const slots = generateSlotsForDay({ config, localDate: date, timeZone: TIME_ZONE, occupied: [] });
  const row = rows.find((item) => item.day === selected)!;
  const prices = slots.map((slot) => slot.priceUsd);
  const fallback = new Decimal(config.defaultPriceUsd);
  const min = prices.reduce((a, b) => (b.lt(a) ? b : a), prices[0] ?? fallback);
  const max = prices.reduce((a, b) => (b.gt(a) ? b : a), prices[0] ?? fallback);
  const leftover = windowMinutes(row) - slots.length * slotMinutes;

  return (
    <section aria-label={ui("owner.pitchPreview", locale)} className="flex flex-col gap-3 rounded-xl border bg-card p-3">
      <h3 className="type-section">{ui("owner.pitchPreview", locale)}</h3>
      <div className="flex flex-wrap gap-2">
        {WEEKDAYS.map((day) => {
          const open = rows.find((item) => item.day === day)?.open ?? false;
          const on = day === selected;
          return (
            <button
              key={day}
              type="button"
              disabled={!open}
              aria-pressed={on}
              onClick={() => setPicked(day)}
              className={cn(
                "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border px-3 type-label outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                on ? "border-transparent bg-selected text-selected-ink" : "bg-card",
                !open && "opacity-40",
              )}
            >
              {ui(`owner.wd.${day}`, locale)}
            </button>
          );
        })}
      </div>

      {slots.length > 0 ? (
        <>
          <p className="type-label">
            {previewSummaryLabel(slots.length, min.toFixed(2), max.toFixed(2), locale)}
          </p>
          <ul className="flex flex-wrap gap-2">
            {slots.map((slot) => {
              const wall = localWallClock(slot.start, TIME_ZONE);
              const hhmm = `${String(wall.hour).padStart(2, "0")}:${String(wall.minute).padStart(2, "0")}`;
              return (
                <li
                  key={slot.start.toISOString()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 type-label text-muted-foreground"
                >
                  <LtrIsolate>{formatClock(hhmm, hourCycle, locale)}</LtrIsolate>
                  {min.eq(max) ? null : <LtrIsolate>${slot.priceUsd.toFixed(0)}</LtrIsolate>}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      {slots.length === 0 ? (
        <p className="type-secondary">{gameLongerLabel(slotMinutes, locale)}</p>
      ) : leftover > 0 ? (
        <p className="type-secondary">{unusedTimeLabel(leftover, locale)}</p>
      ) : null}
    </section>
  );
}
