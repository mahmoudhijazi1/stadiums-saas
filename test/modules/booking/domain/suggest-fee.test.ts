import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import { assertAdjustDue } from "@/modules/booking/domain/adjust-due";
import type { GameMoney } from "@/modules/booking/domain/game-money";
import { bookingRemaining } from "@/modules/payment/domain/collect";
import {
  assertFeeInUnit,
  assertFeeWithinDue,
  confirmedFee,
  ownerInitiatorLowersFee,
  suggestFee,
  typedFeeFor,
} from "@/modules/booking/domain/suggest-fee";

const start = new Date("2026-09-25T18:00:00.000Z");
const usd = (amount: string): GameMoney => ({ currency: "USD", amount: new Decimal(amount) });
const lbp = (amount: string): GameMoney => ({ currency: "LBP", amount: new Decimal(amount) });
const price = usd("30.00");

const policy = {
  cancellationWindowHours: 24,
  lateCancellationFeePercent: 50,
  noShowFeePercent: 100,
};

describe("suggestFee", () => {
  it("charges nothing when the owner cancels", () => {
    const suggestion = suggestFee(policy, { due: price, start }, start, "OWNER");
    expect(suggestion.fee.equals(0)).toBe(true);
    expect(suggestion.reason).toBe("CANCELLATION_NO_FEE");
  });

  it("charges the late percent when the player is inside the window", () => {
    const now = new Date(start.getTime() - 3 * 60 * 60 * 1000);
    const suggestion = suggestFee(policy, { due: price, start }, now, "PLAYER");
    expect(suggestion.fee.toFixed(2)).toBe("15.00");
    expect(suggestion.reason).toBe("LATE_CANCELLATION_FEE");
  });

  it("charges nothing when the player is outside the window", () => {
    const now = new Date(start.getTime() - 25 * 60 * 60 * 1000);
    const suggestion = suggestFee(policy, { due: price, start }, now, "PLAYER");
    expect(suggestion.fee.equals(0)).toBe(true);
    expect(suggestion.reason).toBe("CANCELLATION_NO_FEE");
  });

  it("charges nothing with CANCELLATION_NO_FEE when the late percent is 0", () => {
    const now = new Date(start.getTime() - 60 * 60 * 1000);
    const suggestion = suggestFee({ ...policy, lateCancellationFeePercent: 0 }, { due: price, start }, now, "PLAYER");
    expect(suggestion.fee.equals(0)).toBe(true);
    expect(suggestion.reason).toBe("CANCELLATION_NO_FEE");
  });

  it("defaults a no-show to 100% of the due", () => {
    const suggestion = suggestFee(policy, { due: price, start }, start, "NO_SHOW");
    expect(suggestion.fee.toFixed(2)).toBe("30.00");
    expect(suggestion.reason).toBe("NO_SHOW_FEE");
  });

  // CHANGED by DR-007 slice 8 (decision 7): a suggested fee is rounded to the money unit, so a USD fee
  // is whole dollars, half up. It used to round to cents ("35.00" -> "17.50", "25.00" -> "12.50",
  // "33.33" -> "16.67").
  it.each([
    ["35.00", "18.00"],
    ["25.00", "13.00"],
    ["33.33", "17.00"],
    ["30.00", "15.00"],
    ["31.00", "16.00"],
  ])("rounds $%s × 50% half-up to the whole dollar $%s", (amount, expected) => {
    const suggestion = suggestFee(policy, { due: usd(amount), start }, start, "PLAYER");
    expect(suggestion.fee.toFixed(2)).toBe(expected);
  });

  // CHANGED by DR-007 slice 8: was "$25 at 50% is $12.50".
  it("uses the due after a discount, so $25 at 50% is $13 (rounded to the dollar)", () => {
    const suggestion = suggestFee(policy, { due: usd("25.00"), start }, start, "PLAYER");
    expect(suggestion.fee.toFixed(2)).toBe("13.00");
    expect(suggestion.reason).toBe("LATE_CANCELLATION_FEE");
    expect(suggestion.currency).toBe("USD");
  });
});

