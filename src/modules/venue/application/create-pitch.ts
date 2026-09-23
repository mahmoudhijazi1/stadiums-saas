import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { SETTINGS_MANAGE, can } from "@/modules/access/domain/can";
import { scheduleFromHoursGroups } from "@/modules/venue/domain/daily-schedule";
import { insertPitch } from "@/modules/venue/infrastructure/pitches";
import type { PitchDraft } from "@/modules/venue/schemas/pitch-draft";

/**
 * Create a pitch from hours groups. settings.manage (OWNER passes can()).
 * No hours-cover (there are no live bookings on a new pitch).
 */
export async function createPitch(draft: PitchDraft): Promise<{ id: string }> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, SETTINGS_MANAGE)) {
    throw new DomainError("access.not_allowed");
  }

  try {
    const scheduleConfig = scheduleFromHoursGroups({
      groups: draft.hoursGroups,
      slotDurationMinutes: draft.slotDurationMinutes,
      defaultPriceUsd: draft.defaultPriceUsd,
      priceRules: draft.priceRules,
    });
    const row = await insertPitch({
      name: draft.name,
      scheduleConfig,
    });
    logger.info(`Pitch created ${row.id}`, undefined, {
      useCase: "createPitch",
      tenantId: await safeTenantId(),
    });
    return { id: row.id };
  } catch (error) {
    return await rethrowUnexpected(error, "Create pitch failed", "createPitch");
  }
}
