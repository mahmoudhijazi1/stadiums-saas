import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { formatUsd, isLbpString, isUsdString, normalizeUsdForm, parseLbp, parseUsd } from "@/lib/money";

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

  it("turns a whole-dollar form value into cents", () => {
    expect(normalizeUsdForm("30")).toBe("30.00");
    expect(normalizeUsdForm("30.00")).toBe("30.00");
    expect(normalizeUsdForm("30.0")).toBe("30.0");
  });
});

describe("parseLbp", () => {
  it("parses a whole-pound string with Decimal, not a float", () => {
    const amount = parseLbp("900000");
    expect(amount).toBeInstanceOf(Decimal);
    expect(amount.equals(new Decimal("900000"))).toBe(true);
  });

  it("rejects fractional pounds and leading zeros", () => {
    expect(isLbpString("900000.5")).toBe(false);
    expect(isLbpString("090000")).toBe(false);
    expect(() => parseLbp("900000.00")).toThrow();
  });
});
