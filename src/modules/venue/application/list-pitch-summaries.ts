import { DomainError, UnexpectedError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import {
  collapseHoursGroups,
  type HoursGroup,
} from "@/modules/venue/domain/daily-schedule";
import { listPitches } from "@/modules/venue/infrastructure/pitches";
import {
  parseScheduleConfig,
  type Weekday,
} from "@/modules/venue/schemas/schedule-config";

export type PitchSummary = {
  id: string;
  name: string;
  hoursGroups: HoursGroup[];
  closedDays: Weekday[];
  slotDurationMinutes: number;
  defaultPriceUsd: string;
};

/**
 * Settings list. Any membership (staff see names, not the editor).
 */
export async function listPitchSummaries(): Promise<PitchSummary[]> {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new DomainError("access.not_allowed");
  }

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
      defaultPriceUsd: config.defaultPriceUsd,
    };
  });
}
