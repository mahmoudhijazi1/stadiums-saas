import db from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { BOOKINGS_CREATE, can } from "@/modules/access/domain/can";
import {
  createWeeksUnderLock,
  SERIES_TIME_ZONE,
  type WeeksResult,
} from "@/modules/booking/application/series-weeks";
import { isExclusionViolation } from "@/modules/booking/domain/exclusion";
import {
  anchorFromInstant,
  isSeriesCount,
  seriesOccurrences,
  standardSeriesMinutes,
} from "@/modules/booking/domain/series";
import {
  findBookingForDecision,
  findBookingForUpdate,
  findRequesterPersonId,
  lockPitchForUpdate,
} from "@/modules/booking/infrastructure/bookings";
import {
  findBookingSeriesId,
  insertSeries,
  linkBookingToSeries,
} from "@/modules/booking/infrastructure/series";
import { findPitchById } from "@/modules/venue/infrastructure/pitches";
import { parseScheduleConfig } from "@/modules/venue/domain/schedule-config";

export type MadeWeekly = WeeksResult & { seriesId: string };

/**
 * Turn one APPROVED booking into a weekly series: the booking's own start is the anchor and it
 * is linked as week 0, then the next `count` weeks (4, 8 or 12) are created the same way as
 * createSeries (same re-checks, same skipping). Refused when the booking is not APPROVED, is
 * already in a series. The series length is the pitch's standard game, never the booking's own
 * (an extension belongs to its week only); the booking keeps its range. Lock order: the pitch,
 * then the booking row, then the new rows. `acceptedStarts`, when given, limits the
 * weeks to the ones the owner saw in the preview. Needs bookings.create.
 */
export async function makeWeekly(input: {
  bookingId: string;
  count: number;
  acceptedStarts?: readonly Date[];
}): Promise<MadeWeekly> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, BOOKINGS_CREATE)) {
    throw new DomainError("access.not_allowed");
  }
  if (!isSeriesCount(input.count)) {
    throw new DomainError("form.invalid");
  }
  const now = new Date();

  try {
    const made = await db.$transaction(async (tx) => {
      const loaded = await findBookingForDecision(tx, input.bookingId);
      if (!loaded) {
        throw new DomainError("booking.not_found");
      }
      await lockPitchForUpdate(tx, loaded.pitchId);
      const booking = await findBookingForUpdate(tx, input.bookingId);
      if (!booking) {
        throw new DomainError("booking.not_found");
      }
      if (booking.status !== "APPROVED") {
        throw new DomainError("booking.confirmed_only");
      }
      if (await findBookingSeriesId(tx, booking.id)) {
        throw new DomainError("booking.series_exists");
      }
      const personId = await findRequesterPersonId(tx, booking.id);
      if (!personId) {
        throw new DomainError("booking.requester_not_found");
      }
      const pitch = await findPitchById(tx, booking.pitchId);
      if (!pitch) {
        throw new DomainError("booking.pitch_not_found");
      }
      const config = parseScheduleConfig(pitch.scheduleConfig);
      // The standard game length, not the source booking's (it may be extended). The source keeps its own range.
      const durationMinutes = standardSeriesMinutes(config);

      const anchor = anchorFromInstant(booking.start, SERIES_TIME_ZONE);
      const seriesId = await insertSeries(tx, {
        pitchId: booking.pitchId,
        personId,
        anchor,
        durationMinutes,
        membershipId: membership.membershipId,
      });
      await linkBookingToSeries(tx, booking.id, seriesId);

      const accepted = input.acceptedStarts ? new Set(input.acceptedStarts.map((s) => s.getTime())) : null;
      const weeks = seriesOccurrences(anchor, input.count, SERIES_TIME_ZONE, 1)
        .map((start, offset) => ({ index: offset + 1, start }))
        .filter((week) => accepted === null || accepted.has(week.start.getTime()));

      const result = await createWeeksUnderLock(tx, {
        pitchId: booking.pitchId,
        config,
        seriesId,
        personId,
        durationMinutes,
        weeks,
        now,
      });
      return { ...result, seriesId };
    });

    logger.info(
      `Booking made weekly ${input.bookingId} games=${made.created.length} skipped=${made.skipped.length}`,
      undefined,
      { useCase: "makeWeekly", tenantId: await safeTenantId() },
    );
    return made;
  } catch (error) {
    if (isExclusionViolation(error)) {
      logger.error("Weekly collision", error, { useCase: "makeWeekly", tenantId: await safeTenantId() });
      throw new DomainError("booking.series_retry");
    }
    return await rethrowUnexpected(error, "Make weekly failed", "makeWeekly");
  }
}
