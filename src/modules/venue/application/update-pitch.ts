import { DomainError, UnexpectedError } from "@/lib/errors";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { getCurrentTenant, safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { SETTINGS_MANAGE, can } from "@/modules/access/domain/can";
import { scheduleFromHoursGroups } from "@/modules/venue/domain/daily-schedule";
import { assertPitchPrices } from "@/modules/venue/domain/pitch-prices";
import type { LivePitchWindow } from "@/modules/venue/domain/hours-cover";
import {
  classifyHoursConflicts,
  hoursSaveBlocker,
} from "@/modules/venue/domain/hours-cover";
import { findPitch, updatePitchRow } from "@/modules/venue/infrastructure/pitches";
import { parseScheduleConfig } from "@/modules/venue/domain/schedule-config";
import type { PitchDraft } from "@/modules/venue/schemas/pitch-draft";

const TIME_ZONE = "Asia/Beirut";

/**
 * Update name + hours groups + day priceRules. settings.manage (OWNER passes can()).
 * `liveBookings` come from Booking (`listLivePitchWindows`).
 * Authorize outside `$transaction`; find → classify → update run in one tx.
 * Prices are checked against the stadium's own gamePriceCurrency (DR-007), read before the
 * transaction. A USD-stadium draft that carries no LBP default keeps the stored one, so the pounds
 * are never dropped by an edit in dollars.
 */
export async function updatePitch(input: {
  pitchId: string;
  draft: PitchDraft;
  liveBookings: LivePitchWindow[];
  now?: Date;
}): Promise<void> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, SETTINGS_MANAGE)) {
    throw new DomainError("access.not_allowed");
  }

  try {
    const { gamePriceCurrency } = await getCurrentTenant();
    await db.$transaction(async (tx) => {
      const row = await findPitch(tx, input.pitchId);
      if (!row) {
        throw new DomainError("booking.pitch_not_found");
      }

      let current;
      try {
        current = parseScheduleConfig(row.scheduleConfig);
      } catch (error) {
        logger.error(`Invalid schedule_config on pitch ${row.id}`, error, {
          useCase: "updatePitch",
          tenantId: await safeTenantId(),
        });
        throw new UnexpectedError(error);
      }

      const defaultPriceLbp =
        input.draft.defaultPriceLbp ?? (gamePriceCurrency === "USD" ? current.defaultPriceLbp : undefined);
      assertPitchPrices({ defaultPriceLbp, priceRules: input.draft.priceRules }, gamePriceCurrency);
      const next = scheduleFromHoursGroups({
        groups: input.draft.hoursGroups,
        slotDurationMinutes: input.draft.slotDurationMinutes,
        defaultPriceUsd: input.draft.defaultPriceUsd,
        defaultPriceLbp,
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

      await updatePitchRow(tx, {
        pitchId: row.id,
        name: input.draft.name,
        scheduleConfig: next,
        defaultPlayerCount: input.draft.defaultPlayerCount,
      });
    });

    logger.info(`Pitch updated ${input.pitchId}`, undefined, {
      useCase: "updatePitch",
      tenantId: await safeTenantId(),
    });
  } catch (error) {
    await rethrowUnexpected(error, "Update pitch failed", "updatePitch");
  }
}