describe("suggestFee on a game in pounds", () => {
  it("is in pounds, rounded to the 5,000 unit: 50% of 2,000,000 is 1,000,000", () => {
    const suggestion = suggestFee(policy, { due: lbp("2000000"), start }, start, "PLAYER");
    expect(suggestion.currency).toBe("LBP");
    expect(suggestion.fee.toFixed(0)).toBe("1000000");
    expect(suggestion.reason).toBe("LATE_CANCELLATION_FEE");
  });

  it.each([
    ["2000000", 50, "1000000"],
    ["1990000", 50, "995000"],
    // 33% of 2,010,000 = 663,300, between 660,000 and 665,000: nearest unit is 665,000.
    ["2010000", 33, "665000"],
    // 25% of 1,990,000 = 497,500, exactly half a unit over 495,000: half up gives 500,000.
    ["1990000", 25, "500000"],
    // 12.5% of 20,000 = 2,500, half a unit: half up gives 5,000.
    ["20000", 12.5, "5000"],
  ])("%s at %s%% is %s", (due, percent, expected) => {
    const suggestion = suggestFee(
      { ...policy, noShowFeePercent: percent },
      { due: lbp(due), start },
      start,
      "NO_SHOW",
    );
    expect(suggestion.fee.toFixed(0)).toBe(expected);
  });

  it("the owner path and the outside-the-window path suggest nothing", () => {
    expect(suggestFee(policy, { due: lbp("2000000"), start }, start, "OWNER").fee.isZero()).toBe(true);
    const early = new Date(start.getTime() - 48 * 60 * 60 * 1000);
    expect(suggestFee(policy, { due: lbp("2000000"), start }, early, "PLAYER").fee.isZero()).toBe(true);
  });
});

describe("confirmedFee", () => {
  it("owner cancels a fully paid game and remaining stays 0", () => {
    const due = usd("30.00");
    const collected = new Decimal("30.00");
    const suggestion = suggestFee(policy, { due, start }, start, "OWNER");
    const confirmed = confirmedFee({ suggestion, collected });
    expect(confirmed.fee.toFixed(2)).toBe("30.00");
    expect(confirmed.reason).toBe("CANCELLATION_NO_FEE");
    expect(
      assertAdjustDue({
        currency: "USD",
        from: due.amount,
        to: confirmed.fee,
        collected,
        collectionMode: "WHOLE",
      }),
    ).toBe("noop");
    expect(bookingRemaining(confirmed.fee, collected).toFixed(2)).toBe("0.00");
  });

  it("clamps an owner cancel to collected when only part was paid", () => {
    const suggestion = suggestFee(policy, { due: usd("30.00"), start }, start, "OWNER");
    const confirmed = confirmedFee({ suggestion, collected: new Decimal("10.00") });
    expect(confirmed.fee.toFixed(2)).toBe("10.00");
    expect(confirmed.reason).toBe("CANCELLATION_NO_FEE");
  });

  it("in pounds, a fee below what was settled is clamped up to it, in whole pounds", () => {
    const suggestion = suggestFee(policy, { due: lbp("2000000"), start }, start, "OWNER");
    const confirmed = confirmedFee({ suggestion, collected: new Decimal("284610") });
    expect(confirmed.fee.toFixed(0)).toBe("284610");
    expect(confirmed.reason).toBe("CANCELLATION_NO_FEE");
    const edited = confirmedFee({ suggestion, collected: new Decimal("0"), fee: new Decimal("1500000") });
    expect(edited.fee.toFixed(0)).toBe("1500000");
  });
});

