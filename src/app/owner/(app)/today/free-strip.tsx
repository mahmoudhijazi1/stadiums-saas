"use client";

import { useState } from "react";
import { SlotBookSheet } from "@/components/slot-picker";
import { ClockText, LtrIsolate } from "@/components/ui/ltr-isolate";
import type { FreeStripPitch } from "@/modules/booking/domain/free-strip";
import type { UiLocale } from "@/lib/locale";
import { ui, uiCount } from "@/lib/ui-copy";
import { cn } from "cn";
import { submitCreateOwnerBooking } from "../book/actions";

const chipClass =
  "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border bg-card px-4 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * One line per pitch of time chips for what is still free. Tapping a chip opens the
 * same booking sheet as Book, prefilled. Without `mayBook` the chips only show.
 */
export function FreeStrip({
  pitches,
  showPitchNames,
  day,
  mayBook,
  locale,
}: {
  pitches: FreeStripPitch[];
  showPitchNames: boolean;
  day: string;
  mayBook: boolean;
  locale: UiLocale;
}) {
  const [picked, setPicked] = useState<{
    pitchId: string;
    pitchName: string;
    startIso: string;
  } | null>(null);
  const chip = picked
    ? pitches
        .find((pitch) => pitch.pitchId === picked.pitchId)
        ?.chips.find((item) => item.startIso === picked.startIso)
    : undefined;

  return (
    <section aria-label={ui("owner.freeStrip", locale)} className="flex flex-col gap-2">
      {pitches.map((pitch) => (
        <div key={pitch.pitchId} className="flex items-center gap-2">
          {showPitchNames ? (
            <span className="max-w-24 shrink-0 truncate text-sm font-medium text-muted-foreground">
              {pitch.pitchName}
            </span>
          ) : null}
          <ul className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-1">
            {pitch.chips.map((item) => {
              const face = (
                <>
                  <ClockText text={item.startLocal} />
                  {item.priceUsd ? (
                    <LtrIsolate className="text-muted-foreground">{`$${item.priceUsd}`}</LtrIsolate>
                  ) : null}
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
                <li key={item.startIso} className="shrink-0">
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
                      className={cn(chipClass, "cursor-pointer hover:bg-muted/60")}
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
      ))}
      {mayBook ? (
        <SlotBookSheet
          picked={
            picked && chip
              ? {
                  pitchId: picked.pitchId,
                  pitchName: picked.pitchName,
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
          hiddenFields={{ returnTo: "today", date: day }}
          submitLabel={ui("owner.book", locale)}
          locale={locale}
        />
      ) : null}
    </section>
  );
}
