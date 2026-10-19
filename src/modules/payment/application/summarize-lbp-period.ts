import type Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { REPORTS_VIEW, can } from "@/modules/access/domain/can";
import { periodBoundsFromCivilRange, previousRange } from "@/modules/ledger/domain/period";
import { lbpTotals, type LbpPeriodTotals } from "@/modules/payment/domain/lbp-period";
import { sumTendersInLbpBySource } from "@/modules/payment/infrastructure/lbp-period";

const TIME_ZONE = "Asia/Beirut";

export type LbpPeriodSummary = LbpPeriodTotals & { previous?: LbpPeriodTotals };

async function totalsFor(from: string, to: string, fallbackRate: Decimal | null): Promise<LbpPeriodTotals> {
  const bounds = periodBoundsFromCivilRange(from, to, TIME_ZONE);
  const rows = await sumTendersInLbpBySource(db, bounds.startInclusive, bounds.endExclusive);
  return lbpTotals(rows, fallbackRate, { from, to });
}

/**
 * Money in and out of a civil-date period in pounds, each payment at its own value (DR-007): the
 * Money page's LBP view. A USD tender with no stored rate is counted at `fallbackRate` and reported
 * in `unrated`. With `compare`, the previous period by the same method. reports.view.
 */
export async function summarizeLbpPeriod(input: {
  from: string;
  to: string;
  compare?: boolean;
  fallbackRate: Decimal | null;
}): Promise<LbpPeriodSummary> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, REPORTS_VIEW)) {
    throw new DomainError("access.not_allowed");
  }
  try {
    const current = await totalsFor(input.from, input.to, input.fallbackRate);
    if (!input.compare) return current;
    const before = previousRange({ from: input.from, to: input.to });
    return { ...current, previous: await totalsFor(before.from, before.to, input.fallbackRate) };
  } catch (error) {
    return await rethrowUnexpected(error, "Summarize LBP period failed", "summarizeLbpPeriod");
  }
}
