import type { SeriesCreatedSummary } from "@/modules/booking/domain/series-created";
import type { OccurrenceState } from "@/modules/booking/domain/series";

/**
 * Thin: each use case authorizes (shop.sell, bookings.adjust_due, payments.collect), reads the
 * prices itself and writes in one transaction. The client sends ids and quantities, never a price.
 * The booking sheet refreshes the page after a success.
 */
export type ItemsResult = { ok: true; itemCount?: number; changeLbp?: string; changeUsd?: string } | { error: string };

export type PayerHit = { id: string; name: string; phone: string | null };

/**
 * Extend a game by 30 minutes. Returns a result instead of redirecting: the confirm sheet stays
 * open and shows the new range and the new due. The user and the permission come from the session
 * inside the use case; `expectedEndsAt` is the end the owner saw (a double tap adds 30 minutes once).
 */
export type ExtendActionResult =
  | { ok: true; amountDueUsd: string; addedPriceUsd: string; declined: number }
  | { error: string };

/**
 * Per-player actions (SPEC-15 slice 2). They do not redirect: ten taps in a row must
 * keep the sheet open. The result carries an error key; success revalidates Today.
 */
export type PerPlayerResult =
  | { ok: true; changeUsd?: string; changeLbp?: string }
  | { error: string };

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

export type SeriesSaveResult =
  | { ok: true; summary: SeriesCreatedSummary | null; created: number; skippedLabels: string[] }
  | { error: string };

export type SeriesWeekView = {
  bookingId: string;
  dateLabel: string;
  timeLabel: string;
  status: "upcoming" | "played" | "cancelled" | "no_show";
};

export type SeriesSheetResult =
  | { ok: true; weeks: SeriesWeekView[]; mayRenew: boolean; mayCancelRest: boolean }
  | { error: string };

export type CancelRestPreviewResult =
  | { ok: true; willCancel: number; leftAlone: string[] }
  | { error: string };

export type CancelRestResult =
  | { ok: true; cancelled: number; leftAlone: string[] }
  | { error: string };
