import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import { splitEvenly } from "@/modules/booking/domain/split-evenly";

/** SPEC-15 P5. */
export const MAX_PLAYER_SLOTS = 30;

export type PlannedSlot = {
  slotNumber: number;
  amountDueUsd: Decimal;
  /** Slot 1 only. Every other slot has no person until it is named. */
  personId: string | null;
  isRequester: boolean;
};

/**
 * One slot per player, dues from splitEvenly (exact cents, no rounding: P1).
 * Slot 1 is the requester. The dues add up to amountDueUsd exactly.
 */
export function buildSlots(
  amountDueUsd: Decimal,
  count: number,
  requesterPersonId: string,
): PlannedSlot[] {
  if (!Number.isInteger(count) || count < 1 || count > MAX_PLAYER_SLOTS) {
    throw new DomainError("booking.split_count");
  }
  return splitEvenly(amountDueUsd, count).map((share, index) => ({
    slotNumber: index + 1,
    amountDueUsd: share,
    personId: index === 0 ? requesterPersonId : null,
    isRequester: index === 0,
  }));
}
