"use client";

import { useEffect, useState, type Ref } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { errorMessage } from "@/lib/copy/errors";
import type { UiLocale } from "@/lib/locale";
import { seriesGamesCount, ui } from "@/lib/copy";
import {
  loadSeriesSheetAction,
  previewCancelRestAction,
  submitCancelRest,
  type SeriesSheetResult,
} from "./actions";
import { WeeklyConfirm } from "./weekly-confirm";

type View = "list" | "renew" | "cancel" | "cancelled";

/**
 * The series sheet: the weeks with their status, "Renew 8 more weeks" (the same chips and preview
 * as creating) and "Cancel the rest" (no fee; a confirm lists the weeks left alone because they
 * have payments). One primary button per view.
 */
export function SeriesManage({
  seriesId,
  locale,
  confirmRef,
  onBack,
}: {
  seriesId: string;
  locale: UiLocale;
  confirmRef: Ref<HTMLButtonElement>;
  onBack: () => void;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("list");
  const [sheet, setSheet] = useState<SeriesSheetResult | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadSeriesSheetAction({ seriesId }).then((result) => {
      if (!cancelled) setSheet(result);
    });
    return () => {
      cancelled = true;
    };
  }, [seriesId, reload]);

  if (!sheet) return <p className="type-secondary">{ui("owner.seriesChecking", locale)}</p>;
  if ("error" in sheet) {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="type-secondary text-owed">
          {errorMessage(sheet.error, locale)}
        </p>
        <Button type="button" ref={confirmRef} className="w-full" onClick={onBack}>
          {ui("owner.cancelBack", locale)}
        </Button>
      </div>
    );
  }

  if (view === "renew") {
    return (
      <WeeklyConfirm
        source={{ kind: "renew", seriesId }}
        locale={locale}
        confirmRef={confirmRef}
        onBack={() => {
          setView("list");
          setReload((value) => value + 1);
        }}
      />
    );
  }
  if (view === "cancel" || view === "cancelled") {
    return (
      <CancelRest
        seriesId={seriesId}
        locale={locale}
        confirmRef={confirmRef}
        onBack={() => {
          setView("list");
          setReload((value) => value + 1);
          router.refresh();
        }}
        onDone={() => setView("cancelled")}
        finished={view === "cancelled"}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col overflow-hidden rounded-xl border bg-card" aria-label={ui("owner.seriesSheetTitle", locale)}>
        {sheet.weeks.map((week) => (
          <li key={week.bookingId} className="flex items-center justify-between gap-3 border-b px-4 py-2 last:border-b-0">
            <span className="type-body">
              <LtrIsolate>{week.dateLabel}</LtrIsolate> <LtrIsolate>{week.timeLabel}</LtrIsolate>
            </span>
            <span className="type-caption text-muted-foreground">
              {ui(`owner.seriesWeek.${week.status}`, locale)}
            </span>
          </li>
        ))}
      </ul>
      {sheet.mayRenew ? (
        <Button type="button" ref={confirmRef} className="w-full" onClick={() => setView("renew")}>
          {ui("owner.seriesRenew", locale)}
        </Button>
      ) : null}
      {sheet.mayCancelRest ? (
        <Button
          type="button"
          variant="ghost"
          className="w-full text-destructive"
          onClick={() => setView("cancel")}
        >
          {ui("owner.seriesCancelRest", locale)}
        </Button>
      ) : null}
      <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
        {ui("owner.cancelBack", locale)}
      </Button>
    </div>
  );
}

function CancelRest({
  seriesId,
  locale,
  confirmRef,
  onBack,
  onDone,
  finished,
}: {
  seriesId: string;
  locale: UiLocale;
  confirmRef: Ref<HTMLButtonElement>;
  onBack: () => void;
  onDone: () => void;
  finished: boolean;
}) {
  const [preview, setPreview] = useState<{ willCancel: number; leftAlone: string[] } | null>(null);
  const [result, setResult] = useState<{ cancelled: number; leftAlone: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    previewCancelRestAction({ seriesId }).then((value) => {
      if (cancelled) return;
      if ("error" in value) setError(errorMessage(value.error, locale));
      else setPreview({ willCancel: value.willCancel, leftAlone: value.leftAlone });
    });
    return () => {
      cancelled = true;
    };
  }, [seriesId, locale]);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const done = await submitCancelRest({ seriesId });
      if ("error" in done) {
        setError(errorMessage(done.error, locale));
        return;
      }
      setResult({ cancelled: done.cancelled, leftAlone: done.leftAlone });
      onDone();
    } catch {
      setError(errorMessage("error.generic", locale));
    } finally {
      setBusy(false);
    }
  }

  if (finished && result) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="type-strong">
          {ui("owner.seriesCancelDone", locale).replace("{games}", seriesGamesCount(result.cancelled, locale))}
        </p>
        <LeftAlone weeks={result.leftAlone} locale={locale} />
        <Button type="button" ref={confirmRef} className="w-full" onClick={onBack}>
          {ui("owner.seriesDone", locale)}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {preview ? (
        <>
          <p className="type-body">
            {ui("owner.seriesCancelAsk", locale).replace("{games}", seriesGamesCount(preview.willCancel, locale))}
          </p>
          <LeftAlone weeks={preview.leftAlone} locale={locale} />
        </>
      ) : error ? null : (
        <p className="type-secondary">{ui("owner.seriesChecking", locale)}</p>
      )}
      {error ? (
        <p role="alert" className="type-secondary text-owed">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        ref={confirmRef}
        className="w-full"
        disabled={!preview || preview.willCancel === 0 || busy}
        onClick={confirm}
      >
        {ui("owner.seriesCancelConfirm", locale)}
      </Button>
      <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={onBack}>
        {ui("owner.cancelBack", locale)}
      </Button>
    </div>
  );
}

function LeftAlone({ weeks, locale }: { weeks: string[]; locale: UiLocale }) {
  if (weeks.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <p className="type-secondary text-owed">{ui("owner.seriesLeftAlone", locale)}</p>
      <LtrIsolate className="type-body">{weeks.join(" · ")}</LtrIsolate>
    </div>
  );
}
