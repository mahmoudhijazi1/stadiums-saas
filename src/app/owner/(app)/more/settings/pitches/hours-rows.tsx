"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";
import { cn } from "cn";
import { startHoursInsideWindows } from "@/modules/booking/domain/business-day";
import {
  crossesMidnight,
  formatClock,
  formatHoursSummary,
  rowsToHours,
  sameHoursEveryDay,
  type DayRow,
  type HourCycleChoice,
} from "@/modules/venue/domain/pitch-form-model";
import { TimeSheet } from "./time-sheet";

type Picking = { day: DayRow["day"]; field: "from" | "to" } | null;

/** Open / Closed switch: just the toggle, 44px hit area; the day name labels it for readers. */
function DaySwitch({
  checked,
  onChange,
  name,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  name: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={name}
      onClick={() => onChange(!checked)}
      className="-mx-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span
        aria-hidden
        className={cn(
          "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors motion-reduce:transition-none",
          checked ? "border-transparent bg-action-ink" : "bg-muted",
        )}
      >
        <span
          className={cn(
            // The track is 24px with a 1px border, so its inside is 22px by 38px. An 18px disc centred
            // vertically leaves 2px above and below, and 2px at either end (0.5 / 1.125rem = 2 / 18px).
            "absolute top-1/2 size-[18px] -translate-y-1/2 rounded-full bg-background shadow transition-[inset-inline-start] motion-reduce:transition-none",
            checked ? "inset-s-[1.125rem]" : "inset-s-0.5",
          )}
        />
      </span>
    </button>
  );
}

/** A time chip: 36px pill inside a 44px hit area. */
function TimeChip({
  value,
  note,
  noteLabel,
  onClick,
}: {
  value: string;
  note?: string;
  /** Spoken form of `note` ("next day" for "+1"). */
  noteLabel?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center outline-none focus-visible:[&>span]:ring-[3px] focus-visible:[&>span]:ring-ring/50"
    >
      <span className="inline-flex h-9 items-center gap-1 rounded-full border px-2.5 type-label">
        <LtrIsolate>{value}</LtrIsolate>
        {note ? (
          <span className="type-caption">
            <span aria-hidden>{note}</span>
            <span className="sr-only">{noteLabel}</span>
          </span>
        ) : null}
      </span>
    </button>
  );
}

/**
 * Opening hours as seven day rows. Each day has an Open / Closed switch and, when open,
 * two chips (from, to) that open the time sheet. The submitted field is the stored
 * hours-groups JSON (`rowsToHours`), so the server validates exactly what it did before.
 */
export function HoursRows({
  locale,
  rows,
  onChange,
  hourCycle,
  dayStartHour,
}: {
  locale: UiLocale;
  rows: DayRow[];
  onChange: (rows: DayRow[]) => void;
  hourCycle: HourCycleChoice;
  dayStartHour: number;
}) {
  const setRows = (next: DayRow[] | ((current: DayRow[]) => DayRow[])) =>
    onChange(typeof next === "function" ? next(rows) : next);
  const [picking, setPicking] = useState<Picking>(null);

  const groups = rowsToHours(rows);
  const pickedRow = picking ? rows.find((row) => row.day === picking.day) : undefined;
  const runsPastDayStart = startHoursInsideWindows(
    groups.map((group) => ({ open: group.open, close: group.close })),
  ).includes(dayStartHour);

  function update(day: DayRow["day"], patch: Partial<DayRow>) {
    setRows((current) => current.map((row) => (row.day === day ? { ...row, ...patch } : row)));
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 type-section">
        {ui("owner.pitchHours", locale)}
      </legend>
      <input type="hidden" name="hoursGroupsJson" value={JSON.stringify(groups)} />

      <p className="type-secondary" aria-live="polite">
        {formatHoursSummary(rows, locale, hourCycle)}
      </p>

      <ul className="flex flex-col overflow-hidden rounded-xl border">
        {rows.map((row) => {
          const next = crossesMidnight(row.from, row.to);
          const dayName = ui(`owner.dayFull.${row.day}`, locale);
          return (
            <li
              key={row.day}
              className="flex min-h-14 flex-wrap items-center gap-x-1 border-b bg-card px-3 py-1 last:border-b-0"
            >
              <span className={cn("w-[4.5rem] shrink-0 type-label", !row.open && "text-muted-foreground")}>
                {dayName}
              </span>
              <DaySwitch checked={row.open} onChange={(open) => update(row.day, { open })} name={dayName} />
              {row.open ? (
                <span className="ms-auto flex items-center">
                  <TimeChip
                    value={formatClock(row.from, hourCycle, locale)}
                    onClick={() => setPicking({ day: row.day, field: "from" })}
                  />
                  <span aria-hidden className="type-secondary px-0.5">–</span>
                  <TimeChip
                    value={formatClock(row.to, hourCycle, locale)}
                    note={next ? "+1" : undefined}
                    noteLabel={next ? ui("owner.pitchNextDay", locale) : undefined}
                    onClick={() => setPicking({ day: row.day, field: "to" })}
                  />
                </span>
              ) : (
                <span className="ms-auto type-secondary">{ui("owner.dayClosed", locale)}</span>
              )}
            </li>
          );
        })}
      </ul>

      {runsPastDayStart ? (
        <p role="status" className="type-secondary text-owed">
          {ui("owner.dayStartWarning", locale)}
        </p>
      ) : null}

      <Button
        type="button"
        variant="secondary"
        onClick={() => setRows((current) => sameHoursEveryDay(current))}
      >
        {ui("owner.sameHoursEveryDay", locale)}
      </Button>

      {picking && pickedRow ? (
        <TimeSheet
          key={`${picking.day}-${picking.field}`}
          open
          onOpenChange={(open) => {
            if (!open) setPicking(null);
          }}
          title={ui(picking.field === "from" ? "owner.pitchOpen" : "owner.pitchClose", locale)}
          value={picking.field === "from" ? pickedRow.from : pickedRow.to}
          opensAt={picking.field === "to" ? pickedRow.from : undefined}
          exclude={picking.field === "to" ? pickedRow.from : pickedRow.to}
          onPick={(hhmm) => update(picking.day, picking.field === "from" ? { from: hhmm } : { to: hhmm })}
          hourCycle={hourCycle}
          locale={locale}
        />
      ) : null}
    </fieldset>
  );
}
