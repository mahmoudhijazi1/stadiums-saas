import Decimal from "decimal.js";

export type DueStatus = "APPROVED" | "CANCELLED" | "NO_SHOW";

export type DueClass = "owed" | "expected" | "none";

/**
 * Where a remaining amount sits (SPEC-16 §4.1).
 * Ended approved games, no-shows, and cancelled fees are owed.
 * A game that has not ended, including one in progress, is expected.
 */
export function classifyDue(input: {
  status: DueStatus;
  start: Date;
  end: Date;
  remaining: Decimal;
  now: Date;
}): DueClass {
  if (!input.remaining.gt(0)) return "none";
  if (input.status === "NO_SHOW" || input.status === "CANCELLED") return "owed";
  if (input.status !== "APPROVED") return "none";
  return input.end.getTime() <= input.now.getTime() ? "owed" : "expected";
}
