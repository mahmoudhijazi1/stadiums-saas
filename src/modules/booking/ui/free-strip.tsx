"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { SlotBookSheet } from "@/modules/booking/ui/slot-picker";
import { WeeklyFields } from "@/modules/booking/ui/weekly-preview";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { formatPrice } from "@/lib/format/money";
import { shortPeriod, splitDisplayedClock } from "@/lib/format/time";
import { freeRanges, type FreeChip, type FreeStripPitch } from "@/modules/booking/domain/free-strip";
import type { UiLocale } from "@/lib/locale";
import { ui, uiCount } from "@/lib/copy";
import { cn } from "cn";
import type { PreviewResult } from "@/modules/booking/ui/action-types";

// Soft filled chips from the surface token: no border, 40px tall. Lime on press, focus and pick.
const chipClass = cn(
  "inline-flex min-h-12 w-full flex-col items-center justify-center gap-0.5 rounded-2xl bg-surface-2 px-2 py-1.5 type-label tabular-nums text-foreground outline-none",
  "focus-visible:ring-2 focus-visible:ring-accent-brand/60",
);
const pressable = "cursor-pointer hover:bg-muted active:bg-accent-brand active:text-accent-ink";
const pickedClass = "bg-accent-brand text-accent-ink";

/** A range "from – to", always left to right (both clocks keep their period marker), never joined to another range by text. */
function RangeText({ from, to }: { from: string; to: string }) {
  return (
    <span dir="ltr" className="inline-flex items-baseline gap-1.5 whitespace-nowrap tabular-nums">
      <ChipTime text={from} />
      <span aria-hidden>–</span>
      <ChipTime text={to} />
    </span>
  );
}

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
 * Free hours, one line per pitch: its consecutive free slots merged into ranges ("Pitch 1: 4:00 PM – 12:00 AM",
 * several ranges when there are gaps). Tapping the line opens that pitch's individual hours as equal-width
 * chips that wrap (it starts from the right in Arabic). Tapping a chip opens the same booking
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

  const [openPitches, setOpenPitches] = useState<ReadonlySet<string>>(new Set());
  function togglePitch(pitchId: string) {
    setOpenPitches((current) => {
      const next = new Set(current);
      if (!next.delete(pitchId)) next.add(pitchId);
      return next;
    });
  }

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
        const ranges = freeRanges(pitch.chips);
        // A pitch's line opens its individual hours; a picked hour keeps them open.
        const expanded = openPitches.has(pitch.pitchId) || picked?.pitchId === pitch.pitchId;
        const listId = `free-hours-${pitch.pitchId}`;
        return (
          <div key={pitch.pitchId} className="flex flex-col gap-2">
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={listId}
              onClick={() => togglePitch(pitch.pitchId)}
              className="flex min-h-12 w-full items-start gap-3 rounded-xl border bg-card px-3 py-2.5 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                {showPitchNames ? <span className="type-strong">{pitch.pitchName}</span> : null}
                <span className="flex flex-wrap gap-x-4 gap-y-1 type-body">
                  {ranges.map((range) => (
                    <RangeText key={range.startIso} from={range.startLocal} to={range.endLocal} />
                  ))}
                </span>
              </span>
              <ChevronDown aria-hidden className={cn("mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
            </button>
            {expanded ? (
              <ul id={listId} className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2">
                {pitch.chips.map((item) => {
                  const isPicked = picked?.startIso === item.startIso && picked.pitchId === pitch.pitchId;
                  const face = (
                    <>
                      <span className="inline-flex items-center gap-1.5">
                        <ChipTime text={item.startLocal} />
                        {item.pending > 0 ? (
                          <span
                            title={uiCount("owner.requests", item.pending, locale)}
                            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-action-ink px-1.5 text-xs font-semibold text-background"
                          >
                            <LtrIsolate>{item.pending}</LtrIsolate>
                            <span className="sr-only">{uiCount("owner.requests", item.pending, locale)}</span>
                          </span>
                        ) : null}
                      </span>
                      {item.price ? (
                        <LtrIsolate className="max-w-full whitespace-nowrap text-xs opacity-80">{formatPrice(item.price, locale)}</LtrIsolate>
                      ) : null}
                    </>
                  );
                  return (
                    <li key={item.startIso}>
                      {mayBook ? (
                        <button
                          type="button"
                          aria-haspopup="dialog"
                          onClick={() => setPicked({ pitchId: pitch.pitchId, pitchName: pitch.pitchName, startIso: item.startIso })}
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
            ) : null}
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
                    price: chip.fullPrice,
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
