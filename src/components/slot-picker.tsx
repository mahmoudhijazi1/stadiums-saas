"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import {
  hasPublicRequestFieldErrors,
  publicRequestFieldErrors,
  type PublicRequestFieldErrors,
} from "@/lib/request-fields";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { SubmitButton } from "@/components/ui/submit-button";
import type { UiLocale } from "@/lib/locale";
import { hoursEmptyState, ui } from "@/lib/ui-copy";
import { cn } from "cn";

export type SlotPickerSlot = {
  startIso: string;
  endIso: string;
  startLocal: string;
  endLocal: string;
  priceUsd: string;
  available: boolean;
};

export type SlotPickerPitch = {
  id: string;
  name: string;
  slots: SlotPickerSlot[];
  emptyKind: "closed" | "past" | "hoursEnded" | null;
};

function slotKey(pitchId: string, startIso: string): string {
  return `${pitchId}:${startIso}`;
}

/**
 * Compact time+price grid. Selection only — the Server Action is a prop.
 * No booking / access / venue types.
 */
export function SlotPicker({
  pitches,
  action,
  hiddenFields,
  submitLabel,
  locale = "ar",
}: {
  pitches: SlotPickerPitch[];
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields: Record<string, string>;
  submitLabel: string;
  locale?: UiLocale;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <ul className="flex flex-col gap-6">
      {pitches.map((pitch) => (
        <li key={pitch.id} className="flex flex-col gap-3">
          <h3 className="font-medium">{pitch.name}</h3>
          {pitch.slots.length === 0 ? (
            <EmptyState
              {...hoursEmptyState(pitch.emptyKind ?? "closed", locale)}
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
                    action={action}
                    hiddenFields={hiddenFields}
                    submitLabel={submitLabel}
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
  action,
  hiddenFields,
  submitLabel,
  locale,
  onToggle,
}: {
  pitchId: string;
  slot: SlotPickerSlot;
  isSelected: boolean;
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields: Record<string, string>;
  submitLabel: string;
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
        <RequestForm
          pitchId={pitchId}
          slot={slot}
          action={action}
          hiddenFields={hiddenFields}
          submitLabel={submitLabel}
          locale={locale}
          time={time}
          price={price}
        />
      ) : null}
    </>
  );
}

function RequestForm({
  pitchId,
  slot,
  action,
  hiddenFields,
  submitLabel,
  locale,
  time,
  price,
}: {
  pitchId: string;
  slot: SlotPickerSlot;
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields: Record<string, string>;
  submitLabel: string;
  locale: UiLocale;
  time: ReactNode;
  price: ReactNode;
}) {
  const [fieldErrors, setFieldErrors] = useState<PublicRequestFieldErrors>({});
  const nameErrorId = `name-err-${slot.startIso}`;
  const phoneErrorId = `phone-err-${slot.startIso}`;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const next = publicRequestFieldErrors(
      String(data.get("name") ?? ""),
      String(data.get("phone") ?? ""),
    );
    if (hasPublicRequestFieldErrors(next)) {
      event.preventDefault();
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});
  }

  return (
    <form
      action={action}
      noValidate
      onSubmit={onSubmit}
      className="col-span-2 flex flex-col gap-4 rounded-xl border bg-card px-4 py-4 shadow-sm"
    >
      <p className="flex items-baseline justify-between gap-2">
        {time}
        {price}
      </p>
      <input type="hidden" name="pitchId" value={pitchId} />
      <input type="hidden" name="start" value={slot.startIso} />
      <input type="hidden" name="end" value={slot.endIso} />
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="flex flex-col gap-2">
        <Label htmlFor={`name-${slot.startIso}`}>
          {ui("public.name", locale)}
        </Label>
        <Input
          id={`name-${slot.startIso}`}
          type="text"
          name="name"
          autoComplete="name"
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? nameErrorId : undefined}
          onInput={() =>
            setFieldErrors((current) => ({ ...current, name: undefined }))
          }
        />
        {fieldErrors.name ? (
          <p id={nameErrorId} role="alert" className="text-sm text-destructive">
            {ui(fieldErrors.name, locale)}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`phone-${slot.startIso}`}>
          {ui("public.phone", locale)}
        </Label>
        <Input
          id={`phone-${slot.startIso}`}
          type="tel"
          name="phone"
          autoComplete="tel"
          inputMode="tel"
          className="font-mono"
          aria-invalid={Boolean(fieldErrors.phone)}
          aria-describedby={fieldErrors.phone ? phoneErrorId : undefined}
          onInput={() =>
            setFieldErrors((current) => ({ ...current, phone: undefined }))
          }
        />
        {fieldErrors.phone ? (
          <p
            id={phoneErrorId}
            role="alert"
            className="text-sm text-destructive"
          >
            {ui(fieldErrors.phone, locale)}
          </p>
        ) : null}
      </div>
      <SubmitButton className="w-full">{submitLabel}</SubmitButton>
    </form>
  );
}
