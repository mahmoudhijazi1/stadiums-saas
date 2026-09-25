import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import {
  assertCanCollect,
  assertHasDue,
  freezeTenders,
  bookingRemaining,
  participantRemaining,
  remainingDue,
  unassignedUsd,
  usdEquivalent,
} from "@/modules/payment/domain/collect";

describe("usdEquivalent", () => {
  it("copies a USD amount", () => {
    expect(
      usdEquivalent({
        currency: "USD",
        amount: new Decimal("20.00"),
        rate: null,
      }).equals(new Decimal("20.00")),
    ).toBe(true);
  });

  it("divides LBP by the rate, ROUND_HALF_UP to cents", () => {
    expect(
      usdEquivalent({
        currency: "LBP",
        amount: new Decimal("900000"),
        rate: new Decimal("90000"),
      }).equals(new Decimal("10.00")),
    ).toBe(true);
    expect(
      usdEquivalent({
        currency: "LBP",
        amount: new Decimal("1"),
        rate: new Decimal("90000"),
      }).equals(new Decimal("0.00")),
    ).toBe(true);
  });

  it("refuses LBP when there is no rate", () => {
    expect(() =>
      usdEquivalent({
        currency: "LBP",
        amount: new Decimal("900000"),
        rate: null,
      }),
    ).toThrow("payment.rate_required");
  });
});

describe("remainingDue / collect gates", () => {
  it("subtracts collected from the game price", () => {
    expect(
      remainingDue(new Decimal("30.00"), new Decimal("20.00")).equals(
        new Decimal("10"),
      ),
    ).toBe(true);
  });

  it("keeps booking, participant, and unassigned remainders unclamped", () => {
    expect(
      bookingRemaining(new Decimal("30.00"), new Decimal("20.00")).equals("10.00"),
    ).toBe(true);
    expect(
      bookingRemaining(new Decimal("30.00"), new Decimal("40.00")).equals("-10.00"),
    ).toBe(true);
    expect(
      participantRemaining(new Decimal("4.29"), new Decimal("4.00")).equals("0.29"),
    ).toBe(true);
    expect(
      unassignedUsd(new Decimal("30.00"), new Decimal("12.00")).equals("18.00"),
    ).toBe(true);
  });

  it("refuses when nothing is due", () => {
    expect(() => assertHasDue(new Decimal("0"))).toThrow("payment.nothing_due");
    expect(() => assertHasDue(new Decimal("-1"))).toThrow("payment.nothing_due");
  });

  it("allows APPROVED, NO_SHOW, or CANCELLED to be collected", () => {
    expect(() => assertCanCollect("APPROVED")).not.toThrow();
    expect(() => assertCanCollect("NO_SHOW")).not.toThrow();
    expect(() => assertCanCollect("CANCELLED")).not.toThrow();
    expect(() => assertCanCollect("PENDING")).toThrow(
      "payment.collect_unapproved",
    );
  });

  it("still refuses a cancelled booking once nothing remains", () => {
    expect(() => assertHasDue(new Decimal("0"))).toThrow("payment.nothing_due");
  });
});

describe("freezeTenders", () => {
  it("skips zeros and keeps USD without a rate", () => {
    const frozen = freezeTenders(
      [
        { currency: "USD", amount: new Decimal("0") },
        { currency: "USD", amount: new Decimal("20.00") },
      ],
      null,
    );
    expect(frozen).toHaveLength(1);
    expect(frozen[0].usdEquivalent.equals(new Decimal("20.00"))).toBe(true);
    expect(frozen[0].rateAtTime).toBeNull();
  });

  it("refuses an all-zero list", () => {
    expect(() =>
      freezeTenders([{ currency: "USD", amount: new Decimal("0") }], null),
    ).toThrow("payment.amount_required");
  });
});
