import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { formatUsd, isUsdString, parseUsd } from "@/lib/money";

describe("parseUsd / formatUsd", () => {
  it("parses a two-decimal string with Decimal, not a float", () => {
    const amount = parseUsd("30.00");
    expect(amount).toBeInstanceOf(Decimal);
    expect(amount.equals(new Decimal("30.00"))).toBe(true);
    expect(formatUsd(amount)).toBe("30.00");
  });

  it("rejects numbers-as-strings that are not exact cents", () => {
    expect(isUsdString("30")).toBe(false);
    expect(isUsdString("30.0")).toBe(false);
    expect(() => parseUsd("30")).toThrow();
  });
});
