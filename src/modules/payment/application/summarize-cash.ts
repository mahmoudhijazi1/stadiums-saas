import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { REPORTS_VIEW, can } from "@/modules/access/domain/can";
import { buildCashDay, type CashDay } from "@/modules/payment/domain/cash-day";
import { sumTendersByDirectionAndCurrency } from "@/modules/payment/infrastructure/payments";

/**
 * Cash for a window (the caller passes the current business day's UTC range, from the same
 * `dayStartHour` rule as Today): net, in and out per currency, as recorded. One query.
 * reports.view. Not a report: see `payment/domain/cash-day.ts`.
 */
export async function summarizeCash(input: { start: Date; end: Date }): Promise<CashDay> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, REPORTS_VIEW)) {
    throw new DomainError("access.not_allowed");
  }
  try {
    return buildCashDay(await sumTendersByDirectionAndCurrency(db, input.start, input.end));
  } catch (error) {
    return await rethrowUnexpected(error, "Summarize cash failed", "summarizeCash");
  }
}
