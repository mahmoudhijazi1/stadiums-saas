import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";

/**
 * Who an item put on a game is charged to. `game` is the booker (the booking's requester); `person`
 * and `name` are another player. Every one of them is a tab: it never changes the booking due.
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
  /** The frozen USD value of this line (negative on a reversal). */
  lineTotalUsd: Decimal;
  /** LBP items only: the price tag, the line in pounds (negative on a reversal) and the frozen rate. */
  unitPriceLbp: Decimal | null;
  lineTotalLbp: Decimal | null;
  rateAtTime: Decimal | null;
  reversesItemId: string | null;
};

export type NetLine = {
  /** The original line's id: what a removal names. */
  id: string;
  productId: string;
  name: string;
  qty: number;
  unitPriceUsd: Decimal;
  /** The frozen USD value of what is left. */
  totalUsd: Decimal;
  /** LBP items only. */
  unitPriceLbp: Decimal | null;
  totalLbp: Decimal | null;
  rateAtTime: Decimal | null;
};

/** What is left of each original line after its reversals; fully removed lines disappear. */
export function netLines(lines: readonly StoredLine[]): NetLine[] {
  const reversals = new Map<string, StoredLine[]>();
  for (const line of lines) {
    if (line.reversesItemId) {
      const list = reversals.get(line.reversesItemId) ?? [];
      list.push(line);
      reversals.set(line.reversesItemId, list);
    }
  }
  const result: NetLine[] = [];
  for (const line of lines) {
    if (line.reversesItemId) continue;
    const taken = reversals.get(line.id) ?? [];
    const qty = taken.reduce((sum, reversal) => sum + reversal.qty, line.qty);
    if (qty <= 0) continue;
    result.push({
      id: line.id,
      productId: line.productId,
      name: line.name,
      qty,
      unitPriceUsd: line.unitPriceUsd,
      totalUsd: taken.reduce((sum, reversal) => sum.plus(reversal.lineTotalUsd), line.lineTotalUsd),
      unitPriceLbp: line.unitPriceLbp,
      totalLbp: line.lineTotalLbp
        ? taken.reduce((sum, reversal) => sum.plus(reversal.lineTotalLbp ?? 0), line.lineTotalLbp)
        : null,
      rateAtTime: line.rateAtTime,
    });
  }
  return result;
}

/** Exact sum of the frozen USD values of the net lines. */
export function netTotal(lines: readonly NetLine[]): Decimal {
  return lines.reduce((sum, line) => sum.plus(line.totalUsd), new Decimal(0));
}

/** A removal takes 1 up to what is still on the line. */
export function assertRemovalQty(netQty: number, qty: number): void {
  if (!Number.isInteger(qty) || qty < 1 || qty > netQty) throw new DomainError("shop.remove_exceeds");
}

/** A sale put on a game is always a player's tab; a walk-in sale has no payer and no booking. */
export function isTab(sale: { payerPersonId: string | null; payerName: string | null }): boolean {
  return sale.payerPersonId !== null || sale.payerName !== null;
}
