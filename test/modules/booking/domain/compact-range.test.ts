import { describe, expect, it } from "@jest/globals";
import { compactRange } from "@/modules/booking/domain/compact-range";
import { compactUsd } from "@/lib/format/money";

describe("compactRange", () => {
  it("drops the marker from the start when both have the same one", () => {
    expect(compactRange("5:00 PM", "6:00 PM")).toEqual({ start: "5:00", end: "6:00 PM" });
    expect(compactRange("5:00 م", "6:00 م")).toEqual({ start: "5:00", end: "6:00 م" });
  });

  it("keeps both when the markers differ or there is none", () => {
    expect(compactRange("11:00 AM", "12:00 PM")).toEqual({ start: "11:00 AM", end: "12:00 PM" });
    expect(compactRange("17:00", "18:00")).toEqual({ start: "17:00", end: "18:00" });
  });
});

describe("compactUsd", () => {
  it("drops .00 and keeps cents when present", () => {
    expect(compactUsd("20.00")).toBe("$20");
    expect(compactUsd("22.50")).toBe("$22.50");
    expect(compactUsd("0.00")).toBe("$0");
  });
});
