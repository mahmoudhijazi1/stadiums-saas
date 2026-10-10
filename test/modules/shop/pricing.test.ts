import Decimal from "decimal.js";
import { describe, expect, it } from "@jest/globals";
import { displayChange, formatChange, formatLbpAmount, formatParts, groupDigits } from "@/lib/format/money";
import {
  applyPayment,
  dueParts,
  lbpReversal,
  paymentTenders,
  priceLine,
  settleState,
  type SettleState,
} from "@/modules/shop/domain/pricing";

const d = (value: string | number) => new Decimal(value);
const RATE = d(90000);

/** The state of a brand new sale or tab made of these lines (nothing paid yet). */
function fresh(lines: { usd?: string; lbp?: string; frozen?: string }[]): SettleState {
  const parts = dueParts(
    lines.map((line) =>
      line.lbp
        ? { lineTotalUsd: d(line.frozen ?? "0"), lineTotalLbp: d(line.lbp) }
        : { lineTotalUsd: d(line.usd ?? "0"), lineTotalLbp: null },
    ),
  );
  return settleState({ parts, appliedLbp: d(0), appliedUsd: d(0), recordedUsd: d(0) });
}

describe("priceLine", () => {
  it("a USD item is qty x its price", () => {
    const line = priceLine({ currency: "USD", usd: d("1.50") }, 3, null);
    expect([line.lineTotalUsd.toFixed(2), line.lineTotalLbp, line.unitPriceLbp, line.rateAtTime]).toEqual(["4.50", null, null, null]);
  });

  it("an LBP item keeps the pounds and freezes its USD value at the rate, on the whole line", () => {
    const line = priceLine({ currency: "LBP", lbp: d(20000) }, 3, RATE);
    expect(line.lineTotalLbp?.toFixed(0)).toBe("60000");
    expect(line.lineTotalUsd.toFixed(2)).toBe("0.67"); // 60,000 / 90,000, not 3 x 0.22
    expect(line.unitPriceUsd.toFixed(2)).toBe("0.22");
    expect(line.rateAtTime?.toFixed(0)).toBe("90000");
  });

  it("an LBP item cannot be priced without a rate", () => {
    expect(() => priceLine({ currency: "LBP", lbp: d(20000) }, 1, null)).toThrow(expect.objectContaining({ key: "shop.rate_required" }));
  });
});

describe("lbpReversal", () => {
  it("the lines of an item keep adding up to the conversion of the pounds that remain", () => {
    // 3 x 20,000 frozen at 90,000 = 0.67. Take back one: 40,000 remain = 0.44.
    const reversal = lbpReversal({ unitPriceLbp: d(20000), rateAtTime: RATE, netQtyBefore: 3, netUsdBefore: d("0.67"), removedQty: 1 });
    expect(reversal.lineTotalLbp.toFixed(0)).toBe("-20000");
    expect(d("0.67").plus(reversal.lineTotalUsd).toFixed(2)).toBe("0.44");
    // Take back everything: nothing remains.
    const all = lbpReversal({ unitPriceLbp: d(20000), rateAtTime: RATE, netQtyBefore: 3, netUsdBefore: d("0.67"), removedQty: 3 });
    expect(d("0.67").plus(all.lineTotalUsd).toFixed(2)).toBe("0.00");
  });
});

describe("what a sale or tab is made of", () => {
  it("pounds for the LBP lines, dollars for the USD lines, and the frozen USD of each", () => {
    const parts = dueParts([
      { lineTotalUsd: d("1.50"), lineTotalLbp: null },
      { lineTotalUsd: d("0.22"), lineTotalLbp: d(20000) },
      { lineTotalUsd: d("0.33"), lineTotalLbp: d(30000) },
    ]);
    expect([parts.dueLbp.toFixed(0), parts.dueUsd.toFixed(2), parts.frozenLbpUsd.toFixed(2), parts.frozenUsd.toFixed(2)]).toEqual(["50000", "1.50", "0.55", "2.05"]);
  });
});

