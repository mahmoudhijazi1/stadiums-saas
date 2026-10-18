import Decimal from "decimal.js";

/**
 * The Money page in pounds counts each payment at its own value (DR-007): an LBP tender is its amount,
 * a USD tender is its amount times the rate frozen on it. Pure rules; the sums come from one query.
 */

/** One source type's tenders in a period, as the query returns them (never converted yet). */
export type LbpTenderSums = {
  sourceType: string;
  /** LBP tenders as they are, plus every USD tender that has a stored rate at that rate. */
  ratedLbp: Decimal;
  /** USD tenders with no stored rate: dollars still to convert. */
  unratedUsd: Decimal;
  /** How many USD tenders had no stored rate. */
  unrated: number;
  /** Payments in the period (0 = nothing happened: the comparison hides itself). */
  payments: number;
};

export type LbpPeriodTotals = {
  inLbp: Decimal;
  outLbp: Decimal;
  netLbp: Decimal;
  /** What the shop took in the period (SALE payments), in pounds. */
  salesLbp: Decimal;
  /** What came IN by source, biggest first. */
  inBySource: { sourceType: string; lbp: Decimal }[];
  /** USD tenders that had no stored rate and were counted at the fallback rate. */
  unrated: number;
  payments: number;
  from: string;
  to: string;
};

/** An expense is money OUT; every other source brings money IN (the rule `recordPayment` writes). */
export function directionOfSource(sourceType: string): "IN" | "OUT" {
  return sourceType === "EXPENSE" ? "OUT" : "IN";
}

/** Whole pounds, half up: the value of one source's tenders. */
export function lbpValue(sums: Pick<LbpTenderSums, "ratedLbp" | "unratedUsd">, fallbackRate: Decimal | null): Decimal {
  const unrated = fallbackRate ? sums.unratedUsd.times(fallbackRate) : new Decimal(0);
  return sums.ratedLbp.plus(unrated).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
}

export function lbpTotals(
  rows: readonly LbpTenderSums[],
  fallbackRate: Decimal | null,
  range: { from: string; to: string },
): LbpPeriodTotals {
  let inLbp = new Decimal(0);
  let outLbp = new Decimal(0);
  let salesLbp = new Decimal(0);
  const inBySource: { sourceType: string; lbp: Decimal }[] = [];
  for (const row of rows) {
    const value = lbpValue(row, fallbackRate);
    if (directionOfSource(row.sourceType) === "OUT") {
      outLbp = outLbp.plus(value);
      continue;
    }
    inLbp = inLbp.plus(value);
    if (row.sourceType === "SALE") salesLbp = salesLbp.plus(value);
    inBySource.push({ sourceType: row.sourceType, lbp: value });
  }
  return {
    inLbp,
    outLbp,
    netLbp: inLbp.minus(outLbp),
    salesLbp,
    inBySource: inBySource.sort((a, b) => b.lbp.comparedTo(a.lbp)),
    unrated: rows.reduce((total, row) => total + row.unrated, 0),
    payments: rows.reduce((total, row) => total + row.payments, 0),
    from: range.from,
    to: range.to,
  };
}
