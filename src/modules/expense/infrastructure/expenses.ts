import type { TenantTx } from "@/lib/db";
import type { ExpenseCategory } from "@/modules/expense/domain/categories";

export type ExpenseRow = {
  id: string;
  category: ExpenseCategory;
  description: string;
  occurredAt: Date;
  createdAt: Date;
};

/**
 * Insert what was spent. No amount — money is a Payment (DR-002 §2.22).
 * Omit tenantId — the guard stamps it (DR-001 / Chapter 39).
 */
export async function insertExpense(
  tx: TenantTx,
  input: {
    category: ExpenseCategory;
    description: string;
    occurredAt: Date;
  },
): Promise<ExpenseRow> {
  const row = await tx.expense.create({
    data: {
      category: input.category,
      description: input.description,
      occurredAt: input.occurredAt,
    } as Parameters<typeof tx.expense.create>[0]["data"],
  });

  return {
    id: row.id,
    category: row.category,
    description: row.description,
    occurredAt: row.occurredAt,
    createdAt: row.createdAt,
  };
}

/**
 * Newest 20 for this tenant (occurredAt, then createdAt). No payment join —
 * application asks Payment for USD sums (SPEC-07).
 */
export async function listRecentExpenses(tx: TenantTx): Promise<ExpenseRow[]> {
  const rows = await tx.expense.findMany({
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: 20,
  });

  return rows.map((row) => ({
    id: row.id,
    category: row.category,
    description: row.description,
    occurredAt: row.occurredAt,
    createdAt: row.createdAt,
  }));
}
