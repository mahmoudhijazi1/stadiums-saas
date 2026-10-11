"use client";

import { ClockText, IsolatedDigits, LtrIsolate } from "@/components/ui/ltr-isolate";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";

/**
 * The nearest free time as the one big figure of the page, with its price and length and a primary
 * "Book now". The caller decides the day label and what Book does (open the request sheet); it
 * renders nothing when there is no free time at all.
 */
export function NextFreeCard({
  dayLabel,
  startLocal,
  priceUsd,
  durationMinutes,
  locale,
  onBook,
}: {
  dayLabel: string;
  startLocal: string;
  priceUsd: string;
  durationMinutes: number;
  locale: UiLocale;
  onBook: () => void;
}) {
  const [beforeN = "", afterN = ""] = ui("public.minutes", locale).split("{n}");
  return (
    <section
      aria-labelledby="next-free-heading"
      className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h2 id="next-free-heading" className="type-section">
          {ui("public.nextFreeTime", locale)} · <IsolatedDigits text={dayLabel} />
        </h2>
        <ClockText text={startLocal} className="font-display text-4xl leading-none font-extrabold tabular-nums" />
        <p className="type-secondary">
          <LtrIsolate>{`$${priceUsd}`}</LtrIsolate> · {beforeN}
          <LtrIsolate>{String(durationMinutes)}</LtrIsolate>
          {afterN}
        </p>
      </div>
      <button
        type="button"
        onClick={onBook}
        className="type-button inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-accent-brand px-5 text-accent-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
      >
        {ui("public.bookNow", locale)}
      </button>
    </section>
  );
}
