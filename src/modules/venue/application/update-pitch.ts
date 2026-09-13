import { DomainError, UnexpectedError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { scheduleFromHoursGroups } from "@/modules/venue/domain/daily-schedule";
import type { LivePitchWindow } from "@/modules/venue/domain/hours-cover";
import {
  classifyHoursConflicts,
  hoursSaveBlocker,
} from "@/modules/venue/domain/hours-cover";
import { findPitch, updatePitchRow } from "@/modules/venue/infrastructure/pitches";
import { parseScheduleConfig } from "@/modules/venue/schemas/schedule-config";
import type { PitchDraft } from "@/modules/venue/schemas/pitch-draft";

const TIME_ZONE = "Asia/Beirut";

/**
 * Update name + hours groups + day priceRules. OWNER only.
 * `liveBookings` come from Booking (`listLivePitchWindows`).
 */
export async function updatePitch(input: {
  pitchId: string;
  draft: PitchDraft;
  liveBookings: LivePitchWindow[];
  now?: Date;
}): Promise<void> {
  const membership = await getCurrentMembership();
  if (!membership || membership.role !== "OWNER") {
    throw new DomainError("access.not_allowed");
  }

  try {
    const row = await findPitch(input.pitchId);
    if (!row) {
      throw new DomainError("booking.pitch_not_found");
    }

    try {
      parseScheduleConfig(row.scheduleConfig);
    } catch (error) {
      logger.error(`Invalid schedule_config on pitch ${row.id}`, error, {
        useCase: "updatePitch",
        tenantId: await safeTenantId(),
      });
      throw new UnexpectedError(error);
    }

    const next = scheduleFromHoursGroups({
      groups: input.draft.hoursGroups,
      slotDurationMinutes: input.draft.slotDurationMinutes,
      defaultPriceUsd: input.draft.defaultPriceUsd,
      priceRules: input.draft.priceRules,
    });
    const now = input.now ?? new Date();
    const conflicts = classifyHoursConflicts(
      next,
      input.liveBookings,
      TIME_ZONE,
      now,
    );
    const blocker = hoursSaveBlocker({
      approvedBlocking: conflicts.approvedBlocking,
      pendingWarning: conflicts.pendingWarning,
      confirmPending: input.draft.confirmPending,
    });
    if (blocker) {
      throw new DomainError(blocker);
    }

    await updatePitchRow({
      pitchId: row.id,
      name: input.draft.name,
      scheduleConfig: next,
    });
    logger.info(`Pitch updated ${row.id}`);
  } catch (error) {
    await rethrowUnexpected(error, "Update pitch failed", "updatePitch");
  }
}
