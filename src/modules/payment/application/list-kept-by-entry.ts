import db from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { REPORTS_VIEW, can } from "@/modules/access/domain/can";
import { keptByEntry, type EntryRef, type KeptPart } from "@/modules/payment/domain/entry-payments";
import { listPaymentsOfSources } from "@/modules/payment/infrastructure/lbp-period";

const SOURCE_TYPES = new Set(["BOOKING", "EXPENSE", "SALE", "KEPT_CHANGE"]);

/**
 * What each ledger row kept, in the currency it was paid in: the tenders of the payment behind the
 * row, summed per currency (never added across currencies). Entries whose payment cannot be found
 * are left out. One read for the whole page. reports.view, like the Activity list that asks.
 */
export async function listKeptByEntry(entries: readonly EntryRef[]): Promise<Map<string, KeptPart[]>> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, REPORTS_VIEW)) {
    throw new DomainError("access.not_allowed");
  }
  const sources = new Map<string, { sourceType: "BOOKING" | "EXPENSE" | "SALE" | "KEPT_CHANGE"; sourceId: string }>();
  for (const entry of entries) {
    if (!SOURCE_TYPES.has(entry.sourceType)) continue;
    sources.set(`${entry.sourceType}:${entry.sourceId}`, {
      sourceType: entry.sourceType as "BOOKING" | "EXPENSE" | "SALE" | "KEPT_CHANGE",
      sourceId: entry.sourceId,
    });
  }
  if (sources.size === 0) return new Map();
  try {
    return keptByEntry(entries, await listPaymentsOfSources(db, [...sources.values()]));
  } catch (error) {
    return await rethrowUnexpected(error, "List kept by entry failed", "listKeptByEntry");
  }
}
