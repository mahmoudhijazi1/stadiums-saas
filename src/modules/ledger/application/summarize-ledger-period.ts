import Decimal from "decimal.js";
import db from "@/lib/db";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { REPORTS_VIEW, can } from "@/modules/access/domain/can";
import {
  currentMonthCivilRange,
  periodBoundsFromCivilRange,
} from "@/modules/ledger/domain/period";
import { netUsd } from "@/modules/ledger/domain/totals";
import { sumAmountUsdByDirection } from "@/modules/ledger/infrastructure/entries";

const TIME_ZONE = "Asia/Beirut";

export type LedgerPeriodSummary = {
  inUsd: Decimal;
  outUsd: Decimal;
  netUsd: Decimal;
  from: string;
  to: string;
};

/**
 * USD in / out / net for a civil-date period (SPEC-08). Auth before the query.
 * No $transaction. Does not load the exchange rate (page owns LBP display).
 */
export async function summarizeLedgerPeriod(input: {
  from?: string;
  to?: string;
}): Promise<LedgerPeriodSummary> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, REPORTS_VIEW)) {
    throw new Error("Not allowed");
  }

  const range =
    input.from !== undefined && input.to !== undefined
      ? { from: input.from, to: input.to }
      : currentMonthCivilRange(new Date(), TIME_ZONE);

  const bounds = periodBoundsFromCivilRange(range.from, range.to, TIME_ZONE);
  const totals = await sumAmountUsdByDirection(
    db,
    bounds.startInclusive,
    bounds.endExclusive,
  );

  return {
    inUsd: totals.IN,
    outUsd: totals.OUT,
    netUsd: netUsd(totals.IN, totals.OUT),
    from: range.from,
    to: range.to,
  };
}
