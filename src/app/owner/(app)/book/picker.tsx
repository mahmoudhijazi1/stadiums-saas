"use client";

import { submitCreateOwnerBooking } from "./actions";
import { SlotPicker, type SlotPickerPitch } from "@/components/slot-picker";
import { WeeklyFields } from "@/app/owner/(app)/series/weekly-preview";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";

/**
 * Owner Book grid. Action + bookOn stay here; the picker is shared.
 * Auth is the /owner/book page, not this component.
 */
export function OwnerSlotPicker({
  pitches,
  bookOn,
  locale = "ar",
}: {
  pitches: SlotPickerPitch[];
  bookOn: string;
  locale?: UiLocale;
}) {
  return (
    <SlotPicker
      pitches={pitches}
      action={submitCreateOwnerBooking}
      hiddenFields={{ bookOn }}
      submitLabel={ui("owner.book", locale)}
      locale={locale}
      extra={({ pitchId, slot, setSubmitLabel }) => (
        <WeeklyFields
          pitchId={pitchId}
          startIso={slot.startIso}
          endIso={slot.endIso}
          locale={locale}
          setSubmitLabel={setSubmitLabel}
        />
      )}
    />
  );
}
