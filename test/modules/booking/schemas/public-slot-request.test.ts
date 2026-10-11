import { describe, expect, it } from "@jest/globals";
import { parsePublicSlotRequest } from "@/modules/booking/schemas/public-slot-request";

const valid = {
  name: "Ali",
  phone: "03 123 456",
  pitchId: "pitch_a1",
  start: "2026-09-09T13:00:00.000Z",
  end: "2026-09-09T14:00:00.000Z",
};

describe("parsePublicSlotRequest", () => {
  it("accepts a valid form and stores the phone canonical", () => {
    expect(parsePublicSlotRequest(valid)).toEqual({
      ...valid,
      phone: "9613123456",
    });
  });

  it("accepts every Lebanese format as one canonical number", () => {
    for (const phone of ["71123456", "71 123 456", "+961 71 123 456", "0096171123456", "96171123456"]) {
      expect({ phone, got: parsePublicSlotRequest({ ...valid, phone }).phone }).toEqual({ phone, got: "96171123456" });
    }
  });

  it("refuses a Syrian local number without a country and accepts it with 963", () => {
    expect(() => parsePublicSlotRequest({ ...valid, phone: "0933123456" })).toThrow();
    expect(parsePublicSlotRequest({ ...valid, phone: "0933123456", country: "963" }).phone).toBe("963933123456");
  });

  it("refuses an unknown country and never returns the country field", () => {
    expect(() => parsePublicSlotRequest({ ...valid, country: "999" })).toThrow();
    expect("country" in parsePublicSlotRequest({ ...valid, country: "961" })).toBe(false);
  });

  it("rejects a missing name", () => {
    const { name: _ignored, ...withoutName } = valid;
    expect(() => parsePublicSlotRequest(withoutName)).toThrow();
  });

  it("rejects a phone that is not 8–15 digits after normalize", () => {
    expect(() => parsePublicSlotRequest({ ...valid, phone: "12" })).toThrow();
    expect(() => parsePublicSlotRequest({ ...valid, phone: "71abc456" })).toThrow();
    expect(() => parsePublicSlotRequest({ ...valid, phone: "abc" })).toThrow();
  });

  it("rejects an extra field", () => {
    expect(() =>
      parsePublicSlotRequest({ ...valid, priceUsd: "1.00" }),
    ).toThrow();
  });

  it("cleans the name and allows at most 60 characters after cleaning", () => {
    expect(parsePublicSlotRequest({ ...valid, name: " Ali\u202E  Hassan " }).name).toBe("Ali Hassan");
    expect(parsePublicSlotRequest({ ...valid, name: "a".repeat(60) }).name).toHaveLength(60);
    expect(() => parsePublicSlotRequest({ ...valid, name: "a".repeat(61) })).toThrow();
    // 60 visible characters padded with invisibles still passes.
    expect(parsePublicSlotRequest({ ...valid, name: `${"a".repeat(60)}\u200B\u200B` }).name).toHaveLength(60);
  });

  it("rejects a name that is only invisible characters", () => {
    expect(() => parsePublicSlotRequest({ ...valid, name: "\u200B\u202E" })).toThrow();
  });

  it("normalizes the phone with the shared normalizer", () => {
    expect(parsePublicSlotRequest({ ...valid, phone: "+961 3-123-456" }).phone).toBe("9613123456");
    expect(() => parsePublicSlotRequest({ ...valid, phone: "phone" })).toThrow();
  });
});

