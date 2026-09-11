import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { insertExchangeRate } from "@/modules/payment/infrastructure/rates";

/**
 * Append a new rate. OWNER only this slice (staff with collect still cannot).
 * Single create — no interactive transaction (SPEC-06).
 */
export async function setExchangeRate(lbpPerUsd: Decimal): Promise<void> {
  const membership = await getCurrentMembership();
  if (!membership || membership.role !== "OWNER") {
    throw new DomainError("access.not_allowed");
  }

  try {
    await insertExchangeRate(db, lbpPerUsd);
    logger.info(`Exchange rate set ${lbpPerUsd.toFixed(0)}`);
  } catch (error) {
    await rethrowUnexpected(error, "Set exchange rate failed", "setExchangeRate");
  }
}
