import Decimal from "decimal.js";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  EXPENSES_RECORD,
  can,
} from "@/modules/access/domain/can";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import type { ExpenseCategory } from "@/modules/expense/domain/categories";
import { occurredAtFromCivilDate } from "@/modules/expense/domain/occurred-at";
import { insertExpense } from "@/modules/expense/infrastructure/expenses";
import {
  freezeTenders,
  type TenderDraft,
} from "@/modules/payment/domain/collect";
import { recordPayment } from "@/modules/payment/application/record-payment";
import { findLatestExchangeRate } from "@/modules/payment/infrastructure/rates";

const TIME_ZONE = "Asia/Beirut";

const EXPECTED = new Set([
  "Not allowed",
  "Set exchange rate first",
  "Amount required",
  "Amount must be positive",
]);

/**
 * Create an expense and pay it in the same tx (DR-002 §2.21 / §2.22).
 * Auth before $transaction. No platformDb inside tx.
 */
export async function recordExpense(input: {
  category: ExpenseCategory;
  description: string;
  occurredOn: string;
  tenders: TenderDraft[];
}): Promise<void> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, EXPENSES_RECORD)) {
    throw new Error("Not allowed");
  }

  try {
    const expenseId = await db.$transaction(async (tx) => {
      const occurredAt = occurredAtFromCivilDate(input.occurredOn, TIME_ZONE);
      const expense = await insertExpense(tx, {
        category: input.category,
        description: input.description,
        occurredAt,
      });

      const rate = await findLatestExchangeRate(tx);
      const frozen = freezeTenders(input.tenders, rate);

      let amountDueUsd = new Decimal(0);
      for (const tender of frozen) {
        amountDueUsd = amountDueUsd.plus(tender.usdEquivalent);
      }

      await recordPayment(tx, {
        direction: "OUT",
        sourceType: "EXPENSE",
        sourceId: expense.id,
        amountDueUsd,
        tenders: frozen,
        occurredAt: expense.occurredAt,
      });

      return expense.id;
    });

    logger.info(`Expense recorded ${expenseId}`);
  } catch (error) {
    if (error instanceof Error && isExpected(error)) {
      throw error;
    }
    logger.error("Record expense failed", error);
    throw error;
  }
}

function isExpected(error: Error): boolean {
  return (
    EXPECTED.has(error.message) ||
    error.message.startsWith("Invalid expense date")
  );
}
