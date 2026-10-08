import Decimal from "decimal.js";
import type { TenantTx } from "@/lib/db";
import { formatUsd } from "@/lib/money";
import { getCurrentTenantId } from "@/lib/tenant-context";

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

export type SaleLineRow = { name: string; qty: number; unitPriceUsd: Decimal; lineTotalUsd: Decimal };
export type SaleRow = { id: string; soldAt: Date; lines: SaleLineRow[] };

/** Sales by id with their lines and item names: one query (this tenant only: the guard filters). */
export async function listSalesWithLines(tx: TenantTx, ids: string[]): Promise<SaleRow[]> {
  if (ids.length === 0) return [];
  const rows = await tx.sale.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      soldAt: true,
      items: {
        orderBy: { id: "asc" },
        select: { qty: true, unitPriceUsd: true, lineTotalUsd: true, product: { select: { name: true } } },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    soldAt: row.soldAt,
    lines: row.items.map((item) => ({
      name: item.product.name,
      qty: item.qty,
      unitPriceUsd: new Decimal(item.unitPriceUsd.toString()),
      lineTotalUsd: new Decimal(item.lineTotalUsd.toString()),
    })),
  }));
}

export type SoldItemRow = { productId: string; name: string; qty: number; totalUsd: Decimal };

/** What sold in [start, end): one row per item, best seller first. One query. */
export async function sumSoldItems(tx: TenantTx, start: Date, end: Date): Promise<SoldItemRow[]> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<
    { productId: string; name: string; qty: bigint | number; total: { toString(): string } }[]
  >`
    SELECT si."productId", p.name, SUM(si.qty) AS qty, SUM(si."lineTotalUsd") AS total
    FROM "SaleItem" si
    JOIN "Sale" s ON s.id = si."saleId"
    JOIN "Product" p ON p.id = si."productId"
    WHERE si."tenantId" = ${tenantId} AND s."soldAt" >= ${start} AND s."soldAt" < ${end}
    GROUP BY si."productId", p.name
    ORDER BY SUM(si."lineTotalUsd") DESC, p.name
  `;
  return rows.map((row) => ({
    productId: row.productId,
    name: row.name,
    qty: Number(row.qty),
    totalUsd: new Decimal(row.total.toString()),
  }));
}
