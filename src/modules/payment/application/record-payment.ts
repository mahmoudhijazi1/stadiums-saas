import Decimal from "decimal.js";
import type { TenantTx } from "@/lib/db";
import type { FrozenTender } from "@/modules/payment/domain/collect";
import { insertLedgerEntry } from "@/modules/ledger/infrastructure/entries";
import { insertPaymentWithTenders, type DueSnapshot } from "@/modules/payment/infrastructure/payments";

/**
 * Write payment + tenders + ledger in the *given* tx (DR-002 §2.21).
 * Does not open a transaction. Does not load a Booking or Expense.
 * Optional occurredAt: expense business date. Omit → ledger DB default (now).
 * The due snapshot is dollars, or pounds for a payment on an LBP game (DR-007); the ledger is USD
 * either way: the sum of the tenders' USD values.
 */
export async function recordPayment(
  tx: TenantTx,
  input: {
    direction: "IN" | "OUT";
    sourceType: "BOOKING" | "EXPENSE" | "SALE";
    sourceId: string;
    tenders: FrozenTender[];
    occurredAt?: Date;
  } & DueSnapshot,
): Promise<string> {
  const paymentId = await insertPaymentWithTenders(tx, {
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    tenders: input.tenders,
    ...("amountDueLbp" in input ? { amountDueLbp: input.amountDueLbp } : { amountDueUsd: input.amountDueUsd }),
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
