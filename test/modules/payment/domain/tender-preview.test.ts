import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { usdEquivalent } from "@/modules/payment/domain/collect";
import { lbpCovering, previewTenders } from "@/modules/payment/domain/tender-preview";

const RATE = new Decimal("89500");

function preview(usdText: string, lbpText: string, target: string | null = "30.00", rate: Decimal | null = RATE) {
  return previewTenders({
    usdText,
    lbpText,
    lbpPerUsd: rate,
    targetUsd: target === null ? null : new Decimal(target),
  });
}

function ok(result: ReturnType<typeof previewTenders>) {
  if (result.kind !== "ok") throw new Error(`expected ok, got ${result.kind}`);
  return {
    total: result.totalUsd.toFixed(2),
    remaining: result.remainingUsd?.toFixed(2) ?? null,
    lbp: result.remainingLbp?.toFixed(0) ?? null,
  };
}

describe("previewTenders", () => {
  it("shows what is left in USD and in LBP as the USD part changes", () => {
    expect(ok(preview("20", ""))).toEqual({ total: "20.00", remaining: "10.00", lbp: "895000" });
    expect(ok(preview("20.50", ""))).toEqual({ total: "20.50", remaining: "9.50", lbp: "850250" });
  });

  it("reaches zero when the LBP part covers the rest (30 = 20 + 10 × rate)", () => {
    expect(ok(preview("20", "895000"))).toEqual({ total: "30.00", remaining: "0.00", lbp: "0" });
    expect(ok(preview("", "2685000"))).toEqual({ total: "30.00", remaining: "0.00", lbp: "0" });
  });

  it("goes negative when the owner takes more than is due", () => {
    expect(ok(preview("30", "100000"))).toEqual({ total: "31.12", remaining: "-1.12", lbp: "100240" });
  });

  it("converts LBP exactly as the server freezes it", () => {
    const lbp = new Decimal("746431");
    const server = usdEquivalent({ currency: "LBP", amount: lbp, rate: RATE });
    expect(ok(preview("", lbp.toFixed(0))).total).toBe(server.toFixed(2));
  });

  it("refuses formats the server refuses", () => {
    expect(preview("20.5", "").kind).toBe("bad_usd");
    expect(preview("abc", "").kind).toBe("bad_usd");
    expect(preview("", "895,000").kind).toBe("bad_lbp");
    expect(preview("", "1.5").kind).toBe("bad_lbp");
    expect(preview(" ", " ").kind).toBe("empty");
  });

  it("flags LBP without a rate, but USD alone still works", () => {
    expect(preview("", "100000", "30.00", null).kind).toBe("rate_missing");
    expect(ok(preview("12", "", "30.00", null))).toEqual({ total: "12.00", remaining: "18.00", lbp: null });
  });

  it("gives only the total when there is no target (expenses)", () => {
    expect(ok(preview("10", "447500", null))).toEqual({ total: "15.00", remaining: null, lbp: null });
  });
});

describe("lbpCovering", () => {
  it("is the fewest pounds that freeze to at least the amount", () => {
    for (const usd of ["0.01", "8.34", "10.00", "13.37", "99.99"]) {
      const amount = new Decimal(usd);
      const lbp = lbpCovering(amount, RATE);
      expect(usdEquivalent({ currency: "LBP", amount: lbp, rate: RATE }).gte(amount)).toBe(true);
      const less = lbp.minus(1);
      if (less.gt(0)) {
        expect(less.div(RATE).lt(amount)).toBe(true);
      }
    }
  });
});
