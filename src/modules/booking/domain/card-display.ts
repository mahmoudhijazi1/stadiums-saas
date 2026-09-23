import Decimal from "decimal.js";

/**
 * Trailing state on a Today booking card. Clock at render time.
 * Instants, not civil dates, so a game that ends after midnight stays live
 * until its end. Does not change cancel, no-show, or collect rules.
 */
export type CardDisplay =
  | { kind: "before" }
  | { kind: "live"; minutesLeft: number }
  | { kind: "unpaid" }
  | { kind: "partial" }
  | { kind: "paid" };

export function deriveCardDisplay(input: {
  start: Date;
  end: Date;
  price: Decimal;
  remaining: Decimal;
  now: Date;
}): CardDisplay {
  const nowMs = input.now.getTime();
  if (nowMs < input.start.getTime()) {
    return { kind: "before" };
  }
  if (nowMs < input.end.getTime()) {
    const minutesLeft = Math.max(
      1,
      Math.ceil((input.end.getTime() - nowMs) / 60_000),
    );
    return { kind: "live", minutesLeft };
  }
  if (input.remaining.lte(0)) return { kind: "paid" };
  if (input.remaining.lt(input.price)) return { kind: "partial" };
  return { kind: "unpaid" };
}
