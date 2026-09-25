import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import { assertAdjustDue } from "@/modules/booking/domain/adjust-due";
import { bookingRemaining } from "@/modules/payment/domain/collect";
import { confirmedFee, suggestFee } from "@/modules/booking/domain/suggest-fee";

const start = new Date("2026-09-25T18:00:00.000Z");
const price = new Decimal("30.00");

const policy = {
  cancellationWindowHours: 24,
  lateCancellationFeePercent: 50,
  noShowFeePercent: 100,
};

describe("suggestFee", () => {
  it("charges nothing when the owner cancels", () => {
    const suggestion = suggestFee(policy, { amountDueUsd: price, start }, start, "OWNER");
    expect(suggestion.feeUsd.equals(0)).toBe(true);
    expect(suggestion.reason).toBe("CANCELLATION_NO_FEE");
  });

  it("charges the late percent when the player is inside the window", () => {
    const now = new Date(start.getTime() - 3 * 60 * 60 * 1000);
    const suggestion = suggestFee(policy, { amountDueUsd: price, start }, now, "PLAYER");
    expect(suggestion.feeUsd.toFixed(2)).toBe("15.00");
    expect(suggestion.reason).toBe("LATE_CANCELLATION_FEE");
  });

  it("charges nothing when the player is outside the window", () => {
    const now = new Date(start.getTime() - 25 * 60 * 60 * 1000);
    const suggestion = suggestFee(policy, { amountDueUsd: price, start }, now, "PLAYER");
    expect(suggestion.feeUsd.equals(0)).toBe(true);
    expect(suggestion.reason).toBe("CANCELLATION_NO_FEE");
  });

  it("charges nothing with CANCELLATION_NO_FEE when the late percent is 0", () => {
    const now = new Date(start.getTime() - 60 * 60 * 1000);
    const suggestion = suggestFee(
      { ...policy, lateCancellationFeePercent: 0 },
      { amountDueUsd: price, start },
      now,
      "PLAYER",
    );
    expect(suggestion.feeUsd.equals(0)).toBe(true);
    expect(suggestion.reason).toBe("CANCELLATION_NO_FEE");
  });

  it("defaults a no-show to 100% of the due", () => {
    const suggestion = suggestFee(policy, { amountDueUsd: price, start }, start, "NO_SHOW");
    expect(suggestion.feeUsd.toFixed(2)).toBe("30.00");
    expect(suggestion.reason).toBe("NO_SHOW_FEE");
  });

  it.each([
    ["35.00", "17.50"],
    ["25.00", "12.50"],
    ["33.33", "16.67"],
  ])("rounds $%s × 50% half-up to $%s", (amount, expected) => {
    const suggestion = suggestFee(
      policy,
      { amountDueUsd: new Decimal(amount), start },
      start,
      "PLAYER",
    );
    expect(suggestion.feeUsd.toFixed(2)).toBe(expected);
  });

  it("uses the due after a discount, so $25 at 50% is $12.50", () => {
    const suggestion = suggestFee(
      policy,
      { amountDueUsd: new Decimal("25.00"), start },
      start,
      "PLAYER",
    );
    expect(suggestion.feeUsd.toFixed(2)).toBe("12.50");
    expect(suggestion.reason).toBe("LATE_CANCELLATION_FEE");
  });
});

describe("confirmedFee", () => {
  it("owner cancels a fully paid game and remaining stays 0", () => {
    const due = new Decimal("30.00");
    const collected = new Decimal("30.00");
    const suggestion = suggestFee(
      policy,
      { amountDueUsd: due, start },
      start,
      "OWNER",
    );
    const confirmed = confirmedFee({ suggestion, collectedUsd: collected });
    expect(confirmed.feeUsd.toFixed(2)).toBe("30.00");
    expect(confirmed.reason).toBe("CANCELLATION_NO_FEE");
    expect(
      assertAdjustDue({
        fromUsd: due,
        toUsd: confirmed.feeUsd,
        collectedUsd: collected,
        collectionMode: "WHOLE",
      }),
    ).toBe("noop");
    expect(bookingRemaining(confirmed.feeUsd, collected).toFixed(2)).toBe("0.00");
  });

  it("clamps an owner cancel to collected when only part was paid", () => {
    const suggestion = suggestFee(
      policy,
      { amountDueUsd: new Decimal("30.00"), start },
      start,
      "OWNER",
    );
    const confirmed = confirmedFee({
      suggestion,
      collectedUsd: new Decimal("10.00"),
    });
    expect(confirmed.feeUsd.toFixed(2)).toBe("10.00");
    expect(confirmed.reason).toBe("CANCELLATION_NO_FEE");
  });
});

describe("assertAdjustDue", () => {
  const collected = new Decimal("10.00");

  it("is a no-op when the amount does not change", () => {
    expect(
      assertAdjustDue({
        fromUsd: new Decimal("30.00"),
        toUsd: new Decimal("30"),
        collectedUsd: collected,
        collectionMode: "WHOLE",
      }),
    ).toBe("noop");
  });

  it("allows a whole-game due at or above what was collected", () => {
    expect(
      assertAdjustDue({
        fromUsd: new Decimal("30.00"),
        toUsd: new Decimal("15.00"),
        collectedUsd: collected,
        collectionMode: "WHOLE",
      }),
    ).toBe("ok");
  });

  it("refuses a negative due", () => {
    expect(() =>
      assertAdjustDue({
        fromUsd: new Decimal("30.00"),
        toUsd: new Decimal("-1.00"),
        collectedUsd: new Decimal(0),
        collectionMode: "WHOLE",
      }),
    ).toThrow(DomainError);
  });

  it("refuses a due below what was already collected", () => {
    expect(() =>
      assertAdjustDue({
        fromUsd: new Decimal("30.00"),
        toUsd: new Decimal("0.00"),
        collectedUsd: collected,
        collectionMode: "WHOLE",
      }),
    ).toThrow(DomainError);
  });

  it("refuses per-player bookings", () => {
    expect(() =>
      assertAdjustDue({
        fromUsd: new Decimal("30.00"),
        toUsd: new Decimal("15.00"),
        collectedUsd: new Decimal(0),
        collectionMode: "PER_PLAYER",
      }),
    ).toThrow(DomainError);
  });
});
