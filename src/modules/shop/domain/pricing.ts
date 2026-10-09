import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import { usdEquivalent, type FrozenTender } from "@/modules/payment/domain/collect";
import { assertQty, lineTotal } from "@/modules/shop/domain/sale";

/**
 * Items priced in either currency. USD stays the unit of account (every report, the ledger, every
 * total across time); the LBP price tag and the LBP payment are how an LBP item is actually sold.
 *
 * - A USD item owes dollars. An LBP item owes pounds, whole, fixed when it is added: a rate change
 *   later never changes the pounds owed.
 * - Each line freezes its USD value when it is added (the shared tender conversion, current rate).
 * - A sale or tab therefore has an LBP part (its LBP lines) and a USD part, each settled in its own
 *   currency first; see `applyPayment`.
 */
export type PriceCurrency = "USD" | "LBP";

export type ItemPrice = { currency: "USD"; usd: Decimal } | { currency: "LBP"; lbp: Decimal };

/** The price tag of a catalog row. */
export function itemPrice(product: {
  priceCurrency: PriceCurrency;
  priceUsd: Decimal | null;
  priceLbp: Decimal | null;
}): ItemPrice {
  if (product.priceCurrency === "LBP" && product.priceLbp) return { currency: "LBP", lbp: product.priceLbp };
  if (product.priceUsd) return { currency: "USD", usd: product.priceUsd };
  throw new DomainError("shop.product_not_found");
}

/** One sale line as stored: the frozen USD value, plus the pounds when the item is priced in LBP. */
export type PricedLine = {
  qty: number;
  unitPriceUsd: Decimal;
  lineTotalUsd: Decimal;
  unitPriceLbp: Decimal | null;
  lineTotalLbp: Decimal | null;
  rateAtTime: Decimal | null;
};

/**
 * Price `qty` of an item now. An LBP item needs the exchange rate (`shop.rate_required` without
 * one): its frozen USD value is the conversion of the whole line, not qty x a rounded unit.
 */
export function priceLine(price: ItemPrice, qty: number, rate: Decimal | null): PricedLine {
  assertQty(qty);
  if (price.currency === "USD") {
    return {
      qty,
      unitPriceUsd: price.usd,
      lineTotalUsd: lineTotal(price.usd, qty),
      unitPriceLbp: null,
      lineTotalLbp: null,
      rateAtTime: null,
    };
  }
  if (!rate || rate.lte(0)) throw new DomainError("shop.rate_required");
  const lineLbp = price.lbp.times(qty);
  return {
    qty,
    unitPriceUsd: usdEquivalent({ currency: "LBP", amount: price.lbp, rate }),
    lineTotalUsd: usdEquivalent({ currency: "LBP", amount: lineLbp, rate }),
    unitPriceLbp: price.lbp,
    lineTotalLbp: lineLbp,
    rateAtTime: rate,
  };
}

/**
 * The line that takes back `removedQty` of an LBP line, so that the lines of that item still add up
 * to the conversion of the net pounds (at the rate the item was added at). `netQtyBefore` and
 * `netUsdBefore` are what the item's lines add up to before this removal.
 */
export function lbpReversal(input: {
  unitPriceLbp: Decimal;
  rateAtTime: Decimal;
  netQtyBefore: number;
  netUsdBefore: Decimal;
  removedQty: number;
}): { lineTotalLbp: Decimal; lineTotalUsd: Decimal } {
  const remainingLbp = input.unitPriceLbp.times(input.netQtyBefore - input.removedQty);
  const usdAfter = remainingLbp.isZero()
    ? new Decimal(0)
    : usdEquivalent({ currency: "LBP", amount: remainingLbp, rate: input.rateAtTime });
  return {
    lineTotalLbp: input.unitPriceLbp.times(input.removedQty).negated(),
    lineTotalUsd: usdAfter.minus(input.netUsdBefore),
  };
}

/** What a sale or tab is made of: pounds for the LBP lines, dollars for the USD lines. */
export type DueParts = {
  /** Sum of the LBP lines, in pounds. */
  dueLbp: Decimal;
  /** Sum of the USD lines, in dollars. */
  dueUsd: Decimal;
  /** The frozen USD value of the LBP lines (what they are worth for reports). */
  frozenLbpUsd: Decimal;
  /** The frozen USD value of everything. */
  frozenUsd: Decimal;
};

