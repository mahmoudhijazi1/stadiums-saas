import { describe, expect, it } from "@jest/globals";
import { isValidUsd, padCents, sanitizeUsd } from "@/app/owner/(app)/more/settings/pitches/money-input";
import { previewSummaryLabel, unusedTimeLabel } from "@/lib/ui-copy";

describe("sanitizeUsd", () => {
  it.each([
    ["25", "25"],
    ["25.5", "25.5"],
    ["25.567", "25.56"],
    ["$25", "25"],
    ["2a5", "25"],
    ["1.2.3", "1.23"],
    ["", ""],
    [".", "."],
  ])("%j -> %j", (raw, expected) => {
    expect(sanitizeUsd(raw)).toBe(expected);
  });
});

describe("padCents / isValidUsd", () => {
  it.each([
    ["25", "25.00"],
    ["25.5", "25.50"],
    ["25.", "25.00"],
    ["25.55", "25.55"],
    ["", ""],
    [".", "."],
  ])("padCents(%j) -> %j", (value, expected) => {
    expect(padCents(value)).toBe(expected);
  });

  it("never goes through a float (0.1 + 0.2 style values stay exact)", () => {
    expect(padCents("0.1")).toBe("0.10");
    expect(padCents("19.99")).toBe("19.99");
    expect(isValidUsd("19.99")).toBe(true);
    expect(isValidUsd("19.999")).toBe(false);
    expect(isValidUsd("")).toBe(false);
    expect(isValidUsd(".5")).toBe(false);
  });
});

describe("preview copy", () => {
  it("says one price or a range, in both languages", () => {
    expect(previewSummaryLabel(5, "20.00", "20.00", "en")).toBe("5 games · $20 each");
    expect(previewSummaryLabel(1, "20.50", "20.50", "en")).toBe("1 game · $20.50 each");
    expect(previewSummaryLabel(5, "20.00", "30.00", "en")).toBe("5 games · $20–$30");
    expect(previewSummaryLabel(5, "20.00", "20.00", "ar")).toBe("5 مباريات · $20 للمباراة");
    expect(unusedTimeLabel(30, "en")).toContain("30 min");
  });
});
