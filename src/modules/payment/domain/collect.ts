import Decimal from "decimal.js";

export type TenderCurrency = "USD" | "LBP";

export type TenderDraft = {
  currency: TenderCurrency;
  amount: Decimal;
};

export type FrozenTender = {
  currency: TenderCurrency;
  amount: Decimal;
  rateAtTime: Decimal | null;
  usdEquivalent: Decimal;
};

/**
 * Freeze one cash part to USD. USD copies the amount. LBP divides by the
 * owner's rate (ROUND_HALF_UP, two places). LBP with no rate cannot be taken.
 */
export function usdEquivalent(input: {
  currency: TenderCurrency;
  amount: Decimal;
  rate: Decimal | null;
}): Decimal {
  if (input.amount.lte(0)) {
    throw new Error("Amount must be positive");
  }

  if (input.currency === "USD") {
    return input.amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  if (!input.rate || input.rate.lte(0)) {
    throw new Error("Set exchange rate first");
  }

  return input.amount.div(input.rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * What is still owed on the game (DR-002 §2.11). Never a JS float.
 */
export function remainingDue(priceUsd: Decimal, collectedUsd: Decimal): Decimal {
  return priceUsd.minus(collectedUsd);
}

/**
 * Only APPROVED games may take cash this slice (SPEC-06). Payment does not
 * import Booking — the status is a string the use case already loaded.
 */
export function assertCanCollect(status: string): void {
  if (status !== "APPROVED") {
    throw new Error("Only an approved booking can be collected");
  }
}

/**
 * Remaining must be above zero before a new collection (stops double-submit).
 */
export function assertHasDue(remaining: Decimal): void {
  if (remaining.lte(0)) {
    throw new Error("Nothing due");
  }
}

/**
 * Drop zero parts, freeze the rest. Need at least one positive tender.
 * USD stores the current rate when one exists; LBP always needs a rate.
 */
export function freezeTenders(
  drafts: TenderDraft[],
  rate: Decimal | null,
): FrozenTender[] {
  const frozen: FrozenTender[] = [];

  for (const draft of drafts) {
    if (draft.amount.isZero()) {
      continue;
    }
    if (draft.amount.lt(0)) {
      throw new Error("Amount must be positive");
    }

    const equivalent = usdEquivalent({
      currency: draft.currency,
      amount: draft.amount,
      rate,
    });

    frozen.push({
      currency: draft.currency,
      amount: draft.amount,
      rateAtTime: rate,
      usdEquivalent: equivalent,
    });
  }

  if (frozen.length === 0) {
    throw new Error("Amount required");
  }

  return frozen;
}
