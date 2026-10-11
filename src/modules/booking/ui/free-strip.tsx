"use client";

import { useState } from "react";
import { SlotBookSheet } from "@/modules/booking/ui/slot-picker";
import { WeeklyFields } from "@/modules/booking/ui/weekly-preview";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { shortPeriod, splitDisplayedClock } from "@/lib/format/time";
import type { FreeChip, FreeStripPitch } from "@/modules/booking/domain/free-strip";
import type { UiLocale } from "@/lib/locale";
import { ui, uiCount } from "@/lib/copy";
import { cn } from "cn";
import type { PreviewResult } from "@/modules/booking/ui/action-types";

// Soft filled chips from the surface token: no border, 40px tall. Lime on press, focus and pick.
const chipClass = cn(
  "inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full bg-surface-2 px-3 type-label tabular-nums text-foreground outline-none",
  "focus-visible:ring-2 focus-visible:ring-accent-brand/60",
);
const pressable = "cursor-pointer hover:bg-muted active:bg-accent-brand active:text-accent-ink";
const pickedClass = "bg-accent-brand text-accent-ink";

/** One clock with a single small period marker (م / ص, AM / PM). No marker in 24-hour. */
function ChipTime({ text }: { text: string }) {
  const { digits, period } = splitDisplayedClock(text);
  const mark = shortPeriod(period);
  return (
    <span className="inline-flex items-baseline gap-1">
      <LtrIsolate>{digits}</LtrIsolate>
      {mark ? <span className="text-xs leading-none">{mark}</span> : null}
    </span>
  );
}

/**
 * Free slots, one block per pitch: the pitch name, then its free hours as equal-width chips that
 * fill each line and wrap to the next (no sideways scroll to miss; it starts from the right in
 * Arabic). Tapping a chip opens the same booking
 * sheet as Book, prefilled. Without `mayBook` the chips only show.
 */
export function FreeStrip({
  pitches,
  showPitchNames,
  day,
  mayBook,
  locale,
  previewSeriesAction,
  submitCreateOwnerBooking,
}: {
  pitches: FreeStripPitch[];
  showPitchNames: boolean;
  day: string;
  mayBook: boolean;
  locale: UiLocale;
  previewSeriesAction: (input: unknown) => Promise<PreviewResult>;
  submitCreateOwnerBooking: (formData: FormData) => Promise<void>;
}) {
  const [picked, setPicked] = useState<{
    pitchId: string;
    pitchName: string;
    startIso: string;
  } | null>(null);

  const total = pitches.reduce((sum, pitch) => sum + pitch.chips.length, 0);

  const chip: FreeChip | undefined = picked
    ? pitches
        .find((pitch) => pitch.pitchId === picked.pitchId)
        ?.chips.find((item) => item.startIso === picked.startIso)
    : undefined;

  return (
    <section aria-label={ui("owner.availableHours", locale)} className="mt-3 flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-muted-foreground">
        {ui("owner.availableHours", locale)} <LtrIsolate>{`(${total})`}</LtrIsolate>
      </h3>

      {pitches.map((pitch) => {
        return (
          <div key={pitch.pitchId} className="flex flex-col gap-1">
            {showPitchNames ? <span className="type-section">{pitch.pitchName}</span> : null}
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
              {pitch.chips.map((item) => {
                const isPicked =
                  picked?.startIso === item.startIso && picked.pitchId === pitch.pitchId;
                const face = (
                  <>
                    <ChipTime text={item.startLocal} />
                    {item.priceUsd ? <LtrIsolate>{`$${item.priceUsd}`}</LtrIsolate> : null}
                    {item.pending > 0 ? (
                      <span
                        title={uiCount("owner.requests", item.pending, locale)}
                        className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-action-ink px-1.5 text-xs font-semibold text-background"
                      >
                        <LtrIsolate>{item.pending}</LtrIsolate>
                        <span className="sr-only">
                          {uiCount("owner.requests", item.pending, locale)}
                        </span>
                      </span>
                    ) : null}
                  </>
                );
                return (
                  <li key={item.startIso}>
                    {mayBook ? (
                      <button
                        type="button"
                        aria-haspopup="dialog"
                        onClick={() =>
                          setPicked({
                            pitchId: pitch.pitchId,
                            pitchName: pitch.pitchName,
                            startIso: item.startIso,
                          })
                        }
                        className={cn(chipClass, pressable, isPicked && pickedClass)}
                      >
                        {face}
                      </button>
                    ) : (
                      <span className={chipClass}>{face}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {mayBook ? (
        <SlotBookSheet
          picked={
            picked && chip
              ? {
                  pitchId: picked.pitchId,
                  pitchName: showPitchNames ? picked.pitchName : null,
                  slot: {
                    startIso: chip.startIso,
                    endIso: chip.endIso,
                    startLocal: chip.startLocal,
                    endLocal: chip.endLocal,
                    priceUsd: chip.fullPriceUsd,
                    available: true,
                  },
                }
              : null
          }
          onClose={() => setPicked(null)}
          action={submitCreateOwnerBooking}
          hiddenFields={{
            returnTo: "today",
            date: day,
          }}
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
      ) : null}
    </section>
  );
}
