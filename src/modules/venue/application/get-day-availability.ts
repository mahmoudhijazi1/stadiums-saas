import { UnexpectedError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { formatUsd } from "@/lib/money";
import { safeTenantId } from "@/lib/tenant-context";
import {
  generateSlotsForDay,
  type CivilDate,
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
  occupied?: OccupiedWindow[];
}): Promise<PitchDayAvailability[]> {
  const pitches = await listPitches();
  const occupied = input.occupied ?? [];
  const tenantId = await safeTenantId();

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
    const slots = generateSlotsForDay({
      config,
      localDate: input.localDate,
      timeZone: input.timeZone,
      occupied: occupied
        .filter((range) => range.pitchId === pitch.id)
        .map((range) => ({ start: range.start, end: range.end })),
    });

    return {
      id: pitch.id,
      name: pitch.name,
      slots: slots.map((slot) => ({
        startIso: slot.start.toISOString(),
        endIso: slot.end.toISOString(),
        startLocal: formatLocalHm(slot.start, input.timeZone),
        endLocal: formatLocalHm(slot.end, input.timeZone),
        priceUsd: formatUsd(slot.priceUsd),
        available: slot.available,
      })),
    };
  });
}

function formatLocalHm(instant: Date, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(instant)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  let hour = map.hour ?? "00";
  if (hour === "24") hour = "00";
  return `${hour}:${map.minute}`;
}
