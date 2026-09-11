import Decimal from "decimal.js";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { insertExchangeRate } from "@/modules/payment/infrastructure/rates";

/**
 * Append a new rate. OWNER only this slice (staff with collect still cannot).
 * Single create — no interactive transaction (SPEC-06).
 */
export async function setExchangeRate(lbpPerUsd: Decimal): Promise<void> {
  const membership = await getCurrentMembership();
  if (!membership || membership.role !== "OWNER") {
    throw new Error("Not allowed");
  }

  try {
    await insertExchangeRate(db, lbpPerUsd);
    logger.info(`Exchange rate set ${lbpPerUsd.toFixed(0)}`);
  } catch (error) {
    logger.error("Set exchange rate failed", error);
    throw error;
  }
}
