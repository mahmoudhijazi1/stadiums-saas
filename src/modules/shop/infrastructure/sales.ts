import Decimal from "decimal.js";
import type { TenantTx } from "@/lib/db";
import { formatUsd } from "@/lib/money";
import { getCurrentTenantId } from "@/lib/tenant-context";
import { netLines } from "@/modules/shop/domain/booking-items";

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

/** One priced line (see `priceLine`): USD items leave the LBP fields null. */
export async function insertSaleItem(
  tx: TenantTx,
  input: {
    saleId: string;
    productId: string;
    qty: number;
    unitPriceUsd: Decimal;
    lineTotalUsd: Decimal;
    unitPriceLbp?: Decimal | null;
    lineTotalLbp?: Decimal | null;
    rateAtTime?: Decimal | null;
  },
): Promise<void> {
  await tx.saleItem.create({
    data: {
      saleId: input.saleId,
      productId: input.productId,
      qty: input.qty,
      unitPriceUsd: formatUsd(input.unitPriceUsd),
      lineTotalUsd: formatUsd(input.lineTotalUsd),
      unitPriceLbp: input.unitPriceLbp ? input.unitPriceLbp.toFixed(0) : null,
      lineTotalLbp: input.lineTotalLbp ? input.lineTotalLbp.toFixed(0) : null,
      rateAtTime: input.rateAtTime ? input.rateAtTime.toFixed(0) : null,
    } as Parameters<typeof tx.saleItem.create>[0]["data"],
  });
}

export type SaleLineRow = {
  name: string;
  qty: number;
  unitPriceUsd: Decimal;
  lineTotalUsd: Decimal;
  /** LBP items only: the sheet shows these in pounds. */
  unitPriceLbp: Decimal | null;
  lineTotalLbp: Decimal | null;
};
/** `payerName` is set on a player tab (the person name, or the typed one); null on a walk-in or an "on the game" sale. */
export type SaleRow = { id: string; soldAt: Date; payerName: string | null; lines: SaleLineRow[] };

/** Sales by id with their lines and item names: one query (this tenant only: the guard filters). */
export async function listSalesWithLines(tx: TenantTx, ids: string[]): Promise<SaleRow[]> {
  if (ids.length === 0) return [];
  const rows = await tx.sale.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      soldAt: true,
      payerName: true,
      payer: { select: { name: true } },
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          productId: true,
          qty: true,
          unitPriceUsd: true,
          lineTotalUsd: true,
          unitPriceLbp: true,
          lineTotalLbp: true,
          rateAtTime: true,
          reversesItemId: true,
          product: { select: { name: true } },
        },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    soldAt: row.soldAt,
    payerName: row.payer?.name ?? row.payerName,
    // What is left after removals, as the owner sees it.
    lines: netLines(
      row.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.product.name,
        qty: item.qty,
        unitPriceUsd: new Decimal(item.unitPriceUsd.toString()),
        lineTotalUsd: new Decimal(item.lineTotalUsd.toString()),
        unitPriceLbp: item.unitPriceLbp === null ? null : new Decimal(item.unitPriceLbp.toString()),
        lineTotalLbp: item.lineTotalLbp === null ? null : new Decimal(item.lineTotalLbp.toString()),
        rateAtTime: item.rateAtTime === null ? null : new Decimal(item.rateAtTime.toString()),
        reversesItemId: item.reversesItemId,
      })),
    ).map((line) => ({
      name: line.name,
      qty: line.qty,
      unitPriceUsd: line.unitPriceUsd,
      lineTotalUsd: line.totalUsd,
      unitPriceLbp: line.unitPriceLbp,
      lineTotalLbp: line.totalLbp,
    })),
  }));
}

export type SoldItemRow = { productId: string; name: string; qty: number; totalUsd: Decimal };

/**
 * What sold in [start, end), by the time each line was added: one row per item, best seller first, one query.
 * A removal is a negative line, so it reduces the day it happened on; an item whose net is zero is left out.
 */
export async function sumSoldItems(tx: TenantTx, start: Date, end: Date): Promise<SoldItemRow[]> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<
    { productId: string; name: string; qty: bigint | number; total: { toString(): string } }[]
  >`
    SELECT si."productId", p.name, SUM(si.qty) AS qty, SUM(si."lineTotalUsd") AS total
    FROM "SaleItem" si
    JOIN "Product" p ON p.id = si."productId"
    WHERE si."tenantId" = ${tenantId} AND si."addedAt" >= ${start} AND si."addedAt" < ${end}
    GROUP BY si."productId", p.name
    HAVING SUM(si.qty) <> 0
    ORDER BY SUM(si."lineTotalUsd") DESC, p.name
  `;
  return rows.map((row) => ({
    productId: row.productId,
    name: row.name,
    qty: Number(row.qty),
    totalUsd: new Decimal(row.total.toString()),
  }));
}
