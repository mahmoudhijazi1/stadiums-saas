import Decimal from "decimal.js";
import type { TenantTx } from "@/lib/db";
import { recordPayment } from "@/modules/payment/application/record-payment";
import { freezeTenders, type TenderDraft } from "@/modules/payment/domain/collect";

/**
 * "Keep it" (DR-007 decision 15): the change a player leaves with the stadium is its own payment, with
 * source type KEPT_CHANGE and the booking as its source. It is written in the transaction of the game's
 * payment, under the same booking lock, after it. Its tenders are the change in the currency it was
 * handed over in, valued at the game payment's rate; its ledger IN goes through `recordPayment` (so it
 * carries its paymentId). It has no BookingSettlement and no allocation, so the game's due, its
 * settlements and its own payment are exactly as without it. No change: nothing is written.
 * Returns the payment id, or null when there was no change.
 */
export async function recordKeptChange(
  tx: TenantTx,
  input: { bookingId: string; changeUsd: Decimal; changeLbp: Decimal; rate: Decimal | null },
): Promise<string | null> {
  const drafts: TenderDraft[] = [];
  if (input.changeUsd.gt(0)) drafts.push({ currency: "USD", amount: input.changeUsd });
  if (input.changeLbp.gt(0)) drafts.push({ currency: "LBP", amount: input.changeLbp });
  if (drafts.length === 0) return null;

  const tenders = freezeTenders(drafts, input.rate);
  const amountDueUsd = tenders.reduce((sum, tender) => sum.plus(tender.usdEquivalent), new Decimal(0));
  return recordPayment(tx, {
    direction: "IN",
    sourceType: "KEPT_CHANGE",
    sourceId: input.bookingId,
    amountDueUsd,
    tenders,
  });
}