describe("applyPayment", () => {
  it("3 x 20,000 paid with 60,000: nothing owed, and the frozen USD is what is recorded", () => {
    const state = fresh([{ lbp: "60000", frozen: "0.67" }]);
    const handed = { lbp: d(60000), usd: d(0) };
    const result = applyPayment({ state, handed, rate: RATE });
    expect([result.remLbpAfter.toFixed(0), result.remUsdAfter.toFixed(2), result.changeLbp.toFixed(0)]).toEqual(["0", "0.00", "0"]);
    expect(result.recordedByLbpTender.toFixed(2)).toBe("0.67");
  });

  it("20,000 and 30,000 added separately, paid with 50,000: nothing owed, records the sum of the frozen values", () => {
    const state = fresh([{ lbp: "20000", frozen: "0.22" }, { lbp: "30000", frozen: "0.33" }]);
    const result = applyPayment({ state, handed: { lbp: d(50000), usd: d(0) }, rate: RATE });
    expect(result.remLbpAfter.isZero()).toBe(true);
    expect(result.recordedByLbpTender.toFixed(2)).toBe("0.55");
  });

  it("$1.50 + 40,000, paid with exactly those parts: nothing owed", () => {
    const state = fresh([{ usd: "1.50" }, { lbp: "40000", frozen: "0.44" }]);
    const result = applyPayment({ state, handed: { lbp: d(40000), usd: d("1.50") }, rate: RATE });
    expect([result.remLbpAfter.isZero(), result.remUsdAfter.isZero()]).toEqual([true, true]);
    expect(result.recordedByLbpTender.plus(result.recordedByUsdTender).toFixed(2)).toBe("1.94");
  });

  it("10,000 of 20,000 leaves 10,000 pounds, never a USD remainder, and records half the frozen value", () => {
    const state = fresh([{ lbp: "20000", frozen: "0.22" }]);
    const first = applyPayment({ state, handed: { lbp: d(10000), usd: d(0) }, rate: RATE });
    expect([first.remLbpAfter.toFixed(0), first.remUsdAfter.toFixed(2)]).toEqual(["10000", "0.00"]);
    expect(first.recordedByLbpTender.toFixed(2)).toBe("0.11");

    // The rest takes the exact remainder, whatever the rate does in between.
    const afterFirst = settleState({
      parts: dueParts([{ lineTotalUsd: d("0.22"), lineTotalLbp: d(20000) }]),
      appliedLbp: d(10000),
      appliedUsd: d(0),
      recordedUsd: d("0.11"),
    });
    const second = applyPayment({ state: afterFirst, handed: { lbp: d(10000), usd: d(0) }, rate: d(100000) });
    expect(second.remLbpAfter.isZero()).toBe(true);
    expect(second.recordedByLbpTender.toFixed(2)).toBe("0.11");
  });

  it("an odd split still ends on exactly the frozen value", () => {
    // 0.67 over 60,000 paid in three goes of 20,000: 0.22 + 0.22 + 0.23.
    let state = fresh([{ lbp: "60000", frozen: "0.67" }]);
    let recorded = d(0);
    for (let i = 0; i < 3; i += 1) {
      const result = applyPayment({ state, handed: { lbp: d(20000), usd: d(0) }, rate: RATE });
      recorded = recorded.plus(result.recordedByLbpTender);
      state = settleState({
        parts: dueParts([{ lineTotalUsd: d("0.67"), lineTotalLbp: d(60000) }]),
        appliedLbp: d(20000 * (i + 1)),
        appliedUsd: d(0),
        recordedUsd: recorded,
      });
    }
    expect(recorded.toFixed(2)).toBe("0.67");
    expect(state.remLbp.isZero()).toBe(true);
  });

  it("USD cash settles the LBP part at the current rate when there is no USD part", () => {
    const state = fresh([{ lbp: "90000", frozen: "1.00" }]);
    const result = applyPayment({ state, handed: { lbp: d(0), usd: d("1.00") }, rate: RATE });
    expect(result.remLbpAfter.isZero()).toBe(true);
    expect(result.changeUsd.toFixed(2)).toBe("0.00");
    expect(result.recordedByUsdTender.toFixed(2)).toBe("1.00");
  });

  it("an excess in the other currency is change in that currency: 100,000 for 60,000 leaves 40,000 pounds", () => {
    const state = fresh([{ lbp: "60000", frozen: "0.67" }]);
    const result = applyPayment({ state, handed: { lbp: d(100000), usd: d(0) }, rate: RATE });
    expect([result.remLbpAfter.isZero(), result.changeLbp.toFixed(0)]).toEqual([true, "40000"]);
    expect(result.recordedByLbpTender.toFixed(2)).toBe("0.67");
  });

  it("$10 for a $4.50 USD item gives $5.50 change", () => {
    const state = fresh([{ usd: "4.50" }]);
    const result = applyPayment({ state, handed: { lbp: d(0), usd: d(10) }, rate: RATE });
    expect([result.remUsdAfter.isZero(), result.changeUsd.toFixed(2)]).toEqual([true, "5.50"]);
  });

  it("pounds against a USD item convert at the rate; the excess pounds are change", () => {
    const state = fresh([{ usd: "4.50" }]);
    const result = applyPayment({ state, handed: { lbp: d(500000), usd: d(0) }, rate: RATE });
    expect(result.remUsdAfter.isZero()).toBe(true);
    expect(result.changeLbp.toFixed(0)).toBe("95000");
    expect(result.recordedByLbpTender.toFixed(2)).toBe("4.50");
  });

  it("without a rate there is no crossing: the excess is change", () => {
    const state = fresh([{ usd: "4.50" }]);
    const result = applyPayment({ state, handed: { lbp: d(500000), usd: d(0) }, rate: null });
    expect([result.remUsdAfter.toFixed(2), result.changeLbp.toFixed(0)]).toEqual(["4.50", "500000"]);
  });

  it("paying nothing owed is all change", () => {
    const state = fresh([{ usd: "0.00" }]);
    const result = applyPayment({ state, handed: { lbp: d(0), usd: d("2.00") }, rate: RATE });
    expect(result.changeUsd.toFixed(2)).toBe("2.00");
  });
});

