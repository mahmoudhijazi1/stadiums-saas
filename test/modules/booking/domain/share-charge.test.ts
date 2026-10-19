import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { forgivenShare } from "@/modules/booking/domain/adjust-due";
import { planShareCharge, sharePayState, type ShareSlot } from "@/modules/booking/domain/share-charge";
import { planSlotCharge } from "@/modules/booking/domain/slot-charge";

/**
 * DR-007 slice 7: the charge of a per-player tap, in pounds, with the same rules as dollars (the
 * dollar-named `planSlotCharge` runs through this), and "Consider it paid" on one share.
 * Written, not run when authored.
 */
const D = (value: number | string) => new Decimal(value);

/** 2,000,000 LBP over 7: 290,000 on slot 1 and six of 285,000, nothing paid. */
function slots(paid: Record<number, number> = {}): ShareSlot[] {
  return Array.from({ length: 7 }, (_, index) => ({
    participantId: `p${index + 1}`,
    slotNumber: index + 1,
    due: D(index === 0 ? 290000 : 285000),
    paid: D(paid[index + 1] ?? 0),
  }));
}

const rows = (charge: ReturnType<typeof planShareCharge>) => charge.allocations.map((row) => [row.participantId, row.amount.toFixed(0)]);

describe("planShareCharge in pounds", () => {
  it("one tap charges the share, capped at what the game still owes", () => {
    const charge = planShareCharge({ cap: D(2000000), slots: slots(), target: { participantId: "p2" } });
    expect([charge.total.toFixed(0), rows(charge)]).toEqual(["285000", [["p2", "285000"]]]);
  });

  it("money from before the split caps the charge: 100,000 left means a partial 100,000", () => {
    const charge = planShareCharge({ cap: D(100000), slots: slots(), target: { participantId: "p3" } });
    expect([charge.total.toFixed(0), rows(charge)]).toEqual(["100000", [["p3", "100000"]]]);
  });

  it("nothing left to owe charges nothing", () => {
    expect(planShareCharge({ cap: D(0), slots: slots(), target: { participantId: "p2" } }).total.toFixed(0)).toBe("0");
    expect(planShareCharge({ cap: D(500000), slots: slots({ 2: 285000 }), target: { participantId: "p2" } }).total.toFixed(0)).toBe("0");
  });

  it("pay-all fills the unpaid slots in slot order and the last may be partial", () => {
    const charge = planShareCharge({ cap: D(700000), slots: slots({ 2: 285000 }), target: "ALL_UNPAID" });
    expect(rows(charge)).toEqual([["p1", "290000"], ["p3", "285000"], ["p4", "125000"]]);
    expect(charge.total.toFixed(0)).toBe("700000");
  });

  it("the cash that settled less than the charge credits the first slots (a payment's allocations add up)", () => {
    const credited = planShareCharge({ cap: D(575000), slots: slots(), target: "ALL_UNPAID" });
    expect(rows(credited)).toEqual([["p1", "290000"], ["p2", "285000"]]);
  });
});

describe("sharePayState in pounds", () => {
  it("paid, pay, partial and covered", () => {
    const base = { due: D(2000000), collected: D(285000), participantId: "p2" };
    expect(sharePayState({ ...base, slots: slots({ 2: 285000 }) })).toEqual({ kind: "paid" });
    const pay = sharePayState({ ...base, participantId: "p3", slots: slots({ 2: 285000 }) });
    expect(pay.kind === "pay" && [pay.charge.toFixed(0), pay.partial]).toEqual(["285000", false]);
    const partial = sharePayState({ due: D(2000000), collected: D(1900000), participantId: "p3", slots: slots() });
    expect(partial.kind === "pay" && [partial.charge.toFixed(0), partial.partial]).toEqual(["100000", true]);
    expect(sharePayState({ due: D(2000000), collected: D(2000000), participantId: "p3", slots: slots() })).toEqual({ kind: "covered" });
  });
});

describe("the dollar face is the same rule", () => {
  it("planSlotCharge gives what planShareCharge gives, with the dollar names", () => {
    const usd = [1, 2, 3].map((n) => ({ participantId: `p${n}`, slotNumber: n, dueUsd: D(3), paidUsd: D(0) }));
    const charge = planSlotCharge({ amountDueUsd: D(9), collectedUsd: D(4), slots: usd, target: "ALL_UNPAID" });
    expect(charge.allocations.map((row) => [row.participantId, row.amountUsd.toFixed(2)])).toEqual([["p1", "3.00"], ["p2", "2.00"]]);
    expect(charge.totalUsd.toFixed(2)).toBe("5.00");
  });
});

describe("forgivenShare (Consider it paid on one share)", () => {
  const rate = D(89500);

  it("3,000 LBP left on a share is forgiven by exactly that", () => {
    expect(forgivenShare({ shareRemaining: D(3000), bookingRemaining: D(1700000), currency: "LBP", rate }).toFixed(0)).toBe("3000");
  });

  it("6,000 LBP, and 5,000 exactly, are refused", () => {
    for (const left of [6000, 5000]) {
      expect(() => forgivenShare({ shareRemaining: D(left), bookingRemaining: D(1700000), currency: "LBP", rate })).toThrow(
        expect.objectContaining({ key: "booking.not_forgivable" }),
      );
    }
  });

  it("a share the collected money already covers is refused (the due would drop below it)", () => {
    expect(() => forgivenShare({ shareRemaining: D(3000), bookingRemaining: D(1000), currency: "LBP", rate })).toThrow(
      expect.objectContaining({ key: "booking.not_forgivable" }),
    );
  });

  it("dollars: a few cents is forgivable with a rate, not without one", () => {
    expect(forgivenShare({ shareRemaining: D("0.03"), bookingRemaining: D("10.00"), currency: "USD", rate }).toFixed(2)).toBe("0.03");
    expect(() => forgivenShare({ shareRemaining: D("0.03"), bookingRemaining: D("10.00"), currency: "USD", rate: null })).toThrow(
      expect.objectContaining({ key: "booking.not_forgivable" }),
    );
  });
});
