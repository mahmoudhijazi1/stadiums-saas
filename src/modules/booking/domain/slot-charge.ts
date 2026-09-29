import Decimal from "decimal.js";

/** One slot as loaded: its due and what its allocations already add up to. */
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

/**
 * What a per-player tap or "Booker pays all remaining" charges (SPEC-15 §3.2, P3).
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
  let left = input.amountDueUsd.minus(input.collectedUsd);
  const allocations: SlotCharge["allocations"] = [];
  if (left.lte(0)) return { totalUsd: new Decimal(0), allocations };

  const chosen = [...input.slots]
    .sort((a, b) => a.slotNumber - b.slotNumber)
    .filter(
      (slot) =>
        input.target === "ALL_UNPAID" ||
        slot.participantId === input.target.participantId,
    );

  let total = new Decimal(0);
  for (const slot of chosen) {
    if (left.lte(0)) break;
    const remaining = slot.dueUsd.minus(slot.paidUsd);
    if (remaining.lte(0)) continue;
    const amount = Decimal.min(remaining, left);
    allocations.push({ participantId: slot.participantId, amountUsd: amount });
    total = total.plus(amount);
    left = left.minus(amount);
  }
  return { totalUsd: total, allocations };
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
  const slot = input.slots.find((row) => row.participantId === input.participantId);
  const remaining = slot ? slot.dueUsd.minus(slot.paidUsd) : new Decimal(0);
  if (remaining.lte(0)) return { kind: "paid" };
  const charge = planSlotCharge({
    amountDueUsd: input.amountDueUsd,
    collectedUsd: input.collectedUsd,
    slots: input.slots,
    target: { participantId: input.participantId },
  });
  if (charge.totalUsd.lte(0)) return { kind: "covered" };
  return {
    kind: "pay",
    chargeUsd: charge.totalUsd,
    partial: charge.totalUsd.lt(remaining),
  };
}
