"use client";

import { useState } from "react";
import { submitPublicSlotRequest } from "@/app/request-slot";
import type {
  DaySlotView,
  PitchDayAvailability,
} from "@/modules/venue/application/get-day-availability";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { SubmitButton } from "@/components/ui/submit-button";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";
import { cn } from "cn";

function slotKey(pitchId: string, startIso: string): string {
  return `${pitchId}:${startIso}`;
}

/**
 * Compact time+price grid. Selection only — the Server Action is unchanged.
 */
export function PublicSlotPicker({
  pitches,
  dateValue,
  tenantSlug,
  locale,
}: {
  pitches: PitchDayAvailability[];
  dateValue: string;
  tenantSlug: string;
  locale: UiLocale;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <ul className="flex flex-col gap-6">
      {pitches.map((pitch) => (
        <li key={pitch.id} className="flex flex-col gap-3">
          <h3 className="font-medium">{pitch.name}</h3>
          {pitch.slots.length === 0 ? (
            <EmptyState
              title={ui("public.closed", locale)}
              next={ui("public.closedNext", locale)}
            />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {pitch.slots.map((slot) => {
                const key = slotKey(pitch.id, slot.startIso);
                const isSelected = selected === key;
                return (
                  <SlotBlock
                    key={slot.startIso}
                    pitchId={pitch.id}
                    slot={slot}
                    isSelected={isSelected}
                    dateValue={dateValue}
                    tenantSlug={tenantSlug}
                    locale={locale}
                    onToggle={() =>
                      setSelected((current) => (current === key ? null : key))
                    }
                  />
                );
              })}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function SlotBlock({
  pitchId,
  slot,
  isSelected,
  dateValue,
  tenantSlug,
  locale,
  onToggle,
}: {
  pitchId: string;
  slot: DaySlotView;
  isSelected: boolean;
  dateValue: string;
  tenantSlug: string;
  locale: UiLocale;
  onToggle: () => void;
}) {
  const time = (
    <LtrIsolate className="text-lg font-semibold leading-none tracking-tight">
      {`${slot.startLocal}–${slot.endLocal}`}
    </LtrIsolate>
  );
  const price = (
    <LtrIsolate className="text-sm font-medium text-primary">
      {`$${slot.priceUsd}`}
    </LtrIsolate>
  );

  if (!slot.available) {
    return (
      <div className="flex min-h-16 flex-col items-start justify-center gap-2 rounded-xl border bg-card/60 px-3 py-3 text-start opacity-60">
        {time}
        <div className="flex w-full items-center justify-between gap-2">
          {price}
          <Badge variant="outline">{ui("public.taken", locale)}</Badge>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={isSelected}
        className={cn(
          "flex min-h-16 flex-col items-start justify-center gap-2 rounded-xl border bg-card px-3 py-3 text-start shadow-sm transition-all outline-none",
          "hover:bg-accent/50 hover:border-primary/40",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          isSelected && "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background",
        )}
      >
        {time}
        {price}
      </button>
      {isSelected ? (
        <form
          action={submitPublicSlotRequest}
          className="col-span-2 flex flex-col gap-4 rounded-xl border bg-card px-4 py-4 shadow-sm"
        >
          <p className="flex items-baseline justify-between gap-2">
            {time}
            {price}
          </p>
          <input type="hidden" name="pitchId" value={pitchId} />
          <input type="hidden" name="start" value={slot.startIso} />
          <input type="hidden" name="end" value={slot.endIso} />
          <input type="hidden" name="date" value={dateValue} />
          <input type="hidden" name="tenant" value={tenantSlug} />
          <div className="flex flex-col gap-2">
            <Label htmlFor={`name-${slot.startIso}`}>
              {ui("public.name", locale)}
            </Label>
            <Input
              id={`name-${slot.startIso}`}
              type="text"
              name="name"
              required
              autoComplete="name"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`phone-${slot.startIso}`}>
              {ui("public.phone", locale)}
            </Label>
            <Input
              id={`phone-${slot.startIso}`}
              type="tel"
              name="phone"
              required
              autoComplete="tel"
              className="font-mono"
            />
          </div>
          <SubmitButton className="w-full">
            {ui("public.request", locale)}
          </SubmitButton>
        </form>
      ) : null}
    </>
  );
}
