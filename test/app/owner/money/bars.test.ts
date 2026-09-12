import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { inOutBarPercents } from "@/app/owner/money/bars";

describe("inOutBarPercents", () => {
  it("scales the smaller total against the larger", () => {
    expect(
      inOutBarPercents(new Decimal("1500.00"), new Decimal("260.00")),
    ).toEqual({ inPct: "100", outPct: "17" });
  });

  it("returns empty bars when both totals are zero", () => {
    expect(inOutBarPercents(new Decimal("0.00"), new Decimal("0.00"))).toEqual({
      inPct: "0",
      outPct: "0",
    });
  });
});
