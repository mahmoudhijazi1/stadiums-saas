import Decimal from "decimal.js";
import type { TenantTx } from "@/lib/db";
import { sumCollectedUsd } from "@/modules/payment/infrastructure/payments";
import { netLines } from "@/modules/shop/domain/booking-items";
import { dueParts, settleState, type DueParts, type SettleState } from "@/modules/shop/domain/pricing";
import { listStoredLines } from "@/modules/shop/infrastructure/booking-sales";
import { sumAllocations } from "@/modules/shop/infrastructure/sale-allocations";

/**
 * Where one sale or tab stands: what it is made of (pounds for the LBP lines, dollars for the USD
 * lines) and what is left of each part. Read inside the transaction that is about to collect, after
 * the sale row is locked.
 */
export async function loadSaleState(
  tx: TenantTx,
  saleId: string,
): Promise<{ parts: DueParts; state: SettleState }> {
  const lines = netLines(await listStoredLines(tx, saleId));
  const parts = dueParts(lines.map((line) => ({ lineTotalUsd: line.totalUsd, lineTotalLbp: line.totalLbp })));
  const applied = (await sumAllocations(tx, [saleId])).get(saleId) ?? { lbp: new Decimal(0), usd: new Decimal(0) };
  const recordedUsd = await sumCollectedUsd(tx, "SALE", saleId);
  return {
    parts,
    state: settleState({ parts, appliedLbp: applied.lbp, appliedUsd: applied.usd, recordedUsd }),
  };
}
