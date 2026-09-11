import { describe, expect, it } from "@jest/globals";
import {
  assertApprovedForCancel,
  assertPendingForDecision,
} from "@/modules/booking/domain/decision";

describe("assertPendingForDecision", () => {
  it("allows PENDING", () => {
    expect(() => assertPendingForDecision("PENDING")).not.toThrow();
  });

  it.each(["APPROVED", "REJECTED", "CANCELLED", "NO_SHOW"] as const)(
    "refuses %s",
    (status) => {
      expect(() => assertPendingForDecision(status)).toThrow(
        "booking.pending_only",
      );
    },
  );
});

describe("assertApprovedForCancel", () => {
  it("allows APPROVED", () => {
    expect(() => assertApprovedForCancel("APPROVED")).not.toThrow();
  });

  it.each(["PENDING", "REJECTED", "CANCELLED", "NO_SHOW"] as const)(
    "refuses %s",
    (status) => {
      expect(() => assertApprovedForCancel(status)).toThrow(
        "booking.confirmed_only",
      );
    },
  );
});
