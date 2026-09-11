import Decimal from "decimal.js";
import type { TenantTx } from "@/lib/db";
import type { FrozenTender } from "@/modules/payment/domain/collect";
import { insertLedgerEntry } from "@/modules/ledger/infrastructure/entries";
import { insertPaymentWithTenders } from "@/modules/payment/infrastructure/payments";

/**
 * Write payment + tenders + ledger in the *given* tx (DR-002 §2.21).
 * Does not open a transaction. Does not load a Booking or Expense.
 * Optional occurredAt: expense business date. Omit → ledger DB default (now).
 */
export async function recordPayment(
  tx: TenantTx,
  input: {
    direction: "IN" | "OUT";
    sourceType: "BOOKING" | "EXPENSE";
    sourceId: string;
    amountDueUsd: Decimal;
    tenders: FrozenTender[];
    occurredAt?: Date;
  },
): Promise<string> {
  const paymentId = await insertPaymentWithTenders(tx, {
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    amountDueUsd: input.amountDueUsd,
    tenders: input.tenders,
  });

  let moved = new Decimal(0);
  for (const tender of input.tenders) {
    moved = moved.plus(tender.usdEquivalent);
  }

  await insertLedgerEntry(tx, {
    direction: input.direction,
    amountUsd: moved,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    occurredAt: input.occurredAt,
  });

  return paymentId;
}
