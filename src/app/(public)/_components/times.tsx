"use client";

import { useState } from "react";
import { submitPublicSlotRequest } from "@/app/(public)/request-slot";
import type { SlotPickerPitch } from "@/modules/booking/ui/slot-picker";
import { PublicRequestSheet, type PickedTime } from "@/modules/booking/ui/public-request-sheet";
import { TimeChips } from "@/modules/booking/ui/time-chips";
import type { UiLocale } from "@/lib/locale";

/**
 * The public page's free times. Tapping a chip opens the request sheet; the Server Action and the
 * ?date= value are wired here, the pieces themselves are shared. The only client code on the page
 * besides the language toggle.
 */
export function PublicTimes({
  pitches,
  dateValue,
  dayLabel,
  locale,
  cancelLine,
  feeLine,
  whatsappHref,
}: {
  pitches: SlotPickerPitch[];
  dateValue: string;
  dayLabel: string;
  locale: UiLocale;
  cancelLine: string | null;
  feeLine: string | null;
  whatsappHref: string | null;
}) {
  const [picked, setPicked] = useState<PickedTime | null>(null);
  return (
    <>
      <TimeChips
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
