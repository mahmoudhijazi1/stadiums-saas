"use client";

import { ClockText, LtrIsolate } from "@/components/ui/ltr-isolate";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { commonPriceUsd } from "@/modules/booking/domain/free-times";
import type { SlotPickerPitch, SlotPickerSlot } from "@/modules/booking/ui/slot-picker";

const CHIP =
  "inline-flex min-h-11 min-w-11 flex-col items-center justify-center rounded-full border border-line bg-surface px-4 text-ink outline-none hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand";

/**
 * The free times of one day as compact chips: the start time only, 44px or more tall. The heading
 * states the price most of the free times have; a chip priced differently shows its own price under
 * the time. The caller passes only free times (freePitches) and the tap handler; this component
 * holds no state and knows nothing about the request.
 */
export function TimeChips({
  pitches,
  locale,
  onPick,
}: {
  pitches: SlotPickerPitch[];
  locale: UiLocale;
  onPick: (pitchId: string, slot: SlotPickerSlot) => void;
}) {
  const common = commonPriceUsd(pitches.flatMap((pitch) => pitch.slots));
  const showPitchNames = pitches.length > 1;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="type-title">
        {ui("public.availableTimes", locale)}
        {common ? (
          <>
            {" · "}
            <LtrIsolate>{`$${common}`}</LtrIsolate> {ui("public.perGame", locale)}
          </>
        ) : null}
      </h2>
      {pitches.map((pitch) => (
        <section key={pitch.id} className="flex flex-col gap-2">
          {showPitchNames ? <h3 className="type-strong">{pitch.name}</h3> : null}
          <ul className="flex flex-wrap gap-2">
            {pitch.slots.map((slot) => (
              <li key={slot.startIso}>
                <button type="button" className={CHIP} onClick={() => onPick(pitch.id, slot)}>
                  <ClockText text={slot.startLocal} className="type-label tabular-nums" />
                  {slot.priceUsd !== common ? (
                    <LtrIsolate className="type-caption tabular-nums">{`$${slot.priceUsd}`}</LtrIsolate>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
