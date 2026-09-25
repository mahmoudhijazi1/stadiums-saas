import { UnexpectedError } from "@/lib/errors";
import {
  formatLocalHm,
  type ClockLocale,
  type HourCycle,
} from "@/lib/format-local-hm";
import { logger } from "@/lib/logger";
import { formatUsd } from "@/lib/money";
import { safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import {
  civilDateInTimeZone,
  dayHoursEmptyKind,
  dropEndedSlots,
  generateSlotsForDay,
  type CivilDate,
  type HoursEmptyKind,
} from "@/modules/venue/domain/availability";
import { listPitches } from "@/modules/venue/infrastructure/pitches";
import { parseScheduleConfig } from "@/modules/venue/schemas/schedule-config";

export type DaySlotView = {
  startIso: string;
  endIso: string;
  startLocal: string;
  endLocal: string;
  priceUsd: string;
  available: boolean;
};

export type PitchDayAvailability = {
  id: string;
  name: string;
  slots: DaySlotView[];
  emptyKind: HoursEmptyKind | null;
};

/** Occupied UTC window on one pitch. Caller supplies these; Venue does not import Booking. */
export type OccupiedWindow = {
  pitchId: string;
  start: Date;
  end: Date;
};

/**
 * Load this tenant's pitches, parse jsonb, generate one day's slots.
 * Occupied ranges are an argument (APPROVED bookings from the page / Booking use case).
 */
export async function getDayAvailability(input: {
  localDate: CivilDate;
  timeZone: string;
  now: Date;
  occupied?: OccupiedWindow[];
  /** Owner Book, public hours, and WhatsApp share this clock. */
  hourCycle?: HourCycle;
  locale?: ClockLocale;
}): Promise<PitchDayAvailability[]> {
  try {
    const pitches = await listPitches();
    const occupied = input.occupied ?? [];
    const tenantId = await safeTenantId();
    const today = civilDateInTimeZone(input.now, input.timeZone);

    return pitches.map((pitch) => {
      let config;
      try {
        config = parseScheduleConfig(pitch.scheduleConfig);
      } catch (error) {
        logger.error(`Invalid schedule_config on pitch ${pitch.id}`, error, {
          useCase: "getDayAvailability",
          tenantId,
        });
        throw new UnexpectedError(error);
      }
      const generated = generateSlotsForDay({
        config,
        localDate: input.localDate,
        timeZone: input.timeZone,
        occupied: occupied
          .filter((range) => range.pitchId === pitch.id)
          .map((range) => ({ start: range.start, end: range.end })),
      });
      const slots = dropEndedSlots(generated, input.now);

      return {
        id: pitch.id,
        name: pitch.name,
        emptyKind: dayHoursEmptyKind({
          generatedCount: generated.length,
          remainingCount: slots.length,
          localDate: input.localDate,
          today,
        }),
        slots: slots.map((slot) => ({
          startIso: slot.start.toISOString(),
          endIso: slot.end.toISOString(),
          startLocal: formatLocalHm(
            slot.start,
            input.timeZone,
            input.hourCycle,
            input.locale,
          ),
          endLocal: formatLocalHm(
            slot.end,
            input.timeZone,
            input.hourCycle,
            input.locale,
          ),
          priceUsd: formatUsd(slot.priceUsd),
          available: slot.available,
        })),
      };
    });
  } catch (error) {
    return await rethrowUnexpected(
      error,
      "Get day availability failed",
      "getDayAvailability",
    );
  }
}
