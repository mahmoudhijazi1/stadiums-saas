import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import {
  planSlotCharge,
  slotPayState,
  type ChargeSlot,
} from "@/modules/booking/domain/slot-charge";

/** Ten $3 slots; `paid` lists the slot numbers already fully allocated. */
function tenSlots(paid: number[] = []): ChargeSlot[] {
  return Array.from({ length: 10 }, (_, index) => ({
    participantId: `p${index + 1}`,
    slotNumber: index + 1,
    dueUsd: new Decimal("3.00"),
    paidUsd: paid.includes(index + 1) ? new Decimal("3.00") : new Decimal(0),
  }));
}

const d = (value: string) => new Decimal(value);

describe("planSlotCharge", () => {
  it("audit probe: $10 paid whole before the split, 2 slots paid, pay-all takes exactly $14", () => {
    const charge = planSlotCharge({
      amountDueUsd: d("30.00"),
      collectedUsd: d("16.00"),
      slots: tenSlots([2, 3]),
      target: "ALL_UNPAID",
    });
    expect(charge.totalUsd.equals("14.00")).toBe(true);
    expect(charge.allocations.map((row) => [row.participantId, row.amountUsd.toFixed(2)])).toEqual([
      ["p1", "3.00"],
      ["p4", "3.00"],
      ["p5", "3.00"],
      ["p6", "3.00"],
      ["p7", "2.00"],
    ]);
  });

  it("pays every unpaid slot in full when nothing sits in Unassigned", () => {
    const charge = planSlotCharge({
      amountDueUsd: d("30.00"),
      collectedUsd: d("6.00"),
      slots: tenSlots([2, 3]),
      target: "ALL_UNPAID",
    });
    expect(charge.totalUsd.equals("24.00")).toBe(true);
    expect(charge.allocations).toHaveLength(8);
    expect(charge.allocations.every((row) => row.amountUsd.equals("3.00"))).toBe(true);
  });

  it("charges nothing when the booking owes nothing (fully paid before the split)", () => {
    for (const target of ["ALL_UNPAID", { participantId: "p4" }] as const) {
      const charge = planSlotCharge({
        amountDueUsd: d("30.00"),
        collectedUsd: d("30.00"),
        slots: tenSlots(),
        target,
      });
      expect(charge.totalUsd.isZero()).toBe(true);
      expect(charge.allocations).toEqual([]);
    }
  });

  it("charges a single slot only up to what the booking still owes", () => {
    const charge = planSlotCharge({
      amountDueUsd: d("30.00"),
      collectedUsd: d("28.50"),
      slots: tenSlots(),
      target: { participantId: "p9" },
    });
    expect(charge.totalUsd.equals("1.50")).toBe(true);
    expect(charge.allocations).toEqual([{ participantId: "p9", amountUsd: d("1.50") }]);
  });

  it("charges a single unpaid slot its full remaining when the booking owes more", () => {
    const charge = planSlotCharge({
      amountDueUsd: d("30.00"),
      collectedUsd: d("0"),
      slots: tenSlots(),
      target: { participantId: "p10" },
    });
    expect(charge.totalUsd.equals("3.00")).toBe(true);
  });

  it("never charges a paid slot and never exceeds the cap for any collected amount", () => {
    for (let cents = 0; cents <= 3000; cents += 7) {
      const collected = new Decimal(cents).div(100);
      const charge = planSlotCharge({
        amountDueUsd: d("30.00"),
        collectedUsd: collected,
        slots: tenSlots([1, 5]),
        target: "ALL_UNPAID",
      });
      const cap = Decimal.max(d("30.00").minus(collected), 0);
      expect(charge.totalUsd.lte(cap)).toBe(true);
      expect(charge.totalUsd.lte("24.00")).toBe(true);
      expect(charge.allocations.some((row) => ["p1", "p5"].includes(row.participantId))).toBe(
        false,
      );
      const sum = charge.allocations.reduce((total, row) => total.plus(row.amountUsd), d("0"));
      expect(sum.equals(charge.totalUsd)).toBe(true);
    }
  });
});

describe("slotPayState", () => {
  const base = { amountDueUsd: d("30.00"), slots: tenSlots([2]) };

  it("is paid for a fully allocated slot", () => {
    expect(slotPayState({ ...base, collectedUsd: d("3.00"), participantId: "p2" })).toEqual({
      kind: "paid",
    });
  });

  it("is covered when collected money already covers the booking", () => {
    expect(slotPayState({ ...base, collectedUsd: d("33.00"), participantId: "p4" })).toEqual({
      kind: "covered",
    });
  });

  it("is a partial pay when the booking owes less than the slot", () => {
    const state = slotPayState({ ...base, collectedUsd: d("29.00"), participantId: "p4" });
    expect(state.kind).toBe("pay");
    if (state.kind !== "pay") return;
    expect(state.chargeUsd.equals("1.00")).toBe(true);
    expect(state.partial).toBe(true);
  });

  it("is a full pay otherwise", () => {
    const state = slotPayState({ ...base, collectedUsd: d("3.00"), participantId: "p4" });
    expect(state).toEqual({ kind: "pay", chargeUsd: d("3.00"), partial: false });
  });
});
