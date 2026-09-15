import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { findLatestExchangeRate } from "@/modules/payment/infrastructure/rates";

/**
 * Current LBP-per-USD for the URL tenant, or null if none set.
 * Logged-in membership required; any role may look (SPEC-06).
 * Auth stays outside try — access.not_allowed is not an unexpected failure.
 */
export async function getCurrentRate() {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new DomainError("access.not_allowed");
  }

  try {
    return await findLatestExchangeRate(db);
  } catch (error) {
    return await rethrowUnexpected(
      error,
      "Get current rate failed",
      "getCurrentRate",
    );
  }
}
