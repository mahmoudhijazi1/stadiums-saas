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
  it("accepts a valid form and stores phone as digits only", () => {
    expect(parseOwnerCreateBooking(valid)).toEqual({
      ...valid,
      phone: "03123456",
    });
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
