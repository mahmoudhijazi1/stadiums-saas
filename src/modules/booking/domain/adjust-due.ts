import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import type { CollectionModeName } from "@/modules/booking/domain/person-owed";
import { isForgivable } from "@/modules/payment/domain/units";

export type AdjustDueVerdict = "ok" | "noop";

/**
 * May this due change be written? Unchanged is a no-op (no log row).
 * Below what was already collected would be a refund, which is out of scope.
 * Per-player dues are edited per participant, not here.
 * Every amount is in the game's currency (DR-007): dollars to the cent, or whole pounds; the
 * collected amount is what its tenders (dollars) or its settlements (pounds) add up to.
 */
export function assertAdjustDue(input: {
  currency: "USD" | "LBP";
  from: Decimal;
  to: Decimal;
  collected: Decimal;
  collectionMode: CollectionModeName;
}): AdjustDueVerdict {
  const places = input.currency === "LBP" ? 0 : 2;
  const from = input.from.toDecimalPlaces(places, Decimal.ROUND_HALF_UP);
  const to = input.to.toDecimalPlaces(places, Decimal.ROUND_HALF_UP);
  if (to.equals(from)) return "noop";
  if (to.lt(0)) {
    throw new DomainError("booking.due_negative");
  }
  if (to.lt(input.collected)) {
    throw new DomainError("booking.due_below_collected");
  }
  if (input.collectionMode !== "WHOLE") {
    throw new DomainError("booking.due_whole_only");
  }
  return "ok";
}

/**
 * Only a confirmed game or a fee (cancelled / no-show) has a due worth changing.
 * A PENDING or REJECTED request is not collectible yet (audit #8).
 */
export function assertDueAdjustableStatus(status: string): void {
  if (status !== "APPROVED" && status !== "CANCELLED" && status !== "NO_SHOW") {
    throw new DomainError("booking.due_not_confirmed");
  }
}

/**
 * "Consider it paid" for ONE share of a split game (DR-007 slice 7): how much the share and the
 * game's due both drop by, which is exactly what is left on that share. The same `isForgivable` as the
 * whole game. Refused (`booking.not_forgivable`) when the share's remainder is more than the game
 * still owes: money already collected for it (Unassigned) covers it, so lowering the due by it would
 * put the due below what was collected.
 */
export function forgivenShare(input: {
  shareRemaining: Decimal;
  bookingRemaining: Decimal;
  currency: "USD" | "LBP";
  rate: Decimal | null;
}): Decimal {
  if (
    !isForgivable(input.shareRemaining, input.currency, input.rate) ||
    input.shareRemaining.gt(input.bookingRemaining)
  ) {
    throw new DomainError("booking.not_forgivable");
  }
  return input.shareRemaining;
}

/**
 * "Consider it paid" (DR-007 decision 8): the due that makes the game paid, which is the due lowered
 * by exactly what is left. Only when what is left is forgivable (`isForgivable`: under 5,000 LBP, or
 * worth under 5,000 LBP at `rate` on a USD game, never without a rate) and the game is collected
 * whole; anything else is refused with `booking.not_forgivable`. Never called without the owner's tap.
 */
export function forgivenDue(input: {
  due: Decimal;
  remaining: Decimal;
  currency: "USD" | "LBP";
  rate: Decimal | null;
  collectionMode: CollectionModeName;
}): Decimal {
  if (input.collectionMode !== "WHOLE") {
    throw new DomainError("booking.due_whole_only");
  }
  if (!isForgivable(input.remaining, input.currency, input.rate)) {
    throw new DomainError("booking.not_forgivable");
  }
  return input.due.minus(input.remaining);
}
