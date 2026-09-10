import { describe, expect, it } from "@jest/globals";
import { BOOKINGS_APPROVE, can } from "@/modules/access/domain/can";

describe("can", () => {
  it("lets OWNER approve without a json shopping list", () => {
    expect(can({ role: "OWNER", permissions: {} }, BOOKINGS_APPROVE)).toBe(true);
  });

  it("does not let STAFF approve by default", () => {
    expect(can({ role: "STAFF", permissions: {} }, BOOKINGS_APPROVE)).toBe(false);
    expect(
      can({ role: "STAFF", permissions: { "bookings.approve": false } }, BOOKINGS_APPROVE),
    ).toBe(false);
  });

  it("lets STAFF approve only when the flag is strictly true", () => {
    expect(
      can({ role: "STAFF", permissions: { "bookings.approve": true } }, BOOKINGS_APPROVE),
    ).toBe(true);
  });
});