export function dueParts(lines: readonly { lineTotalUsd: Decimal; lineTotalLbp: Decimal | null }[]): DueParts {
  let dueLbp = new Decimal(0);
  let dueUsd = new Decimal(0);
  let frozenLbpUsd = new Decimal(0);
  for (const line of lines) {
    if (line.lineTotalLbp) {
      dueLbp = dueLbp.plus(line.lineTotalLbp);
      frozenLbpUsd = frozenLbpUsd.plus(line.lineTotalUsd);
    } else {
      dueUsd = dueUsd.plus(line.lineTotalUsd);
    }
  }
  return { dueLbp, dueUsd, frozenLbpUsd, frozenUsd: dueUsd.plus(frozenLbpUsd) };
}

/** Where a sale or tab stands, in each currency. */
export type SettleState = {
  remLbp: Decimal;
  remUsd: Decimal;
  /** The frozen USD value of the LBP part still outstanding. */
  outstandingFrozenLbpUsd: Decimal;
  /** Everything still outstanding, at frozen USD values: what the aggregate totals show. */
  outstandingFrozenUsd: Decimal;
};

/**
 * `appliedLbp` / `appliedUsd` are the sums of the sale's allocations; `recordedUsd` is the USD the
 * payments recorded (the sum of their tender USD values). Never negative: an overpaid legacy sale
 * simply owes nothing.
 */
export function settleState(input: {
  parts: DueParts;
  appliedLbp: Decimal;
  appliedUsd: Decimal;
  recordedUsd: Decimal;
}): SettleState {
  const remLbp = Decimal.max(input.parts.dueLbp.minus(input.appliedLbp), 0);
  const remUsd = Decimal.max(input.parts.dueUsd.minus(input.appliedUsd), 0);
  const outstandingFrozenUsd = Decimal.max(input.parts.frozenUsd.minus(input.recordedUsd), 0);
  const outstandingFrozenLbpUsd = remLbp.isZero() ? new Decimal(0) : Decimal.max(outstandingFrozenUsd.minus(remUsd), 0);
  return { remLbp, remUsd, outstandingFrozenLbpUsd, outstandingFrozenUsd };
}

export function owesAnything(state: Pick<SettleState, "remLbp" | "remUsd">): boolean {
  return state.remLbp.gt(0) || state.remUsd.gt(0);
}

/** Pounds to dollars, the shared conversion (half-up to cents). */
export function lbpToUsd(lbp: Decimal, rate: Decimal): Decimal {
  return usdEquivalent({ currency: "LBP", amount: lbp, rate });
}

/** Dollars to pounds, whole, half-up. */
export function usdToLbp(usd: Decimal, rate: Decimal): Decimal {
  return usd.times(rate).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
}

export type PaymentApplication = {
  /** Pounds / dollars of the sale's own parts this payment settles. */
  lbpApplied: Decimal;
  usdApplied: Decimal;
  /** What is left of each part afterwards. */
  remLbpAfter: Decimal;
  remUsdAfter: Decimal;
  /** What was handed over beyond what the sale owed, in the currency it was handed over in. */
  changeLbp: Decimal;
  changeUsd: Decimal;
  /** The USD this payment records per tender (the frozen value it settles), before any change. */
  recordedByLbpTender: Decimal;
  recordedByUsdTender: Decimal;
};

/**
 * Apply cash to what a sale or tab owes. An LBP tender settles the LBP part first, a USD tender the
 * USD part first; any excess converts to the other part at the current rate (`rate`, null when none
 * is set: then there is no conversion and the excess is simply change). What is still beyond both
 * parts is change, in its own currency.
 *
 * The USD recorded is not the cash converted: pounds paid against LBP lines record those lines'
 * frozen USD value, allocated in proportion to the pounds settled, with the payment that settles
 * the last pound taking the exact remainder. So a fully paid sale records exactly its frozen USD,
 * whatever the rate did in between. Dollars paid against dollar lines record themselves.
 */
