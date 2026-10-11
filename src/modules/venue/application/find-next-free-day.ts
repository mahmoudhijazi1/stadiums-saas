import { logger } from "@/lib/logger";
import {
  addCalendarDays,
  compareCivilDate,
  dropEndedSlots,
  generateSlotsForDay,
  type CivilDate,
} from "@/modules/venue/domain/availability";
import { parseScheduleConfig } from "@/modules/venue/domain/schedule-config";
import { listPitches } from "@/modules/venue/infrastructure/pitches";
import type { OccupiedWindow } from "@/modules/venue/application/get-day-availability";

/**
 * The first day after `after`, up to `lastDay`, on which some pitch still has a free time. One query
 * (the pitches); the days are walked in memory against the occupied windows the caller already
 * loaded for the page. Best effort: a pitch whose schedule cannot be read ends the search with null
 * instead of breaking the page it decorates.
 */
export async function findNextFreeDay(input: {
  after: CivilDate;
  lastDay: CivilDate;
  timeZone: string;
  now: Date;
  occupied: OccupiedWindow[];
}): Promise<CivilDate | null> {
  try {
    const pitches = (await listPitches()).map((pitch) => ({
      id: pitch.id,
      config: parseScheduleConfig(pitch.scheduleConfig),
    }));
    for (let day = addCalendarDays(input.after, 1); compareCivilDate(day, input.lastDay) <= 0; day = addCalendarDays(day, 1)) {
      for (const pitch of pitches) {
        const generated = generateSlotsForDay({
          config: pitch.config,
          localDate: day,
          timeZone: input.timeZone,
          occupied: input.occupied.filter((range) => range.pitchId === pitch.id),
        });
        if (dropEndedSlots(generated, input.now).some((slot) => slot.available)) return day;
      }
    }
    return null;
  } catch (error) {
    logger.error("Find next free day failed", error, { useCase: "findNextFreeDay" });
    return null;
  }
}
