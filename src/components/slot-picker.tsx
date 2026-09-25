"use client";

import { useState, type FormEvent } from "react";
import {
  hasPublicRequestFieldErrors,
  publicRequestFieldErrors,
  type PublicRequestFieldErrors,
} from "@/lib/request-fields";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { SubmitButton } from "@/components/ui/submit-button";
import type { UiLocale } from "@/lib/locale";
import { hoursEmptyState, ui } from "@/lib/ui-copy";
import { IsolatedDigits } from "@/components/ui/ltr-isolate";
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

function findSelected(
  pitches: SlotPickerPitch[],
  key: string | null,
): { pitch: SlotPickerPitch; slot: SlotPickerSlot } | null {
  if (!key) return null;
  for (const pitch of pitches) {
    for (const slot of pitch.slots) {
      if (slotKey(pitch.id, slot.startIso) === key) {
        return { pitch, slot };
      }
    }
  }
  return null;
}

/**
 * Latin duration from UTC instants. Integer minutes — not money, not a float total.
 */
export function formatSlotDuration(startIso: string, endIso: string): string {
  const minutes = Math.round(
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000,
  );
  if (!Number.isFinite(minutes) || minutes <= 0) return "";
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  if (minutes % 30 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}

function SlotFace({
  slot,
  variant,
  locale,
  onSurface = false,
}: {
  slot: SlotPickerSlot;
  variant: "idle" | "selected" | "taken";
  locale: UiLocale;
  /** Sheet summary sits on surface. Accent time is only legal on the inverse tile. */
  onSurface?: boolean;
}) {
  const duration = formatSlotDuration(slot.startIso, slot.endIso);
  const selected = variant === "selected";
  const taken = variant === "taken";
  const timeColour = selected
    ? "text-accent-ink"
    : taken
      ? "text-ink-muted line-through"
      : onSurface
        ? "text-ink"
        : "text-accent-brand";
  const quiet = selected ? "text-accent-ink/70" : "text-ink-muted";

  return (
    <span className="flex h-full min-h-0 w-full flex-col justify-between">
      <span className="flex flex-col">
        <LtrIsolate
          className={cn(
            "font-display text-3xl leading-[0.9] font-extrabold tabular-nums",
            timeColour,
          )}
        >
          {slot.startLocal}
        </LtrIsolate>
        <span className={cn("text-xs", quiet)}>
          {ui("public.until", locale)}{" "}
          <LtrIsolate className="font-display tabular-nums">
            {slot.endLocal}
          </LtrIsolate>
        </span>
      </span>
      <span className="flex items-center justify-between gap-2">
        <LtrIsolate
          className={cn(
            "font-display text-xl leading-none font-extrabold tabular-nums",
            selected ? "text-accent-ink" : "text-current",
          )}
        >
          {`$${slot.priceUsd}`}
        </LtrIsolate>
        {duration ? (
          <span className="inline-flex h-5 items-center rounded-full bg-surface-2 px-2 text-[10px] font-semibold text-ink-muted">
            <LtrIsolate className="font-display tabular-nums">
              {duration}
            </LtrIsolate>
          </span>
        ) : null}
      </span>
    </span>
  );
}

/**
 * Compact time+price grid. Selection only — the Server Action is a prop.
 * Name/phone is a bottom sheet so the 2-col grid does not shift. No booking /
 * access / venue types.
 */
export function SlotPicker({
  pitches,
  action,
  hiddenFields,
  submitLabel,
  locale = "ar",
  policyLine = null,
}: {
  pitches: SlotPickerPitch[];
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields: Record<string, string>;
  submitLabel: string;
  locale?: UiLocale;
  /** Late-cancel policy. Public page only, and only when the percent is above 0. */
  policyLine?: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const picked = findSelected(pitches, selected);

  return (
    <>
      <ul className="flex flex-col gap-6 lg:grid lg:grid-cols-2">
        {pitches.map((pitch) => (
          <li key={pitch.id} className="flex flex-col gap-3">
            <p className="font-heading text-xl lg:text-2xl">{pitch.name}</p>
            {pitch.slots.length === 0 ? (
              <EmptyState
                {...hoursEmptyState(pitch.emptyKind ?? "closed", locale)}
              />
            ) : (
              <div className="slot-cols grid w-full grid-cols-2 gap-2.5 md:grid-cols-3">
                {pitch.slots.map((slot) => {
                  const key = slotKey(pitch.id, slot.startIso);
                  const isSelected = selected === key;
                  return (
                    <SlotBlock
                      key={slot.startIso}
                      slot={slot}
                      isSelected={isSelected}
                      locale={locale}
                      onToggle={() =>
                        setSelected((current) =>
                          current === key ? null : key,
                        )
                      }
                    />
                  );
                })}
              </div>
            )}
          </li>
        ))}
      </ul>
      <BottomSheet
        open={picked !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        {picked ? (
          <BottomSheetContent closeLabel={ui("dialog.close", locale)}>
            <BottomSheetHeader>
              <BottomSheetTitle className="sr-only">
                {`${picked.slot.startLocal} ${ui("public.until", locale)} ${picked.slot.endLocal}`}
              </BottomSheetTitle>
              <SlotFace slot={picked.slot} variant="idle" locale={locale} onSurface />
              <BottomSheetDescription>{picked.pitch.name}</BottomSheetDescription>
            </BottomSheetHeader>
            <BottomSheetBody>
              <RequestForm
                pitchId={picked.pitch.id}
                slot={picked.slot}
                action={action}
                hiddenFields={hiddenFields}
                submitLabel={submitLabel}
                locale={locale}
                policyLine={policyLine}
              />
            </BottomSheetBody>
          </BottomSheetContent>
        ) : null}
      </BottomSheet>
    </>
  );
}

function SlotBlock({
  slot,
  isSelected,
  locale,
  onToggle,
}: {
  slot: SlotPickerSlot;
  isSelected: boolean;
  locale: UiLocale;
  onToggle: () => void;
}) {
  if (!slot.available) {
    return (
      <div
        className="fill-stripe flex min-h-[96px] w-full flex-col justify-center gap-2 rounded-[var(--radius-card)] px-[14px] py-3 text-start text-ink-muted lg:max-w-[320px]"
        aria-label={ui("public.taken", locale)}
      >
        <SlotFace slot={slot} variant="taken" locale={locale} />
        <span className="text-xs font-semibold">{ui("public.taken", locale)}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isSelected}
      className={cn(
        "flex min-h-[96px] w-full flex-col rounded-[var(--radius-card)] px-[14px] py-3 text-start outline-none lg:max-w-[320px]",
        "transition-[background-color,color] duration-150 ease-out motion-reduce:transition-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        isSelected
          ? "bg-accent-brand text-accent-ink focus-visible:outline-accent-ink"
          : "bg-inverse text-inverse-ink focus-visible:outline-accent-brand dark:bg-surface dark:text-ink",
      )}
    >
      <SlotFace
        slot={slot}
        variant={isSelected ? "selected" : "idle"}
        locale={locale}
      />
    </button>
  );
}

function RequestForm({
  pitchId,
  slot,
  action,
  hiddenFields,
  submitLabel,
  locale,
  policyLine,
}: {
  pitchId: string;
  slot: SlotPickerSlot;
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields: Record<string, string>;
  submitLabel: string;
  locale: UiLocale;
  policyLine: string | null;
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
      className="flex flex-col gap-3"
    >
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
      {policyLine ? (
        <p className="text-sm text-muted-foreground">
          <IsolatedDigits text={policyLine} />
        </p>
      ) : null}
      <SubmitButton className="w-full">{submitLabel}</SubmitButton>
    </form>
  );
}