export function applyPayment(input: {
  state: SettleState;
  handed: { lbp: Decimal; usd: Decimal };
  rate: Decimal | null;
}): PaymentApplication {
  const { state, handed, rate } = input;
  const zero = new Decimal(0);

  // Same currency first.
  const lbpSame = Decimal.min(handed.lbp, state.remLbp);
  const usdSame = Decimal.min(handed.usd, state.remUsd);
  const lbpLeft = handed.lbp.minus(lbpSame);
  const usdLeft = handed.usd.minus(usdSame);
  const remLbp1 = state.remLbp.minus(lbpSame);
  const remUsd1 = state.remUsd.minus(usdSame);

  // Then the excess crosses over to the other part.
  let usdFromLbp = zero;
  let lbpConsumed = zero;
  if (rate && rate.gt(0) && lbpLeft.gt(0) && remUsd1.gt(0)) {
    const value = lbpToUsd(lbpLeft, rate);
    usdFromLbp = Decimal.min(value, remUsd1);
    lbpConsumed = value.lt(remUsd1)
      ? lbpLeft
      : Decimal.min(lbpLeft, remUsd1.times(rate).toDecimalPlaces(0, Decimal.ROUND_UP));
  }
  let lbpFromUsd = zero;
  let usdConsumed = zero;
  if (rate && rate.gt(0) && usdLeft.gt(0) && remLbp1.gt(0)) {
    const value = usdToLbp(usdLeft, rate);
    lbpFromUsd = Decimal.min(value, remLbp1);
    usdConsumed = value.lt(remLbp1)
      ? usdLeft
      : Decimal.min(usdLeft, remLbp1.div(rate).toDecimalPlaces(2, Decimal.ROUND_UP));
  }

  const lbpApplied = lbpSame.plus(lbpFromUsd);
  const usdApplied = usdSame.plus(usdFromLbp);
  const remLbpAfter = state.remLbp.minus(lbpApplied);
  const remUsdAfter = state.remUsd.minus(usdApplied);

  // What the pounds settled are worth: proportional, the last pound takes the remainder.
  let recordedLbpPart = zero;
  if (lbpApplied.gt(0)) {
    recordedLbpPart = remLbpAfter.isZero()
      ? state.outstandingFrozenLbpUsd
      : state.outstandingFrozenLbpUsd.times(lbpApplied).div(state.remLbp).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }
  const fromLbpTender = lbpApplied.isZero() ? zero : recordedLbpPart.times(lbpSame).div(lbpApplied).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const fromUsdTender = recordedLbpPart.minus(fromLbpTender);

  return {
    lbpApplied,
    usdApplied,
    remLbpAfter,
    remUsdAfter,
    changeLbp: lbpLeft.minus(lbpConsumed),
    changeUsd: usdLeft.minus(usdConsumed),
    recordedByLbpTender: fromLbpTender.plus(usdFromLbp),
    recordedByUsdTender: usdSame.plus(fromUsdTender),
  };
}

/**
 * The tenders to write for one payment. A sale or a tab does not record the excess (`keepChange`
 * false): the tender is reduced to what the sale used and the rest is change for the customer.
 * `keepChange` true records everything handed over, the excess valued at the current rate (how a
 * booking collection works); no sale code uses it today.
 */
export function paymentTenders(input: {
  application: PaymentApplication;
  handed: { lbp: Decimal; usd: Decimal };
  rate: Decimal | null;
  keepChange: boolean;
}): FrozenTender[] {
  const { application, handed, rate, keepChange } = input;
  const tenders: FrozenTender[] = [];
  const lbpAmount = keepChange ? handed.lbp : handed.lbp.minus(application.changeLbp);
  const usdAmount = keepChange ? handed.usd : handed.usd.minus(application.changeUsd);

  if (lbpAmount.gt(0)) {
    if (!rate || rate.lte(0)) throw new DomainError("payment.rate_required");
    tenders.push({
      currency: "LBP",
      amount: lbpAmount,
      rateAtTime: rate,
      usdEquivalent: application.recordedByLbpTender.plus(keepChange && application.changeLbp.gt(0) ? lbpToUsd(application.changeLbp, rate) : 0),
    });
  }
  if (usdAmount.gt(0)) {
    tenders.push({
      currency: "USD",
      amount: usdAmount,
      rateAtTime: rate,
      usdEquivalent: application.recordedByUsdTender.plus(keepChange ? application.changeUsd : 0),
    });
  }
  if (tenders.length === 0) throw new DomainError("payment.amount_required");
  return tenders;
}
