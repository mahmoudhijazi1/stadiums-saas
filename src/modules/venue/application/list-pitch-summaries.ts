import { DomainError, UnexpectedError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";
import type { GamePriceCurrency } from "@/lib/tenant-settings";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import {
  collapseHoursGroups,
  type HoursGroup,
} from "@/modules/venue/domain/daily-schedule";
import { listPitches } from "@/modules/venue/infrastructure/pitches";
import { defaultPriceIn, type PriceView } from "@/modules/venue/domain/availability";
import {
  hasPricesIn,
  parseScheduleConfig,
  type Weekday,
} from "@/modules/venue/domain/schedule-config";

export type PitchSummary = {
  id: string;
  name: string;
  hoursGroups: HoursGroup[];
  closedDays: Weekday[];
  slotDurationMinutes: number;
  /** The default price in the stadium's currency; null when the pitch has none in it (DR-007). */
  defaultPrice: PriceView | null;
  /** False when some price (the default or a rule) is missing in the stadium's currency. */
  hasPrices: boolean;
};

/**
 * Settings list. Any membership (staff see names, not the editor). Prices are in `currency`, the
 * stadium's gamePriceCurrency.
 */
export async function listPitchSummaries(currency: GamePriceCurrency): Promise<PitchSummary[]> {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new DomainError("access.not_allowed");
  }

  try {
    const pitches = await listPitches();
    const tenantId = await safeTenantId();

    return pitches.map((pitch) => {
      let config;
      try {
        config = parseScheduleConfig(pitch.scheduleConfig);
      } catch (error) {
        logger.error(`Invalid schedule_config on pitch ${pitch.id}`, error, {
          useCase: "listPitchSummaries",
          tenantId,
        });
        throw new UnexpectedError(error);
      }
      const { groups, closed } = collapseHoursGroups(config.hours);
      return {
        id: pitch.id,
        name: pitch.name,
        hoursGroups: groups,
        closedDays: closed,
        slotDurationMinutes: config.slotDurationMinutes,
        defaultPrice: defaultPriceIn(config, currency),
        hasPrices: hasPricesIn(config, currency),
      };
    });
  } catch (error) {
    return await rethrowUnexpected(
      error,
      "List pitch summaries failed",
      "listPitchSummaries",
    );
  }
}
