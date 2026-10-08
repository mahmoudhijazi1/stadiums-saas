import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { REPORTS_VIEW, can } from "@/modules/access/domain/can";
import { periodBoundsFromCivilRange } from "@/modules/ledger/domain/period";
import { sumSoldItems, type SoldItemRow } from "@/modules/shop/infrastructure/sales";

const TIME_ZONE = "Asia/Beirut";

export type ShopPeriodSummary = { salesUsd: Decimal; items: SoldItemRow[] };

/**
 * What the shop sold in a civil-date range (Beirut days, by sale time): the total and the per-item
 * list, from one query. Sales only; it says nothing about profit. reports.view.
 */
export async function summarizeShopPeriod(input: { from: string; to: string }): Promise<ShopPeriodSummary> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, REPORTS_VIEW)) throw new DomainError("access.not_allowed");
  try {
    const bounds = periodBoundsFromCivilRange(input.from, input.to, TIME_ZONE);
    const items = await sumSoldItems(db, bounds.startInclusive, bounds.endExclusive);
    return { salesUsd: items.reduce((sum, item) => sum.plus(item.totalUsd), new Decimal(0)), items };
  } catch (error) {
    return await rethrowUnexpected(error, "Summarize shop period failed", "summarizeShopPeriod");
  }
}