describe("applyPayment: every tender settles its own currency first, then leftovers cross", () => {
  const state = fresh([{ usd: "1.50" }, { lbp: "60000", frozen: "0.67" }]);

  it("[100,000 ل.ل, $1.50] on 60,000 ل.ل + $1.50 records both parts and leaves 40,000 ل.ل change, not $0.44", () => {
    const result = applyPayment({ state, handed: { lbp: d(100000), usd: d("1.50") }, rate: RATE });
    expect([result.lbpApplied.toFixed(0), result.usdApplied.toFixed(2)]).toEqual(["60000", "1.50"]);
    expect([result.changeLbp.toFixed(0), result.changeUsd.toFixed(2)]).toEqual(["40000", "0.00"]);
    expect([result.remLbpAfter.isZero(), result.remUsdAfter.isZero()]).toEqual([true, true]);
    expect(result.recordedByLbpTender.toFixed(2)).toBe("0.67");
    expect(result.recordedByUsdTender.toFixed(2)).toBe("1.50");
  });

  it("the order the tenders are entered in does not matter", () => {
    const a = applyPayment({ state, handed: { lbp: d(100000), usd: d("1.50") }, rate: RATE });
    const b = applyPayment({ state, handed: { usd: d("1.50"), lbp: d(100000) }, rate: RATE });
    expect(b).toEqual(a);
  });

  it("only what is left after both own-currency settlements crosses over", () => {
    // $1.00 only against the dollar part, 100,000 pounds: the pounds settle 60,000, the 40,000 left
    // cross to the 0.50 still owed in dollars (0.44), the rest is change.
    const result = applyPayment({ state, handed: { lbp: d(100000), usd: d("1.00") }, rate: RATE });
    expect([result.usdApplied.toFixed(2), result.remUsdAfter.toFixed(2), result.changeLbp.toFixed(0)]).toEqual(["1.44", "0.06", "0"]);
  });
});

