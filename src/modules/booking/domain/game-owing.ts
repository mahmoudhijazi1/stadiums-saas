import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import { gameDue, type GameCurrency } from "@/modules/booking/domain/game-money";
import { bookingRemaining, participantRemaining } from "@/modules/payment/domain/collect";

/**
 * What a game has collected and still owes, in the game's own currency (DR-007 decisions 2, 4 and
 * 11). Pure. A USD game is read as it always was: its collected money is the sum of its tenders'
 * dollar equivalents. An LBP game is read from its settlements (`BookingSettlement.lbpApplied`,
 * empty until the collecting slice), so its remaining is its due minus what was applied, and a rate
 * change never moves it. Totals are kept per currency and never added across them.
 */

type Stored = Decimal | { toString(): string } | string | null | undefined;

const dec = (value: Stored): Decimal => new Decimal((value ?? 0).toString());

/** An amount per currency: dollars and pounds side by side, never converted into one another. */
export type Parts = { usd: Decimal; lbp: Decimal };

export function noParts(): Parts {
  return { usd: new Decimal(0), lbp: new Decimal(0) };
}

/** `amount` in `currency`, nothing in the other. */
export function partsOf(currency: GameCurrency, amount: Decimal): Parts {
  return currency === "LBP" ? { usd: new Decimal(0), lbp: amount } : { usd: amount, lbp: new Decimal(0) };
}

export function addParts(a: Parts, b: Parts): Parts {
  return { usd: a.usd.plus(b.usd), lbp: a.lbp.plus(b.lbp) };
}

export function hasParts(parts: Parts): boolean {
  return parts.usd.gt(0) || parts.lbp.gt(0);
}

export type GameOwing = {
  currency: GameCurrency;
  /** What the game is owed now (price changed by due changes), in `currency`. */
  due: Decimal;
  /** Collected so far, in `currency`: USD tenders, or the pounds the settlements applied. */
  collected: Decimal;
  /** Due minus collected. Not clamped, like `bookingRemaining`: an overpaid USD game stays negative. */
  remaining: Decimal;
};

/**
 * A booking's due, collected and remaining. `collectedUsd` is the sum of its tenders' dollar
 * equivalents, `settledLbp` the sum of its settlements' `lbpApplied`; the game's currency says which
 * one counts. The other is not an error: an LBP game paid in dollars (slice 6) records the pounds it
 * settled in its settlement, and the ledger keeps the dollars.
 */
export function gameOwing(input: {
  priceCurrency: GameCurrency;
  amountDueUsd: Stored;
  amountDueLbp: Stored;
  collectedUsd: Stored;
  settledLbp: Stored;
}): GameOwing {
  const due = gameDue(input);
  const collected = due.currency === "LBP" ? dec(input.settledLbp) : dec(input.collectedUsd);
  return {
    currency: due.currency,
    due: due.amount,
    collected,
    remaining: bookingRemaining(due.amount, collected),
  };
}

export type ShareOwing = {
  currency: GameCurrency;
  due: Decimal;
  allocated: Decimal;
  remaining: Decimal;
};

/**
 * One participant's share, what its allocations add up to, and what is left, in the game's
 * currency. A share or an allocation in the other currency than its game's means a USD-only reader
 * would have dropped money: it is refused (`booking.lbp_not_supported`) rather than left out, as
 * the slice 3b readers did. `where` names the reader for the log.
 */
export function shareOwing(input: {
  currency: GameCurrency;
  amountDueUsd: Stored;
  amountDueLbp: Stored;
  allocatedUsd: Stored;
  allocatedLbp: Stored;
  where: string;
}): ShareOwing {
  const mixed = () => new DomainError("booking.lbp_not_supported", { where: input.where });
  const lbpGame = input.currency === "LBP";
  const due = lbpGame ? input.amountDueLbp : input.amountDueUsd;
  const other = lbpGame ? input.amountDueUsd : input.amountDueLbp;
  // A share is in exactly one currency (CHECK) and it is the game's; a game without shares yet
  // (a slot being added) reads as nothing due.
  if (other !== null && other !== undefined && dec(other).gt(0)) throw mixed();
  const allocated = lbpGame ? dec(input.allocatedLbp) : dec(input.allocatedUsd);
  const otherAllocated = lbpGame ? dec(input.allocatedUsd) : dec(input.allocatedLbp);
  if (otherAllocated.gt(0)) throw mixed();
  return {
    currency: input.currency,
    due: dec(due),
    allocated,
    remaining: participantRemaining(dec(due), allocated),
  };
}

/**
 * The remaining of one participation, as a domain input. A USD game sets the dollar figures, as
 * every caller did before; an LBP game sets the pound figures (and its dollar figures are zero), so
 * a function that sums or classifies debts keeps one figure per currency and never mixes them.
 */
export type Remaining = {
  bookingRemainingUsd: Decimal;
  participantRemainingUsd: Decimal;
  /** Pounds, set on an LBP game only (DR-007). */
  bookingRemainingLbp?: Decimal;
  participantRemainingLbp?: Decimal;
};

export function remainingInput(currency: GameCurrency, booking: Decimal, participant: Decimal): Remaining {
  return currency === "LBP"
    ? {
        bookingRemainingUsd: new Decimal(0),
        participantRemainingUsd: new Decimal(0),
        bookingRemainingLbp: booking,
        participantRemainingLbp: participant,
      }
    : { bookingRemainingUsd: booking, participantRemainingUsd: participant };
}

/** The same two figures and the currency they are in. */
export function remainingOf(input: Remaining): { currency: GameCurrency; booking: Decimal; participant: Decimal } {
  return input.bookingRemainingLbp !== undefined && input.participantRemainingLbp !== undefined
    ? { currency: "LBP", booking: input.bookingRemainingLbp, participant: input.participantRemainingLbp }
    : { currency: "USD", booking: input.bookingRemainingUsd, participant: input.participantRemainingUsd };
}
