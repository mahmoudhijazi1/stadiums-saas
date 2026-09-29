import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import {
  addCalendarDays,
  generateSlotsForDay,
  type CivilDate,
} from "@/modules/venue/domain/availability";
import type { ScheduleConfig } from "@/modules/venue/schemas/schedule-config";

export type UtcRange = { start: Date; end: Date };

/**
 * Confirm this UTC window is a slot Venue would offer, and its start is still in the
 * future (same cutoff as dropEndedSlots / booking.slot_ended). `localDate` is the civil
 * day of the start; the day before is checked too, because a window that crosses
 * midnight (22:00–02:00) offers its 00:00 and 01:00 slots under its own day (BR-7).
 * The price then comes from that window's day.
 * Price is copied from the engine — never trusted from the requester (DR-002 §2.18).
 * Pass APPROVED ranges as occupied so a taken hour fails (SPEC-05). Default [] = none taken.
 */
export function resolveOfferedSlot(input: {
  config: ScheduleConfig;
  localDate: CivilDate;
  timeZone: string;
  start: Date;
  end: Date;
  now: Date;
  occupied?: UtcRange[];
  /** "They played" on a missed request. Skips the future-start check only. */
  allowStarted?: boolean;
}): { start: Date; end: Date; priceUsd: Decimal } {
  const offered = [input.localDate, addCalendarDays(input.localDate, -1)]
    .flatMap((localDate) =>
      generateSlotsForDay({
        config: input.config,
        localDate,
        timeZone: input.timeZone,
        occupied: input.occupied ?? [],
      }),
    )
    .find(
      (slot) =>
        slot.start.getTime() === input.start.getTime() &&
        slot.end.getTime() === input.end.getTime(),
    );

  if (!offered) {
    throw new DomainError("booking.slot_not_offered");
  }

  if (!offered.available) {
    throw new DomainError("booking.slot_taken");
  }

  if (!input.allowStarted && offered.start.getTime() <= input.now.getTime()) {
    throw new DomainError("booking.slot_ended");
  }

  return {
    start: offered.start,
    end: offered.end,
    priceUsd: offered.priceUsd,
  };
}

/**
 * Half-open [start, end), same as Venue occupied. Adjacent games do not collide.
 */
export function overlaps(a: UtcRange, b: UtcRange): boolean {
  return a.start.getTime() < b.end.getTime() && a.end.getTime() > b.start.getTime();
}

export type PendingRangeLike = {
  id: string;
  pitchId: string;
  start: Date;
  end: Date;
};

/**
 * Other PENDING on the same pitch whose window overlaps the approved range (BR-20 pin).
 * Caller passes the losers, not the winner. Different pitch never matches.
 */
export function overlappingPendingIds(
  approved: { pitchId: string } & UtcRange,
  pending: PendingRangeLike[],
): string[] {
  return pending
    .filter(
      (row) =>
        row.pitchId === approved.pitchId && overlaps(row, approved),
    )
    .map((row) => row.id);
}
