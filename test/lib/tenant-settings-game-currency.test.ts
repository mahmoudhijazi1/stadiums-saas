import { describe, expect, it } from "@jest/globals";
import { mergeGamePriceCurrency, parseTenantSettings } from "@/lib/tenant-settings";

/** DR-007 decision 1: "game prices in USD or LBP", one setting per stadium, USD unless set. */
describe("gamePriceCurrency setting", () => {
  it("reads as USD when missing or invalid, so existing stadiums are USD", () => {
    expect(parseTenantSettings({}).gamePriceCurrency).toBe("USD");
    expect(parseTenantSettings(null).gamePriceCurrency).toBe("USD");
    expect(parseTenantSettings({ gamePriceCurrency: "EUR" }).gamePriceCurrency).toBe("USD");
    expect(parseTenantSettings({ gamePriceCurrency: "lbp" }).gamePriceCurrency).toBe("USD");
    expect(parseTenantSettings({ gamePriceCurrency: 1 }).gamePriceCurrency).toBe("USD");
  });

  it("parses LBP and USD", () => {
    expect(parseTenantSettings({ gamePriceCurrency: "LBP" }).gamePriceCurrency).toBe("LBP");
    expect(parseTenantSettings({ gamePriceCurrency: "USD" }).gamePriceCurrency).toBe("USD");
  });

  it("merging it keeps every other setting", () => {
    const merged = mergeGamePriceCurrency({ timeDisplay: "h12", dayStartHour: 3, address: "Hamra" }, "LBP");
    expect(merged).toMatchObject({ gamePriceCurrency: "LBP", timeDisplay: "h12", dayStartHour: 3, address: "Hamra" });
    expect(mergeGamePriceCurrency(merged, "USD").gamePriceCurrency).toBe("USD");
  });
});
