import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { SETTINGS_MANAGE, can } from "@/modules/access/domain/can";
import { insertExchangeRate } from "@/modules/payment/infrastructure/rates";

/**
 * Append a new rate. settings.manage (OWNER passes can()).
 * Single create — no interactive transaction (SPEC-06).
 */
export async function setExchangeRate(lbpPerUsd: Decimal): Promise<void> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, SETTINGS_MANAGE)) {
    throw new DomainError("access.not_allowed");
  }

  try {
    await insertExchangeRate(db, lbpPerUsd);
    logger.info(`Exchange rate set ${lbpPerUsd.toFixed(0)}`, undefined, {
      useCase: "setExchangeRate",
      tenantId: await safeTenantId(),
    });
  } catch (error) {
    await rethrowUnexpected(error, "Set exchange rate failed", "setExchangeRate");
  }
}