describe("assertAdjustDue", () => {
  const collected = new Decimal("10.00");

  it("is a no-op when the amount does not change", () => {
    expect(
      assertAdjustDue({
        currency: "USD",
        from: new Decimal("30.00"),
        to: new Decimal("30"),
        collected,
        collectionMode: "WHOLE",
      }),
    ).toBe("noop");
  });

  it("allows a whole-game due at or above what was collected", () => {
    expect(
      assertAdjustDue({
        currency: "USD",
        from: new Decimal("30.00"),
        to: new Decimal("15.00"),
        collected,
        collectionMode: "WHOLE",
      }),
    ).toBe("ok");
  });

  it("refuses a negative due", () => {
    expect(() =>
      assertAdjustDue({
        currency: "USD",
        from: new Decimal("30.00"),
        to: new Decimal("-1.00"),
        collected: new Decimal(0),
        collectionMode: "WHOLE",
      }),
    ).toThrow(DomainError);
  });

  it("refuses a due below what was already collected", () => {
    expect(() =>
      assertAdjustDue({
        currency: "USD",
        from: new Decimal("30.00"),
        to: new Decimal("0.00"),
        collected,
        collectionMode: "WHOLE",
      }),
    ).toThrow(DomainError);
  });

  it("refuses per-player bookings", () => {
    expect(() =>
      assertAdjustDue({
        currency: "USD",
        from: new Decimal("30.00"),
        to: new Decimal("15.00"),
        collected: new Decimal(0),
        collectionMode: "PER_PLAYER",
      }),
    ).toThrow(DomainError);
  });
});

describe("ownerInitiatorLowersFee", () => {
  const booking = { due: price, start };
  const late = new Date(start.getTime() - 3 * 60 * 60 * 1000);
  const early = new Date(start.getTime() - 48 * 60 * 60 * 1000);

  it("is true inside the late window when I-cancelled would store less than the player fee", () => {
    expect(ownerInitiatorLowersFee({ policy, booking, now: late, resultingFee: new Decimal(0) })).toBe(true);
  });

  it("is false before the window (the player path charges nothing either)", () => {
    expect(ownerInitiatorLowersFee({ policy, booking, now: early, resultingFee: new Decimal(0) })).toBe(false);
  });

  it("is false when what was already collected keeps the fee at the player amount or more", () => {
    expect(ownerInitiatorLowersFee({ policy, booking, now: late, resultingFee: new Decimal("15.00") })).toBe(false);
  });

  it("is false when the tenant charges no late fee", () => {
    expect(
      ownerInitiatorLowersFee({
        policy: { ...policy, lateCancellationFeePercent: 0 },
        booking,
        now: late,
        resultingFee: new Decimal(0),
      }),
    ).toBe(false);
  });

  it("works in pounds", () => {
    const pounds = { due: lbp("2000000"), start };
    expect(ownerInitiatorLowersFee({ policy, booking: pounds, now: late, resultingFee: new Decimal(0) })).toBe(true);
    expect(ownerInitiatorLowersFee({ policy, booking: pounds, now: late, resultingFee: new Decimal("1000000") })).toBe(false);
  });
});

describe("assertFeeWithinDue", () => {
  it("rejects a fee above the due and accepts one equal to it", () => {
    expect(() => assertFeeWithinDue(new Decimal("30.01"), price.amount)).toThrow("booking.fee_above_due");
    expect(() => assertFeeWithinDue(new Decimal("30.00"), price.amount)).not.toThrow();
    expect(() => assertFeeWithinDue(new Decimal("0.00"), price.amount)).not.toThrow();
  });

  it("compares in the game's currency: 2,000,001 pounds is above a 2,000,000 due", () => {
    expect(() => assertFeeWithinDue(new Decimal("2000001"), new Decimal("2000000"))).toThrow("booking.fee_above_due");
    expect(() => assertFeeWithinDue(new Decimal("2000000"), new Decimal("2000000"))).not.toThrow();
  });
});

