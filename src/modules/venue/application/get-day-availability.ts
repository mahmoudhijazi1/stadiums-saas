import { UnexpectedError } from "@/lib/errors";
import { formatLocalHm, type ClockLocale, type HourCycle } from "@/lib/format/time";
import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";
import type { GamePriceCurrency } from "@/lib/tenant-settings";
import { rethrowUnexpected } from "@/lib/use-case-error";
import {
  civilDateInTimeZone,
  dayHoursEmptyKind,
  defaultPriceIn,
  dropEndedSlots,
  generateSlotsForDay,
  priceForSlotIn,
  toPriceView,
  type CivilDate,
  type HoursEmptyKind,
  type PriceView,
} from "@/modules/venue/domain/availability";
import { listPitches } from "@/modules/venue/infrastructure/pitches";
import { parseScheduleConfig } from "@/modules/venue/domain/schedule-config";

export type DaySlotView = {
  startIso: string;
  endIso: string;
  startLocal: string;
  endLocal: string;
  /** In the stadium's currency (DR-007). Null: the pitch has no price in it, so none is shown. */
  price: PriceView | null;
  available: boolean;
};

export type PitchDayAvailability = {
  id: string;
  name: string;
  /** The pitch's base price in the stadium's currency; a slot priced differently is a rule price. */
  defaultPrice: PriceView | null;
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
  /**
   * The caller's "today" for the empty-state wording (past vs hours ended). Pages pass
   * the business date (06:00 rollover, owned by Booking). Defaults to the civil date.
   */
  today?: CivilDate;
  occupied?: OccupiedWindow[];
  /** Owner Book, public hours, and WhatsApp share this clock. */
  hourCycle?: HourCycle;
  locale?: ClockLocale;
  /** The stadium's gamePriceCurrency: every price is shown in it (DR-007). */
  currency: GamePriceCurrency;
}): Promise<PitchDayAvailability[]> {
  try {
    const pitches = await listPitches();
    const occupied = input.occupied ?? [];
    const tenantId = await safeTenantId();
    const today = input.today ?? civilDateInTimeZone(input.now, input.timeZone);

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
        defaultPrice: defaultPriceIn(config, input.currency),
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
          price: toPriceView(
            priceForSlotIn(config, input.currency, {
              start: slot.start,
              localDate: input.localDate,
              timeZone: input.timeZone,
            }),
          ),
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
