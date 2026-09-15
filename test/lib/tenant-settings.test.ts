import { describe, expect, it } from "@jest/globals";
import {
  mergeTenantTimeDisplay,
  parseTenantSettings,
  parseTimeDisplayForm,
} from "@/lib/tenant-settings";

describe("parseTenantSettings", () => {
  it("defaults empty object to h23", () => {
    expect(parseTenantSettings({})).toEqual({ timeDisplay: "h23" });
  });

  it("defaults null/undefined to h23", () => {
    expect(parseTenantSettings(null)).toEqual({ timeDisplay: "h23" });
    expect(parseTenantSettings(undefined)).toEqual({ timeDisplay: "h23" });
  });

  it("accepts h12", () => {
    expect(parseTenantSettings({ timeDisplay: "h12" })).toEqual({
      timeDisplay: "h12",
    });
  });

  it("strips unknown keys", () => {
    expect(
      parseTenantSettings({ timeDisplay: "h23", locale: "ar", extra: 1 }),
    ).toEqual({ timeDisplay: "h23" });
  });

  it("defaults invalid timeDisplay to h23", () => {
    expect(parseTenantSettings({ timeDisplay: "bogus" })).toEqual({
      timeDisplay: "h23",
    });
  });
});

describe("mergeTenantTimeDisplay", () => {
  it("merges onto current without dropping known shape", () => {
    expect(mergeTenantTimeDisplay({ timeDisplay: "h23" }, "h12")).toEqual({
      timeDisplay: "h12",
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
