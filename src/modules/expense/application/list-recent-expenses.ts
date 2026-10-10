import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { REPORTS_VIEW, can } from "@/modules/access/domain/can";
import type { ExpenseCategory } from "@/modules/expense/domain/categories";
import { listRecentExpenses as loadRecentExpenseRows } from "@/modules/expense/infrastructure/expenses";
import { sumCollectedUsdBySourceIds } from "@/modules/payment/infrastructure/payments";

export type RecentExpense = {
  id: string;
  category: ExpenseCategory;
  description: string;
  occurredAt: Date;
  amountUsd: Decimal;
};

/**
 * Last 20 expenses for this stadium. reports.view (the amounts are money the stadium spent;
 * recording an expense needs only expenses.record and does not show this list).
 * USD spent comes from Payment sums — Expense does not join payment tables.
 */
export async function listRecentExpenses(): Promise<RecentExpense[]> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, REPORTS_VIEW)) {
    throw new DomainError("access.not_allowed");
  }

  try {
    const rows = await loadRecentExpenseRows(db);
    const spent = await sumCollectedUsdBySourceIds(
      db,
      "EXPENSE",
      rows.map((row) => row.id),
    );

    return rows.map((row) => ({
      id: row.id,
      category: row.category,
      description: row.description,
      occurredAt: row.occurredAt,
      amountUsd: spent.get(row.id) ?? new Decimal(0),
    }));
  } catch (error) {
    return await rethrowUnexpected(
      error,
      "List recent expenses failed",
      "listRecentExpenses",
    );
  }
}
