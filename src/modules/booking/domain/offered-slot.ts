import Decimal from "decimal.js";
import {
  generateSlotsForDay,
  type CivilDate,
} from "@/modules/venue/domain/availability";
import type { ScheduleConfig } from "@/modules/venue/schemas/schedule-config";

export type UtcRange = { start: Date; end: Date };

/**
 * Confirm this UTC window is a slot Venue would offer that day, and it has not ended.
 * Price is copied from the engine — never trusted from the requester (DR-002 §2.18).
 * occupied is [] here: APPROVED occupancy is a later slice, not this public-request rule.
 */
export function resolveOfferedSlot(input: {
  config: ScheduleConfig;
  localDate: CivilDate;
  timeZone: string;
  start: Date;
  end: Date;
  now: Date;
}): { start: Date; end: Date; priceUsd: Decimal } {
  const slots = generateSlotsForDay({
    config: input.config,
    localDate: input.localDate,
    timeZone: input.timeZone,
    occupied: [],
  });

  const offered = slots.find(
    (slot) =>
      slot.start.getTime() === input.start.getTime() &&
      slot.end.getTime() === input.end.getTime(),
  );

  if (!offered) {
    throw new Error("Slot is not offered");
  }

  if (offered.end.getTime() <= input.now.getTime()) {
    throw new Error("Slot has already ended");
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
