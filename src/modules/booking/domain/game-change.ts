import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import type { FrozenTender, TenderDraft } from "@/modules/payment/domain/collect";
import { applyPayment, paymentTenders, settleState } from "@/modules/shop/domain/pricing";

export type GameCollection = {
  /** What is kept: the handed-over tenders reduced by the change. These are what gets recorded. */
  tenders: FrozenTender[];
  /** Handed over beyond the due, in the currency it was handed over in. */
  changeUsd: Decimal;
  changeLbp: Decimal;
};

/** The cash the owner typed, per currency. Zero parts are dropped; a negative part is refused. */
export function handedFromTenders(drafts: TenderDraft[]): { lbp: Decimal; usd: Decimal } {
  let lbp = new Decimal(0);
  let usd = new Decimal(0);
  for (const draft of drafts) {
    if (draft.amount.lt(0)) throw new DomainError("payment.amount_positive");
    if (draft.currency === "USD") usd = usd.plus(draft.amount);
    else lbp = lbp.plus(draft.amount);
  }
  if (lbp.isZero() && usd.isZero()) throw new DomainError("payment.amount_required");
  return { lbp, usd };
}

/**
 * Apply cash to what a USD-priced game still owes, the way the shop does (`applyPayment`):
 * up to the remaining, and the excess is change in the currency it was handed over in. The tenders
 * to record are reduced to what the game used, so a game never collects more than it is owed
 * (DR-007 decision 6). LBP is converted at the current rate, as `usdEquivalent` freezes it.
 * `remainingUsd` must be above zero (the caller refuses a game that owes nothing).
 */
export function applyToGameDue(input: {
  remainingUsd: Decimal;
  handed: { lbp: Decimal; usd: Decimal };
  rate: Decimal | null;
}): GameCollection {
  const { remainingUsd, handed, rate } = input;
  if (handed.lbp.gt(0) && (!rate || rate.lte(0))) throw new DomainError("payment.rate_required");

  const state = settleState({
    parts: {
      dueLbp: new Decimal(0),
      dueUsd: remainingUsd,
      frozenLbpUsd: new Decimal(0),
      frozenUsd: remainingUsd,
    },
    appliedLbp: new Decimal(0),
    appliedUsd: new Decimal(0),
    recordedUsd: new Decimal(0),
  });
  const application = applyPayment({ state, handed, rate });
  return {
    tenders: paymentTenders({ application, handed, rate, keepChange: false }),
    changeUsd: application.changeUsd,
    changeLbp: application.changeLbp,
  };
}
