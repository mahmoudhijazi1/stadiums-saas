import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { REPORTS_VIEW, can } from "@/modules/access/domain/can";
import { listTendersBySourceIds } from "@/modules/payment/infrastructure/payments";
import { listSalesWithLines, type SaleLineRow } from "@/modules/shop/infrastructure/sales";

export type SaleDetail = {
  id: string;
  soldAt: Date;
  /** The player a tab belongs to; null for a walk-in sale. */
  payerName: string | null;
  lines: SaleLineRow[];
  tenders: { currency: "USD" | "LBP"; amount: Decimal; rateAtTime: Decimal | null; usdEquivalent: Decimal }[];
};

/** The sales behind some ledger rows, with lines and tenders (frozen rates): two reads. reports.view. */
export async function listSaleDetails(ids: string[]): Promise<Map<string, SaleDetail>> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, REPORTS_VIEW)) throw new DomainError("access.not_allowed");
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  try {
    const [sales, tenders] = await Promise.all([
      listSalesWithLines(db, unique),
      listTendersBySourceIds(db, "SALE", unique),
    ]);
    return new Map(
      sales.map((sale) => [
        sale.id,
        {
          ...sale,
          tenders: tenders
            .filter((tender) => tender.sourceId === sale.id)
            .map(({ currency, amount, rateAtTime, usdEquivalent }) => ({ currency, amount, rateAtTime, usdEquivalent })),
        },
      ]),
    );
  } catch (error) {
    return await rethrowUnexpected(error, "List sale details failed", "listSaleDetails");
  }
}
