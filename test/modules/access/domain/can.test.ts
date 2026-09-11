import { describe, expect, it } from "@jest/globals";
import {
  BOOKINGS_APPROVE,
  PAYMENTS_COLLECT,
  can,
} from "@/modules/access/domain/can";

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

  it("lets OWNER collect without a json shopping list", () => {
    expect(can({ role: "OWNER", permissions: {} }, PAYMENTS_COLLECT)).toBe(true);
  });

  it("does not let STAFF collect by default", () => {
    expect(can({ role: "STAFF", permissions: {} }, PAYMENTS_COLLECT)).toBe(false);
    expect(
      can({ role: "STAFF", permissions: { "payments.collect": false } }, PAYMENTS_COLLECT),
    ).toBe(false);
  });

  it("lets STAFF collect only when the flag is strictly true", () => {
    expect(
      can({ role: "STAFF", permissions: { "payments.collect": true } }, PAYMENTS_COLLECT),
    ).toBe(true);
  });
});


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
