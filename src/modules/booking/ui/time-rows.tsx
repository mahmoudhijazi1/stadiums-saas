"use client";

import { ChevronRight } from "lucide-react";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { splitDisplayedClock } from "@/lib/format/time";
import { commonPriceUsd } from "@/modules/booking/domain/free-times";
import { compactRange } from "@/modules/booking/domain/compact-range";
import type { SlotPickerPitch, SlotPickerSlot } from "@/modules/booking/ui/slot-picker";
import { compactUsd } from "@/lib/format/money";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { cn } from "cn";

/**
 * How much of the accent tints the "Nearest" pill. The accent text (--action-ink) must reach 4.5:1
 * on it for every preset in both themes: 16% (the app's --accent-subtle) fails for the blue ones,
 * 6% passes (10% still misses by 0.01 for one preset) (test/app/public/header-contrast.test.ts).
 */
export const NEAREST_PILL_TINT_PERCENT = 6;

/**
 * The day's times as one list in time order inside one rounded container with thin dividers. A free
 * row opens the request (the whole row is the button); a taken row stays, faded, with "Taken" and
 * cannot be pressed. The first free time of the day carries a "Nearest" badge. A row shows its price
 * only when it differs from the heading's. The caller drops started times; this holds no state.
 * With more than one pitch each gets its own list under its name.
 */
export function TimeRows({
  pitches,
  locale,
  onPick,
}: {
  pitches: SlotPickerPitch[];
  locale: UiLocale;
  onPick: (pitchId: string, slot: SlotPickerSlot) => void;
}) {
  const free = pitches.flatMap((pitch) => pitch.slots.filter((slot) => slot.available));
  const common = commonPriceUsd(free);
  const nearest = free.reduce<SlotPickerSlot | null>((best, slot) => (!best || slot.startIso < best.startIso ? slot : best), null);
  const minutes = free[0] ? Math.round((new Date(free[0].endIso).getTime() - new Date(free[0].startIso).getTime()) / 60_000) : 0;
  const [beforeN = "", afterN = ""] = ui("public.minutes", locale).split("{n}");
  const showPitchNames = pitches.length > 1;

  return (
    <div className="flex flex-col gap-4">
      {common ? (
        <div className="flex flex-col gap-0.5">
          <h2 className="type-title">{ui("public.availableTimes", locale)}</h2>
          <p className="type-secondary">
            <LtrIsolate>{compactUsd(common)}</LtrIsolate> {ui("public.perGame", locale)}
            {minutes > 0 ? (
              <>
                {" · "}
                {beforeN}
                <LtrIsolate>{String(minutes)}</LtrIsolate>
                {afterN}
              </>
            ) : null}
          </p>
        </div>
      ) : null}
      {pitches.map((pitch) => (
        <section key={pitch.id} className="flex flex-col gap-2">
          {showPitchNames ? <h3 className="type-strong">{pitch.name}</h3> : null}
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {pitch.slots.map((slot) => (
              <TimeRow
                key={slot.startIso}
                slot={slot}
                locale={locale}
                isNearest={slot === nearest}
                showPrice={slot.priceUsd !== common}
                onPick={() => onPick(pitch.id, slot)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TimeRow({
  slot,
  locale,
  isNearest,
  showPrice,
  onPick,
}: {
  slot: SlotPickerSlot;
  locale: UiLocale;
  isNearest: boolean;
  showPrice: boolean;
  onPick: () => void;
}) {
  const range = compactRange(slot.startLocal, slot.endLocal);
  const end = splitDisplayedClock(range.end);
  const label = (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <span className="type-strong tabular-nums">
        <LtrIsolate>{`${range.start} – ${end.digits}`}</LtrIsolate>
        {end.period ? ` ${end.period}` : ""}
      </span>
      {isNearest ? (
        <span
          className="type-caption shrink-0 rounded-full px-2 py-0.5 font-semibold text-action-ink"
          style={{ backgroundColor: `color-mix(in oklab, var(--brand) ${NEAREST_PILL_TINT_PERCENT}%, var(--surface))` }}
        >{ui("public.nearest", locale)}</span>
      ) : null}
    </span>
  );
  const price = showPrice ? <LtrIsolate className="type-secondary tabular-nums">{compactUsd(slot.priceUsd)}</LtrIsolate> : null;

  if (!slot.available) {
    return (
      <li aria-disabled="true" className="flex min-h-14 items-center gap-3 px-4 opacity-60">
        {label}
        {price}
        <span className="type-label text-ink">{ui("public.taken", locale)}</span>
      </li>
    );
  }
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className={cn(
          "flex min-h-14 w-full items-center gap-3 px-4 text-start outline-none hover:bg-surface-2",
          "focus-visible:bg-surface-2 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-brand",
        )}
      >
        {label}
        {price}
        <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-muted rtl:-scale-x-100" />
      </button>
    </li>
  );
}
