import Decimal from "decimal.js";
import { describe, expect, it } from "@jest/globals";
import { directionOfSource, lbpTotals, lbpValue, type LbpTenderSums } from "@/modules/payment/domain/lbp-period";

/** DR-007: the Money page in pounds counts each payment at its own value. */
const RANGE = { from: "2026-10-01", to: "2026-10-31" };

function sums(sourceType: string, ratedLbp: string, over: Partial<LbpTenderSums> = {}): LbpTenderSums {
  return { sourceType, ratedLbp: new Decimal(ratedLbp), unratedUsd: new Decimal(0), unrated: 0, payments: 1, ...over };
}

describe("directionOfSource", () => {
  it("an expense is money out; bookings and sales are money in", () => {
    expect(directionOfSource("EXPENSE")).toBe("OUT");
    expect(directionOfSource("BOOKING")).toBe("IN");
    expect(directionOfSource("SALE")).toBe("IN");
  });
});

describe("lbpValue", () => {
  it("counts a USD tender with no stored rate at the fallback rate, whole pounds half up", () => {
    const row = sums("BOOKING", "1000000", { unratedUsd: new Decimal("4.00"), unrated: 1 });
    expect(lbpValue(row, new Decimal(95000)).toFixed(0)).toBe("1380000");
    expect(lbpValue(sums("BOOKING", "100.5"), null).toFixed(0)).toBe("101");
  });

  it("without any rate an unrated dollar counts as nothing (the caller says so)", () => {
    const row = sums("BOOKING", "0", { unratedUsd: new Decimal("4.00"), unrated: 1 });
    expect(lbpValue(row, null).toFixed(0)).toBe("0");
  });
});

describe("lbpTotals", () => {
  const rows = [
    sums("BOOKING", "3800000"),
    sums("SALE", "1000000"),
    sums("EXPENSE", "500000"),
  ];

  it("In is bookings and sales, Out is expenses, Profit is In minus Out, sales are the shop's In", () => {
    const totals = lbpTotals(rows, new Decimal(95000), RANGE);
    expect(totals.inLbp.toFixed(0)).toBe("4800000");
    expect(totals.outLbp.toFixed(0)).toBe("500000");
    expect(totals.netLbp.toFixed(0)).toBe("4300000");
    expect(totals.salesLbp.toFixed(0)).toBe("1000000");
    expect(totals.inBySource.map((s) => [s.sourceType, s.lbp.toFixed(0)])).toEqual([
      ["BOOKING", "3800000"],
      ["SALE", "1000000"],
    ]);
    expect([totals.payments, totals.unrated, totals.from, totals.to]).toEqual([3, 0, "2026-10-01", "2026-10-31"]);
  });

  it("a loss is a negative Profit and unrated tenders are counted", () => {
    const totals = lbpTotals(
      [sums("BOOKING", "100000", { unratedUsd: new Decimal(2), unrated: 1 }), sums("EXPENSE", "900000")],
      new Decimal(90000),
      RANGE,
    );
    expect(totals.inLbp.toFixed(0)).toBe("280000");
    expect(totals.netLbp.toFixed(0)).toBe("-620000");
    expect(totals.unrated).toBe(1);
  });

  it("no payments is an empty period", () => {
    const totals = lbpTotals([], null, RANGE);
    expect([totals.inLbp.toFixed(0), totals.outLbp.toFixed(0), totals.netLbp.toFixed(0), totals.payments]).toEqual(["0", "0", "0", 0]);
  });
});
