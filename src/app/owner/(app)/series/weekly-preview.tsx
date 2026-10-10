"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { errorMessage } from "@/lib/error-messages";
import type { UiLocale } from "@/lib/locale";
import { seriesGamesLabel, ui } from "@/lib/ui-copy";
import { previewSeriesAction, type WeekView } from "./actions";

export const WEEK_CHOICES = [4, 8, 12] as const;
export const DEFAULT_WEEKS = 8;

/** Where the weeks come from: a new series at this slot, a booking made weekly, or a renewal. */
export type PreviewSource =
  | { kind: "new"; pitchId: string; startIso: string; endIso: string }
  | { kind: "booking"; bookingId: string }
  | { kind: "renew"; seriesId: string };

export type PreviewState = {
  count: number;
  loading: boolean;
  error: string | null;
  /** The starts of the weeks that are free: what the owner agrees to. */
  acceptedStarts: string[];
  bookable: number;
  declines: number;
};

/**
 * 4 / 8 / 12 chips and the list of weeks (date, and a mark for taken, outside hours, past or "N
 * requests will be declined"). It fetches the preview itself and reports the state to the parent,
 * which owns the button that says the real count.
 */
export function WeeklyPreview({
  source,
  locale,
  onState,
}: {
  source: PreviewSource;
  locale: UiLocale;
  onState: (state: PreviewState) => void;
}) {
  const [count, setCount] = useState<number>(DEFAULT_WEEKS);
  const [weeks, setWeeks] = useState<WeekView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sourceKey = JSON.stringify(source);
  const latest = useRef(0);
  const report = useRef(onState);
  useEffect(() => {
    report.current = onState;
  });

  useEffect(() => {
    const ticket = latest.current + 1;
    latest.current = ticket;
    report.current({ count, loading: true, error: null, acceptedStarts: [], bookable: 0, declines: 0 });
    previewSeriesAction({ ...JSON.parse(sourceKey), count }).then(
      (result) => {
        if (latest.current !== ticket) return; // a newer choice is already loading
        if ("error" in result) {
          const message = errorMessage(result.error, locale);
          setError(message);
          setWeeks(null);
          report.current({ count, loading: false, error: message, acceptedStarts: [], bookable: 0, declines: 0 });
          return;
        }
        setError(null);
        setWeeks(result.weeks);
        report.current({
          count,
          loading: false,
          error: null,
          acceptedStarts: result.weeks.filter((week) => week.state === "free").map((week) => week.startIso),
          bookable: result.bookable,
          declines: result.declines,
        });
      },
      () => {
        if (latest.current !== ticket) return;
        const message = errorMessage("error.generic", locale);
        setError(message);
        report.current({ count, loading: false, error: message, acceptedStarts: [], bookable: 0, declines: 0 });
      },
    );
  }, [count, sourceKey, locale]);

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2">
        <legend className="type-label">{ui("owner.seriesWeeks", locale)}</legend>
        <div className="flex gap-2">
          {WEEK_CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              aria-pressed={count === choice}
              onClick={() => setCount(choice)}
              className={cn(
                "flex min-h-11 flex-1 items-center justify-center rounded-[var(--radius-control)] border type-label outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                count === choice && "bg-selected text-selected-ink",
              )}
            >
              <LtrIsolate>{choice}</LtrIsolate>
            </button>
          ))}
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className="type-secondary text-owed">
          {error}
        </p>
      ) : null}
      {weeks === null && !error ? <p className="type-secondary">{ui("owner.seriesChecking", locale)}</p> : null}
      {weeks ? (
        <ul className="flex flex-col overflow-hidden rounded-xl border bg-card" aria-label={ui("owner.seriesWeeks", locale)}>
          {weeks.map((week) => (
            <li key={week.startIso} className="flex items-center justify-between gap-3 border-b px-4 py-2 last:border-b-0">
              <LtrIsolate className={cn("type-body", week.state !== "free" && "text-muted-foreground line-through")}>
                {week.dateLabel}
              </LtrIsolate>
              <WeekMark week={week} locale={locale} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function WeekMark({ week, locale }: { week: WeekView; locale: UiLocale }) {
  if (week.state === "free") {
    return week.pendingCount > 0 ? (
      <span className="type-caption text-owed">
        {ui("owner.seriesDeclines", locale).replace("{n}", String(week.pendingCount))}
      </span>
    ) : null;
  }
  const key =
    week.state === "taken"
      ? "owner.seriesTaken"
      : week.state === "outside_hours"
        ? "owner.seriesOutside"
        : "owner.seriesPast";
  return <span className="type-caption text-muted-foreground">{ui(key, locale)}</span>;
}

/**
 * The "Repeat weekly" switch inside the quick-booking sheet. On: the chips and the preview, hidden
 * fields for the action (`weeklyCount` and one `acceptedStart` per free week), and the primary
 * button says the real count ("Book 7 games"). Off: it renders nothing into the form.
 */
export function WeeklyFields({
  pitchId,
  startIso,
  endIso,
  locale,
  setSubmitLabel,
}: {
  pitchId: string;
  startIso: string;
  endIso: string;
  locale: UiLocale;
  setSubmitLabel: (label: string | null) => void;
}) {
  const [on, setOn] = useState(false);
  const [state, setState] = useState<PreviewState | null>(null);

  useEffect(() => {
    if (on && state && !state.loading && !state.error && state.bookable > 0) {
      setSubmitLabel(seriesGamesLabel("book", state.bookable, locale));
    } else {
      setSubmitLabel(null);
    }
    return () => setSubmitLabel(null);
  }, [on, state, locale, setSubmitLabel]);

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn((value) => !value)}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-1 type-body text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span>{ui("owner.repeatWeekly", locale)}</span>
        <span
          aria-hidden
          className={cn(
            "flex h-6 w-11 shrink-0 items-center rounded-full border px-0.5 transition-colors",
            on ? "bg-selected" : "bg-surface-2",
          )}
        >
          <span
            className={cn(
              "size-5 rounded-full bg-card shadow-xs transition-transform motion-reduce:transition-none",
              on && "translate-x-5 rtl:-translate-x-5",
            )}
          />
        </span>
      </button>
      {on ? (
        <>
          <WeeklyPreview source={{ kind: "new", pitchId, startIso, endIso }} locale={locale} onState={setState} />
          {state && state.declines > 0 ? (
            <p role="status" className="type-secondary text-owed">
              {ui("owner.seriesDeclines", locale).replace("{n}", String(state.declines))}
            </p>
          ) : null}
          {state && !state.loading && !state.error && state.bookable === 0 ? (
            <p role="status" className="type-secondary text-owed">
              {ui("owner.seriesNone", locale)}
            </p>
          ) : null}
          <input type="hidden" name="weeklyCount" value={state?.count ?? DEFAULT_WEEKS} />
          {(state?.acceptedStarts ?? []).map((start) => (
            <input key={start} type="hidden" name="acceptedStart" value={start} />
          ))}
        </>
      ) : null}
    </div>
  );
}
