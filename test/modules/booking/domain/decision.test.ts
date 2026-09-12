import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import {
  assertApprovedForCancel,
  assertNotPastUnpaidCancel,
  assertPendingForDecision,
  isPastUnpaidCancel,
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

const START = new Date("2026-09-13T13:00:00.000Z");

describe("isPastUnpaidCancel", () => {
  it("is true when start has passed and remaining is positive", () => {
    expect(
      isPastUnpaidCancel(
        START,
        new Decimal("10.00"),
        new Date("2026-09-13T13:00:00.000Z"),
      ),
    ).toBe(true);
  });

  it("is false when the slot has not started", () => {
    expect(
      isPastUnpaidCancel(
        START,
        new Decimal("30.00"),
        new Date("2026-09-13T12:59:59.000Z"),
      ),
    ).toBe(false);
  });

  it("is false when remaining is zero even after start", () => {
    expect(
      isPastUnpaidCancel(START, new Decimal(0), new Date("2026-09-13T14:00:00.000Z")),
    ).toBe(false);
  });
});

describe("assertNotPastUnpaidCancel", () => {
  it("refuses past unpaid", () => {
    expect(() =>
      assertNotPastUnpaidCancel({
        start: START,
        remaining: new Decimal("10.00"),
        now: new Date("2026-09-13T13:01:00.000Z"),
      }),
    ).toThrow("booking.cancel_past_unpaid");
  });

  it("allows future unpaid", () => {
    expect(() =>
      assertNotPastUnpaidCancel({
        start: START,
        remaining: new Decimal("30.00"),
        now: new Date("2026-09-13T12:00:00.000Z"),
      }),
    ).not.toThrow();
  });
});
