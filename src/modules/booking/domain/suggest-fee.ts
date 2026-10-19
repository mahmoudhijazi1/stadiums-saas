import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import type { GameCurrency, GameMoney } from "@/modules/booking/domain/game-money";
import { moneyUnit, roundToUnit } from "@/modules/payment/domain/units";

export type FeeInitiator = "PLAYER" | "OWNER" | "NO_SHOW";

export type DueChangeReason =
  | "LATE_CANCELLATION_FEE"
  | "NO_SHOW_FEE"
  | "CANCELLATION_NO_FEE"
  | "PARTIAL_GAME"
  | "DISCOUNT"
  | "WAIVER"
  | "CORRECTION"
  | "EXTENSION"
  | "SHOP_ITEMS"
  /** "Consider it paid" (DR-007 decision 8). */
  | "ROUNDING";

export type FeePolicy = {
  cancellationWindowHours: number;
  lateCancellationFeePercent: number;
  noShowFeePercent: number;
};

/** A fee in the game's own currency (DR-007 slice 8): dollars on a USD game, pounds on an LBP game. */
export type FeeSuggestion = {
  currency: GameCurrency;
  fee: Decimal;
  reason: DueChangeReason;
};

/** What a fee is worked out from: the game's current due, in its currency, and its start. */
export type FeeBooking = { due: GameMoney; start: Date };

/**
 * Suggested fee from the current due, not the agreed price, in the game's currency.
 * OWNER cancel suggests nothing. A player inside the window pays the late percent.
 * No-show uses noShowFeePercent. The fee is rounded to the money unit of the currency, half up
 * (DR-007 decision 7): $1 on a game in dollars, 5,000 LBP on a game in pounds.
 */
export function suggestFee(
  policy: FeePolicy,
  booking: FeeBooking,
  now: Date,
  initiator: FeeInitiator,
): FeeSuggestion {
  const { currency } = booking.due;
  const none = (reason: DueChangeReason): FeeSuggestion => ({ currency, fee: new Decimal(0), reason });
  if (initiator === "NO_SHOW") {
    return { currency, fee: percentOf(booking.due, policy.noShowFeePercent), reason: "NO_SHOW_FEE" };
  }
  if (initiator === "OWNER") return none("CANCELLATION_NO_FEE");

  const windowMs = policy.cancellationWindowHours * 60 * 60 * 1000;
  const insideWindow = now.getTime() >= booking.start.getTime() - windowMs;
  if (!insideWindow || policy.lateCancellationFeePercent === 0) return none("CANCELLATION_NO_FEE");
  return {
    currency,
    fee: percentOf(booking.due, policy.lateCancellationFeePercent),
    reason: "LATE_CANCELLATION_FEE",
  };
}

/**
 * A cancel or no-show fee the owner typed can be at most what the booking owes now (both in the
 * game's currency). A higher fee would invent a debt; the owner uses Adjust for that.
 */
export function assertFeeWithinDue(fee: Decimal, due: Decimal): void {
  if (fee.gt(due)) {
    throw new DomainError("booking.fee_above_due");
  }
}

/**
 * A fee typed on a game in pounds is a whole multiple of the LBP money unit, like every other amount
 * a game is priced in (`booking.fee_unit`). On a game in dollars it is as before: any amount in cents.
 */
export function assertFeeInUnit(fee: Decimal, currency: GameCurrency): void {
  if (currency === "LBP" && !fee.mod(moneyUnit("LBP")).isZero()) {
    throw new DomainError("booking.fee_unit");
  }
}

/**
 * The fee the owner typed for this game, from the field of its currency (`feeUsd` or `feeLbp`).
 * A field of the other currency means the form and the game disagree: `form.invalid`.
 */
export function typedFeeFor(
  currency: GameCurrency,
  typed: { feeUsd?: Decimal; feeLbp?: Decimal },
): Decimal | undefined {
  const other = currency === "LBP" ? typed.feeUsd : typed.feeLbp;
  if (other !== undefined) throw new DomainError("form.invalid");
  return currency === "LBP" ? typed.feeLbp : typed.feeUsd;
}

/** Cents on a game in dollars, whole pounds on a game in pounds. */
function atScale(amount: Decimal, currency: GameCurrency): Decimal {
  return amount.toDecimalPlaces(currency === "LBP" ? 0 : 2, Decimal.ROUND_HALF_UP);
}

/**
 * Due never drops below what was already collected (in the game's currency: dollars from tenders,
 * pounds from settlements). When the confirmed amount is not above collected, the fee is clamped to
 * collected. The log reason then stays CANCELLATION_NO_FEE for a cancel. For a no-show it is
 * WAIVER when the owner lowered a non-zero suggestion, else NO_SHOW_FEE (a no-show is
 * not a cancellation). An omitted fee uses the suggestion.
 */
export function confirmedFee(input: {
  suggestion: FeeSuggestion;
  collected: Decimal;
  fee?: Decimal;
}): { fee: Decimal; reason: DueChangeReason } {
  const { currency } = input.suggestion;
  const requested = input.fee ?? input.suggestion.fee;
  const collected = atScale(input.collected, currency);
  const fee = atScale(Decimal.max(requested, collected), currency);
  if (!fee.gt(collected)) {
    return { fee: collected, reason: clampedReason(input.suggestion, requested) };
  }
  return { fee, reason: reasonForConfirmedFee(input.suggestion, requested) };
}

/**
 * "I cancelled" (OWNER) suggests no fee, so choosing it instead of "Player cancelled"
 * is itself a waiver when the player path would charge more. The caller then needs
 * bookings.adjust_due, like an Edit or Waive (SPEC-16 §6, audit §1.5).
 * `resultingFee` is what the owner path would actually store (after the clamp).
 */
export function ownerInitiatorLowersFee(input: {
  policy: FeePolicy;
  booking: FeeBooking;
  now: Date;
  resultingFee: Decimal;
}): boolean {
  const player = suggestFee(input.policy, input.booking, input.now, "PLAYER");
  return player.fee.gt(input.resultingFee);
}

function clampedReason(suggestion: FeeSuggestion, requested: Decimal): DueChangeReason {
  if (suggestion.reason !== "NO_SHOW_FEE") return "CANCELLATION_NO_FEE";
  return suggestion.fee.gt(0) && requested.lt(suggestion.fee) ? "WAIVER" : "NO_SHOW_FEE";
}

/** Log reason when the owner confirms a fee. Waive is 0 against a non-zero suggestion. */
export function reasonForConfirmedFee(suggestion: FeeSuggestion, fee: Decimal): DueChangeReason {
  if (fee.isZero() && suggestion.fee.gt(0)) return "WAIVER";
  return suggestion.reason;
}

function percentOf(due: GameMoney, percent: number): Decimal {
  if (percent === 0) return new Decimal(0);
  return roundToUnit(due.amount.times(percent).div(100), due.currency);
}
