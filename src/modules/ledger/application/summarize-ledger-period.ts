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
import { sumAmountUsdByDirection } from "@/modules/ledger/infrastructure/entries";

const TIME_ZONE = "Asia/Beirut";

export type LedgerPeriodTotals = {
  inUsd: Decimal;
  outUsd: Decimal;
  netUsd: Decimal;
  from: string;
  to: string;
};

export type LedgerPeriodSummary = LedgerPeriodTotals & {
  /** The period before it (same length, or the previous calendar month), when asked for. */
  previous?: LedgerPeriodTotals;
};

async function totalsFor(from: string, to: string): Promise<LedgerPeriodTotals> {
  const bounds = periodBoundsFromCivilRange(from, to, TIME_ZONE);
  const totals = await sumAmountUsdByDirection(db, bounds.startInclusive, bounds.endExclusive);
  return {
    inUsd: totals.IN,
    outUsd: totals.OUT,
    netUsd: netUsd(totals.IN, totals.OUT),
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
