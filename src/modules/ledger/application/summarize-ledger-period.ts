import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { REPORTS_VIEW, can } from "@/modules/access/domain/can";
import {
  currentMonthCivilRange,
  periodBoundsFromCivilRange,
  previousRange,
} from "@/modules/ledger/domain/period";
import { netUsd } from "@/modules/ledger/domain/totals";
import { sumAmountUsdByDirectionAndSource } from "@/modules/ledger/infrastructure/entries";

const TIME_ZONE = "Asia/Beirut";

export type LedgerPeriodTotals = {
  inUsd: Decimal;
  outUsd: Decimal;
  netUsd: Decimal;
  /** What came IN, split by where it came from (BOOKING, SALE, ...), biggest first. */
  inBySource: { sourceType: string; usd: Decimal }[];
  /** Ledger rows in the period (0 = nothing happened: the comparison hides itself). */
  rows: number;
  from: string;
  to: string;
};

export type LedgerPeriodSummary = LedgerPeriodTotals & {
  /** The period before it (same length, or the previous calendar month), when asked for. */
  previous?: LedgerPeriodTotals;
};

async function totalsFor(from: string, to: string): Promise<LedgerPeriodTotals> {
  const bounds = periodBoundsFromCivilRange(from, to, TIME_ZONE);
  const groups = await sumAmountUsdByDirectionAndSource(db, bounds.startInclusive, bounds.endExclusive);
  const sum = (direction: "IN" | "OUT") =>
    groups.filter((group) => group.direction === direction).reduce((total, group) => total.plus(group.usd), new Decimal("0.00"));
  const inUsd = sum("IN");
  const outUsd = sum("OUT");
  return {
    inUsd,
    outUsd,
    netUsd: netUsd(inUsd, outUsd),
    inBySource: groups
      .filter((group) => group.direction === "IN")
      .map((group) => ({ sourceType: group.sourceType, usd: group.usd }))
      .sort((a, b) => b.usd.comparedTo(a.usd)),
    rows: groups.reduce((total, group) => total + group.rows, 0),
    from,
    to,
  };
}

/**
 * USD in / out / net for a civil-date period (SPEC-08). Auth before the query.
 * No $transaction. Does not load the exchange rate (page owns LBP display).
 * With `compare`, one more aggregate for the previous period (the Money headline).
 */
export async function summarizeLedgerPeriod(input: {
  from?: string;
  to?: string;
  compare?: boolean;
}): Promise<LedgerPeriodSummary> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, REPORTS_VIEW)) {
    throw new DomainError("access.not_allowed");
  }

  try {
    const range =
      input.from !== undefined && input.to !== undefined
        ? { from: input.from, to: input.to }
        : currentMonthCivilRange(new Date(), TIME_ZONE);

    const current = await totalsFor(range.from, range.to);
    if (!input.compare) return current;
    const before = previousRange(range);
    return { ...current, previous: await totalsFor(before.from, before.to) };
  } catch (error) {
    return await rethrowUnexpected(
      error,
      "Summarize ledger period failed",
      "summarizeLedgerPeriod",
    );
  }
}