describe("displayChange", () => {
  it("shows whole dollars and the cents as pounds at the rate", () => {
    const shown = displayChange({ lbp: "0", usd: "5.50" }, RATE);
    expect([shown.usd.toFixed(0), shown.lbp.toFixed(0)]).toEqual(["5", "45000"]);
    expect(formatChange(shown, "ar")).toBe("$5 + 45,000 ل.ل");
    expect(formatChange(displayChange({ lbp: "40000", usd: "0" }, RATE), "en")).toBe("40,000 LBP");
  });

  it("adds to pounds of change already there, leaves whole dollars alone, and needs a rate", () => {
    const mixed = displayChange({ lbp: "10000", usd: "0.25" }, RATE);
    expect([mixed.usd.toFixed(0), mixed.lbp.toFixed(0)]).toEqual(["0", "32500"]);
    expect(displayChange({ lbp: "0", usd: "5.00" }, RATE).lbp.toFixed(0)).toBe("0");
    const noRate = displayChange({ lbp: "0", usd: "5.50" }, null);
    expect([noRate.usd.toFixed(2), noRate.lbp.toFixed(0)]).toEqual(["5.50", "0"]);
  });
});

describe("paymentTenders", () => {
  const state = fresh([{ lbp: "60000", frozen: "0.67" }]);
  const handed = { lbp: d(100000), usd: d(0) };
  const application = applyPayment({ state, handed, rate: RATE });

  it("keeping the change records everything handed over (how a booking collection works)", () => {
    const tenders = paymentTenders({ application, handed, rate: RATE, keepChange: true });
    expect(tenders.map((t) => [t.currency, t.amount.toFixed(0)])).toEqual([["LBP", "100000"]]);
    expect(tenders[0]!.usdEquivalent.toFixed(2)).toBe("1.11"); // 0.67 + 40,000 / 90,000 (0.44)
  });

  it("not keeping it reduces the tender to what the sale used", () => {
    const tenders = paymentTenders({ application, handed, rate: RATE, keepChange: false });
    expect(tenders.map((t) => [t.currency, t.amount.toFixed(0), t.rateAtTime?.toFixed(0), t.usdEquivalent.toFixed(2)])).toEqual([["LBP", "60000", "90000", "0.67"]]);
  });

  it("LBP cash needs a rate", () => {
    expect(() => paymentTenders({ application, handed, rate: null, keepChange: true })).toThrow(expect.objectContaining({ key: "payment.rate_required" }));
  });
});

describe("display", () => {
  it("groups pounds and writes the sign for the language", () => {
    expect(groupDigits("20000")).toBe("20,000");
    expect(groupDigits(d("1500000"))).toBe("1,500,000");
    expect(formatLbpAmount("20000", "ar")).toBe("20,000 ل.ل");
    expect(formatLbpAmount("20000", "en")).toBe("20,000 LBP");
  });

  it("shows both parts, or the one that is not zero", () => {
    expect(formatParts({ lbp: "60000", usd: "1.50" }, "ar")).toBe("60,000 ل.ل + $1.50");
    expect(formatParts({ lbp: "0", usd: "2.00" }, "en")).toBe("$2");
    expect(formatParts({ lbp: "20000", usd: "0" }, "en")).toBe("20,000 LBP");
    expect(formatParts({ lbp: "0", usd: "0" }, "en")).toBe("0");
  });
});
