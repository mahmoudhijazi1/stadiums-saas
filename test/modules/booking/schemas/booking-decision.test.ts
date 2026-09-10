import { describe, expect, it } from "@jest/globals";
import { parseBookingDecision } from "@/modules/booking/schemas/booking-decision";

describe("parseBookingDecision", () => {
  it("accepts a non-empty bookingId", () => {
    expect(parseBookingDecision({ bookingId: "bk_1" })).toEqual({
      bookingId: "bk_1",
    });
  });

  it("rejects a missing bookingId", () => {
    expect(() => parseBookingDecision({})).toThrow();
  });

  it("rejects a blank bookingId", () => {
    expect(() => parseBookingDecision({ bookingId: "  " })).toThrow();
  });

  it("rejects an extra field", () => {
    expect(() =>
      parseBookingDecision({ bookingId: "bk_1", tenantId: "ahmad" }),
    ).toThrow();
  });
});
