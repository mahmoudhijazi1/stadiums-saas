import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";

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
    throw new DomainError("payment.amount_positive");
  }

  if (input.currency === "USD") {
    return input.amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  if (!input.rate || input.rate.lte(0)) {
    throw new DomainError("payment.rate_required");
  }

  return input.amount.div(input.rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Booking remaining. Same subtract as remainingDue. No clamp, so an overpay stays negative.
 */
export function bookingRemaining(amountDueUsd: Decimal, collectedUsd: Decimal): Decimal {
  return amountDueUsd.minus(collectedUsd);
}

/**
 * One participant's remaining after allocations. No clamp.
 */
export function participantRemaining(dueUsd: Decimal, allocatedUsd: Decimal): Decimal {
  return dueUsd.minus(allocatedUsd);
}

/**
 * Collected USD that is not yet assigned to a participant.
 */
export function unassignedUsd(collectedUsd: Decimal, allocatedUsd: Decimal): Decimal {
  return collectedUsd.minus(allocatedUsd);
}

/**
 * What is still owed on the game (DR-002 §2.11). Never a JS float.
 * Prefer bookingRemaining(amountDueUsd, collectedUsd) at call sites.
 */
export function remainingDue(priceUsd: Decimal, collectedUsd: Decimal): Decimal {
  return bookingRemaining(priceUsd, collectedUsd);
}

/**
 * APPROVED, NO_SHOW, or CANCELLED may take cash (SPEC-06, SPEC-14, RULE-9).
 * Remaining above zero is `assertHasDue`. Payment does not import Booking —
 * the status is a string the use case already loaded.
 */
export function assertCanCollect(status: string): void {
  if (status !== "APPROVED" && status !== "NO_SHOW" && status !== "CANCELLED") {
    throw new DomainError("payment.collect_unapproved");
  }
}

/**
 * Remaining must be above zero before a new collection (stops double-submit).
 */
export function assertHasDue(remaining: Decimal): void {
  if (remaining.lte(0)) {
    throw new DomainError("payment.nothing_due");
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
      throw new DomainError("payment.amount_positive");
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
    throw new DomainError("payment.amount_required");
  }

  return frozen;
}
