import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { REPORTS_VIEW, can } from "@/modules/access/domain/can";
import type { ExpenseCategory } from "@/modules/expense/domain/categories";
import { listTendersBySourceIds } from "@/modules/payment/infrastructure/payments";

export type ExpenseDetail = {
  id: string;
  category: ExpenseCategory;
  description: string;
  occurredAt: Date;
  tenders: {
    currency: "USD" | "LBP";
    amount: Decimal;
    rateAtTime: Decimal | null;
    usdEquivalent: Decimal;
  }[];
};

/**
 * The expenses behind some ledger rows, with their tenders (and the rates frozen on them):
 * two reads for any number of rows. reports.view, like the Activity list that asks.
 */
export async function listExpenseDetails(ids: string[]): Promise<Map<string, ExpenseDetail>> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, REPORTS_VIEW)) {
    throw new DomainError("access.not_allowed");
  }
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();

  try {
    const [rows, tenders] = await Promise.all([
      db.expense.findMany({ where: { id: { in: unique } } }),
      listTendersBySourceIds(db, "EXPENSE", unique),
    ]);
    return new Map(
      rows.map((row) => [
        row.id,
        {
          id: row.id,
          category: row.category,
          description: row.description,
          occurredAt: row.occurredAt,
          tenders: tenders
            .filter((tender) => tender.sourceId === row.id)
            .map(({ currency, amount, rateAtTime, usdEquivalent }) => ({
              currency,
              amount,
              rateAtTime,
              usdEquivalent,
            })),
        },
      ]),
    );
  } catch (error) {
    return await rethrowUnexpected(error, "List expense details failed", "listExpenseDetails");
  }
}
