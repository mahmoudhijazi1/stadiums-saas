import Decimal from "decimal.js";

/**
 * Trailing state on a Today booking card. Clock at render time.
 * Instants, not civil dates, so a game that ends after midnight stays live
 * until its end. Does not change cancel, no-show, or collect rules.
 */
export type CardBookingStatus = "APPROVED" | "CANCELLED" | "NO_SHOW";

export type CardDisplay =
  | { kind: "before" }
  | { kind: "live"; minutesLeft: number }
  | { kind: "unpaid" }
  | { kind: "partial" }
  | { kind: "paid" }
  | { kind: "no_show_unpaid" }
  | { kind: "no_show_paid" }
  | { kind: "cancelled" };

export function deriveCardDisplay(input: {
  start: Date;
  end: Date;
  price: Decimal;
  remaining: Decimal;
  now: Date;
  /** Omitted means APPROVED, so clock states stay as they were. */
  status?: CardBookingStatus;
}): CardDisplay {
  if (input.status === "CANCELLED") return { kind: "cancelled" };
  if (input.status === "NO_SHOW") {
    return input.remaining.lte(0)
      ? { kind: "no_show_paid" }
      : { kind: "no_show_unpaid" };
  }

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
