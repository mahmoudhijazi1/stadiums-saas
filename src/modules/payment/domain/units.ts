import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import type { TenderCurrency } from "@/modules/payment/domain/collect";

/**
 * Money units for game prices (DR-007 decision 7): $1 and 5,000 LBP. Pure, no caller yet.
 * Amounts are Decimal, like `collect.ts` and the shop's `pricing.ts`: USD in dollars (cents allowed),
 * LBP in whole pounds. Nothing here is a float.
 */

const LBP_UNIT = new Decimal(5000);
const USD_UNIT = new Decimal(1);

/** The smallest amount a game is priced, split or rounded in: $1.00 or 5,000 LBP. */
export function moneyUnit(currency: TenderCurrency): Decimal {
  return currency === "USD" ? USD_UNIT : LBP_UNIT;
}

/** The nearest whole unit, half up: 2,500 LBP -> 5,000; $0.50 -> $1. */
export function roundToUnit(amount: Decimal, currency: TenderCurrency): Decimal {
  const unit = moneyUnit(currency);
  return amount.div(unit).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).times(unit);
}

/**
 * Split `total` into `count` shares of whole units.
 *
 * Every share is a whole number of units. The leftover whole units go one by one to the first
 * shares (the requester is slot 1). If `total` is not a multiple of the unit, the part below one
 * unit goes to the first share as well, so the shares always add up exactly to `total`.
 *
 * A share can be 0 when the total has fewer units than there are players ($3 over 7 players is
 * $1, $1, $1 and four of $0); the caller decides what to do with an empty share.
 * `count` below 1 (or not a whole number) and a negative total throw.
 */
export function splitInUnits(total: Decimal, count: number, currency: TenderCurrency): Decimal[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new DomainError("booking.split_count");
  }
  if (total.lt(0)) {
    throw new DomainError("payment.amount_positive");
  }

  const unit = moneyUnit(currency);
  const wholeUnits = total.div(unit).floor();
  const belowUnit = total.minus(wholeUnits.times(unit));
  const base = wholeUnits.div(count).floor();
  let extra = wholeUnits.minus(base.times(count));

  const shares: Decimal[] = [];
  for (let i = 0; i < count; i++) {
    const units = extra.gt(0) ? base.plus(1) : base;
    if (extra.gt(0)) extra = extra.minus(1);
    shares.push(units.times(unit));
  }
  shares[0] = shares[0]!.plus(belowUnit);
  return shares;
}

/**
 * What to say out loud: pounds rounded UP to the next 5,000 (537,000 -> 540,000; 540,000 stays).
 * Up, so the owner never loses by quoting it. Display only: never record it.
 */
export function friendlyLbp(amountLbp: Decimal): Decimal {
  return amountLbp.div(LBP_UNIT).ceil().times(LBP_UNIT);
}

/**
 * May the owner mark what is left as paid in one tap ("Consider it paid", reason ROUNDING)?
 * LBP: more than 0 and under 5,000. USD: more than 0 and worth under 5,000 LBP at `rate`; without a
 * rate there is no way to tell, so no. The conversion is the shop's `usdToLbp` (whole pounds, half
 * up); it is repeated here because `payment` may not import `shop` (test/architecture/rules.ts).
 */
export function isForgivable(remaining: Decimal, currency: TenderCurrency, rate: Decimal | null): boolean {
  if (remaining.lte(0)) return false;
  if (currency === "LBP") return remaining.lt(LBP_UNIT);
  if (!rate || rate.lte(0)) return false;
  return remaining.times(rate).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).lt(LBP_UNIT);
}
