"use client";

import { submitPublicSlotRequest } from "./request-slot";
import { SlotPicker, type SlotPickerPitch } from "@/components/slot-picker";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";

/**
 * Public hours grid. Action + date query stay here; the picker is shared.
 */
export function PublicSlotPicker({
  pitches,
  dateValue,
  locale,
  policyLine,
}: {
  pitches: SlotPickerPitch[];
  dateValue: string;
  locale: UiLocale;
  policyLine: string;
}) {
  return (
    <SlotPicker
      pitches={pitches}
      action={submitPublicSlotRequest}
      hiddenFields={{ date: dateValue }}
      submitLabel={ui("public.request", locale)}
      locale={locale}
      policyLine={policyLine || null}
    />
  );
}
