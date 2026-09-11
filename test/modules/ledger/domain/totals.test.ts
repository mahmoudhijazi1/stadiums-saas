import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { netUsd, usdToDisplayLbp } from "@/modules/ledger/domain/totals";

describe("netUsd", () => {
  it("is in minus out", () => {
    expect(netUsd(new Decimal("100.00"), new Decimal("30.00")).toFixed(2)).toBe(
      "70.00",
    );
  });

  it("may be negative when out is larger", () => {
    expect(netUsd(new Decimal("10.00"), new Decimal("30.00")).toFixed(2)).toBe(
      "-20.00",
    );
  });
});

describe("usdToDisplayLbp", () => {
  it("multiplies USD by LBP-per-USD and rounds to whole pounds", () => {
    expect(
      usdToDisplayLbp(new Decimal("20.00"), new Decimal("90000")).toFixed(0),
    ).toBe("1800000");
  });
});
