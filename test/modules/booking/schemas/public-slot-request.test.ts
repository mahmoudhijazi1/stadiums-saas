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
  it("accepts a valid form and stores phone as digits only", () => {
    expect(parsePublicSlotRequest(valid)).toEqual({
      ...valid,
      phone: "03123456",
    });
  });

  it("rejects a missing name", () => {
    const { name: _ignored, ...withoutName } = valid;
    expect(() => parsePublicSlotRequest(withoutName)).toThrow();
  });

  it("rejects a phone that is not 8–15 digits after normalize", () => {
    expect(() => parsePublicSlotRequest({ ...valid, phone: "12" })).toThrow();
    expect(() => parsePublicSlotRequest({ ...valid, phone: "abc" })).toThrow();
  });

  it("rejects an extra field", () => {
    expect(() =>
      parsePublicSlotRequest({ ...valid, priceUsd: "1.00" }),
    ).toThrow();
  });
});
