"use client";

import { useState, type Ref } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { errorMessage } from "@/lib/copy/errors";
import type { UiLocale } from "@/lib/locale";
import { seriesGamesCount, seriesGamesLabel, ui } from "@/lib/copy";
import type { SeriesCreatedSummary } from "@/modules/booking/application/load-series-created";
import { submitSeriesSave } from "./actions";
import { WeeklyPreview, type PreviewSource, type PreviewState } from "./weekly-preview";

/**
 * What was created: the weekday and time, the first date, how many games, any week skipped since
 * the preview, and the WhatsApp confirmation (the SERIES_CONFIRMED text).
 */
export function SeriesCreatedPanel({
  summary,
  skippedLabels,
  locale,
  onDone,
  doneRef,
}: {
  summary: SeriesCreatedSummary;
  skippedLabels: string[];
  locale: UiLocale;
  onDone: () => void;
  doneRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p role="status" className="type-strong">
          {ui("owner.seriesCreatedTitle", locale)}
        </p>
        <p className="type-body">
          <bdi>{summary.personName}</bdi>
        </p>
        <p className="type-secondary">
          {ui("owner.seriesCreatedLine", locale)
            .replace("{weekday}", summary.weekdayLabel)
            .replace("{time}", "⁦" + summary.timeLabel + "⁩")
            .replace("{day}", summary.firstDateLabel)}
        </p>
        <p className="type-secondary">{seriesGamesCount(summary.games, locale)}</p>
      </div>
      {skippedLabels.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="type-secondary text-owed">{ui("owner.seriesSkippedLead", locale)}</p>
          <LtrIsolate className="type-body">{skippedLabels.join(" · ")}</LtrIsolate>
        </div>
      ) : null}
      {summary.whatsAppHref ? (
        <Button asChild variant="outline" className="w-full">
          <a href={summary.whatsAppHref} target="_blank" rel="noopener noreferrer">
            {ui("owner.seriesWhatsApp", locale)}
          </a>
        </Button>
      ) : null}
      <Button type="button" ref={doneRef} className="w-full" onClick={onDone}>
        {ui("owner.seriesDone", locale)}
      </Button>
    </div>
  );
}

/**
 * The confirm step for "Repeat weekly" on a booking and "Renew N more weeks" on a series: the same
 * chips and preview as the quick booking, one primary button that says the real count, then the
 * result.
 */
export function WeeklyConfirm({
  source,
  locale,
  confirmRef,
  onBack,
}: {
  source: Extract<PreviewSource, { kind: "booking" } | { kind: "renew" }>;
  locale: UiLocale;
  confirmRef?: Ref<HTMLButtonElement>;
  onBack: () => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<PreviewState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ summary: SeriesCreatedSummary | null; skippedLabels: string[] } | null>(null);

  async function confirm() {
    if (!state) return;
    setError(null);
    setBusy(true);
    try {
      const result = await submitSeriesSave({
        ...source,
        count: state.count,
        acceptedStarts: state.acceptedStarts,
      });
      if ("error" in result) {
        setError(errorMessage(result.error, locale));
        return;
      }
      setDone({ summary: result.summary, skippedLabels: result.skippedLabels });
      router.refresh();
    } catch {
      setError(errorMessage("error.generic", locale));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return done.summary ? (
      <SeriesCreatedPanel
        summary={done.summary}
        skippedLabels={done.skippedLabels}
        locale={locale}
        onDone={onBack}
        doneRef={confirmRef}
      />
    ) : (
      <Button type="button" ref={confirmRef} className="w-full" onClick={onBack}>
        {ui("owner.seriesDone", locale)}
      </Button>
    );
  }

  const ready = state !== null && !state.loading && !state.error && state.bookable > 0;
  return (
    <div className="flex flex-col gap-4">
      <WeeklyPreview source={source} locale={locale} onState={setState} />
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
      {error ? (
        <p role="alert" className="type-secondary text-owed">
          {error}
        </p>
      ) : null}
      <Button type="button" ref={confirmRef} className="w-full" disabled={!ready || busy} onClick={confirm}>
        {ready ? seriesGamesLabel("add", state.bookable, locale) : ui("owner.seriesChecking", locale)}
      </Button>
      <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={onBack}>
        {ui("owner.cancelBack", locale)}
      </Button>
    </div>
  );
}

/**
 * Opens on Today right after a series was booked from the quick-booking sheet (the action
 * redirects with ?series=…). Closing it drops the query so a refresh does not reopen it.
 */
export function SeriesCreatedSheet({
  summary,
  skippedLabels,
  locale,
  closeHref,
}: {
  summary: SeriesCreatedSummary;
  skippedLabels: string[];
  locale: UiLocale;
  closeHref: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  function close() {
    setOpen(false);
    router.replace(closeHref);
  }
  return (
    <BottomSheet open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <BottomSheetContent closeLabel={ui("dialog.close", locale)}>
        <BottomSheetHeader>
          <BottomSheetTitle>{ui("owner.seriesCreatedTitle", locale)}</BottomSheetTitle>
        </BottomSheetHeader>
        <BottomSheetBody className="pb-4">
          <SeriesCreatedPanel summary={summary} skippedLabels={skippedLabels} locale={locale} onDone={close} />
        </BottomSheetBody>
      </BottomSheetContent>
    </BottomSheet>
  );
}
