"use client";

import { Moon, Sun, Sunrise, type LucideIcon } from "lucide-react";
import { ClockText, LtrIsolate } from "@/components/ui/ltr-isolate";
import { localWallClock } from "@/modules/venue/domain/availability";
import { commonPriceUsd } from "@/modules/booking/domain/free-times";
import { groupByPeriod, type DayPeriod } from "@/modules/booking/domain/day-periods";
import type { SlotPickerPitch, SlotPickerSlot } from "@/modules/booking/ui/slot-picker";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { cn } from "cn";

const PERIOD_ICON: Record<DayPeriod, LucideIcon> = { evening: Moon, afternoon: Sun, morning: Sunrise };

/**
 * The day's times as full-width rows grouped by period (evening first): "5:00 PM – 6:00 PM" at the
 * start, the price and a small accent "Book" button at the end, 56px or taller. A taken time stays
 * as a faded row with "Taken" and no button. The caller drops started times; this component holds
 * no state and does not know the request. With more than one pitch each gets its own section.
 */
export function TimeRows({
  pitches,
  locale,
  timeZone,
  dayStartHour,
  onPick,
}: {
  pitches: SlotPickerPitch[];
  locale: UiLocale;
  timeZone: string;
  dayStartHour: number;
  onPick: (pitchId: string, slot: SlotPickerSlot) => void;
}) {
  const free = pitches.flatMap((pitch) => pitch.slots.filter((slot) => slot.available));
  const common = commonPriceUsd(free);
  const showPitchNames = pitches.length > 1;

  return (
    <div className="flex flex-col gap-5">
      {common ? (
        <h2 className="type-title">
          {ui("public.availableTimes", locale)}
          {" · "}
          <LtrIsolate>{`$${common}`}</LtrIsolate> {ui("public.perGame", locale)}
        </h2>
      ) : null}
      {pitches.map((pitch) => (
        <section key={pitch.id} className="flex flex-col gap-4">
          {showPitchNames ? <h3 className="type-strong">{pitch.name}</h3> : null}
          {groupByPeriod(pitch.slots, (slot) => localWallClock(new Date(slot.startIso), timeZone).hour, dayStartHour).map(
            ({ period, items }) => {
              const Icon = PERIOD_ICON[period];
              return (
                <div key={period} className="flex flex-col gap-2">
                  <h4 className="type-section flex items-center gap-1.5">
                    <Icon aria-hidden className="size-4" />
                    {ui(`public.period.${period}`, locale)}
                  </h4>
                  <ul className="flex flex-col gap-2">
                    {items.map((slot) => (
                      <TimeRow key={slot.startIso} slot={slot} locale={locale} onBook={() => onPick(pitch.id, slot)} />
                    ))}
                  </ul>
                </div>
              );
            },
          )}
        </section>
      ))}
    </div>
  );
}

function TimeRow({ slot, locale, onBook }: { slot: SlotPickerSlot; locale: UiLocale; onBook: () => void }) {
  return (
    <li
      className={cn(
        "flex min-h-14 items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4",
        !slot.available && "opacity-60",
      )}
    >
      <span className="type-strong tabular-nums">
        <ClockText text={slot.startLocal} /> – <ClockText text={slot.endLocal} />
      </span>
      <span className="flex items-center gap-3">
        <LtrIsolate className="type-body tabular-nums">{`$${slot.priceUsd}`}</LtrIsolate>
        {slot.available ? (
          <button
            type="button"
            onClick={onBook}
            className="type-label inline-flex min-h-11 min-w-16 items-center justify-center rounded-full bg-accent-brand px-4 text-accent-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
          >
            {ui("public.book", locale)}
          </button>
        ) : (
          <span className="type-label min-w-16 text-center text-ink-muted">{ui("public.taken", locale)}</span>
        )}
      </span>
    </li>
  );
}
