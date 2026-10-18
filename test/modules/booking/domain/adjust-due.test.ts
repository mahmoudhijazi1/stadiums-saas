import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import {
  assertAdjustDue,
  assertDueAdjustableStatus,
} from "@/modules/booking/domain/adjust-due";

describe("assertDueAdjustableStatus", () => {
  it("allows a confirmed game and a cancelled or no-show fee", () => {
    for (const status of ["APPROVED", "CANCELLED", "NO_SHOW"]) {
      expect(() => assertDueAdjustableStatus(status)).not.toThrow();
    }
  });

  it("refuses a PENDING or REJECTED request", () => {
    for (const status of ["PENDING", "REJECTED"]) {
      expect(() => assertDueAdjustableStatus(status)).toThrow("booking.due_not_confirmed");
    }
  });
});

describe("assertAdjustDue", () => {
  const base = {
    currency: "USD" as const,
    from: new Decimal("30.00"),
    collected: new Decimal("10.00"),
    collectionMode: "WHOLE" as const,
  };

  it("is a no-op when the amount does not change", () => {
    expect(assertAdjustDue({ ...base, to: new Decimal("30.00") })).toBe("noop");
  });

  it("refuses a due below what was collected", () => {
    expect(() => assertAdjustDue({ ...base, to: new Decimal("9.99") })).toThrow(
      "booking.due_below_collected",
    );
  });

  it("allows a due equal to what was collected", () => {
    expect(assertAdjustDue({ ...base, to: new Decimal("10.00") })).toBe("ok");
  });

  it("in pounds: a due below what was settled is refused, equal to it is allowed", () => {
    const pounds = { currency: "LBP" as const, from: new Decimal("2000000"), collected: new Decimal("1790000"), collectionMode: "WHOLE" as const };
    expect(() => assertAdjustDue({ ...pounds, to: new Decimal("1789999") })).toThrow("booking.due_below_collected");
    expect(assertAdjustDue({ ...pounds, to: new Decimal("1790000") })).toBe("ok");
    expect(assertAdjustDue({ ...pounds, to: new Decimal("1500000"), collected: new Decimal("0") })).toBe("ok");
    expect(assertAdjustDue({ ...pounds, to: new Decimal("2000000") })).toBe("noop");
  });

  it("in pounds: a negative due and a split game are refused as in dollars", () => {
    const pounds = { currency: "LBP" as const, from: new Decimal("2000000"), collected: new Decimal("0"), collectionMode: "WHOLE" as const };
    expect(() => assertAdjustDue({ ...pounds, to: new Decimal("-5000") })).toThrow("booking.due_negative");
    expect(() => assertAdjustDue({ ...pounds, to: new Decimal("1500000"), collectionMode: "PER_PLAYER" })).toThrow("booking.due_whole_only");
  });
});
