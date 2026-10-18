/** @jest-environment node */
import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LbpGameBalance } from "@/modules/booking/ui/booking-sheet/lbp-collect";
import { TenderBalance } from "@/modules/payment/ui/tender-balance";

/**
 * DR-007 slice 6, the collect screen: an LBP game's live line (what is left in pounds, the pounds the
 * typed dollars cover, Give back) and, on a USD game paid in pounds, the exact equivalent with the
 * friendly amount. Written, not run when authored.
 */
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

function lbpLine(usdText: string, lbpText: string, locale: "en" | "ar" = "en", rate: string | null = "89500") {
  return text(
    renderToStaticMarkup(
      createElement(LbpGameBalance, { remainingLbp: new Decimal(2000000), usdText, lbpText, lbpPerUsd: rate, locale }),
    ),
  );
}

describe("the collect line of an LBP game", () => {
  it("dollars typed show the pounds they cover and what is left", () => {
    const line = lbpLine("20", "");
    expect(line).toContain("$20 covers 1,790,000 LBP");
    expect(line).toContain("210,000 LBP");
  });

  it("the exact pounds cover the full amount", () => {
    expect(lbpLine("", "2000000")).toContain("Covers the full amount");
  });

  it("more than is owed shows Give back, in the currency handed over", () => {
    expect(lbpLine("", "2100000")).toContain("Give back 100,000 LBP");
    // $25 keeps $22.35: $2.65 back, shown as $2 and the cents in pounds.
    expect(lbpLine("25", "")).toContain("Give back $2 + 58,175 LBP");
    expect(lbpLine("", "2100000", "ar")).toContain("رجّع له 100,000 ل.ل");
  });

  it("without a rate it says to set one", () => {
    expect(lbpLine("", "2000000", "en", null)).toContain("Set the exchange rate first.");
  });
});

describe("a USD game paid in pounds", () => {
  it("shows the exact pounds and the friendly amount", () => {
    const line = text(
      renderToStaticMarkup(
        createElement(TenderBalance, { usdText: "0", lbpText: "", lbpPerUsd: "89500", targetUsd: "6.00", locale: "en" }),
      ),
    );
    expect(line).toContain("537,000 LBP, about 540,000");
  });

  it("a round amount has no friendly twin", () => {
    const line = text(
      renderToStaticMarkup(
        createElement(TenderBalance, { usdText: "0", lbpText: "", lbpPerUsd: "90000", targetUsd: "6.00", locale: "en" }),
      ),
    );
    expect(line).toContain("540,000 LBP");
    expect(line).not.toContain("about");
  });
});
