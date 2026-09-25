import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import type { CollectionModeName } from "@/modules/booking/domain/person-owed";

export type AdjustDueVerdict = "ok" | "noop";

/**
 * May this due change be written? Unchanged is a no-op (no log row).
 * Below what was already collected would be a refund, which is out of scope.
 * Per-player dues are edited per participant, not here.
 */
export function assertAdjustDue(input: {
  fromUsd: Decimal;
  toUsd: Decimal;
  collectedUsd: Decimal;
  collectionMode: CollectionModeName;
}): AdjustDueVerdict {
  const fromUsd = input.fromUsd.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const toUsd = input.toUsd.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  if (toUsd.equals(fromUsd)) return "noop";
  if (toUsd.lt(0)) {
    throw new DomainError("booking.due_negative");
  }
  if (toUsd.lt(input.collectedUsd)) {
    throw new DomainError("booking.due_below_collected");
  }
  if (input.collectionMode !== "WHOLE") {
    throw new DomainError("booking.due_whole_only");
  }
  return "ok";
}
