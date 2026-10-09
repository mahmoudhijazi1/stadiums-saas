import Decimal from "decimal.js";
import { Prisma } from "@/app/generated/prisma/client";
import type { TenantTx } from "@/lib/db";
import { getCurrentTenantId } from "@/lib/tenant-context";

export type ProductRow = {
  id: string;
  name: string;
  priceUsd: Decimal;
  archivedAt: Date | null;
};

function toRow(row: { id: string; name: string; priceUsd: { toString(): string }; archivedAt: Date | null }): ProductRow {
  return { id: row.id, name: row.name, priceUsd: new Decimal(row.priceUsd.toString()), archivedAt: row.archivedAt };
}

/** Omit tenantId: the guard stamps it. */
export async function insertProduct(tx: TenantTx, input: { name: string; priceUsd: string }): Promise<ProductRow> {
  const row = await tx.product.create({
    data: { name: input.name, priceUsd: input.priceUsd } as Parameters<typeof tx.product.create>[0]["data"],
  });
  return toRow(row);
}

/** Name and price only. A price change affects future sales: past lines froze their own price. */
export async function updateProductRow(
  tx: TenantTx,
  id: string,
  input: { name: string; priceUsd: string },
): Promise<boolean> {
  const result = await tx.product.updateMany({
    where: { id, archivedAt: null },
    data: { name: input.name, priceUsd: input.priceUsd },
  });
  return result.count === 1;
}

/** Archive instead of delete: hidden from selling, still on past sales. Idempotent. */
export async function archiveProductRow(tx: TenantTx, id: string, now: Date): Promise<boolean> {
  const result = await tx.product.updateMany({ where: { id, archivedAt: null }, data: { archivedAt: now } });
  return result.count === 1;
}

/** Active items by id (this tenant only: the guard filters). Missing and archived ids are simply absent. */
export async function findActiveProducts(tx: TenantTx, ids: string[]): Promise<ProductRow[]> {
  if (ids.length === 0) return [];
  const rows = await tx.product.findMany({ where: { id: { in: ids }, archivedAt: null } });
  return rows.map(toRow);
}

export type ProductWithSold = ProductRow & { sold30d: number };

/**
 * Items with how many were sold in the last 30 days (one query). Archived items only when
 * asked for. The caller orders them (`orderByPopularity`).
 */
export async function listProductsWithSold(
  tx: TenantTx,
  input: { since: Date; includeArchived: boolean },
): Promise<ProductWithSold[]> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<
    { id: string; name: string; priceUsd: { toString(): string }; archivedAt: Date | null; sold: bigint | number | null }[]
  >`
    SELECT p.id, p.name, p."priceUsd", p."archivedAt",
           COALESCE(SUM(si.qty) FILTER (WHERE si."addedAt" >= ${input.since}), 0) AS sold
    FROM "Product" p
    LEFT JOIN "SaleItem" si ON si."productId" = p.id AND si."tenantId" = p."tenantId"
    WHERE p."tenantId" = ${tenantId}
      ${input.includeArchived ? Prisma.empty : Prisma.sql`AND p."archivedAt" IS NULL`}
    GROUP BY p.id
  `;
  return rows.map((row) => ({ ...toRow(row), sold30d: Number(row.sold ?? 0) }));
}

