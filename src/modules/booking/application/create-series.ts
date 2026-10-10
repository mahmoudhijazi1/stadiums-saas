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
  SERIES_MAX_DURATION_MINUTES,
  seriesOccurrences,
} from "@/modules/booking/domain/series";
import { lockPitchForUpdate } from "@/modules/booking/infrastructure/bookings";
import { insertSeries } from "@/modules/booking/infrastructure/series";
import { findOrCreatePerson } from "@/modules/people/application/find-or-create-person";
import { findPersonById } from "@/modules/people/infrastructure/persons";
import { findPitchById } from "@/modules/venue/infrastructure/pitches";
import { parseScheduleConfig } from "@/modules/venue/domain/schedule-config";

export type SeriesPerson = { personId: string } | { name: string; phone: string };

export type CreatedSeries = WeeksResult & { seriesId: string; personId: string };

/**
 * Book a weekly series: `count` weeks (4, 8 or 12) from the anchor, each an ordinary APPROVED
 * owner booking made up front. Needs bookings.create (checked before the transaction). The owner
 * previewed the weeks and sends `acceptedStarts`, the starts they agreed to; each is re-checked
 * under the single pitch lock, and one that became taken since is skipped and returned in
 * `skipped`, never a failure of the series. If nothing could be booked the whole call is refused
 * (booking.series_none) and nothing is written. Pending requests overlapping a created week are
 * declined into interests. 23P01 (the exclusion constraint) aborts with booking.series_retry.
 */
export async function createSeries(input: {
  pitchId: string;
  person: SeriesPerson;
  anchorStart: Date;
  durationMinutes: number;
  count: number;
  acceptedStarts: readonly Date[];
}): Promise<CreatedSeries> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, BOOKINGS_CREATE)) {
    throw new DomainError("access.not_allowed");
  }
  if (
    !isSeriesCount(input.count) ||
    !Number.isInteger(input.durationMinutes) ||
    input.durationMinutes < 15 ||
    input.durationMinutes > SERIES_MAX_DURATION_MINUTES
  ) {
    throw new DomainError("form.invalid");
  }

  const anchor = anchorFromInstant(input.anchorStart, SERIES_TIME_ZONE);
  const starts = seriesOccurrences(anchor, input.count, SERIES_TIME_ZONE);
  const accepted = new Set(input.acceptedStarts.map((start) => start.getTime()));
  if (input.acceptedStarts.some((start) => !starts.some((s) => s.getTime() === start.getTime()))) {
    throw new DomainError("form.invalid");
  }
  const weeks = starts
    .map((start, index) => ({ index, start }))
    .filter((week) => accepted.has(week.start.getTime()));
  if (weeks.length === 0) {
    throw new DomainError("booking.series_none");
  }
  const now = new Date();

  try {
    const created = await db.$transaction(async (tx) => {
      await lockPitchForUpdate(tx, input.pitchId);
      const pitch = await findPitchById(tx, input.pitchId);
      if (!pitch) {
        throw new DomainError("booking.pitch_not_found");
      }
      const person =
        "personId" in input.person
          ? await findPersonById(tx, input.person.personId)
          : await findOrCreatePerson(tx, input.person);
      if (!person) {
        throw new DomainError("booking.requester_not_found");
      }

      const seriesId = await insertSeries(tx, {
        pitchId: pitch.id,
        personId: person.id,
        anchor,
        durationMinutes: input.durationMinutes,
        membershipId: membership.membershipId,
      });
      const result = await createWeeksUnderLock(tx, {
        pitchId: pitch.id,
        config: parseScheduleConfig(pitch.scheduleConfig),
        seriesId,
        personId: person.id,
        durationMinutes: input.durationMinutes,
        weeks,
        now,
      });
      if (result.created.length === 0) {
        throw new DomainError("booking.series_none");
      }
      return { ...result, seriesId, personId: person.id };
    });

    logger.info(
      `Weekly series created ${created.seriesId} games=${created.created.length} skipped=${created.skipped.length}`,
      undefined,
      { useCase: "createSeries", tenantId: await safeTenantId() },
    );
    return created;
  } catch (error) {
    if (isExclusionViolation(error)) {
      logger.error("Series collision", error, { useCase: "createSeries", tenantId: await safeTenantId() });
      throw new DomainError("booking.series_retry");
    }
    return await rethrowUnexpected(error, "Create series failed", "createSeries");
  }
}
