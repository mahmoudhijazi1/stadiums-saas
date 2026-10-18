import Decimal from "decimal.js";

/**
 * Which payment is behind a ledger row. `recordPayment` writes one ledger row per payment and the
 * two share only the source (type and id), so a row is paired with the payment of its source made
 * closest to its time, one-to-one (the smallest gaps are paired first and a payment is used once).
 * An EXPENSE has exactly one payment (its row carries the business date, not the moment of entry), so it needs no time match. Any other source must match within a few minutes;
 * an entry with no payment gets nothing, and the screen falls back to the ledger's dollars.
 */
export type EntryRef = { id: string; sourceType: string; sourceId: string; occurredAt: Date };

export type PaymentRef = {
  sourceType: string;
  sourceId: string;
  createdAt: Date;
  tenders: { currency: "USD" | "LBP"; amount: Decimal }[];
};

/** What was kept: one part per currency, never added across currencies. */
export type KeptPart = { currency: "USD" | "LBP"; amount: Decimal };

const MATCH_WINDOW_MS = 5 * 60 * 1000;

export function keptParts(payment: PaymentRef): KeptPart[] {
  const usd = payment.tenders.filter((t) => t.currency === "USD").reduce((sum, t) => sum.plus(t.amount), new Decimal(0));
  const lbp = payment.tenders.filter((t) => t.currency === "LBP").reduce((sum, t) => sum.plus(t.amount), new Decimal(0));
  const parts: KeptPart[] = [];
  if (usd.gt(0)) parts.push({ currency: "USD", amount: usd });
  if (lbp.gt(0)) parts.push({ currency: "LBP", amount: lbp });
  return parts;
}

export function keptByEntry(entries: readonly EntryRef[], payments: readonly PaymentRef[]): Map<string, KeptPart[]> {
  const bySource = new Map<string, PaymentRef[]>();
  for (const payment of payments) {
    const key = `${payment.sourceType}:${payment.sourceId}`;
    bySource.set(key, [...(bySource.get(key) ?? []), payment]);
  }

  // Every allowed (entry, payment) pair of a source, then the smallest time gap first, globally: a
  // payment, once paired, is never used again, so no amount can show on two rows. Ties are broken by
  // the entry id, then the payment's time, then its amounts, so the result does not depend on the
  // order the rows were read in.
  type Candidate = { entry: EntryRef; payment: PaymentRef; gap: number; signature: string };
  const candidates: Candidate[] = [];
  for (const entry of entries) {
    for (const payment of bySource.get(`${entry.sourceType}:${entry.sourceId}`) ?? []) {
      const gap = Math.abs(payment.createdAt.getTime() - entry.occurredAt.getTime());
      if (entry.sourceType !== "EXPENSE" && gap > MATCH_WINDOW_MS) continue;
      const signature = keptParts(payment)
        .map((part) => `${part.currency}${part.amount.toFixed(2)}`)
        .join("+");
      candidates.push({ entry, payment, gap, signature });
    }
  }
  candidates.sort(
    (a, b) =>
      a.gap - b.gap ||
      compare(a.entry.id, b.entry.id) ||
      a.payment.createdAt.getTime() - b.payment.createdAt.getTime() ||
      compare(a.signature, b.signature),
  );

  const kept = new Map<string, KeptPart[]>();
  const used = new Set<PaymentRef>();
  for (const { entry, payment } of candidates) {
    if (kept.has(entry.id) || used.has(payment)) continue;
    const parts = keptParts(payment);
    if (parts.length === 0) continue;
    kept.set(entry.id, parts);
    used.add(payment);
  }
  return kept;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
