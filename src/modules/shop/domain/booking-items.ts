import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";

/**
 * Who an item put on a game is charged to.
 * `game`: raises the booking due (WHOLE bookings only). `person` / `name`: that player's own tab.
 */
export type PayerInput =
  | { kind: "game" }
  | { kind: "person"; personId: string }
  | { kind: "name"; name: string; phone?: string };

/** A stored line, original or reversal. A reversal has a negative qty and names the line it undoes. */
export type StoredLine = {
  id: string;
  productId: string;
  name: string;
  qty: number;
  unitPriceUsd: Decimal;
  reversesItemId: string | null;
};

export type NetLine = {
  /** The original line's id: what a removal names. */
  id: string;
  productId: string;
  name: string;
  qty: number;
  unitPriceUsd: Decimal;
  totalUsd: Decimal;
};

/** What is left of each original line after its reversals; fully removed lines disappear. */
export function netLines(lines: readonly StoredLine[]): NetLine[] {
  const reversed = new Map<string, number>();
  for (const line of lines) {
    if (line.reversesItemId) reversed.set(line.reversesItemId, (reversed.get(line.reversesItemId) ?? 0) + line.qty);
  }
  const result: NetLine[] = [];
  for (const line of lines) {
    if (line.reversesItemId) continue;
    const qty = line.qty + (reversed.get(line.id) ?? 0);
    if (qty <= 0) continue;
    result.push({
      id: line.id,
      productId: line.productId,
      name: line.name,
      qty,
      unitPriceUsd: line.unitPriceUsd,
      totalUsd: line.unitPriceUsd.times(qty).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    });
  }
  return result;
}

/** Exact sum of the net lines. */
export function netTotal(lines: readonly NetLine[]): Decimal {
  return lines.reduce((sum, line) => sum.plus(line.totalUsd), new Decimal(0));
}

/** A removal takes 1 up to what is still on the line. */
export function assertRemovalQty(netQty: number, qty: number): void {
  if (!Number.isInteger(qty) || qty < 1 || qty > netQty) throw new DomainError("shop.remove_exceeds");
}

/** What a tab still owes. Not clamped: a negative figure would be an overpayment, which stays visible. */
export function tabRemaining(totalUsd: Decimal, collectedUsd: Decimal): Decimal {
  return totalUsd.minus(collectedUsd);
}

/** A sale put on a game is a player's tab when it names a payer, "on the game" otherwise. */
export function isTab(sale: { payerPersonId: string | null; payerName: string | null }): boolean {
  return sale.payerPersonId !== null || sale.payerName !== null;
}
