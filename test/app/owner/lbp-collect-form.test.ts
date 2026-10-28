/** @jest-environment node */
import { describe, expect, it } from "@jest/globals";
import { otherAmountView } from "@/modules/booking/ui/booking-sheet/other-amount-view";

/**
 * DR-007 slice 6, the collect screen, now the one "Other amount or currency" form: an LBP game's live line
 * (what is left in pounds, the pounds the typed dollars cover, Give back) and, on a USD game paid in
 * pounds, the exact equivalent with the friendly amount. The old `LbpGameBalance` and the booking use of
 * `TenderBalance` were merged into `otherAmountView`; the same cases, read from it. Written, not run.
 */
function lbpGame(usdText: string, lbpText: string, locale: "en" | "ar" = "en", rate: string | null = "89500") {
  return otherAmountView({ currency: "LBP", remaining: "2000000", usdText, lbpText, lbpPerUsd: rate, locale, about: locale === "en" ? "about" : "حوالي" });
}

describe("the collect line of an LBP game", () => {
  it("dollars typed show the pounds they cover and what is left", () => {
    const view = lbpGame("20", "");
    expect(view.coversLine).toBe("$20 = 1,790,000 LBP");
    expect(view.result).toEqual({ kind: "owed", amount: "210,000 LBP" });
  });

  it("the exact pounds cover the full amount", () => {
    expect(lbpGame("", "2000000").result).toEqual({ kind: "exact" });
  });

  it("more than is owed shows Give back, in the currency handed over", () => {
    expect(lbpGame("", "2100000").result).toEqual({ kind: "change", amount: "100,000 LBP" });
    // $25 keeps $22.35: $2.65 back, shown as $2 and the cents in pounds.
    expect(lbpGame("25", "").result).toEqual({ kind: "change", amount: "$2 + 58,175 LBP" });
    expect(lbpGame("", "2100000", "ar").result).toEqual({ kind: "change", amount: "100,000 ل.ل" });
  });

  it("without a rate, dollars cannot be counted", () => {
    expect(lbpGame("20", "", "en", null).result).toEqual({ kind: "rate_missing" });
    // Pounds alone need no rate.
    expect(lbpGame("", "2000000", "en", null).result).toEqual({ kind: "exact" });
  });
});

describe("a USD game paid in pounds", () => {
  const usdGame = (lbpText: string, rate = "89500") =>
    otherAmountView({ currency: "USD", remaining: "6.00", usdText: "", lbpText, lbpPerUsd: rate, locale: "en", about: "about" });

  it("shows the exact pounds still owed and the friendly amount", () => {
    expect(usdGame("").result).toEqual({ kind: "empty" });
    expect(otherAmountView({ currency: "USD", remaining: "6.00", usdText: "0", lbpText: "", lbpPerUsd: "89500", locale: "en", about: "about" }).result).toEqual({
      kind: "owed",
      amount: "$6.00 · 537,000 LBP, about 540,000",
    });
  });

  it("a round amount has no friendly twin", () => {
    const view = otherAmountView({ currency: "USD", remaining: "6.00", usdText: "0", lbpText: "", lbpPerUsd: "90000", locale: "en", about: "about" });
    expect(view.result).toEqual({ kind: "owed", amount: "$6.00 · 540,000 LBP" });
  });

  it("pounds typed say what they cover in dollars", () => {
    expect(usdGame("537000").coversLine).toBe("537,000 LBP = $6.00");
  });
});
