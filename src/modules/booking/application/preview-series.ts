import db from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { BOOKINGS_CREATE, can } from "@/modules/access/domain/can";
import { SERIES_TIME_ZONE } from "@/modules/booking/application/series-weeks";
import {
  anchorFromInstant,
  buildSeriesPreview,
  isSeriesCount,
  occurrenceIndex,
  seriesOccurrences,
  standardSeriesMinutes,
  SERIES_MAX_DURATION_MINUTES,
  type OccurrencePreview,
} from "@/modules/booking/domain/series";
import {
  findBookingForDecision,
  listApprovedRanges,
  listPendingBookings,
} from "@/modules/booking/infrastructure/bookings";
import { findBookingSeriesId, findSeries, latestSeriesStart } from "@/modules/booking/infrastructure/series";
import { findPitchById } from "@/modules/venue/infrastructure/pitches";
import { parseScheduleConfig } from "@/modules/venue/schemas/schedule-config";

export type SeriesPreview = {
  pitchId: string;
  durationMinutes: number;
  items: OccurrencePreview[];
};

async function requireCreate() {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, BOOKINGS_CREATE)) {
    throw new DomainError("access.not_allowed");
  }
}

async function preview(input: {
  pitchId: string;
  durationMinutes: number;
  starts: Date[];
  firstIndex: number;
}): Promise<SeriesPreview> {
  const now = new Date();
  const pitch = await findPitchById(db, input.pitchId);
  if (!pitch) {
    throw new DomainError("booking.pitch_not_found");
  }
  const [approved, pending] = await Promise.all([
    listApprovedRanges(db, input.pitchId, now),
    listPendingBookings(db),
  ]);
  return {
    pitchId: input.pitchId,
    durationMinutes: input.durationMinutes,
    items: buildSeriesPreview({
      starts: input.starts,
      firstIndex: input.firstIndex,
      durationMinutes: input.durationMinutes,
      config: parseScheduleConfig(pitch.scheduleConfig),
      approved,
      pending: pending.filter((row) => row.pitchId === input.pitchId),
      now,
      timeZone: SERIES_TIME_ZONE,
    }),
  };
}

/** The weeks of a series that does not exist yet, starting at `anchorStart` (week 0 included). */
export async function previewNewSeries(input: {
  pitchId: string;
  anchorStart: Date;
  durationMinutes: number;
  count: number;
}): Promise<SeriesPreview> {
  await requireCreate();
  if (
    !isSeriesCount(input.count) ||
    !Number.isInteger(input.durationMinutes) ||
    input.durationMinutes < 15 ||
    input.durationMinutes > SERIES_MAX_DURATION_MINUTES
  ) {
    throw new DomainError("form.invalid");
  }
  const anchor = anchorFromInstant(input.anchorStart, SERIES_TIME_ZONE);
  return preview({
    pitchId: input.pitchId,
    durationMinutes: input.durationMinutes,
    starts: seriesOccurrences(anchor, input.count, SERIES_TIME_ZONE),
    firstIndex: 0,
  });
}

/** "Repeat weekly" on an existing booking: the next `count` weeks, starting next week. */
export async function previewMakeWeekly(input: { bookingId: string; count: number }): Promise<SeriesPreview> {
  await requireCreate();
  if (!isSeriesCount(input.count)) {
    throw new DomainError("form.invalid");
  }
  const booking = await findBookingForDecision(db, input.bookingId);
  if (!booking) {
    throw new DomainError("booking.not_found");
  }
  if (booking.status !== "APPROVED") {
    throw new DomainError("booking.confirmed_only");
  }
  if (await findBookingSeriesId(db, booking.id)) {
    throw new DomainError("booking.series_exists");
  }
  const pitch = await findPitchById(db, booking.pitchId);
  if (!pitch) {
    throw new DomainError("booking.pitch_not_found");
  }
  // The standard game, not the booking's own length (it may be extended).
  const durationMinutes = standardSeriesMinutes(parseScheduleConfig(pitch.scheduleConfig));
  const anchor = anchorFromInstant(booking.start, SERIES_TIME_ZONE);
  return preview({
    pitchId: booking.pitchId,
    durationMinutes,
    starts: seriesOccurrences(anchor, input.count, SERIES_TIME_ZONE, 1),
    firstIndex: 1,
  });
}

/** "Renew N more weeks": the weeks after the series' latest game. */
export async function previewRenewal(input: { seriesId: string; count: number }): Promise<SeriesPreview> {
  await requireCreate();
  if (!isSeriesCount(input.count)) {
    throw new DomainError("form.invalid");
  }
  const found = await findSeries(db, input.seriesId);
  if (!found) {
    throw new DomainError("booking.series_not_found");
  }
  const latest = await latestSeriesStart(db, found.id);
  const firstIndex = latest ? occurrenceIndex(found.anchor, latest, SERIES_TIME_ZONE) + 1 : 1;
  return preview({
    pitchId: found.pitchId,
    durationMinutes: found.durationMinutes,
    starts: seriesOccurrences(found.anchor, input.count, SERIES_TIME_ZONE, firstIndex),
    firstIndex,
  });
}
