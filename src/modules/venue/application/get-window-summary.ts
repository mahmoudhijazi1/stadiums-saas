import { UnexpectedError } from "@/lib/errors";
import { formatLocalHm, type ClockLocale, type HourCycle } from "@/lib/format/time";
import type { GamePriceCurrency } from "@/lib/tenant-settings";
import { rethrowUnexpected } from "@/lib/use-case-error";
import {
  addCalendarDays,
  compareCivilDate,
  dropEndedSlots,
  formatCivilDate,
  generateSlotsForDay,
  priceForSlotIn,
  toPriceView,
  type CivilDate,
  type PriceView,
} from "@/modules/venue/domain/availability";
import { parseScheduleConfig } from "@/modules/venue/domain/schedule-config";
import { listPitches } from "@/modules/venue/infrastructure/pitches";
import type { OccupiedWindow } from "@/modules/venue/application/get-day-availability";

export type WindowDay = { date: CivilDate; key: string; freeCount: number };

/** The nearest free time from now, formatted like the day's rows. */
export type NextFreeTime = {
  date: CivilDate;
  dateKey: string;
  pitchId: string;
  /** Null with one pitch: the name is noise then. */
  pitchName: string | null;
  startIso: string;
  endIso: string;
  startLocal: string;
  endLocal: string;
  /** In the stadium's currency (DR-007); null when the pitch has no price in it. */
  price: PriceView | null;
  durationMinutes: number;
};

/**
 * For every day from `from` to `lastDay`: how many free times it has (the day strip's dots), and
 * the nearest free time from now (the "next free" card). One query, the pitches; the days are
 * generated in memory against the occupied windows the caller already loaded. A started time is
 * never free (same cutoff as the request itself).
 */
export async function getWindowSummary(input: {
  from: CivilDate;
  lastDay: CivilDate;
  timeZone: string;
  now: Date;
  occupied: OccupiedWindow[];
  hourCycle?: HourCycle;
  locale?: ClockLocale;
  /** The stadium's gamePriceCurrency (DR-007). */
  currency: GamePriceCurrency;
}): Promise<{ days: WindowDay[]; nextFree: NextFreeTime | null }> {
  try {
    const pitches = (await listPitches()).map((pitch) => {
      try {
        return { id: pitch.id, name: pitch.name, config: parseScheduleConfig(pitch.scheduleConfig) };
      } catch (error) {
        throw new UnexpectedError(error);
      }
    });
    const days: WindowDay[] = [];
    let nextFree: NextFreeTime | null = null;

    for (let day = input.from; compareCivilDate(day, input.lastDay) <= 0; day = addCalendarDays(day, 1)) {
      let freeCount = 0;
      let earliest: { pitch: (typeof pitches)[number]; start: Date; end: Date; price: PriceView | null } | null = null;
      for (const pitch of pitches) {
        const generated = generateSlotsForDay({
          config: pitch.config,
          localDate: day,
          timeZone: input.timeZone,
          occupied: input.occupied.filter((range) => range.pitchId === pitch.id),
        });
        for (const slot of dropEndedSlots(generated, input.now)) {
          if (!slot.available) continue;
          freeCount += 1;
          if (!earliest || slot.start < earliest.start) {
            const price = toPriceView(
              priceForSlotIn(pitch.config, input.currency, { start: slot.start, localDate: day, timeZone: input.timeZone }),
            );
            earliest = { pitch, start: slot.start, end: slot.end, price };
          }
        }
      }
      days.push({ date: day, key: formatCivilDate(day), freeCount });
      if (!nextFree && earliest) {
        nextFree = {
          date: day,
          dateKey: formatCivilDate(day),
          pitchId: earliest.pitch.id,
          pitchName: pitches.length > 1 ? earliest.pitch.name : null,
          startIso: earliest.start.toISOString(),
          endIso: earliest.end.toISOString(),
          startLocal: formatLocalHm(earliest.start, input.timeZone, input.hourCycle, input.locale),
          endLocal: formatLocalHm(earliest.end, input.timeZone, input.hourCycle, input.locale),
          price: earliest.price,
          durationMinutes: Math.round((earliest.end.getTime() - earliest.start.getTime()) / 60_000),
        };
      }
    }
    return { days, nextFree };
  } catch (error) {
    return await rethrowUnexpected(error, "Get window summary failed", "getWindowSummary");
  }
}
