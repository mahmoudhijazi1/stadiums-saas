"use server";

import { z } from "zod";
import { formatDisplayDate, formatLocalHm } from "@/lib/format/time";
import { getUiLocale } from "@/lib/get-ui-locale";
import { getCurrentTenant } from "@/lib/tenant-context";
import { actionErrorKey } from "@/lib/use-case-error";
import { cancelRestOfSeries } from "@/modules/booking/application/cancel-rest-of-series";
import { loadSeriesCreated, type SeriesCreatedSummary } from "@/modules/booking/application/load-series-created";
import { makeWeekly } from "@/modules/booking/application/make-weekly";
import {
  previewMakeWeekly,
  previewNewSeries,
  previewRenewal,
  type SeriesPreview,
} from "@/modules/booking/application/preview-series";
import { renewSeries } from "@/modules/booking/application/renew-series";
import { loadSeriesSheet, previewCancelRest } from "@/modules/booking/application/series-sheet";
import { bookableCount, declineTotal, type OccurrenceState } from "@/modules/booking/domain/series";
import type { WeekView, PreviewResult, SeriesSaveResult, SeriesWeekView, SeriesSheetResult, CancelRestPreviewResult, CancelRestResult } from "@/modules/booking/ui/action-types";
export type { WeekView, PreviewResult, SeriesSaveResult, SeriesWeekView, SeriesSheetResult, CancelRestPreviewResult, CancelRestResult };

const TIME_ZONE = "Asia/Beirut";



const iso = z.iso.datetime();
const count = z.number().int();
const sourceSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("new"), pitchId: z.string().min(1).max(64), startIso: iso, endIso: iso, count }),
  z.strictObject({ kind: z.literal("booking"), bookingId: z.string().min(1).max(64), count }),
  z.strictObject({ kind: z.literal("renew"), seriesId: z.string().min(1).max(64), count }),
]);

async function weekViews(preview: SeriesPreview): Promise<WeekView[]> {
  const locale = await getUiLocale();
  return preview.items.map((item) => ({
    index: item.index,
    startIso: item.start.toISOString(),
    dateLabel: formatDisplayDate(
      item.start,
      locale,
      { weekday: "short", day: "numeric", month: "short" },
      TIME_ZONE,
    ),
    state: item.state,
    pendingCount: item.pendingCount,
  }));
}

export async function previewSeriesAction(input: unknown): Promise<PreviewResult> {
  try {
    const source = sourceSchema.parse(input);
    let preview: SeriesPreview;
    if (source.kind === "new") {
      const start = new Date(source.startIso);
      const end = new Date(source.endIso);
      preview = await previewNewSeries({
        pitchId: source.pitchId,
        anchorStart: start,
        durationMinutes: (end.getTime() - start.getTime()) / 60_000,
        count: source.count,
      });
    } else if (source.kind === "booking") {
      preview = await previewMakeWeekly({ bookingId: source.bookingId, count: source.count });
    } else {
      preview = await previewRenewal({ seriesId: source.seriesId, count: source.count });
    }
    return {
      ok: true,
      weeks: await weekViews(preview),
      bookable: bookableCount(preview.items),
      declines: declineTotal(preview.items),
    };
  } catch (error) {
    return { error: await actionErrorKey(error, "previewSeriesAction") };
  }
}


const saveSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("booking"),
    bookingId: z.string().min(1).max(64),
    count,
    acceptedStarts: z.array(iso).max(12),
  }),
  z.strictObject({
    kind: z.literal("renew"),
    seriesId: z.string().min(1).max(64),
    count,
    acceptedStarts: z.array(iso).max(12),
  }),
]);

/** "Repeat weekly" on a booking, or "Renew N more weeks" on a series. */
export async function submitSeriesSave(input: unknown): Promise<SeriesSaveResult> {
  try {
    const parsed = saveSchema.parse(input);
    const acceptedStarts = parsed.acceptedStarts.map((value) => new Date(value));
    const result =
      parsed.kind === "booking"
        ? await makeWeekly({ bookingId: parsed.bookingId, count: parsed.count, acceptedStarts })
        : await renewSeries({ seriesId: parsed.seriesId, count: parsed.count, acceptedStarts });

    const tenant = await getCurrentTenant();
    const locale = await getUiLocale();
    const skippedStarts = result.skipped.map((week) => week.start);
    const summary = await loadSeriesCreated({
      seriesId: result.seriesId,
      skippedStarts,
      locale,
      hourCycle: tenant.timeDisplay,
      stadiumName: tenant.name,
    });
    return {
      ok: true,
      summary,
      created: result.created.length,
      skippedLabels: summary?.skippedLabels ?? [],
    };
  } catch (error) {
    return { error: await actionErrorKey(error, "submitSeriesSave") };
  }
}

const seriesIdSchema = z.strictObject({ seriesId: z.string().min(1).max(64) });



/** The weeks of one series, for the series sheet. */
export async function loadSeriesSheetAction(input: unknown): Promise<SeriesSheetResult> {
  try {
    const { seriesId } = seriesIdSchema.parse(input);
    const sheet = await loadSeriesSheet({ seriesId });
    const locale = await getUiLocale();
    const tenant = await getCurrentTenant();
    return {
      ok: true,
      mayRenew: sheet.mayRenew,
      mayCancelRest: sheet.mayCancelRest,
      weeks: sheet.weeks.map((week) => ({
        bookingId: week.bookingId,
        dateLabel: formatDisplayDate(
          week.start,
          locale,
          { weekday: "short", day: "numeric", month: "short" },
          TIME_ZONE,
        ),
        timeLabel: formatLocalHm(week.start, TIME_ZONE, tenant.timeDisplay, locale),
        status:
          week.status === "CANCELLED"
            ? "cancelled"
            : week.status === "NO_SHOW"
              ? "no_show"
              : week.started
                ? "played"
                : "upcoming",
      })),
    };
  } catch (error) {
    return { error: await actionErrorKey(error, "loadSeriesSheetAction") };
  }
}


function shortDate(start: Date, locale: Awaited<ReturnType<typeof getUiLocale>>): string {
  return formatDisplayDate(start, locale, { weekday: "short", day: "numeric", month: "short" }, TIME_ZONE);
}

/** What "Cancel the rest" would do: how many weeks, and which are left alone because they have payments. */
export async function previewCancelRestAction(input: unknown): Promise<CancelRestPreviewResult> {
  try {
    const { seriesId } = seriesIdSchema.parse(input);
    const preview = await previewCancelRest({ seriesId });
    const locale = await getUiLocale();
    return {
      ok: true,
      willCancel: preview.willCancel.length,
      leftAlone: preview.leftAlone.map((week) => shortDate(week.start, locale)),
    };
  } catch (error) {
    return { error: await actionErrorKey(error, "previewCancelRestAction") };
  }
}


/** "Cancel the rest": no fee; weeks with collected money stay and are listed. */
export async function submitCancelRest(input: unknown): Promise<CancelRestResult> {
  try {
    const { seriesId } = seriesIdSchema.parse(input);
    const done = await cancelRestOfSeries({ seriesId });
    const locale = await getUiLocale();
    return {
      ok: true,
      cancelled: done.cancelled.length,
      leftAlone: done.kept.map((week) => shortDate(week.start, locale)),
    };
  } catch (error) {
    return { error: await actionErrorKey(error, "submitCancelRest") };
  }
}
