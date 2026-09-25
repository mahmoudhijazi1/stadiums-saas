import { describe, expect, it } from "@jest/globals";
import {
  BOOKINGS_APPROVE,
  BOOKINGS_CANCEL,
  BOOKINGS_CREATE,
  BOOKINGS_ADJUST_DUE,
  BOOKINGS_NO_SHOW,
  EXPENSES_RECORD,
  PAYMENTS_COLLECT,
  REPORTS_VIEW,
  SETTINGS_MANAGE,
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

  it("lets OWNER record an expense without a json shopping list", () => {
    expect(can({ role: "OWNER", permissions: {} }, EXPENSES_RECORD)).toBe(true);
  });

  it("does not let STAFF record an expense by default", () => {
    expect(can({ role: "STAFF", permissions: {} }, EXPENSES_RECORD)).toBe(false);
    expect(
      can({ role: "STAFF", permissions: { "expenses.record": false } }, EXPENSES_RECORD),
    ).toBe(false);
  });

  it("lets STAFF record an expense only when the flag is strictly true", () => {
    expect(
      can({ role: "STAFF", permissions: { "expenses.record": true } }, EXPENSES_RECORD),
    ).toBe(true);
  });

  it("lets OWNER view reports without a json shopping list", () => {
    expect(can({ role: "OWNER", permissions: {} }, REPORTS_VIEW)).toBe(true);
  });

  it("does not let STAFF view reports by default", () => {
    expect(can({ role: "STAFF", permissions: {} }, REPORTS_VIEW)).toBe(false);
    expect(
      can({ role: "STAFF", permissions: { "reports.view": false } }, REPORTS_VIEW),
    ).toBe(false);
  });

  it("lets STAFF view reports only when the flag is strictly true", () => {
    expect(
      can({ role: "STAFF", permissions: { "reports.view": true } }, REPORTS_VIEW),
    ).toBe(true);
  });

  it("lets OWNER create a booking without a json shopping list", () => {
    expect(can({ role: "OWNER", permissions: {} }, BOOKINGS_CREATE)).toBe(true);
  });

  it("does not let STAFF create a booking by default", () => {
    expect(can({ role: "STAFF", permissions: {} }, BOOKINGS_CREATE)).toBe(false);
    expect(
      can({ role: "STAFF", permissions: { "bookings.create": false } }, BOOKINGS_CREATE),
    ).toBe(false);
  });

  it("lets STAFF create a booking only when the flag is strictly true", () => {
    expect(
      can({ role: "STAFF", permissions: { "bookings.create": true } }, BOOKINGS_CREATE),
    ).toBe(true);
  });

  it("does not treat bookings.approve as bookings.create", () => {
    expect(
      can({ role: "STAFF", permissions: { "bookings.approve": true } }, BOOKINGS_CREATE),
    ).toBe(false);
  });

  it("lets OWNER cancel without a json shopping list", () => {
    expect(can({ role: "OWNER", permissions: {} }, BOOKINGS_CANCEL)).toBe(true);
  });

  it("does not let STAFF cancel by default", () => {
    expect(can({ role: "STAFF", permissions: {} }, BOOKINGS_CANCEL)).toBe(false);
    expect(
      can({ role: "STAFF", permissions: { "bookings.cancel": false } }, BOOKINGS_CANCEL),
    ).toBe(false);
  });

  it("lets STAFF cancel only when the flag is strictly true", () => {
    expect(
      can({ role: "STAFF", permissions: { "bookings.cancel": true } }, BOOKINGS_CANCEL),
    ).toBe(true);
  });

  it("does not treat bookings.approve as bookings.cancel", () => {
    expect(
      can({ role: "STAFF", permissions: { "bookings.approve": true } }, BOOKINGS_CANCEL),
    ).toBe(false);
  });

  it("lets OWNER record a no-show without a json shopping list", () => {
    expect(can({ role: "OWNER", permissions: {} }, BOOKINGS_NO_SHOW)).toBe(true);
  });

  it("does not let STAFF record a no-show by default", () => {
    expect(can({ role: "STAFF", permissions: {} }, BOOKINGS_NO_SHOW)).toBe(false);
    expect(
      can({ role: "STAFF", permissions: { "bookings.no_show": false } }, BOOKINGS_NO_SHOW),
    ).toBe(false);
  });

  it("lets STAFF record a no-show only when the flag is strictly true", () => {
    expect(
      can({ role: "STAFF", permissions: { "bookings.no_show": true } }, BOOKINGS_NO_SHOW),
    ).toBe(true);
  });

  it("does not treat bookings.cancel as bookings.no_show", () => {
    expect(
      can({ role: "STAFF", permissions: { "bookings.cancel": true } }, BOOKINGS_NO_SHOW),
    ).toBe(false);
  });

  it("lets OWNER adjust a due without a json flag", () => {
    expect(can({ role: "OWNER", permissions: {} }, BOOKINGS_ADJUST_DUE)).toBe(true);
  });

  it("does not let STAFF adjust a due by default", () => {
    expect(can({ role: "STAFF", permissions: {} }, BOOKINGS_ADJUST_DUE)).toBe(false);
    expect(
      can(
        { role: "STAFF", permissions: { "bookings.cancel": true, "bookings.no_show": true } },
        BOOKINGS_ADJUST_DUE,
      ),
    ).toBe(false);
  });

  it("lets OWNER manage settings without a json flag", () => {
    expect(can({ role: "OWNER", permissions: {} }, SETTINGS_MANAGE)).toBe(true);
  });

  it("lets STAFF manage settings only when the flag is strictly true", () => {
    expect(can({ role: "STAFF", permissions: {} }, SETTINGS_MANAGE)).toBe(false);
    expect(
      can({ role: "STAFF", permissions: { "settings.manage": true } }, SETTINGS_MANAGE),
    ).toBe(true);
  });
});

