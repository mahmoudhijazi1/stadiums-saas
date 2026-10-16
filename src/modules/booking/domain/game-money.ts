import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";

/**
 * A game's money in its own currency (DR-007 decision 2). A USD game stores its USD columns and an
 * LBP game its LBP columns, never both (database CHECKs). Every reader goes through one of these
 * accessors, so it has to say what it does with each currency; a reader that only knows dollars
 * calls `requireUsd`, which refuses an LBP game instead of reading a null as zero.
 */
export type GameCurrency = "USD" | "LBP";

export type GameMoney = { currency: GameCurrency; amount: Decimal };

/** What a database row or a raw SQL row gives back for a money column. */
type Stored = Decimal | { toString(): string } | string | null | undefined;

function decimalOf(value: Stored, column: string): Decimal {
  if (value === null || value === undefined) {
    throw new Error(`Game money: ${column} is missing for its currency (CHECK broken?)`);
  }
  return new Decimal(value.toString());
}

/** The agreed price, in the game's currency. */
export function gamePrice(booking: {
  priceCurrency: GameCurrency;
  priceUsd: Stored;
  priceLbp: Stored;
}): GameMoney {
  return booking.priceCurrency === "LBP"
    ? { currency: "LBP", amount: decimalOf(booking.priceLbp, "priceLbp") }
    : { currency: "USD", amount: decimalOf(booking.priceUsd, "priceUsd") };
}

/** What the game owes now (before payments), in the game's currency. */
export function gameDue(booking: {
  priceCurrency: GameCurrency;
  amountDueUsd: Stored;
  amountDueLbp: Stored;
}): GameMoney {
  return booking.priceCurrency === "LBP"
    ? { currency: "LBP", amount: decimalOf(booking.amountDueLbp, "amountDueLbp") }
    : { currency: "USD", amount: decimalOf(booking.amountDueUsd, "amountDueUsd") };
}

/** One participant's share. Exactly one of the two columns is set (CHECK), so that one says the currency. */
export function shareDue(participant: { amountDueUsd: Stored; amountDueLbp: Stored }): GameMoney {
  if (participant.amountDueLbp !== null && participant.amountDueLbp !== undefined) {
    return { currency: "LBP", amount: decimalOf(participant.amountDueLbp, "amountDueLbp") };
  }
  return { currency: "USD", amount: decimalOf(participant.amountDueUsd, "amountDueUsd") };
}

/** One due change's from and to, in its currency. */
export function dueChangeAmounts(change: {
  currency: GameCurrency;
  fromUsd: Stored;
  toUsd: Stored;
  fromLbp: Stored;
  toLbp: Stored;
}): { currency: GameCurrency; from: Decimal; to: Decimal } {
  return change.currency === "LBP"
    ? { currency: "LBP", from: decimalOf(change.fromLbp, "fromLbp"), to: decimalOf(change.toLbp, "toLbp") }
    : { currency: "USD", from: decimalOf(change.fromUsd, "fromUsd"), to: decimalOf(change.toUsd, "toUsd") };
}

/**
 * The USD amount, for code that only handles USD games today. An LBP game is refused with
 * `booking.lbp_not_supported` ("LBP games are not supported here yet"); `where` names the reader
 * for the log. Until LBP games can be created (DR-007 slice 5) this never throws.
 */
export function requireUsd(money: GameMoney, where: string): Decimal {
  if (money.currency !== "USD") {
    throw new DomainError("booking.lbp_not_supported", { where });
  }
  return money.amount;
}
