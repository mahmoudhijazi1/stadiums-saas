import { describe, expect, it } from "@jest/globals";
import { formatDisplayDate } from "@/lib/format-display-date";

describe("formatDisplayDate", () => {
  const instant = new Date("2026-09-24T12:00:00.000Z");

  it("uses Levantine month names and Western digits in Arabic", () => {
    expect(
      formatDisplayDate(instant, "ar", { day: "numeric", month: "short" }),
    ).toBe("24 أيلول");
  });

  it("uses English month names", () => {
    expect(
      formatDisplayDate(instant, "en", { day: "numeric", month: "short" }),
    ).toBe("Sep 24");
  });
});