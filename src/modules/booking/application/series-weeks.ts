import type { TenantTx } from "@/lib/db";
import {
  rejectOverlappingPending,
  type AutoRejectedPerson,
} from "@/modules/booking/application/reject-overlapping-pending";
import { classifyOccurrence, type OccurrenceState } from "@/modules/booking/domain/series";
import {
  insertApprovedOwnerBooking,
  insertRequesterParticipant,
  listApprovedRanges,
} from "@/modules/booking/infrastructure/bookings";
import type { ScheduleConfig } from "@/modules/venue/domain/schedule-config";

export const SERIES_TIME_ZONE = "Asia/Beirut";

export type SkippedWeek = { index: number; start: Date; reason: OccurrenceState };
export type CreatedWeek = { bookingId: string; index: number; start: Date; end: Date };

export type WeeksResult = {
  created: CreatedWeek[];
  /** Weeks that failed the re-check under the pitch lock (taken, outside hours, started). */
  skipped: SkippedWeek[];
  /** Pending requests declined by the weeks that were created, kept as interests. */
  declined: AutoRejectedPerson[];
};

/**
 * Create these weeks as ordinary APPROVED owner bookings, priced at their own time. The caller
 * holds the PITCH lock (once, for the whole series) and passes the weeks the owner accepted. Each
 * week is re-checked here against the hours and the APPROVED games as they are now: a week that
 * became taken since the preview is skipped and reported, never a failure of the series. Pending
 * requests overlapping a created week are rejected and recorded as interests, as approval does.
 * The exclusion constraint stays the backstop (the caller maps 23P01).
 */
export async function createWeeksUnderLock(
  tx: TenantTx,
  input: {
    pitchId: string;
    config: ScheduleConfig;
    seriesId: string;
    personId: string;
    durationMinutes: number;
    weeks: readonly { index: number; start: Date }[];
    now: Date;
  },
): Promise<WeeksResult> {
  const approved = await listApprovedRanges(tx, input.pitchId, input.now);
  const result: WeeksResult = { created: [], skipped: [], declined: [] };

  for (const week of input.weeks) {
    const verdict = classifyOccurrence({
      index: week.index,
      start: week.start,
      durationMinutes: input.durationMinutes,
      config: input.config,
      approved,
      pending: [],
      now: input.now,
      timeZone: SERIES_TIME_ZONE,
    });
    if (verdict.state !== "free" || verdict.priceUsd === null) {
      result.skipped.push({ index: week.index, start: week.start, reason: verdict.state });
      continue;
    }

    const bookingId = await insertApprovedOwnerBooking(tx, {
      pitchId: input.pitchId,
      start: verdict.start,
      end: verdict.end,
      priceUsd: verdict.priceUsd,
      seriesId: input.seriesId,
    });
    await insertRequesterParticipant(tx, {
      bookingId,
      personId: input.personId,
      amountDueUsd: verdict.priceUsd,
    });
    result.declined.push(
      ...(await rejectOverlappingPending(tx, {
        id: bookingId,
        pitchId: input.pitchId,
        start: verdict.start,
        end: verdict.end,
      })),
    );
    approved.push({ pitchId: input.pitchId, start: verdict.start, end: verdict.end });
    result.created.push({ bookingId, index: week.index, start: verdict.start, end: verdict.end });
  }
  return result;
}
