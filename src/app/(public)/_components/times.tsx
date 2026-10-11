"use client";

import { useState } from "react";
import { submitPublicSlotRequest } from "@/app/(public)/request-slot";
import { SlotBookSheet, type SlotPickerPitch, type SlotPickerSlot } from "@/modules/booking/ui/slot-picker";
import { TimeChips } from "@/modules/booking/ui/time-chips";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";

type Picked = { pitchId: string; pitchName: string | null; slot: SlotPickerSlot };

/**
 * The public page's free times. Tapping a chip opens the request sheet; the Server Action and the
 * ?date= value are wired here, the pieces themselves are shared.
 */
export function PublicTimes({
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
  const [picked, setPicked] = useState<Picked | null>(null);
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
      <SlotBookSheet
        picked={picked}
        onClose={() => setPicked(null)}
        action={submitPublicSlotRequest}
        hiddenFields={{ date: dateValue }}
        submitLabel={ui("public.request", locale)}
        locale={locale}
        policyLine={policyLine || null}
      />
    </>
  );
}
