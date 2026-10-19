import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import type { GameMoney } from "@/modules/booking/domain/game-money";
import { splitInUnits } from "@/modules/payment/domain/units";

/** SPEC-15 P5. */
export const MAX_PLAYER_SLOTS = 30;

export type PlannedSlot = {
  slotNumber: number;
  /** The share, in the game's currency. */
  amountDue: Decimal;
  /** Slot 1 only. Every other slot has no person until it is named. */
  personId: string | null;
  isRequester: boolean;
};

/**
 * One slot per player, shares from `splitInUnits` in the game's currency (DR-007 decision 7): whole
 * units of $1 or 5,000 LBP, the leftover units one by one to the first slots, and the part of the due
 * below one unit on slot 1, so the shares always add up to the due exactly. $40 over 7 is five of $6
 * and two of $5; 2,000,000 LBP over 7 is 290,000 on slot 1 and six of 285,000.
 * Slot 1 is the requester.
 */
export function buildSlots(due: GameMoney, count: number, requesterPersonId: string): PlannedSlot[] {
  if (!Number.isInteger(count) || count < 1 || count > MAX_PLAYER_SLOTS) {
    throw new DomainError("booking.split_count");
  }
  return splitInUnits(due.amount, count, due.currency).map((share, index) => ({
    slotNumber: index + 1,
    amountDue: share,
    personId: index === 0 ? requesterPersonId : null,
    isRequester: index === 0,
  }));
}
