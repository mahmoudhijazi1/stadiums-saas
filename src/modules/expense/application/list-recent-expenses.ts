import Decimal from "decimal.js";
import db from "@/lib/db";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
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
 * Last 20 expenses for this stadium. Staff may look (no record flag).
 * USD spent comes from Payment sums — Expense does not join payment tables.
 */
export async function listRecentExpenses(): Promise<RecentExpense[]> {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new Error("Not allowed");
  }

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
}
