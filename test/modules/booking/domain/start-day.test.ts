import { describe, expect, it } from "@jest/globals";
import { civilDateInTimeZone } from "@/modules/venue/domain/availability";
import {
  bookingStartDay,
  OWNER_FUTURE_DAYS,
  resolveOwnerDay,
} from "@/modules/booking/domain/start-day";

describe("bookingStartDay", () => {
  it("keeps a game that ends after midnight on the start day", () => {
    const start = new Date("2026-09-13T20:00:00.000Z"); // 23:00 Beirut
    const end = new Date("2026-09-13T21:30:00.000Z"); // 00:30 Beirut, next day

    expect(bookingStartDay(start)).toEqual({
      year: 2026,
      month: 9,
      day: 13,
    });
    expect(civilDateInTimeZone(end, "Asia/Beirut")).toEqual({
      year: 2026,
      month: 9,
      day: 14,
    });
  });

  it("uses the Asia/Beirut spring-forward this ICU reports (2023-03-25)", () => {
    const start = new Date("2023-03-25T21:00:00.000Z"); // 23:00 +02, before the jump
    const end = new Date("2023-03-25T22:30:00.000Z"); // 01:30 +03, 26 March

    expect(bookingStartDay(start)).toEqual({
      year: 2023,
      month: 3,
      day: 25,
    });
    expect(civilDateInTimeZone(end, "Asia/Beirut")).toEqual({
      year: 2023,
      month: 3,
      day: 26,
    });
    expect(bookingStartDay(new Date("2023-03-25T22:00:00.000Z"))).toEqual({
      year: 2023,
      month: 3,
      day: 26,
    });
  });
});

describe("resolveOwnerDay", () => {
  const today = { year: 2026, month: 9, day: 24 };

  it("uses today when the param is missing or not a date", () => {
    expect(resolveOwnerDay(undefined, today)).toEqual(today);
    expect(resolveOwnerDay("09-24", today)).toEqual(today);
    expect(resolveOwnerDay("2026-02-31", today)).toEqual(today);
  });

  it("keeps a past day and a day on the future limit", () => {
    expect(resolveOwnerDay("2020-01-02", today)).toEqual({
      year: 2020,
      month: 1,
      day: 2,
    });
    expect(resolveOwnerDay("2026-11-23", today)).toEqual({
      year: 2026,
      month: 11,
      day: 23,
    });
    expect(OWNER_FUTURE_DAYS).toBe(60);
  });

  it("rejects a day past the future limit", () => {
    expect(resolveOwnerDay("2026-11-24", today)).toEqual(today);
  });
});
