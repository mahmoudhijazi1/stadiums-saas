import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { findLatestExchangeRate } from "@/modules/payment/infrastructure/rates";

/**
 * Current LBP-per-USD for the URL tenant, or null if none set.
 * Logged-in membership required; any role may look (SPEC-06).
 */
export async function getCurrentRate() {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new DomainError("access.not_allowed");
  }

  return findLatestExchangeRate(db);
}
