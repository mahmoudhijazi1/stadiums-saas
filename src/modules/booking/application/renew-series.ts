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
import { isSeriesCount, occurrenceIndex, seriesOccurrences } from "@/modules/booking/domain/series";
import { lockPitchForUpdate } from "@/modules/booking/infrastructure/bookings";
import { findSeries, latestSeriesStart } from "@/modules/booking/infrastructure/series";
import { findPitchById } from "@/modules/venue/infrastructure/pitches";
import { parseScheduleConfig } from "@/modules/venue/schemas/schedule-config";

/**
 * Continue a series for `count` more weeks (4, 8 or 12), starting the week after its latest
 * game (any status), with the same rules, re-checks and skipping as createSeries. Same person,
 * pitch, time and length. Needs bookings.create. `acceptedStarts`, when given, limits the weeks
 * to the ones the owner saw in the preview. Lock order: the pitch, then the new rows.
 */
export async function renewSeries(input: {
  seriesId: string;
  count: number;
  acceptedStarts?: readonly Date[];
}): Promise<WeeksResult & { seriesId: string }> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, BOOKINGS_CREATE)) {
    throw new DomainError("access.not_allowed");
  }
  if (!isSeriesCount(input.count)) {
    throw new DomainError("form.invalid");
  }
  const now = new Date();

  try {
    const renewed = await db.$transaction(async (tx) => {
      const found = await findSeries(tx, input.seriesId);
      if (!found) {
        throw new DomainError("booking.series_not_found");
      }
      await lockPitchForUpdate(tx, found.pitchId);
      const pitch = await findPitchById(tx, found.pitchId);
      if (!pitch) {
        throw new DomainError("booking.pitch_not_found");
      }

      const latest = await latestSeriesStart(tx, found.id);
      const firstIndex = latest ? occurrenceIndex(found.anchor, latest, SERIES_TIME_ZONE) + 1 : 1;
      const accepted = input.acceptedStarts ? new Set(input.acceptedStarts.map((s) => s.getTime())) : null;
      const weeks = seriesOccurrences(found.anchor, input.count, SERIES_TIME_ZONE, firstIndex)
        .map((start, offset) => ({ index: firstIndex + offset, start }))
        .filter((week) => accepted === null || accepted.has(week.start.getTime()));

      const result = await createWeeksUnderLock(tx, {
        pitchId: found.pitchId,
        config: parseScheduleConfig(pitch.scheduleConfig),
        seriesId: found.id,
        personId: found.personId,
        durationMinutes: found.durationMinutes,
        weeks,
        now,
      });
      if (result.created.length === 0) {
        throw new DomainError("booking.series_none");
      }
      return { ...result, seriesId: found.id };
    });

    logger.info(
      `Weekly series renewed ${input.seriesId} games=${renewed.created.length} skipped=${renewed.skipped.length}`,
      undefined,
      { useCase: "renewSeries", tenantId: await safeTenantId() },
    );
    return renewed;
  } catch (error) {
    if (isExclusionViolation(error)) {
      logger.error("Renew collision", error, { useCase: "renewSeries", tenantId: await safeTenantId() });
      throw new DomainError("booking.series_retry");
    }
    return await rethrowUnexpected(error, "Renew series failed", "renewSeries");
  }
}
