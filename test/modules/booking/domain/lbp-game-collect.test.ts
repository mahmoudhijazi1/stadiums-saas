import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { forgivenDue } from "@/modules/booking/domain/adjust-due";
import { applyToGameDue, applyToLbpGameDue } from "@/modules/booking/domain/game-change";

/**
 * DR-007 slice 6: cash on an LBP game (pounds first, dollars at the current rate against what is
 * left, change in the currency handed over, each kept tender valued at this payment's rate) and
 * "Consider it paid". Written, not run when authored.
 */
const D = (value: number | string) => new Decimal(value);
const RATE = D(89500);

function collect(remainingLbp: number, lbp: number, usd: number | string, rate: Decimal | null = RATE) {
  return applyToLbpGameDue({ remainingLbp: D(remainingLbp), handed: { lbp: D(lbp), usd: D(usd) }, rate });
}

const tenders = (result: ReturnType<typeof applyToLbpGameDue>) =>
  result.tenders.map((t) => [t.currency, t.amount.toString(), t.usdEquivalent.toFixed(2), t.rateAtTime?.toFixed(0) ?? null]);

describe("applyToLbpGameDue", () => {
  it("2,000,000 LBP exact settles the game; the ledger value is the conversion at this rate", () => {
    const result = collect(2000000, 2000000, 0);
    expect(result.lbpApplied.toFixed(0)).toBe("2000000");
    expect(result.usdKept.toFixed(2)).toBe("0.00");
    expect([result.changeLbp.toFixed(0), result.changeUsd.toFixed(2)]).toEqual(["0", "0.00"]);
    expect(tenders(result)).toEqual([["LBP", "2000000", "22.35", "89500"]]);
  });

  it("$20 covers 1,790,000 of 2,000,000 LBP, with no change", () => {
    const result = collect(2000000, 0, 20);
    expect(result.lbpApplied.toFixed(0)).toBe("1790000");
    expect(result.usdKept.toFixed(2)).toBe("20.00");
    expect(tenders(result)).toEqual([["USD", "20", "20.00", "89500"]]);
  });

  it("2,100,000 LBP gives back 100,000 LBP and records 2,000,000", () => {
    const result = collect(2000000, 2100000, 0);
    expect(result.changeLbp.toFixed(0)).toBe("100000");
    expect(tenders(result)).toEqual([["LBP", "2000000", "22.35", "89500"]]);
  });

  it("$25 on 2,000,000 LBP keeps $22.35 and gives back $2.65, never over-recorded", () => {
    const result = collect(2000000, 0, 25);
    expect(result.lbpApplied.toFixed(0)).toBe("2000000");
    expect([result.usdKept.toFixed(2), result.changeUsd.toFixed(2), result.changeLbp.toFixed(0)]).toEqual(["22.35", "2.65", "0"]);
    expect(tenders(result)).toEqual([["USD", "22.35", "22.35", "89500"]]);
  });

  it("pounds count first, then dollars against what is left; extra dollars come back as dollars", () => {
    const result = collect(2000000, 1000000, 20);
    expect(result.lbpApplied.toFixed(0)).toBe("2000000");
    // 1,000,000 left after the pounds: 1,000,000 / 89,500 = 11.173..., rounded up to $11.18.
    expect([result.usdKept.toFixed(2), result.changeUsd.toFixed(2)]).toEqual(["11.18", "8.82"]);
  });

  it("the same pounds owed at a new rate are valued at that rate", () => {
    const result = collect(1000000, 0, 10, D(100000));
    expect(result.lbpApplied.toFixed(0)).toBe("1000000");
    expect(tenders(result)).toEqual([["USD", "10", "10.00", "100000"]]);
  });

  it("refuses without a rate, and when nothing is handed over", () => {
    expect(() => collect(2000000, 2000000, 0, null)).toThrow(expect.objectContaining({ key: "payment.rate_required" }));
    expect(() => collect(2000000, 0, 20, null)).toThrow(expect.objectContaining({ key: "payment.rate_required" }));
    expect(() => collect(2000000, 0, 0)).toThrow(expect.objectContaining({ key: "payment.amount_required" }));
  });

  it("a USD game is unchanged: $25 on $20 gives back $5", () => {
    const result = applyToGameDue({ remainingUsd: D(20), handed: { lbp: D(0), usd: D(25) }, rate: RATE });
    expect(result.changeUsd.toFixed(2)).toBe("5.00");
    expect(result.tenders.map((t) => [t.currency, t.usdEquivalent.toFixed(2)])).toEqual([["USD", "20.00"]]);
  });
});

describe("forgivenDue (Consider it paid)", () => {
  const base = { collectionMode: "WHOLE" as const, rate: RATE };

  it("3,000 LBP left: the due drops by exactly that", () => {
    expect(forgivenDue({ ...base, due: D(2000000), remaining: D(3000), currency: "LBP" }).toFixed(0)).toBe("1997000");
  });

  it("6,000 LBP left, or nothing left, is refused", () => {
    expect(() => forgivenDue({ ...base, due: D(2000000), remaining: D(6000), currency: "LBP" })).toThrow(
      expect.objectContaining({ key: "booking.not_forgivable" }),
    );
    expect(() => forgivenDue({ ...base, due: D(2000000), remaining: D(5000), currency: "LBP" })).toThrow(
      expect.objectContaining({ key: "booking.not_forgivable" }),
    );
    expect(() => forgivenDue({ ...base, due: D(2000000), remaining: D(0), currency: "LBP" })).toThrow(
      expect.objectContaining({ key: "booking.not_forgivable" }),
    );
  });

  it("a USD game with a few cents left is forgivable with a rate, not without one", () => {
    expect(forgivenDue({ ...base, due: D(30), remaining: D("0.05"), currency: "USD" }).toFixed(2)).toBe("29.95");
    expect(() => forgivenDue({ ...base, due: D(30), remaining: D("0.05"), currency: "USD", rate: null })).toThrow(
      expect.objectContaining({ key: "booking.not_forgivable" }),
    );
  });

  it("a split game is refused", () => {
    expect(() => forgivenDue({ ...base, collectionMode: "PER_PLAYER", due: D(2000000), remaining: D(3000), currency: "LBP" })).toThrow(
      expect.objectContaining({ key: "booking.due_whole_only" }),
    );
  });
});
