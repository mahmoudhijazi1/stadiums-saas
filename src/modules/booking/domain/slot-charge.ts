import Decimal from "decimal.js";
import { planShareCharge, sharePayState, type ShareSlot } from "@/modules/booking/domain/share-charge";

/** One slot of a game in dollars, as loaded: its due and what its allocations already add up to. */
export type ChargeSlot = {
  participantId: string;
  slotNumber: number;
  dueUsd: Decimal;
  paidUsd: Decimal;
};

export type SlotCharge = {
  /** What to take in cash now. Zero means nothing may be charged. */
  totalUsd: Decimal;
  /** One per slot that receives money, in slot order. Sums to totalUsd. */
  allocations: { participantId: string; amountUsd: Decimal }[];
};

export type ChargeTarget = "ALL_UNPAID" | { participantId: string };

function shareSlots(slots: ChargeSlot[]): ShareSlot[] {
  return slots.map((slot) => ({
    participantId: slot.participantId,
    slotNumber: slot.slotNumber,
    due: slot.dueUsd,
    paid: slot.paidUsd,
  }));
}

/**
 * What a per-player tap or "Booker pays all remaining" charges (SPEC-15 §3.2, P3) on a game in
 * dollars. The rules live in `share-charge.ts`, shared with games in pounds (DR-007 slice 7).
 *
 * The cap is the booking remaining: amountDueUsd minus everything collected, Unassigned
 * included. A charge never exceeds it, so money paid before the split is never taken
 * twice. Within the cap, unpaid slots are filled in slot order and the last may be
 * partial. Unassigned stays unassigned (assigning it is slice 5).
 *
 * Supersedes the slice 2 rule "a slot checks only its own remaining": that rule charged
 * again for money already sitting in Unassigned (audit §3.6).
 */
export function planSlotCharge(input: {
  amountDueUsd: Decimal;
  collectedUsd: Decimal;
  slots: ChargeSlot[];
  target: ChargeTarget;
}): SlotCharge {
  const plan = planShareCharge({
    cap: input.amountDueUsd.minus(input.collectedUsd),
    slots: shareSlots(input.slots),
    target: input.target,
  });
  return {
    totalUsd: plan.total,
    allocations: plan.allocations.map((row) => ({ participantId: row.participantId, amountUsd: row.amount })),
  };
}

export type SlotPayState =
  | { kind: "paid" }
  | { kind: "pay"; chargeUsd: Decimal; partial: boolean }
  | { kind: "covered" };

/**
 * What the sheet shows on one slot. "covered" is an unpaid slot the booking no longer
 * owes for (money already collected, e.g. Unassigned, covers it): no Pay button.
 */
export function slotPayState(input: {
  amountDueUsd: Decimal;
  collectedUsd: Decimal;
  slots: ChargeSlot[];
  participantId: string;
}): SlotPayState {
  const state = sharePayState({
    due: input.amountDueUsd,
    collected: input.collectedUsd,
    slots: shareSlots(input.slots),
    participantId: input.participantId,
  });
  return state.kind === "pay" ? { kind: "pay", chargeUsd: state.charge, partial: state.partial } : state;
}
