import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { scheduleFromHoursGroups } from "@/modules/venue/domain/daily-schedule";
import { insertPitch } from "@/modules/venue/infrastructure/pitches";
import type { PitchDraft } from "@/modules/venue/schemas/pitch-draft";

/**
 * Create a pitch from hours groups. OWNER only. No hours-cover
 * (there are no live bookings on a new pitch).
 */
export async function createPitch(draft: PitchDraft): Promise<{ id: string }> {
  const membership = await getCurrentMembership();
  if (!membership || membership.role !== "OWNER") {
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
    logger.info(`Pitch created ${row.id}`);
    return { id: row.id };
  } catch (error) {
    return await rethrowUnexpected(error, "Create pitch failed", "createPitch");
  }
}
