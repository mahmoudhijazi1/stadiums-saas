"use client";

import { useState } from "react";
import { submitPublicSlotRequest } from "@/app/(public)/request-slot";
import type { SlotPickerPitch } from "@/modules/booking/ui/slot-picker";
import { PublicRequestSheet, type PickedTime } from "@/modules/booking/ui/public-request-sheet";
import { TimeRows } from "@/modules/booking/ui/time-rows";
import type { UiLocale } from "@/lib/locale";

/**
 * The public page's booking area: the day's rows and one request sheet. The Server Action is wired
 * here; the pieces are shared. The only client code on the page besides the header controls.
 */
export function PublicBooking({
  pitches,
  dateValue,
  dayLabel,
  locale,
  cancelLine,
  feeLine,
  whatsappHref,
  emptyDay,
}: {
  pitches: SlotPickerPitch[];
  dateValue: string;
  dayLabel: string;
  locale: UiLocale;
  cancelLine: string | null;
  feeLine: string | null;
  whatsappHref: string | null;
  /** Shown above the rows when the day has none free (with the link to the nearest free time). */
  emptyDay?: React.ReactNode;
}) {
  const [picked, setPicked] = useState<PickedTime | null>(null);
  return (
    <>
      {emptyDay}
      {pitches.length > 0 ? (
        <TimeRows
          pitches={pitches}
          locale={locale}
          onPick={(pitchId, slot) =>
            setPicked({
              pitchId,
              pitchName: pitches.length > 1 ? (pitches.find((pitch) => pitch.id === pitchId)?.name ?? null) : null,
              slot,
            })
          }
        />
      ) : null}
      <PublicRequestSheet
        picked={picked}
        onClose={() => setPicked(null)}
        action={submitPublicSlotRequest}
        dayLabel={dayLabel}
        dateValue={dateValue}
        locale={locale}
        cancelLine={cancelLine}
        feeLine={feeLine}
        whatsappHref={whatsappHref}
      />
    </>
  );
}
