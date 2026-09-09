import { formatUsd } from "@/lib/money";
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

/**
 * Load this tenant's pitches, parse jsonb, generate one day's slots.
 * occupied is [] until pitch_blocks / bookings exist (SPEC-02).
 */
export async function getDayAvailability(input: {
  localDate: CivilDate;
  timeZone: string;
}): Promise<PitchDayAvailability[]> {
  const pitches = await listPitches();

  return pitches.map((pitch) => {
    const config = parseScheduleConfig(pitch.scheduleConfig);
    const slots = generateSlotsForDay({
      config,
      localDate: input.localDate,
      timeZone: input.timeZone,
      occupied: [],
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
