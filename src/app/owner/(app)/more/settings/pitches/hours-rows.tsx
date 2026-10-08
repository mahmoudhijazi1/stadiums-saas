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

/** Open / Closed switch with a text label, so state never rests on colour alone. */
function DaySwitch({
  checked,
  onChange,
  label,
  name,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  name: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={name}
      onClick={() => onChange(!checked)}
      className="inline-flex min-h-11 items-center gap-2 rounded-full pe-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
            "absolute top-0.5 size-5 rounded-full bg-background shadow transition-[inset-inline-start] motion-reduce:transition-none",
            checked ? "inset-s-[1.125rem]" : "inset-s-0.5",
          )}
        />
      </span>
      <span className="min-w-14 type-label">{label}</span>
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
      <legend className="type-label text-muted-foreground">
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
              className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 border-b bg-card px-3 py-2 last:border-b-0"
            >
              <span className="w-20 shrink-0 type-body">{dayName}</span>
              <DaySwitch
                checked={row.open}
                onChange={(open) => update(row.day, { open })}
                name={dayName}
                label={ui(row.open ? "owner.dayOpen" : "owner.dayClosed", locale)}
              />
              {row.open ? (
                <span className="ms-auto flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPicking({ day: row.day, field: "from" })}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 type-label outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <span className="text-muted-foreground">{ui("owner.fromLabel", locale)}</span>
                    <LtrIsolate className="type-label">{formatClock(row.from, hourCycle, locale)}</LtrIsolate>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPicking({ day: row.day, field: "to" })}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 type-label outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <span className="text-muted-foreground">{ui("owner.toLabel", locale)}</span>
                    <LtrIsolate className="type-label">{formatClock(row.to, hourCycle, locale)}</LtrIsolate>
                    {next ? <span className="type-caption">{ui("owner.pitchNextDay", locale)}</span> : null}
                  </button>
                </span>
              ) : null}
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
