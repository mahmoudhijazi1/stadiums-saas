"use client";

import { SlotPicker, type SlotPickerPitch } from "@/modules/booking/ui/slot-picker";
import { WeeklyFields } from "@/modules/booking/ui/weekly-preview";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import type { PreviewResult } from "@/modules/booking/ui/action-types";

/**
 * Owner Book grid. Action + bookOn stay here; the picker is shared.
 * Auth is the /owner/book page, not this component.
 */
export function OwnerSlotPicker({
  pitches,
  bookOn,
  locale = "ar",
  previewSeriesAction,
  submitCreateOwnerBooking,
}: {
  pitches: SlotPickerPitch[];
  bookOn: string;
  locale?: UiLocale;
  previewSeriesAction: (input: unknown) => Promise<PreviewResult>;
  submitCreateOwnerBooking: (formData: FormData) => Promise<void>;
}) {
  return (
    <SlotPicker
      pitches={pitches}
      action={submitCreateOwnerBooking}
      hiddenFields={{ bookOn }}
      submitLabel={ui("owner.book", locale)}
      locale={locale}
      extra={({ pitchId, slot, setSubmitLabel }) => (
        <WeeklyFields previewSeriesAction={previewSeriesAction}
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
