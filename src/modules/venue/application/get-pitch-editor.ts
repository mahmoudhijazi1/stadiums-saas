import { DomainError, UnexpectedError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import {
  collapseHoursGroups,
  type HoursGroup,
} from "@/modules/venue/domain/daily-schedule";
import { findPitch } from "@/modules/venue/infrastructure/pitches";
import type { PitchPriceRule } from "@/modules/venue/schemas/pitch-draft";
import {
  parseScheduleConfig,
  type Weekday,
} from "@/modules/venue/schemas/schedule-config";

export type PitchEditor = {
  id: string;
  name: string;
  hoursGroups: HoursGroup[];
  closedDays: Weekday[];
  slotDurationMinutes: number;
  defaultPriceUsd: string;
  priceRules: PitchPriceRule[];
};

/**
 * Prefill for the edit form. Missing / other-tenant id → null.
 * Hours rows are collapsed groups, not a single window.
 */
export async function getPitchEditor(
  pitchId: string,
): Promise<PitchEditor | null> {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new DomainError("access.not_allowed");
  }

  const row = await findPitch(pitchId);
  if (!row) return null;

  let config;
  try {
    config = parseScheduleConfig(row.scheduleConfig);
  } catch (error) {
    logger.error(`Invalid schedule_config on pitch ${row.id}`, error, {
      useCase: "getPitchEditor",
      tenantId: await safeTenantId(),
    });
    throw new UnexpectedError(error);
  }

  const { groups, closed } = collapseHoursGroups(config.hours);
  return {
    id: row.id,
    name: row.name,
    hoursGroups: groups,
    closedDays: closed,
    slotDurationMinutes: config.slotDurationMinutes,
    defaultPriceUsd: config.defaultPriceUsd,
    priceRules: config.priceRules,
  };
}
