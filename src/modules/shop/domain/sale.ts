import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";

/** A line sells 1 to 99 of one item. */
export const QTY_MIN = 1;
export const QTY_MAX = 99;

/** What a client may send for one line. Prices never come from the client. */
export type SaleLineInput = { productId: string; qty: number };

export function isValidQty(qty: number): boolean {
  return Number.isInteger(qty) && qty >= QTY_MIN && qty <= QTY_MAX;
}

export function assertQty(qty: number): void {
  if (!isValidQty(qty)) throw new DomainError("shop.qty_invalid");
}

/** unit price x quantity, exact (Decimal, never a float). */
export function lineTotal(unitPriceUsd: Decimal, qty: number): Decimal {
  assertQty(qty);
  return unitPriceUsd.times(qty).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** A sale has no stored total: it is the sum of its lines. */
export function saleTotal(lines: readonly { lineTotalUsd: Decimal }[]): Decimal {
  return lines.reduce((sum, line) => sum.plus(line.lineTotalUsd), new Decimal(0));
}

/** The same product twice becomes one line (quantities added, still within 1 to 99). */
export function mergeLines(lines: readonly SaleLineInput[]): SaleLineInput[] {
  const byProduct = new Map<string, number>();
  for (const line of lines) {
    assertQty(line.qty);
    byProduct.set(line.productId, (byProduct.get(line.productId) ?? 0) + line.qty);
  }
  const merged = [...byProduct.entries()].map(([productId, qty]) => ({ productId, qty }));
  for (const line of merged) assertQty(line.qty);
  return merged;
}

/** Items for one sale: as many as the counter can hold (the grid has no more tiles than this). */
export const MAX_LINES = 60;

/** Most sold in the last 30 days first, then by name (ties and never-sold items alphabetical). */
export function orderByPopularity<T extends { id: string; name: string; sold30d: number }>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) => b.sold30d - a.sold30d || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || (a.id < b.id ? -1 : 1),
  );
}

/** Enough USD to cover the total. Under-payment is refused; more is kept (as booking collection does). */
export function assertFullyPaid(paidUsd: Decimal, totalUsd: Decimal): void {
  if (paidUsd.lt(totalUsd)) throw new DomainError("shop.sale_not_fully_paid");
}
