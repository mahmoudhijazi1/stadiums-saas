import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { buildSlots } from "@/modules/booking/domain/build-slots";

function sum(values: Decimal[]): Decimal {
  return values.reduce((total, value) => total.plus(value), new Decimal(0));
}

describe("buildSlots", () => {
  it("makes slot 1 the requester and leaves the rest unnamed", () => {
    const slots = buildSlots(new Decimal("30.00"), 10, "person-1");
    expect(slots).toHaveLength(10);
    expect(slots[0]).toMatchObject({
      slotNumber: 1,
      personId: "person-1",
      isRequester: true,
    });
    expect(slots.slice(1).every((s) => s.personId === null && !s.isRequester)).toBe(true);
    expect(slots.map((s) => s.slotNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("keeps exact cents and sums to the due with no rounding", () => {
    const slots = buildSlots(new Decimal("30.00"), 7, "p");
    expect(slots.filter((s) => s.amountDueUsd.equals("4.29"))).toHaveLength(4);
    expect(slots.filter((s) => s.amountDueUsd.equals("4.28"))).toHaveLength(3);
    expect(sum(slots.map((s) => s.amountDueUsd)).equals("30.00")).toBe(true);
  });

  it("accepts 1 and 30 slots", () => {
    expect(buildSlots(new Decimal("30.00"), 1, "p")).toHaveLength(1);
    const thirty = buildSlots(new Decimal("31.00"), 30, "p");
    expect(thirty).toHaveLength(30);
    expect(sum(thirty.map((s) => s.amountDueUsd)).equals("31.00")).toBe(true);
  });

  it.each([0, 31, -1, 2.5, Number.NaN])("rejects count %p", (count) => {
    expect(() => buildSlots(new Decimal("30.00"), count, "p")).toThrow(
      expect.objectContaining({ key: "booking.split_count" }),
    );
  });
});
