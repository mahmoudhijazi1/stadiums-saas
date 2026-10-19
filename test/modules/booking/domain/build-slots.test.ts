import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { buildSlots } from "@/modules/booking/domain/build-slots";
import { splitInUnits } from "@/modules/payment/domain/units";

function sum(values: Decimal[]): Decimal {
  return values.reduce((total, value) => total.plus(value), new Decimal(0));
}

const usd = (amount: string) => ({ currency: "USD" as const, amount: new Decimal(amount) });
const lbp = (amount: string) => ({ currency: "LBP" as const, amount: new Decimal(amount) });
const shares = (slots: { amountDue: Decimal }[], digits = 2) => slots.map((slot) => slot.amountDue.toFixed(digits));

describe("buildSlots", () => {
  it("makes slot 1 the requester and leaves the rest unnamed", () => {
    const slots = buildSlots(usd("30.00"), 10, "person-1");
    expect(slots).toHaveLength(10);
    expect(slots[0]).toMatchObject({
      slotNumber: 1,
      personId: "person-1",
      isRequester: true,
    });
    expect(slots.slice(1).every((s) => s.personId === null && !s.isRequester)).toBe(true);
    expect(slots.map((s) => s.slotNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("is exactly what splitInUnits gives, in the game's currency (DR-007 decision 7)", () => {
    expect(buildSlots(usd("30.00"), 7, "p").map((s) => s.amountDue)).toEqual(splitInUnits(new Decimal("30.00"), 7, "USD"));
    expect(buildSlots(lbp("2000000"), 7, "p").map((s) => s.amountDue)).toEqual(splitInUnits(new Decimal("2000000"), 7, "LBP"));
  });

  it("USD: whole dollars, leftover dollars to the first slots, sums to the due", () => {
    // $30 / 7: base $4, two leftover dollars go to slots 1 and 2.
    const slots = buildSlots(usd("30.00"), 7, "p");
    expect(shares(slots)).toEqual(["5.00", "5.00", "4.00", "4.00", "4.00", "4.00", "4.00"]);
    expect(sum(slots.map((s) => s.amountDue)).equals("30.00")).toBe(true);
    // $40 / 7: base $5, five leftover dollars go to slots 1 to 5 (five of $6 and two of $5).
    const forty = buildSlots(usd("40.00"), 7, "p");
    expect(shares(forty)).toEqual(["6.00", "6.00", "6.00", "6.00", "6.00", "5.00", "5.00"]);
    expect(sum(forty.map((s) => s.amountDue)).equals("40.00")).toBe(true);
  });

  it("USD: cents below a dollar go on slot 1, so the total stays exact", () => {
    const slots = buildSlots(usd("30.50"), 4, "p");
    expect(shares(slots)).toEqual(["8.50", "8.00", "7.00", "7.00"]);
    expect(sum(slots.map((s) => s.amountDue)).equals("30.50")).toBe(true);
  });

  it("LBP: 2,000,000 over 7 is 290,000 on slot 1 and six of 285,000", () => {
    const slots = buildSlots(lbp("2000000"), 7, "p");
    expect(shares(slots, 0)).toEqual(["290000", "285000", "285000", "285000", "285000", "285000", "285000"]);
    expect(sum(slots.map((s) => s.amountDue)).equals("2000000")).toBe(true);
    expect(slots.every((s) => s.amountDue.mod(5000).isZero() || s.slotNumber === 1)).toBe(true);
  });

  it("accepts 1 and 30 slots", () => {
    expect(buildSlots(usd("30.00"), 1, "p")).toHaveLength(1);
    const thirty = buildSlots(usd("31.00"), 30, "p");
    expect(thirty).toHaveLength(30);
    expect(sum(thirty.map((s) => s.amountDue)).equals("31.00")).toBe(true);
    const pounds = buildSlots(lbp("2000000"), 30, "p");
    expect(pounds).toHaveLength(30);
    expect(sum(pounds.map((s) => s.amountDue)).equals("2000000")).toBe(true);
  });

  it.each([0, 31, -1, 2.5, Number.NaN])("rejects count %p", (count) => {
    expect(() => buildSlots(usd("30.00"), count, "p")).toThrow(
      expect.objectContaining({ key: "booking.split_count" }),
    );
  });
});
