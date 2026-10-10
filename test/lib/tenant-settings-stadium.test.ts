import { describe, expect, it } from "@jest/globals";
import { mergeStadiumInfo, parseTenantSettings } from "@/lib/tenant-settings";

/** Written, not run when authored. The stadium info keys of Tenant.settings. */
const INFO = {
  address: "Hamra, Beirut",
  mapLink: "https://maps.app.goo.gl/AbCdEf123",
  phone: "03123456",
  whatsappSame: false,
  whatsapp: "71123456",
  brandPreset: "blue" as const,
};

describe("stadium info in tenant settings", () => {
  it("defaults an old row (no info keys) to nothing set and the default colour", () => {
    expect(parseTenantSettings({ timeDisplay: "h12" })).toMatchObject({
      address: "",
      mapLink: "",
      phone: "",
      whatsappSame: true,
      whatsapp: "",
      brandPreset: "lime",
    });
  });

  it("round-trips what was saved and keeps the other settings", () => {
    const saved = mergeStadiumInfo({ timeDisplay: "h12", dayStartHour: 3 }, INFO);
    expect(saved).toMatchObject({ ...INFO, timeDisplay: "h12", dayStartHour: 3 });
    expect(parseTenantSettings(saved)).toEqual(saved);
  });

  it("re-checks the map link on read: a stored lookalike reads as none", () => {
    expect(parseTenantSettings({ mapLink: "https://google.com.evil.com/maps/x" }).mapLink).toBe("");
    expect(parseTenantSettings({ mapLink: "javascript:alert(1)" }).mapLink).toBe("");
    expect(parseTenantSettings({ mapLink: "https://google.com/maps/place/x" }).mapLink).toBe(
      "https://google.com/maps/place/x",
    );
  });

  it("re-checks the phones on read: a stored non-number reads as none", () => {
    expect(parseTenantSettings({ phone: "call me" }).phone).toBe("");
    expect(parseTenantSettings({ whatsapp: "12" }).whatsapp).toBe("");
    expect(parseTenantSettings({ phone: "03123456" }).phone).toBe("03123456");
  });

  it("reads an unknown or colour-value preset as the default: only keys are accepted", () => {
    expect(parseTenantSettings({ brandPreset: "#ff0000" }).brandPreset).toBe("lime");
    expect(parseTenantSettings({ brandPreset: "magenta" }).brandPreset).toBe("lime");
    expect(parseTenantSettings({ brandPreset: "pink" }).brandPreset).toBe("pink");
  });

  it("limits the address to 120 characters", () => {
    expect(parseTenantSettings({ address: "a".repeat(121) }).address).toBe("");
    expect(parseTenantSettings({ address: "a".repeat(120) }).address).toHaveLength(120);
  });
});
