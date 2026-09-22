"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";
import {
  MAX_PRICE_RULES,
  type PitchPriceRule,
} from "@/modules/venue/schemas/pitch-draft";
import { WEEKDAYS, type Weekday } from "@/modules/venue/schemas/schedule-config";

type Row = {
  key: string;
  days: Weekday[];
  priceUsd: string;
  start?: string;
  end?: string;
};

function toRow(rule: PitchPriceRule | Row, key: string): Row {
  return {
    key,
    days: [...rule.days],
    priceUsd: rule.priceUsd,
    start: rule.start,
    end: rule.end,
  };
}

function toPayload(rows: Row[]): PitchPriceRule[] {
  return rows.map((row) => {
    const next: PitchPriceRule = {
      days: row.days,
      priceUsd: row.priceUsd,
    };
    if (row.start && row.end) {
      next.start = row.start;
      next.end = row.end;
    }
    return next;
  });
}

/**
 * Day-checkbox + USD overrides. JSON is the submitted field so a refused
 * save can keep the draft in ?priceRulesJson=. start/end round-trip hidden
 * (no time-window UI this slice).
 * Checkbox ids use useId() + row index so SSR HTML matches the client.
 * A module-level counter drifted across server renders (hydration mismatch).
 */
export function PriceRuleRows({
  locale,
  initial,
}: {
  locale: UiLocale;
  initial: PitchPriceRule[];
}) {
  const idBase = useId();
  const nextKey = useRef(initial.length);
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((rule, index) => toRow(rule, String(index))),
  );

  function addRow() {
    if (rows.length >= MAX_PRICE_RULES) return;
    const key = String(nextKey.current++);
    setRows((current) => [
      ...current,
      toRow({ days: [], priceUsd: "" }, key),
    ]);
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium text-muted-foreground">
        {ui("owner.pitchPriceRules", locale)}
      </legend>
      <p className="text-sm text-muted-foreground">
        {ui("owner.pitchPriceRuleHint", locale)}
      </p>
      <input
        type="hidden"
        name="priceRulesJson"
        value={JSON.stringify(toPayload(rows))}
      />
      <ul className="flex flex-col gap-3">
        {rows.map((row, index) => (
          <li
            key={row.key}
            className="flex flex-col gap-3 rounded-xl border bg-card p-3"
          >
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => {
                const checked = row.days.includes(day);
                const id = `${idBase}-${row.key}-${day}`;
                return (
                  <label
                    key={day}
                    htmlFor={id}
                    className="flex min-h-11 items-center gap-1.5 rounded-md border px-2 text-sm"
                  >
                    <input
                      id={id}
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
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
            <div className="flex items-center gap-2">
              <Input
                type="text"
                inputMode="decimal"
                aria-label={ui("owner.pitchPriceRuleAmount", locale)}
                value={row.priceUsd}
                onChange={(event) => {
                  const priceUsd = event.target.value;
                  setRows((current) =>
                    current.map((item, i) =>
                      i === index ? { ...item, priceUsd } : item,
                    ),
                  );
                }}
                className="font-mono"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRows((current) => current.filter((_, i) => i !== index));
                }}
              >
                {ui("owner.pitchPriceRuleRemove", locale)}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {rows.length < MAX_PRICE_RULES ? (
        <Button type="button" variant="secondary" onClick={addRow}>
          {ui("owner.pitchPriceRuleAdd", locale)}
        </Button>
      ) : null}
    </fieldset>
  );
}
