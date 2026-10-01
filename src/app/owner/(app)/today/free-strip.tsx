"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { SlotBookSheet } from "@/components/slot-picker";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { shortPeriod, splitDisplayedClock } from "@/lib/format-local-hm";
import type { FreeChip, FreeStripPitch } from "@/modules/booking/domain/free-strip";
import type { UiLocale } from "@/lib/locale";
import { ui, uiCount } from "@/lib/ui-copy";
import { cn } from "cn";
import { submitCreateOwnerBooking } from "../book/actions";

/** Chips shown per pitch before "+N more". */
const CHIP_LIMIT = 12;
/** More pitches than this: one row of filter chips instead of a row per pitch. */
const ROW_PITCH_LIMIT = 2;

// Quiet on purpose: outline only, smaller than a booking card. Lime on press, focus and pick.
const chipClass = cn(
  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-transparent px-3 text-sm text-muted-foreground outline-none",
  "focus-visible:border-accent-brand focus-visible:ring-2 focus-visible:ring-accent-brand/60",
);
const pressable =
  "cursor-pointer hover:bg-muted/60 active:border-accent-brand active:bg-accent-brand active:text-accent-ink";
const pickedClass = "border-accent-brand bg-accent-brand text-accent-ink";

/** One clock with a single small period marker (م / ص, AM / PM). No marker in 24-hour. */
function ChipTime({ text }: { text: string }) {
  const { digits, period } = splitDisplayedClock(text);
  const mark = shortPeriod(period);
  return (
    <span className="inline-flex items-baseline gap-1">
      <LtrIsolate>{digits}</LtrIsolate>
      {mark ? <span className="text-[10px] leading-none">{mark}</span> : null}
    </span>
  );
}

/**
 * Free slots as quiet outline chips that wrap (no sideways scroll). Tapping a chip opens
 * the same booking sheet as Book, prefilled. Without `mayBook` the chips only show.
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [picked, setPicked] = useState<{
    pitchId: string;
    pitchName: string;
    startIso: string;
  } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtering = pitches.length > ROW_PITCH_LIMIT;
  const wanted = searchParams?.get("pitch") ?? null;
  const selected = filtering ? pitches.find((pitch) => pitch.pitchId === wanted) : undefined;
  const visible = selected ? [selected] : pitches;
  const total = pitches.reduce((sum, pitch) => sum + pitch.chips.length, 0);

  const chip: FreeChip | undefined = picked
    ? pitches
        .find((pitch) => pitch.pitchId === picked.pitchId)
        ?.chips.find((item) => item.startIso === picked.startIso)
    : undefined;

  function filterHref(pitchId: string | null): string {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    if (pitchId) next.set("pitch", pitchId);
    else next.delete("pitch");
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <section aria-label={ui("owner.availableHours", locale)} className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">
        {ui("owner.availableHours", locale)} <LtrIsolate>{`(${total})`}</LtrIsolate>
      </h3>

      {filtering ? (
        <ul className="flex flex-wrap gap-2">
          {[null, ...pitches].map((pitch) => {
            const active = (pitch?.pitchId ?? null) === (selected?.pitchId ?? null);
            return (
              <li key={pitch?.pitchId ?? "all"}>
                <Link
                  href={filterHref(pitch?.pitchId ?? null)}
                  replace
                  scroll={false}
                  aria-current={active ? "true" : undefined}
                  className={cn(chipClass, pressable, active && pickedClass)}
                >
                  {pitch ? pitch.pitchName : ui("owner.allPitches", locale)}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}

      {visible.map((pitch) => {
        const open = expanded.has(pitch.pitchId);
        const shown = open ? pitch.chips : pitch.chips.slice(0, CHIP_LIMIT);
        const hidden = pitch.chips.length - shown.length;
        // One pitch: no label. Two: a label per row. Three or more: the filter chips name them,
        // and the rows keep a label only while "All" is selected.
        const showLabel = showPitchNames && (!filtering || !selected);
        return (
          <div key={pitch.pitchId} className="flex flex-col gap-1">
            {showLabel ? (
              <span className="text-xs font-medium text-muted-foreground">{pitch.pitchName}</span>
            ) : null}
            <ul className="flex flex-wrap gap-2">
              {shown.map((item) => {
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
              {hidden > 0 ? (
                <li>
                  <button
                    type="button"
                    aria-expanded={false}
                    onClick={() => setExpanded((current) => new Set(current).add(pitch.pitchId))}
                    className={cn(chipClass, pressable, "border-dashed")}
                  >
                    <LtrIsolate>{`+${hidden}`}</LtrIsolate> {ui("owner.moreSlots", locale)}
                  </button>
                </li>
              ) : null}
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
          hiddenFields={{
            returnTo: "today",
            date: day,
            ...(selected ? { pitch: selected.pitchId } : {}),
          }}
          submitLabel={ui("owner.book", locale)}
          locale={locale}
        />
      ) : null}
    </section>
  );
}
