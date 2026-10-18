import Decimal from "decimal.js";

/**
 * What a per-player tap charges, in the game's own currency (DR-007 slice 7). `slot-charge.ts` is the
 * dollar-named face of the same rules; both run through here, so a game in pounds charges exactly as a
 * game in dollars does: the cap is what the booking still owes, unpaid slots are filled in slot order,
 * the last may be partial.
 */
export type ShareSlot = {
  participantId: string;
  slotNumber: number;
  /** The share, in the game's currency. */
  due: Decimal;
  /** What its allocations add up to, in the game's currency. */
  paid: Decimal;
};

export type ShareAllocation = { participantId: string; amount: Decimal };

export type ShareCharge = {
  /** What to take now. Zero means nothing may be charged. */
  total: Decimal;
  /** One per slot that receives money, in slot order. Sums to `total`. */
  allocations: ShareAllocation[];
};

export type ShareTarget = "ALL_UNPAID" | { participantId: string };

/**
 * Fill the chosen slots in slot order with at most `cap`. `cap` is the booking remaining (due minus
 * everything collected or settled, money from before the split included) for a charge, and the amount
 * actually applied for the allocations of a payment that covered less than the charge.
 */
export function planShareCharge(input: { cap: Decimal; slots: ShareSlot[]; target: ShareTarget }): ShareCharge {
  let left = input.cap;
  const allocations: ShareAllocation[] = [];
  if (left.lte(0)) return { total: new Decimal(0), allocations };

  const chosen = [...input.slots]
    .sort((a, b) => a.slotNumber - b.slotNumber)
    .filter((slot) => input.target === "ALL_UNPAID" || slot.participantId === input.target.participantId);

  let total = new Decimal(0);
  for (const slot of chosen) {
    if (left.lte(0)) break;
    const remaining = slot.due.minus(slot.paid);
    if (remaining.lte(0)) continue;
    const amount = Decimal.min(remaining, left);
    allocations.push({ participantId: slot.participantId, amount });
    total = total.plus(amount);
    left = left.minus(amount);
  }
  return { total, allocations };
}

export type SharePayState =
  | { kind: "paid" }
  | { kind: "pay"; charge: Decimal; partial: boolean }
  | { kind: "covered" };

/**
 * What the sheet shows on one slot. "covered" is an unpaid slot the booking no longer owes for (money
 * already collected, e.g. Unassigned, covers it): no Pay button.
 */
export function sharePayState(input: {
  due: Decimal;
  collected: Decimal;
  slots: ShareSlot[];
  participantId: string;
}): SharePayState {
  const slot = input.slots.find((row) => row.participantId === input.participantId);
  const remaining = slot ? slot.due.minus(slot.paid) : new Decimal(0);
  if (remaining.lte(0)) return { kind: "paid" };
  const charge = planShareCharge({
    cap: input.due.minus(input.collected),
    slots: input.slots,
    target: { participantId: input.participantId },
  });
  if (charge.total.lte(0)) return { kind: "covered" };
  return { kind: "pay", charge: charge.total, partial: charge.total.lt(remaining) };
}
