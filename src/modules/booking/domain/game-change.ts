import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import { usdEquivalent, type FrozenTender, type TenderDraft } from "@/modules/payment/domain/collect";
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

export type LbpGameCollection = GameCollection & {
  /** Pounds of the game's due this payment settles (BookingSettlement.lbpApplied). */
  lbpApplied: Decimal;
  /** Dollars kept on this payment (BookingSettlement.usdApplied): the USD tender after change. */
  usdKept: Decimal;
};

/**
 * Apply cash to what an LBP-priced game still owes, in pounds (DR-007 decisions 3 to 6). Pounds count
 * first; dollars are converted at the current `rate` and count against the pounds still left; what is
 * beyond is change, in the currency it was handed over in. How much is settled and how much is change
 * is the shop's `applyPayment` (an LBP-only state). The tenders are NOT `paymentTenders`: that values
 * pounds at the frozen value of the lines they settle, while a game has no frozen dollar value and
 * decision 3 values each kept tender at THIS payment's rate (`usdEquivalent`). The pounds owed never
 * depend on the rate; only the ledger value does. A rate is required (`payment.rate_required`): pounds
 * cannot be valued and dollars cannot settle pounds without one. `remainingLbp` must be above zero.
 */
export function applyToLbpGameDue(input: {
  remainingLbp: Decimal;
  handed: { lbp: Decimal; usd: Decimal };
  rate: Decimal | null;
}): LbpGameCollection {
  const { remainingLbp, handed, rate } = input;
  if (!rate || rate.lte(0)) throw new DomainError("payment.rate_required");
  const zero = new Decimal(0);
  const application = applyPayment({
    state: { remLbp: remainingLbp, remUsd: zero, outstandingFrozenLbpUsd: zero, outstandingFrozenUsd: zero },
    handed,
    rate,
  });
  const lbpKept = handed.lbp.minus(application.changeLbp);
  const usdKept = handed.usd.minus(application.changeUsd);
  const tenders: FrozenTender[] = [];
  if (lbpKept.gt(0)) {
    tenders.push({ currency: "LBP", amount: lbpKept, rateAtTime: rate, usdEquivalent: usdEquivalent({ currency: "LBP", amount: lbpKept, rate }) });
  }
  if (usdKept.gt(0)) {
    tenders.push({ currency: "USD", amount: usdKept, rateAtTime: rate, usdEquivalent: usdEquivalent({ currency: "USD", amount: usdKept, rate }) });
  }
  if (tenders.length === 0) throw new DomainError("payment.amount_required");
  return {
    tenders,
    changeUsd: application.changeUsd,
    changeLbp: application.changeLbp,
    lbpApplied: application.lbpApplied,
    usdKept,
  };
}
