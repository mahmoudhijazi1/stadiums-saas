import Decimal from "decimal.js";

export type FeeInitiator = "PLAYER" | "OWNER" | "NO_SHOW";

export type DueChangeReason =
  | "LATE_CANCELLATION_FEE"
  | "NO_SHOW_FEE"
  | "CANCELLATION_NO_FEE"
  | "PARTIAL_GAME"
  | "DISCOUNT"
  | "WAIVER"
  | "CORRECTION";

export type FeePolicy = {
  cancellationWindowHours: number;
  lateCancellationFeePercent: number;
  noShowFeePercent: number;
};

export type FeeSuggestion = {
  feeUsd: Decimal;
  reason: DueChangeReason;
};

const ZERO = new Decimal(0);

/**
 * Suggested fee from the current due (`amountDueUsd`), not the agreed price.
 * OWNER cancel suggests nothing. A player inside the window pays the late percent.
 * No-show uses noShowFeePercent. Cents round half-up.
 */
export function suggestFee(
  policy: FeePolicy,
  booking: { amountDueUsd: Decimal; start: Date },
  now: Date,
  initiator: FeeInitiator,
): FeeSuggestion {
  if (initiator === "NO_SHOW") {
    return {
      feeUsd: percentOf(booking.amountDueUsd, policy.noShowFeePercent),
      reason: "NO_SHOW_FEE",
    };
  }
  if (initiator === "OWNER") {
    return { feeUsd: ZERO, reason: "CANCELLATION_NO_FEE" };
  }

  const windowMs = policy.cancellationWindowHours * 60 * 60 * 1000;
  const insideWindow = now.getTime() >= booking.start.getTime() - windowMs;
  if (!insideWindow || policy.lateCancellationFeePercent === 0) {
    return { feeUsd: ZERO, reason: "CANCELLATION_NO_FEE" };
  }
  return {
    feeUsd: percentOf(booking.amountDueUsd, policy.lateCancellationFeePercent),
    reason: "LATE_CANCELLATION_FEE",
  };
}

/**
 * Due never drops below what was already collected.
 * When the confirmed amount is not above collected, the log reason is
 * CANCELLATION_NO_FEE. An omitted fee uses the suggestion.
 */
export function confirmedFee(input: {
  suggestion: FeeSuggestion;
  collectedUsd: Decimal;
  feeUsd?: Decimal;
}): { feeUsd: Decimal; reason: DueChangeReason } {
  const requested = input.feeUsd ?? input.suggestion.feeUsd;
  const collected = input.collectedUsd.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const feeUsd = Decimal.max(requested, collected).toDecimalPlaces(
    2,
    Decimal.ROUND_HALF_UP,
  );
  if (!feeUsd.gt(collected)) {
    return { feeUsd: collected, reason: "CANCELLATION_NO_FEE" };
  }
  return {
    feeUsd,
    reason: reasonForConfirmedFee(input.suggestion, requested),
  };
}

/** Log reason when the owner confirms a fee. Waive is 0 against a non-zero suggestion. */
export function reasonForConfirmedFee(
  suggestion: FeeSuggestion,
  feeUsd: Decimal,
): DueChangeReason {
  if (feeUsd.isZero() && suggestion.feeUsd.gt(0)) return "WAIVER";
  return suggestion.reason;
}

function percentOf(amountDueUsd: Decimal, percent: number): Decimal {
  if (percent === 0) return ZERO;
  return amountDueUsd
    .times(percent)
    .div(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}
