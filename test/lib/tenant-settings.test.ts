import { describe, expect, it } from "@jest/globals";
import {
  mergeBookingRules,
  mergeTenantTimeDisplay,
  parseBookingRulesForm,
  parseTenantSettings,
  parseTimeDisplayForm,
} from "@/lib/tenant-settings";

const feeDefaults = {
  cancellationWindowHours: 24,
  lateCancellationFeePercent: 0,
  noShowFeePercent: 100,
};

describe("parseTenantSettings", () => {
  it("defaults empty object to h23 and the fee policy", () => {
    expect(parseTenantSettings({})).toEqual({
      timeDisplay: "h23",
      ...feeDefaults,
    });
  });

  it("defaults null/undefined to h23 and the fee policy", () => {
    expect(parseTenantSettings(null)).toEqual({
      timeDisplay: "h23",
      ...feeDefaults,
    });
    expect(parseTenantSettings(undefined)).toEqual({
      timeDisplay: "h23",
      ...feeDefaults,
    });
  });

  it("accepts h12", () => {
    expect(parseTenantSettings({ timeDisplay: "h12" })).toEqual({
      timeDisplay: "h12",
      ...feeDefaults,
    });
  });

  it("keeps a late-cancel percent and strips unknown keys", () => {
    expect(
      parseTenantSettings({
        timeDisplay: "h23",
        lateCancellationFeePercent: 50,
        locale: "ar",
        extra: 1,
      }),
    ).toEqual({
      timeDisplay: "h23",
      ...feeDefaults,
      lateCancellationFeePercent: 50,
    });
  });

  it("defaults an out-of-range percent", () => {
    expect(parseTenantSettings({ lateCancellationFeePercent: 150 })).toEqual({
      timeDisplay: "h23",
      ...feeDefaults,
    });
  });

  it("defaults invalid timeDisplay to h23", () => {
    expect(parseTenantSettings({ timeDisplay: "bogus" })).toEqual({
      timeDisplay: "h23",
      ...feeDefaults,
    });
  });
});

describe("mergeTenantTimeDisplay", () => {
  it("merges onto current without dropping known shape", () => {
    expect(mergeTenantTimeDisplay({ timeDisplay: "h23" }, "h12")).toEqual({
      timeDisplay: "h12",
      ...feeDefaults,
    });
  });
});

describe("parseBookingRulesForm", () => {
  it("accepts a window and the 0 / 50 / 100 percents", () => {
    expect(
      parseBookingRulesForm({
        cancellationWindowHours: "24",
        lateCancellationFeePercent: "50",
        noShowFeePercent: "100",
      }),
    ).toEqual({
      cancellationWindowHours: 24,
      lateCancellationFeePercent: 50,
      noShowFeePercent: 100,
    });
  });

  it("rejects a percent outside 0, 50, and 100", () => {
    expect(() =>
      parseBookingRulesForm({
        cancellationWindowHours: "24",
        lateCancellationFeePercent: "25",
        noShowFeePercent: "100",
      }),
    ).toThrow();
  });
});

describe("mergeBookingRules", () => {
  it("keeps the clock when the fees change", () => {
    expect(
      mergeBookingRules(
        { timeDisplay: "h12" },
        {
          cancellationWindowHours: 12,
          lateCancellationFeePercent: 50,
          noShowFeePercent: 0,
        },
      ),
    ).toEqual({
      timeDisplay: "h12",
      cancellationWindowHours: 12,
      lateCancellationFeePercent: 50,
      noShowFeePercent: 0,
    });
  });
});

describe("parseTimeDisplayForm", () => {
  it("accepts h12 / h23", () => {
    expect(parseTimeDisplayForm({ timeDisplay: "h12" })).toEqual({
      timeDisplay: "h12",
    });
  });

  it("rejects invalid", () => {
    expect(() => parseTimeDisplayForm({ timeDisplay: "h24" })).toThrow();
  });
});