describe("assertFeeInUnit", () => {
  it("a fee typed in pounds is a whole multiple of the unit", () => {
    expect(() => assertFeeInUnit(new Decimal("12345"), "LBP")).toThrow("booking.fee_unit");
    expect(() => assertFeeInUnit(new Decimal("1000"), "LBP")).toThrow("booking.fee_unit");
    expect(() => assertFeeInUnit(new Decimal("15000"), "LBP")).not.toThrow();
    expect(() => assertFeeInUnit(new Decimal("0"), "LBP")).not.toThrow();
  });

  it("a fee typed in dollars is as before: any amount in cents", () => {
    expect(() => assertFeeInUnit(new Decimal("12.34"), "USD")).not.toThrow();
  });
});

describe("typedFeeFor", () => {
  it("reads the field of the game's currency and refuses the other one", () => {
    expect(typedFeeFor("USD", { feeUsd: new Decimal("5.00") })?.toFixed(2)).toBe("5.00");
    expect(typedFeeFor("LBP", { feeLbp: new Decimal("5000") })?.toFixed(0)).toBe("5000");
    expect(typedFeeFor("USD", {})).toBeUndefined();
    expect(() => typedFeeFor("LBP", { feeUsd: new Decimal("5.00") })).toThrow("form.invalid");
    expect(() => typedFeeFor("USD", { feeLbp: new Decimal("5000") })).toThrow("form.invalid");
  });
});

describe("confirmedFee reason for a no-show clamped to collected", () => {
  const noShow = (percent: number) =>
    suggestFee({ ...policy, noShowFeePercent: percent }, { due: price, start }, start, "NO_SHOW");

  it("is WAIVER when the owner waives a non-zero suggestion", () => {
    for (const collected of ["0.00", "3.00"]) {
      const confirmed = confirmedFee({
        suggestion: noShow(100),
        collected: new Decimal(collected),
        fee: new Decimal("0.00"),
      });
      expect(confirmed.reason).toBe("WAIVER");
      expect(confirmed.fee.toFixed(2)).toBe(collected);
    }
  });

  it("is WAIVER when the owner edits the fee down to at most what was collected", () => {
    const confirmed = confirmedFee({
      suggestion: noShow(100),
      collected: new Decimal("5.00"),
      fee: new Decimal("2.00"),
    });
    expect(confirmed.reason).toBe("WAIVER");
    expect(confirmed.fee.toFixed(2)).toBe("5.00");
  });

  it("is NO_SHOW_FEE when the suggestion is kept and collected already covers it", () => {
    const confirmed = confirmedFee({ suggestion: noShow(50), collected: new Decimal("20.00") });
    expect(confirmed.reason).toBe("NO_SHOW_FEE");
    expect(confirmed.fee.toFixed(2)).toBe("20.00");
  });

  it("is NO_SHOW_FEE when the policy suggests nothing", () => {
    const confirmed = confirmedFee({ suggestion: noShow(0), collected: new Decimal("0.00") });
    expect(confirmed.reason).toBe("NO_SHOW_FEE");
  });

  it("keeps NO_SHOW_FEE for a fee above collected (edited down, still owed)", () => {
    const confirmed = confirmedFee({
      suggestion: noShow(100),
      collected: new Decimal("0.00"),
      fee: new Decimal("10.00"),
    });
    expect(confirmed.reason).toBe("NO_SHOW_FEE");
  });

  it("leaves cancel reasons as they were", () => {
    const late = suggestFee(policy, { due: price, start }, new Date(start.getTime() - 3_600_000), "PLAYER");
    expect(confirmedFee({ suggestion: late, collected: new Decimal("0"), fee: new Decimal("0") }).reason).toBe(
      "CANCELLATION_NO_FEE",
    );
  });

  it("works the same in pounds", () => {
    const pounds = suggestFee(policy, { due: lbp("2000000"), start }, start, "NO_SHOW");
    const waived = confirmedFee({ suggestion: pounds, collected: new Decimal("0"), fee: new Decimal("0") });
    expect([waived.reason, waived.fee.toFixed(0)]).toEqual(["WAIVER", "0"]);
  });
});
