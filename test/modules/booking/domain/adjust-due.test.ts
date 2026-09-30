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
    fromUsd: new Decimal("30.00"),
    collectedUsd: new Decimal("10.00"),
    collectionMode: "WHOLE" as const,
  };

  it("is a no-op when the amount does not change", () => {
    expect(assertAdjustDue({ ...base, toUsd: new Decimal("30.00") })).toBe("noop");
  });

  it("refuses a due below what was collected", () => {
    expect(() => assertAdjustDue({ ...base, toUsd: new Decimal("9.99") })).toThrow(
      "booking.due_below_collected",
    );
  });

  it("allows a due equal to what was collected", () => {
    expect(assertAdjustDue({ ...base, toUsd: new Decimal("10.00") })).toBe("ok");
  });
});
