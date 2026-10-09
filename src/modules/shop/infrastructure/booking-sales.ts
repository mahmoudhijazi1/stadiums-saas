import Decimal from "decimal.js";
import type { TenantTx } from "@/lib/db";
import { formatUsd } from "@/lib/money";
import { getCurrentTenantId } from "@/lib/tenant-context";
import type { StoredLine } from "@/modules/shop/domain/booking-items";

/**
 * Sales put on a game. Still insert-only: a removal is a second line with a negative quantity.
 * Omit tenantId everywhere: the guard stamps it.
 */

/** Hold the sale row until the transaction ends (adding, removing and collecting a tab serialize here). */
export async function lockSale(tx: TenantTx, saleId: string): Promise<boolean> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Sale" WHERE id = ${saleId} AND "tenantId" = ${tenantId} FOR UPDATE
  `;
  return rows.length === 1;
}

export type BookingSaleRow = {
  id: string;
  bookingId: string | null;
  payerPersonId: string | null;
  payerName: string | null;
  payerPhone: string | null;
};

const SALE_SELECT = { id: true, bookingId: true, payerPersonId: true, payerName: true, payerPhone: true } as const;

export async function findSale(tx: TenantTx, saleId: string): Promise<BookingSaleRow | null> {
  return tx.sale.findFirst({ where: { id: saleId }, select: SALE_SELECT });
}

export async function findPersonTab(tx: TenantTx, bookingId: string, personId: string): Promise<BookingSaleRow | null> {
  return tx.sale.findFirst({ where: { bookingId, payerPersonId: personId }, select: SALE_SELECT });
}

/** A typed-name tab, matched without regard to case. */
export async function findNameTab(tx: TenantTx, bookingId: string, name: string): Promise<BookingSaleRow | null> {
  return tx.sale.findFirst({
    where: { bookingId, payerName: { equals: name, mode: "insensitive" } },
    select: SALE_SELECT,
  });
}

export async function insertBookingSale(
  tx: TenantTx,
  input: {
    createdByMembershipId: string;
    bookingId: string;
    payerPersonId?: string;
    payerName?: string;
    payerPhone?: string;
  },
): Promise<BookingSaleRow> {
  return tx.sale.create({
    data: {
      createdByMembershipId: input.createdByMembershipId,
      bookingId: input.bookingId,
      payerPersonId: input.payerPersonId ?? null,
      payerName: input.payerName ?? null,
      payerPhone: input.payerPhone ?? null,
    } as Parameters<typeof tx.sale.create>[0]["data"],
    select: SALE_SELECT,
  });
}

/** Take `qty` (positive here) of an original line back: a new line with a negative quantity. */
export async function insertReversalItem(
  tx: TenantTx,
  input: { saleId: string; original: { id: string; productId: string; unitPriceUsd: Decimal }; qty: number },
): Promise<void> {
  const qty = -input.qty;
  await tx.saleItem.create({
    data: {
      saleId: input.saleId,
      productId: input.original.productId,
      qty,
      unitPriceUsd: formatUsd(input.original.unitPriceUsd),
      lineTotalUsd: formatUsd(input.original.unitPriceUsd.times(qty)),
      reversesItemId: input.original.id,
    } as Parameters<typeof tx.saleItem.create>[0]["data"],
  });
}

export type SaleItemRow = {
  id: string;
  saleId: string;
  productId: string;
  qty: number;
  unitPriceUsd: Decimal;
  reversesItemId: string | null;
};

export async function findSaleItem(tx: TenantTx, itemId: string): Promise<SaleItemRow | null> {
  const row = await tx.saleItem.findFirst({ where: { id: itemId } });
  if (!row) return null;
  return {
    id: row.id,
    saleId: row.saleId,
    productId: row.productId,
    qty: row.qty,
    unitPriceUsd: new Decimal(row.unitPriceUsd.toString()),
    reversesItemId: row.reversesItemId,
  };
}

function toStored(item: {
  id: string;
  productId: string;
  qty: number;
  unitPriceUsd: { toString(): string };
  reversesItemId: string | null;
  product: { name: string };
}): StoredLine {
  return {
    id: item.id,
    productId: item.productId,
    name: item.product.name,
    qty: item.qty,
    unitPriceUsd: new Decimal(item.unitPriceUsd.toString()),
    reversesItemId: item.reversesItemId,
  };
}

const ITEM_SELECT = {
  id: true,
  productId: true,
  qty: true,
  unitPriceUsd: true,
  reversesItemId: true,
  product: { select: { name: true } },
} as const;

/** Every stored line of one sale, oldest first (originals and reversals). */
export async function listStoredLines(tx: TenantTx, saleId: string): Promise<StoredLine[]> {
  const rows = await tx.saleItem.findMany({ where: { saleId }, orderBy: { id: "asc" }, select: ITEM_SELECT });
  return rows.map(toStored);
}

export type BookingSaleWithLines = BookingSaleRow & {
  /** The payer's name: the person's, or the typed one. Null for the "on the game" sale. */
  displayName: string | null;
  displayPhone: string | null;
  lines: StoredLine[];
};

/** All sales put on these games, with their stored lines and payer names: two reads for any number of games. */
export async function listSalesOnBookings(tx: TenantTx, bookingIds: string[]): Promise<BookingSaleWithLines[]> {
  if (bookingIds.length === 0) return [];
  const rows = await tx.sale.findMany({
    where: { bookingId: { in: bookingIds } },
    orderBy: { createdAt: "asc" },
    select: {
      ...SALE_SELECT,
      payer: { select: { name: true, phone: true } },
      items: { orderBy: { id: "asc" }, select: ITEM_SELECT },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    bookingId: row.bookingId,
    payerPersonId: row.payerPersonId,
    payerName: row.payerName,
    payerPhone: row.payerPhone,
    displayName: row.payer?.name ?? row.payerName,
    displayPhone: row.payer?.phone ?? row.payerPhone,
    lines: row.items.map(toStored),
  }));
}
