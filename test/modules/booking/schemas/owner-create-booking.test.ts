import { describe, expect, it } from "@jest/globals";
import { parseOwnerCreateBooking } from "@/modules/booking/schemas/owner-create-booking";

const valid = {
  name: "Karim",
  phone: "03 123 456",
  pitchId: "pitch_a1",
  start: "2026-09-11T13:00:00.000Z",
  end: "2026-09-11T14:00:00.000Z",
};

describe("parseOwnerCreateBooking", () => {
  it("accepts a valid form and stores the phone canonical", () => {
    expect(parseOwnerCreateBooking(valid)).toEqual({
      ...valid,
      phone: "9613123456",
    });
  });

  it("accepts every Lebanese format as one canonical number", () => {
    for (const phone of ["71123456", "71 123 456", "+961 71 123 456", "0096171123456", "96171123456"]) {
      expect({ phone, got: parseOwnerCreateBooking({ ...valid, phone }).phone }).toEqual({ phone, got: "96171123456" });
    }
  });

  it("refuses a Syrian local number without a country and accepts it with 963", () => {
    expect(() => parseOwnerCreateBooking({ ...valid, phone: "0933123456" })).toThrow();
    expect(parseOwnerCreateBooking({ ...valid, phone: "0933123456", country: "963" }).phone).toBe("963933123456");
  });

  it("refuses letters and an unknown country", () => {
    expect(() => parseOwnerCreateBooking({ ...valid, phone: "71abc456" })).toThrow();
    expect(() => parseOwnerCreateBooking({ ...valid, country: "999" })).toThrow();
  });

  it("rejects a missing pitchId", () => {
    const { pitchId: _ignored, ...withoutPitch } = valid;
    expect(() => parseOwnerCreateBooking(withoutPitch)).toThrow();
  });

  it("rejects a phone that is not 8–15 digits after normalize", () => {
    expect(() => parseOwnerCreateBooking({ ...valid, phone: "12" })).toThrow();
    expect(() => parseOwnerCreateBooking({ ...valid, phone: "abc" })).toThrow();
  });

  it("rejects a price field and other extra keys", () => {
    expect(() =>
      parseOwnerCreateBooking({ ...valid, priceUsd: "30.00" }),
    ).toThrow();
    expect(() =>
      parseOwnerCreateBooking({ ...valid, tenant: "ahmad" }),
    ).toThrow();
  });
});
