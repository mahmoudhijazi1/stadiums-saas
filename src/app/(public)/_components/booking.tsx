"use client";

import { useState } from "react";
import { submitPublicSlotRequest } from "@/app/(public)/request-slot";
import type { SlotPickerPitch, SlotPickerSlot } from "@/modules/booking/ui/slot-picker";
import { NextFreeCard } from "@/modules/booking/ui/next-free-card";
import { PublicRequestSheet, type PickedTime } from "@/modules/booking/ui/public-request-sheet";
import { TimeRows } from "@/modules/booking/ui/time-rows";
import type { UiLocale } from "@/lib/locale";

/** What the "next free" card is about: possibly another day than the one the rows show. */
export type NextFreeView = {
  pitchId: string;
  pitchName: string | null;
  slot: SlotPickerSlot;
  dateValue: string;
  dayLabel: string;
  durationMinutes: number;
};

type Pick = PickedTime & { dateValue: string; dayLabel: string };

/**
 * The public page's booking area: the next-free card and the day's rows share one request sheet.
 * The Server Action is wired here; the pieces are shared. The only client code on the page besides
 * the language control.
 */
export function PublicBooking({
  nextFree,
  pitches,
  dateValue,
  dayLabel,
  locale,
  timeZone,
  dayStartHour,
  cancelLine,
  feeLine,
  whatsappHref,
  emptyDay,
}: {
  nextFree: NextFreeView | null;
  pitches: SlotPickerPitch[];
  dateValue: string;
  dayLabel: string;
  locale: UiLocale;
  timeZone: string;
  dayStartHour: number;
  cancelLine: string | null;
  feeLine: string | null;
  whatsappHref: string | null;
  /** Shown above the rows when the day has none free (with the link to the next free day). */
  emptyDay?: React.ReactNode;
}) {
  const [picked, setPicked] = useState<Pick | null>(null);
  return (
    <>
      {nextFree ? (
        <NextFreeCard
          dayLabel={nextFree.dayLabel}
          startLocal={nextFree.slot.startLocal}
          priceUsd={nextFree.slot.priceUsd}
          durationMinutes={nextFree.durationMinutes}
          locale={locale}
          onBook={() =>
            setPicked({
              pitchId: nextFree.pitchId,
              pitchName: nextFree.pitchName,
              slot: nextFree.slot,
              dateValue: nextFree.dateValue,
              dayLabel: nextFree.dayLabel,
            })
          }
        />
      ) : null}
      {emptyDay}
      {pitches.length > 0 ? (
        <TimeRows
          pitches={pitches}
          locale={locale}
          timeZone={timeZone}
          dayStartHour={dayStartHour}
          onPick={(pitchId, slot) =>
            setPicked({
              pitchId,
              pitchName: pitches.length > 1 ? (pitches.find((pitch) => pitch.id === pitchId)?.name ?? null) : null,
              slot,
              dateValue,
              dayLabel,
            })
          }
        />
      ) : null}
      <PublicRequestSheet
        picked={picked}
        onClose={() => setPicked(null)}
        action={submitPublicSlotRequest}
        dayLabel={picked?.dayLabel ?? dayLabel}
        dateValue={picked?.dateValue ?? dateValue}
        locale={locale}
        cancelLine={cancelLine}
        feeLine={feeLine}
        whatsappHref={whatsappHref}
      />
    </>
  );
}
