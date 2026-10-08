"use client";

import { useRef } from "react";
import { Clock } from "lucide-react";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";
import { cn } from "cn";
import { crossesMidnight, formatClock, type HourCycleChoice } from "@/modules/venue/domain/pitch-form-model";

const STEP_MINUTES = 30;

function toMinutes(hhmm: string): number {
  const [hour, minute] = hhmm.split(":").map(Number) as [number, number];
  return hour * 60 + minute;
}

function toClock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** 00:00 to 23:30 in 30-minute steps, plus the current value when it is not on a step. */
export function timeOptions(current: string): string[] {
  const steps: string[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += STEP_MINUTES) steps.push(toClock(minutes));
  if (!steps.includes(current)) {
    steps.push(current);
    steps.sort();
  }
  return steps;
}

/**
 * Bottom sheet to pick a time: 30-minute steps with the current value centred, and
 * "Other time..." for the native picker. For a closing time, a time at or before the
 * opening time is labelled "(next day)"; the opening time itself cannot be picked.
 */
export function TimeSheet({
  open,
  onOpenChange,
  title,
  value,
  opensAt,
  exclude,
  onPick,
  hourCycle,
  locale,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  value: string;
  /** Set when picking a closing time: the day's opening time (for the "next day" label). */
  opensAt?: string;
  /** A time that cannot be picked (the other end of the same window). */
  exclude?: string;
  onPick: (hhmm: string) => void;
  hourCycle: HourCycleChoice;
  locale: UiLocale;
}) {
  const nativeRef = useRef<HTMLInputElement>(null);
  const options = timeOptions(value);

  function pick(hhmm: string) {
    onPick(hhmm);
    onOpenChange(false);
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent closeLabel={ui("dialog.close", locale)}>
        <BottomSheetHeader>
          <BottomSheetTitle>{title}</BottomSheetTitle>
        </BottomSheetHeader>
        <BottomSheetBody className="flex max-h-[60dvh] flex-col gap-1 pb-4">
          <ul className="flex flex-col gap-1">
            {options.map((hhmm) => {
              const selected = hhmm === value;
              const blocked = exclude !== undefined && toMinutes(hhmm) === toMinutes(exclude);
              const nextDay = opensAt !== undefined && !blocked && crossesMidnight(opensAt, hhmm);
              return (
                <li key={hhmm}>
                  <button
                    type="button"
                    ref={(node) => {
                      if (node && selected) node.scrollIntoView({ block: "center" });
                    }}
                    disabled={blocked}
                    aria-pressed={selected}
                    onClick={() => pick(hhmm)}
                    className={cn(
                      "flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 text-start type-body outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      selected ? "bg-selected text-selected-ink" : "hover:bg-muted",
                      blocked && "opacity-40",
                    )}
                  >
                    <LtrIsolate>{formatClock(hhmm, hourCycle, locale)}</LtrIsolate>
                    {nextDay ? (
                      <span className="type-label opacity-80">{ui("owner.pitchNextDay", locale)}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => {
              const input = nativeRef.current;
              if (!input) return;
              try {
                input.showPicker();
              } catch {
                input.focus();
                input.click();
              }
            }}
            className="mt-2 flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 text-start type-label outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Clock aria-hidden className="size-4" />
            {ui("owner.otherTime", locale)}
          </button>
          <input
            ref={nativeRef}
            type="time"
            tabIndex={-1}
            aria-hidden
            defaultValue={value}
            onChange={(event) => {
              const next = event.target.value.slice(0, 5);
              if (!next) return;
              if (exclude !== undefined && toMinutes(next) === toMinutes(exclude)) return;
              pick(next);
            }}
            className="pointer-events-none absolute size-0 opacity-0"
          />
        </BottomSheetBody>
      </BottomSheetContent>
    </BottomSheet>
  );
}
