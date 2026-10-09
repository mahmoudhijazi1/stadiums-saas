import db from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { BOOKINGS_CANCEL, BOOKINGS_CREATE, can } from "@/modules/access/domain/can";
import { findSeries, listSeriesOccurrences, listUpcomingApprovedIds } from "@/modules/booking/infrastructure/series";
import { findBookingForDecision } from "@/modules/booking/infrastructure/bookings";
import { sumCollectedUsd } from "@/modules/payment/infrastructure/payments";

export type SeriesSheetWeek = {
  bookingId: string;
  start: Date;
  end: Date;
  status: string;
  /** The game has started (or is over): it is history now. */
  started: boolean;
};

export type SeriesSheet = {
  seriesId: string;
  weeks: SeriesSheetWeek[];
  mayRenew: boolean;
  mayCancelRest: boolean;
};

/** The weeks of one series with their status, for the series sheet. Any logged-in member may look. */
export async function loadSeriesSheet(input: { seriesId: string; now?: Date }): Promise<SeriesSheet> {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new DomainError("access.not_allowed");
  }
  const found = await findSeries(db, input.seriesId);
  if (!found) {
    throw new DomainError("booking.series_not_found");
  }
  const now = input.now ?? new Date();
  const weeks = await listSeriesOccurrences(db, found.id);
  return {
    seriesId: found.id,
    weeks: weeks.map((week) => ({
      bookingId: week.id,
      start: week.start,
      end: week.end,
      status: week.status,
      started: week.start.getTime() <= now.getTime(),
    })),
    mayRenew: can(membership, BOOKINGS_CREATE),
    mayCancelRest: can(membership, BOOKINGS_CANCEL),
  };
}

export type CancelRestPreview = {
  /** Upcoming APPROVED weeks with nothing collected: they would be cancelled, no fee. */
  willCancel: { bookingId: string; start: Date }[];
  /** Weeks with collected money: left alone, to be cancelled one by one. */
  leftAlone: { bookingId: string; start: Date }[];
};

/** What "Cancel the rest" would do, before it does it (the confirm lists the weeks left alone). */
export async function previewCancelRest(input: { seriesId: string; now?: Date }): Promise<CancelRestPreview> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, BOOKINGS_CANCEL)) {
    throw new DomainError("access.not_allowed");
  }
  const found = await findSeries(db, input.seriesId);
  if (!found) {
    throw new DomainError("booking.series_not_found");
  }
  const preview: CancelRestPreview = { willCancel: [], leftAlone: [] };
  for (const id of await listUpcomingApprovedIds(db, found.id, input.now ?? new Date())) {
    const booking = await findBookingForDecision(db, id);
    if (!booking) continue;
    const collected = await sumCollectedUsd(db, "BOOKING", id);
    (collected.gt(0) ? preview.leftAlone : preview.willCancel).push({ bookingId: id, start: booking.start });
  }
  return preview;
}
