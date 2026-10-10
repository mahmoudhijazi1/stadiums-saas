import Decimal from "decimal.js";
import type { TenantTx } from "@/lib/db";
import { formatUsd } from "@/lib/format/money";

/**
 * How much of a sale's LBP part and USD part each payment settled. Insert-only, one row per payment.
 * Omit tenantId: the guard stamps it.
 */
export async function insertSaleAllocation(
  tx: TenantTx,
  input: { saleId: string; paymentId: string; lbpApplied: Decimal; usdApplied: Decimal },
): Promise<void> {
  await tx.saleAllocation.create({
    data: {
      saleId: input.saleId,
      paymentId: input.paymentId,
      lbpApplied: input.lbpApplied.toFixed(0),
      usdApplied: formatUsd(input.usdApplied),
    } as Parameters<typeof tx.saleAllocation.create>[0]["data"],
  });
}

export type AppliedSums = { lbp: Decimal; usd: Decimal };

/** What has been settled so far on these sales, per sale: one query for any number of sales. */
export async function sumAllocations(tx: TenantTx, saleIds: string[]): Promise<Map<string, AppliedSums>> {
  const sums = new Map<string, AppliedSums>();
  if (saleIds.length === 0) return sums;
  const rows = await tx.saleAllocation.groupBy({
    by: ["saleId"],
    where: { saleId: { in: saleIds } },
    _sum: { lbpApplied: true, usdApplied: true },
  });
  for (const row of rows) {
    sums.set(row.saleId, {
      lbp: new Decimal((row._sum.lbpApplied ?? 0).toString()),
      usd: new Decimal((row._sum.usdApplied ?? 0).toString()),
    });
  }
  return sums;
}
