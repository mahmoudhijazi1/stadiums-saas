import { describe, expect, it } from "@jest/globals";
import { parseStadiumInfo, STADIUM_ADDRESS_MAX, STADIUM_NAME_MAX } from "@/modules/platform/domain/stadium-info";

/** Written, not run when authored. The Stadium info form's validation. */
const GOOD = {
  name: "Ahmad Stadium",
  address: "Hamra, Beirut",
  mapLink: "https://maps.app.goo.gl/AbCdEf123",
  phone: "03 123 456",
  whatsappSame: true,
  whatsapp: "",
  brandPreset: "lime",
};

function key(raw: unknown): string | null {
  try {
    parseStadiumInfo(raw);
    return null;
  } catch (error) {
    return (error as { key?: string }).key ?? "other";
  }
}

describe("parseStadiumInfo", () => {
  it("accepts a good form and turns the phone into digits", () => {
    expect(parseStadiumInfo(GOOD)).toMatchObject({ name: "Ahmad Stadium", phone: "03123456", whatsapp: "" });
  });

  describe("name", () => {
    it("is kept as written (never translated), trimmed and collapsed", () => {
      expect(parseStadiumInfo({ ...GOOD, name: "  ملعب   أحمد " }).name).toBe("ملعب أحمد");
      expect(parseStadiumInfo({ ...GOOD, name: "Al-Nour FC" }).name).toBe("Al-Nour FC");
    });

    it("uses the shared name cleaner: invisible and control characters go", () => {
      expect(parseStadiumInfo({ ...GOOD, name: "Ah​mad‮ Stadium\u0007" }).name).toBe("Ahmad Stadium");
      expect(parseStadiumInfo({ ...GOOD, name: "‏ًملعب" }).name).toBe("ملعب");
    });

    it("must not be empty after cleaning, and at most 60 characters", () => {
      expect(key({ ...GOOD, name: "" })).toBe("stadium.name_invalid");
      expect(key({ ...GOOD, name: " ​‎ " })).toBe("stadium.name_invalid");
      expect(key({ ...GOOD, name: "a".repeat(STADIUM_NAME_MAX) })).toBeNull();
      expect(key({ ...GOOD, name: "a".repeat(STADIUM_NAME_MAX + 1) })).toBe("stadium.name_invalid");
    });
  });

  describe("address", () => {
    it("is optional and at most 120 characters", () => {
      expect(key({ ...GOOD, address: "" })).toBeNull();
      expect(key({ ...GOOD, address: "a".repeat(STADIUM_ADDRESS_MAX) })).toBeNull();
      expect(key({ ...GOOD, address: "a".repeat(STADIUM_ADDRESS_MAX + 1) })).toBe("stadium.address_invalid");
    });
  });

  describe("map link", () => {
    it("is optional", () => {
      expect(key({ ...GOOD, mapLink: "" })).toBeNull();
    });

    it("accepts the allowed Google Maps forms", () => {
      for (const url of [
        "https://google.com/maps/place/x",
        "https://www.google.com/maps?q=1,2",
        "https://maps.google.com/?q=1,2",
        "https://maps.app.goo.gl/abc",
        "https://goo.gl/maps/abc",
      ]) {
        expect({ url, key: key({ ...GOOD, mapLink: url }) }).toEqual({ url, key: null });
      }
    });

    it("refuses lookalikes and other schemes", () => {
      for (const url of [
        "https://google.com.evil.com/maps/place/x",
        "https://evil.com/google.com/maps",
        "https://google.com@evil.com/maps",
        "http://google.com/maps/place/x",
        "https://example.com/maps",
        "javascript:alert(1)",
        "not a url",
      ]) {
        expect({ url, key: key({ ...GOOD, mapLink: url }) }).toEqual({ url, key: "stadium.map_invalid" });
      }
    });
  });

  describe("phones", () => {
    it("normalizes spaces, dashes, + and Arabic-Indic digits", () => {
      expect(parseStadiumInfo({ ...GOOD, phone: "+961 3-123-456" }).phone).toBe("9613123456");
      expect(parseStadiumInfo({ ...GOOD, phone: "٠٣١٢٣٤٥٦" }).phone).toBe("03123456");
    });

    it("refuses letters and symbols, and numbers that cannot be Lebanese", () => {
      for (const phone of ["03abc456", "03/123/456", "0312", "12"]) {
        expect({ phone, key: key({ ...GOOD, phone }) }).toEqual({ phone, key: "stadium.phone_invalid" });
      }
    });

    it("may be empty", () => {
      expect(key({ ...GOOD, phone: "" })).toBeNull();
    });

    it("keeps a separate WhatsApp number when 'same number' is off, and validates it", () => {
      const separate = parseStadiumInfo({ ...GOOD, whatsappSame: false, whatsapp: "71 123 456" });
      expect(separate).toMatchObject({ whatsappSame: false, whatsapp: "71123456" });
      expect(key({ ...GOOD, whatsappSame: false, whatsapp: "71x23456" })).toBe("stadium.phone_invalid");
    });

    it("drops the separate number when 'same number' is on", () => {
      expect(parseStadiumInfo({ ...GOOD, whatsappSame: true, whatsapp: "71123456" }).whatsapp).toBe("");
    });
  });

  describe("colour and unknown fields", () => {
    it("takes only a preset key", () => {
      expect(key({ ...GOOD, brandPreset: "blue" })).toBeNull();
      expect(key({ ...GOOD, brandPreset: "#ff0000" })).toBe("form.invalid");
      expect(key({ ...GOOD, brandPreset: "" })).toBe("form.invalid");
    });

    it("refuses any field it does not know, so a tenant id or slug can never ride along", () => {
      expect(key({ ...GOOD, tenantId: "other" })).toBe("form.invalid");
      expect(key({ ...GOOD, slug: "other" })).toBe("form.invalid");
    });
  });
});
