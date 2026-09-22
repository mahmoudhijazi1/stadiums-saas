"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "cn";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";
import { MAX_HOURS_GROUPS } from "@/modules/venue/schemas/pitch-draft";
import { WEEKDAYS, type Weekday } from "@/modules/venue/schemas/schedule-config";

type HoursRow = {
  days: Weekday[];
  open: string;
  close: string;
};

type Row = HoursRow & { key: string };

function toRow(group: HoursRow, key: string): Row {
  return {
    key,
    days: [...group.days],
    open: group.open,
    close: group.close,
  };
}

function toPayload(rows: Row[]): HoursRow[] {
  return rows.map((row) => ({
    days: row.days,
    open: row.open,
    close: row.close,
  }));
}

function closedDaysFromRows(rows: Row[]): Weekday[] {
  const taken = new Set(rows.flatMap((row) => row.days));
  return WEEKDAYS.filter((day) => !taken.has(day));
}

function takenDays(rows: Row[], exceptIndex: number): Set<Weekday> {
  const taken = new Set<Weekday>();
  rows.forEach((row, index) => {
    if (index === exceptIndex) return;
    for (const day of row.days) taken.add(day);
  });
  return taken;
}

/**
 * Repeatable hours groups. A day may be checked on at most one row
 * (disabled elsewhere). Days in no row are closed — listed under the fieldset.
 * Ids use useId() so SSR matches the client.
 */
export function HoursGroupRows({
  locale,
  initial,
}: {
  locale: UiLocale;
  initial: HoursRow[];
}) {
  const idBase = useId();
  const nextKey = useRef(initial.length);
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((group, index) => toRow(group, String(index))),
  );
  const closed = closedDaysFromRows(rows);

  function addRow() {
    if (rows.length >= MAX_HOURS_GROUPS) return;
    const key = String(nextKey.current++);
    setRows((current) => [
      ...current,
      toRow({ days: [], open: "16:00", close: "22:00" }, key),
    ]);
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium text-muted-foreground">
        {ui("owner.pitchHours", locale)}
      </legend>
      <p className="text-sm text-muted-foreground">
        {ui("owner.pitchHoursHint", locale)}
      </p>
      <input
        type="hidden"
        name="hoursGroupsJson"
        value={JSON.stringify(toPayload(rows))}
      />
      <ul className="flex flex-col gap-3">
        {rows.map((row, index) => {
          const taken = takenDays(rows, index);
          return (
            <li
              key={row.key}
              className="flex flex-col gap-3 rounded-xl border bg-card p-3"
            >
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => {
                  const checked = row.days.includes(day);
                  const blocked = taken.has(day) && !checked;
                  const id = `${idBase}-${row.key}-${day}`;
                  return (
                    <label
                      key={day}
                      htmlFor={id}
                      className={cn(
                        "flex min-h-11 items-center gap-1.5 rounded-md border px-2 text-sm",
                        blocked && "opacity-50",
                      )}
                    >
                      <input
                        id={id}
                        type="checkbox"
                        checked={checked}
                        disabled={blocked}
                        onChange={() => {
                          if (blocked) return;
                          setRows((current) =>
                            current.map((item, i) => {
                              if (i !== index) return item;
                              const days = item.days.includes(day)
                                ? item.days.filter((d) => d !== day)
                                : [...item.days, day];
                              return { ...item, days };
                            }),
                          );
                        }}
                        className="size-4"
                      />
                      {ui(`owner.wd.${day}`, locale)}
                    </label>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`${idBase}-${row.key}-open`}>
                    {ui("owner.pitchOpen", locale)}
                  </Label>
                  <Input
                    id={`${idBase}-${row.key}-open`}
                    type="time"
                    value={row.open}
                    onChange={(event) => {
                      const open = event.target.value;
                      setRows((current) =>
                        current.map((item, i) =>
                          i === index ? { ...item, open } : item,
                        ),
                      );
                    }}
                    className="font-mono"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`${idBase}-${row.key}-close`}>
                    {ui("owner.pitchClose", locale)}
                  </Label>
                  <Input
                    id={`${idBase}-${row.key}-close`}
                    type="time"
                    value={row.close}
                    onChange={(event) => {
                      const close = event.target.value;
                      setRows((current) =>
                        current.map((item, i) =>
                          i === index ? { ...item, close } : item,
                        ),
                      );
                    }}
                    className="font-mono"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => {
                  setRows((current) => current.filter((_, i) => i !== index));
                }}
              >
                {ui("owner.pitchHoursRemove", locale)}
              </Button>
            </li>
          );
        })}
      </ul>
      {closed.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          {closed
            .map(
              (day) =>
                `${ui(`owner.wd.${day}`, locale)}: ${ui("owner.pitchClosed", locale)}`,
            )
            .join(" · ")}
        </p>
      ) : null}
      {rows.length < MAX_HOURS_GROUPS ? (
        <Button type="button" variant="secondary" onClick={addRow}>
          {ui("owner.pitchHoursAdd", locale)}
        </Button>
      ) : null}
    </fieldset>
  );
}
