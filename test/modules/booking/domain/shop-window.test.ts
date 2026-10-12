import { describe, expect, it } from "@jest/globals";
import { ITEMS_OPEN_MINUTES_BEFORE_START, mayAddItemsToBooking } from "@/modules/booking/domain/shop-window";

/** Written, not run. Items open 60 minutes before the start of a confirmed game. */
const START = new Date("2026-10-20T17:00:00.000Z");
const minutesBefore = (minutes: number) => new Date(START.getTime() - minutes * 60_000);

describe("mayAddItemsToBooking", () => {
  it("opens 60 minutes before the start", () => {
    expect(ITEMS_OPEN_MINUTES_BEFORE_START).toBe(60);
    expect(mayAddItemsToBooking({ status: "APPROVED", start: START, now: minutesBefore(61) })).toBe(false);
    expect(mayAddItemsToBooking({ status: "APPROVED", start: START, now: minutesBefore(60) })).toBe(true);
    expect(mayAddItemsToBooking({ status: "APPROVED", start: START, now: minutesBefore(59) })).toBe(true);
  });

  it("stays open at the start, during and after the game", () => {
    for (const offset of [0, 30, 90, 24 * 60]) {
      expect(mayAddItemsToBooking({ status: "APPROVED", start: START, now: new Date(START.getTime() + offset * 60_000) })).toBe(true);
    }
  });

  it("is never open for a booking that is not APPROVED, at any time", () => {
    for (const status of ["PENDING", "CANCELLED", "NO_SHOW", "REJECTED"]) {
      for (const now of [minutesBefore(120), minutesBefore(30), START, new Date(START.getTime() + 3_600_000)]) {
        expect({ status, open: mayAddItemsToBooking({ status, start: START, now }) }).toEqual({ status, open: false });
      }
    }
  });
});
