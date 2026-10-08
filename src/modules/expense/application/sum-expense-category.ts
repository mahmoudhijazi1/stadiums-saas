import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { REPORTS_VIEW, can } from "@/modules/access/domain/can";
import type { ExpenseCategory } from "@/modules/expense/domain/categories";
import { periodBoundsFromCivilRange } from "@/modules/ledger/domain/period";
import { listTendersBySourceIds } from "@/modules/payment/infrastructure/payments";

const TIME_ZONE = "Asia/Beirut";

/** USD spent on one category in a civil-date range (by the day it happened): what was paid, tender by tender. reports.view. */
export async function sumExpenseCategory(input: {
  from: string;
  to: string;
  category: ExpenseCategory;
}): Promise<Decimal> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, REPORTS_VIEW)) throw new DomainError("access.not_allowed");
  try {
    const bounds = periodBoundsFromCivilRange(input.from, input.to, TIME_ZONE);
    const expenses = await db.expense.findMany({
      where: { category: input.category, occurredAt: { gte: bounds.startInclusive, lt: bounds.endExclusive } },
      select: { id: true },
    });
    const tenders = await listTendersBySourceIds(db, "EXPENSE", expenses.map((expense) => expense.id));
    return tenders.reduce((sum, tender) => sum.plus(tender.usdEquivalent), new Decimal(0));
  } catch (error) {
    return await rethrowUnexpected(error, "Sum expense category failed", "sumExpenseCategory");
  }
}
