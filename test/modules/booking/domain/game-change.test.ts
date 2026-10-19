import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { applyToGameDue, handedFromTenders } from "@/modules/booking/domain/game-change";

const RATE = new Decimal("90000");
const dec = (value: string) => new Decimal(value);

function thrownKey(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return (error as { key?: string }).key;
  }
  return undefined;
}

function collect(remaining: string, handed: { lbp?: string; usd?: string }, rate: Decimal | null = RATE) {
  const result = applyToGameDue({
    remainingUsd: dec(remaining),
    handed: { lbp: dec(handed.lbp ?? "0"), usd: dec(handed.usd ?? "0") },
    rate,
  });
  return {
    tenders: result.tenders.map((t) => [t.currency, t.amount.toFixed(0), t.usdEquivalent.toFixed(2)]),
    changeUsd: result.changeUsd.toFixed(2),
    changeLbp: result.changeLbp.toFixed(0),
  };
}

describe("applyToGameDue (change on a game, DR-007 decision 6)", () => {
  it("USD only: $50 on $30 keeps $30 and gives $20 back", () => {
    expect(collect("30.00", { usd: "50.00" })).toEqual({
      tenders: [["USD", "30", "30.00"]],
      changeUsd: "20.00",
      changeLbp: "0",
    });
  });

  it("LBP only: 3,000,000 on $30 keeps 2,700,000 and gives 300,000 back in pounds", () => {
    expect(collect("30.00", { lbp: "3000000" })).toEqual({
      tenders: [["LBP", "2700000", "30.00"]],
      changeUsd: "0.00",
      changeLbp: "300000",
    });
  });

  it("both: $20 + 1,000,000 on $30 keeps 900,000 of the pounds and gives 100,000 back", () => {
    expect(collect("30.00", { usd: "20.00", lbp: "1000000" })).toEqual({
      tenders: [
        ["LBP", "900000", "10.00"],
        ["USD", "20", "20.00"],
      ],
      changeUsd: "0.00",
      changeLbp: "100000",
    });
  });

  it("exact: no change, one tender", () => {
    expect(collect("30.00", { usd: "30.00" })).toEqual({
      tenders: [["USD", "30", "30.00"]],
      changeUsd: "0.00",
      changeLbp: "0",
    });
    expect(collect("30.00", { lbp: "2700000" })).toEqual({
      tenders: [["LBP", "2700000", "30.00"]],
      changeUsd: "0.00",
      changeLbp: "0",
    });
  });

  it("less than owed: all of it is kept and there is no change", () => {
    expect(collect("30.00", { usd: "10.00" })).toEqual({
      tenders: [["USD", "10", "10.00"]],
      changeUsd: "0.00",
      changeLbp: "0",
    });
    expect(collect("30.00", { lbp: "100000" })).toEqual({
      tenders: [["LBP", "100000", "1.11"]],
      changeUsd: "0.00",
      changeLbp: "0",
    });
  });

  it("the kept USD never exceeds what is owed", () => {
    const result = applyToGameDue({
      remainingUsd: dec("12.50"),
      handed: { lbp: dec("5000000"), usd: dec("40.00") },
      rate: RATE,
    });
    const kept = result.tenders.reduce((sum, t) => sum.plus(t.usdEquivalent), new Decimal(0));
    expect(kept.toFixed(2)).toBe("12.50");
  });

  it("cents of change stay dollars (the screen shows them as handed over)", () => {
    expect(collect("30.00", { usd: "35.50" })).toEqual({
      tenders: [["USD", "30", "30.00"]],
      changeUsd: "5.50",
      changeLbp: "0",
    });
  });

  it("pounds without a rate are refused", () => {
    expect(thrownKey(() => collect("30.00", { lbp: "100000" }, null))).toBe("payment.rate_required");
  });
});

describe("handedFromTenders", () => {
  it("adds the parts per currency and drops zero parts", () => {
    const handed = handedFromTenders([
      { currency: "USD", amount: dec("20.00") },
      { currency: "LBP", amount: dec("0") },
      { currency: "USD", amount: dec("5.00") },
    ]);
    expect([handed.usd.toFixed(2), handed.lbp.toFixed(0)]).toEqual(["25.00", "0"]);
  });

  it("refuses nothing handed over and a negative part", () => {
    expect(thrownKey(() => handedFromTenders([]))).toBe("payment.amount_required");
    expect(thrownKey(() => handedFromTenders([{ currency: "USD", amount: dec("0") }]))).toBe("payment.amount_required");
    expect(thrownKey(() => handedFromTenders([{ currency: "USD", amount: dec("-1") }]))).toBe("payment.amount_positive");
  });
});
