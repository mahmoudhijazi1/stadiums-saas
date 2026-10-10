import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import {
  displayChange, formatChange, formatLbpAmount, formatParts, formatUsd, formatUsdAmount, formatUsdCompact,
  formatUsdMoney, groupDigits, lbpUnit,
} from "@/lib/format/money";
import { isLbpString, isUsdString, normalizeUsdForm, parseLbp, parseUsd } from "@/lib/format/parse-money";

/** Characterization of every money function: these strings are what the screens show. Not to change in a refactor. */
const d = (v: string) => new Decimal(v);
const table = <I, O>(fn: (i: I) => O, rows: Array<[I, O]>) => rows.forEach(([i, o]) => expect(fn(i)).toBe(o));

describe("USD formatting", () => {
  it("formatUsd: exactly two decimals", () => {
    table((v: string) => formatUsd(d(v)), [["0", "0.00"], ["0.5", "0.50"], ["30", "30.00"], ["12.5", "12.50"], ["1234567.89", "1234567.89"], ["-40", "-40.00"], ["1.005", "1.01"]]);
  });
  it("formatUsdCompact: whole dollars drop the cents, half-up", () => {
    table((v: string) => formatUsdCompact(d(v)), [["0", "0"], ["0.5", "0.50"], ["30", "30"], ["30.00", "30"], ["12.5", "12.50"], ["1234567.89", "1234567.89"], ["-40", "-40"], ["-4.5", "-4.50"], ["1.005", "1.01"], ["1.004", "1"]]);
  });
  it("formatUsdMoney: sign outside the symbol", () => {
    table((v: string) => formatUsdMoney(d(v)), [["0", "$0.00"], ["5.5", "$5.50"], ["1234567.89", "$1234567.89"], ["-40", "-$40.00"], ["-0.5", "-$0.50"]]);
  });
  it("formatUsdAmount: $ + compact", () => {
    table((v: string) => formatUsdAmount(v), [["0", "$0"], ["1.5", "$1.50"], ["2", "$2"], ["20.00", "$20"], ["1000000", "$1000000"], ["4.5", "$4.50"]]);
    expect(formatUsdAmount(d("7.25"))).toBe("$7.25");
  });
});

describe("LBP formatting", () => {
  it("groupDigits: comma grouping, whole pounds half-up", () => {
    table((v: string) => groupDigits(v), [["0", "0"], ["999", "999"], ["1000", "1,000"], ["20000", "20,000"], ["1234567", "1,234,567"], ["90000000", "90,000,000"], ["0.5", "1"], ["1499.4", "1,499"]]);
    expect(groupDigits(d("45000"))).toBe("45,000");
  });
  it("lbpUnit and formatLbpAmount in both languages", () => {
    expect(lbpUnit("ar")).toBe("ل.ل");
    expect(lbpUnit("en")).toBe("LBP");
    expect(formatLbpAmount("20000", "ar")).toBe("20,000 ل.ل");
    expect(formatLbpAmount("20000", "en")).toBe("20,000 LBP");
    expect(formatLbpAmount("0", "en")).toBe("0 LBP");
  });
});

describe("mixed parts and change", () => {
  const parts: Array<[string, string, string, string]> = [
    ["0", "0", "0", "0"],
    ["60000", "1.5", "60,000 ل.ل + $1.50", "60,000 LBP + $1.50"],
    ["60000", "0", "60,000 ل.ل", "60,000 LBP"],
    ["0", "20", "$20", "$20"],
  ];
  it("formatParts: pounds first, zero parts hidden", () => {
    for (const [lbp, usd, ar, en] of parts) {
      expect(formatParts({ lbp, usd }, "ar")).toBe(ar);
      expect(formatParts({ lbp, usd }, "en")).toBe(en);
    }
  });
  it("formatChange: dollars first, zero parts hidden", () => {
    expect(formatChange({ lbp: "45000", usd: "5" }, "ar")).toBe("$5 + 45,000 ل.ل");
    expect(formatChange({ lbp: "45000", usd: "5" }, "en")).toBe("$5 + 45,000 LBP");
    expect(formatChange({ lbp: "0", usd: "4.5" }, "en")).toBe("$4.50");
    expect(formatChange({ lbp: "0", usd: "0" }, "ar")).toBe("0");
  });
  it("displayChange: cents rest in pounds at the rate, half-up; no rate leaves it alone", () => {
    const out = displayChange({ lbp: "0", usd: "5.50" }, "90000");
    expect([out.usd.toFixed(0), out.lbp.toFixed(0)]).toEqual(["5", "45000"]);
    const plus = displayChange({ lbp: "1000", usd: "0.01" }, "89500");
    expect([plus.usd.toFixed(0), plus.lbp.toFixed(0)]).toEqual(["0", "1895"]);
    const none = displayChange({ lbp: "0", usd: "4.50" }, null);
    expect([none.usd.toFixed(2), none.lbp.toFixed(0)]).toEqual(["4.50", "0"]);
    const zero = displayChange({ lbp: "0", usd: "4.50" }, "0");
    expect(zero.usd.toFixed(2)).toBe("4.50");
  });
});

describe("parsing", () => {
  it("USD strings", () => {
    table(isUsdString, [["30.00", true], ["0.00", true], ["30", false], ["30.0", false], ["-1.00", false], ["01.00", false], ["", false]]);
    table(normalizeUsdForm, [["30", "30.00"], ["0", "0.00"], ["30.0", "30.0"], ["30.00", "30.00"], ["abc", "abc"]]);
    expect(parseUsd("12.50").toFixed(2)).toBe("12.50");
    expect(() => parseUsd("12.5")).toThrow('Invalid USD amount "12.5"');
  });
  it("LBP strings", () => {
    table(isLbpString, [["0", true], ["900000", true], ["1.5", false], ["-1", false], ["007", false], ["", false]]);
    expect(parseLbp("900000").toFixed(0)).toBe("900000");
    expect(() => parseLbp("9.5")).toThrow('Invalid LBP amount "9.5"');
  });
});
