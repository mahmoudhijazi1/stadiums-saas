"use server";

import { z } from "zod";
import { formatDisplayDate } from "@/lib/format-display-date";
import { getUiLocale } from "@/lib/get-ui-locale";
import { getCurrentTenant } from "@/lib/tenant-context";
import { actionErrorKey } from "@/lib/use-case-error";
import { loadSeriesCreated, type SeriesCreatedSummary } from "@/modules/booking/application/load-series-created";
import { makeWeekly } from "@/modules/booking/application/make-weekly";
import {
  previewMakeWeekly,
  previewNewSeries,
  previewRenewal,
  type SeriesPreview,
} from "@/modules/booking/application/preview-series";
import { renewSeries } from "@/modules/booking/application/renew-series";
import { bookableCount, declineTotal, type OccurrenceState } from "@/modules/booking/domain/series";

const TIME_ZONE = "Asia/Beirut";

/**
 * Weekly series actions. They return results instead of redirecting: the sheet stays open and
 * shows the preview, then what was created. The user and the permissions come from the session
 * inside each use case.
 */
export type WeekView = {
  index: number;
  startIso: string;
  dateLabel: string;
  state: OccurrenceState;
  pendingCount: number;
};

export type PreviewResult =
  | { ok: true; weeks: WeekView[]; bookable: number; declines: number }
  | { error: string };

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

export type SeriesSaveResult =
  | { ok: true; summary: SeriesCreatedSummary | null; created: number; skippedLabels: string[] }
  | { error: string };

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
