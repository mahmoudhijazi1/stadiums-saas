import Decimal from "decimal.js";
import type { TenantTx } from "@/lib/db";
import { formatUsd } from "@/lib/money";

/**
 * Sales are insert-only: nothing in this module updates or deletes a Sale or a SaleItem.
 * Omit tenantId: the guard stamps it.
 */
export async function insertSale(tx: TenantTx, input: { createdByMembershipId: string }): Promise<{ id: string }> {
  const row = await tx.sale.create({
    data: { createdByMembershipId: input.createdByMembershipId } as Parameters<typeof tx.sale.create>[0]["data"],
    select: { id: true },
  });
  return row;
}

export async function insertSaleItem(
  tx: TenantTx,
  input: { saleId: string; productId: string; qty: number; unitPriceUsd: Decimal; lineTotalUsd: Decimal },
): Promise<void> {
  await tx.saleItem.create({
    data: {
      saleId: input.saleId,
      productId: input.productId,
      qty: input.qty,
      unitPriceUsd: formatUsd(input.unitPriceUsd),
      lineTotalUsd: formatUsd(input.lineTotalUsd),
    } as Parameters<typeof tx.saleItem.create>[0]["data"],
  });
}
