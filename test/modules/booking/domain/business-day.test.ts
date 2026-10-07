import { describe, expect, it } from "@jest/globals";
import {
  BUSINESS_DAY_ROLLOVER_HOUR,
  businessDate,
  businessDayUtcRange,
  isNightStart,
  startHoursInsideWindows,
} from "@/modules/booking/domain/business-day";
import { formatCivilDate } from "@/modules/venue/domain/availability";

const day = (instant: string, hour: number) =>
  formatCivilDate(businessDate(new Date(instant), hour));

describe("businessDate", () => {
  it("defaults to a 06:00 day start for tenants that never set one", () => {
    expect(BUSINESS_DAY_ROLLOVER_HOUR).toBe(6);
  });

  // Friday 11 Sep 2026, Beirut UTC+3. Columns: label, instant, then the date for hours 0, 3, 6.
  it.each([
    ["Fri 23:59", "2026-09-11T20:59:00.000Z", "2026-09-11", "2026-09-11", "2026-09-11"],
    ["Sat 00:00", "2026-09-11T21:00:00.000Z", "2026-09-12", "2026-09-11", "2026-09-11"],
    ["Sat 00:30", "2026-09-11T21:30:00.000Z", "2026-09-12", "2026-09-11", "2026-09-11"],
    ["Sat 02:59", "2026-09-11T23:59:00.000Z", "2026-09-12", "2026-09-11", "2026-09-11"],
    ["Sat 03:00", "2026-09-12T00:00:00.000Z", "2026-09-12", "2026-09-12", "2026-09-11"],
    ["Sat 05:59", "2026-09-12T02:59:00.000Z", "2026-09-12", "2026-09-12", "2026-09-11"],
    ["Sat 06:00", "2026-09-12T03:00:00.000Z", "2026-09-12", "2026-09-12", "2026-09-12"],
  ])("normal night: %s", (_label, instant, h0, h3, h6) => {
    expect(day(instant, 0)).toBe(h0);
    expect(day(instant, 3)).toBe(h3);
    expect(day(instant, 6)).toBe(h6);
  });

  // Spring forward, Sun 29 Mar 2026: 00:00 EET jumps to 01:00 EEST (00:xx never exists).
  it.each([
    ["Sat 23:59 EET", "2026-03-28T21:59:00.000Z", "2026-03-28", "2026-03-28", "2026-03-28"],
    ["Sun 01:00 EEST, first minute after the skipped hour", "2026-03-28T22:00:00.000Z", "2026-03-29", "2026-03-28", "2026-03-28"],
    ["Sun 02:59 EEST", "2026-03-28T23:59:00.000Z", "2026-03-29", "2026-03-28", "2026-03-28"],
    ["Sun 03:00 EEST", "2026-03-29T00:00:00.000Z", "2026-03-29", "2026-03-29", "2026-03-28"],
    ["Sun 05:59 EEST", "2026-03-29T02:59:00.000Z", "2026-03-29", "2026-03-29", "2026-03-28"],
    // "Instant minus 6h" would say 23:00 Sat here: the boundary must be 06:00 local.
    ["Sun 06:00 EEST", "2026-03-29T03:00:00.000Z", "2026-03-29", "2026-03-29", "2026-03-29"],
  ])("spring forward: %s", (_label, instant, h0, h3, h6) => {
    expect(day(instant, 0)).toBe(h0);
    expect(day(instant, 3)).toBe(h3);
    expect(day(instant, 6)).toBe(h6);
  });

  // Fall back, Sun 25 Oct 2026: 00:00 EEST goes back to Sat 23:00 EET (23:xx twice).
  it.each([
    ["Sat 23:30 EEST, first time", "2026-10-24T20:30:00.000Z", "2026-10-24", "2026-10-24", "2026-10-24"],
    ["Sat 23:30 EET, repeated hour", "2026-10-24T21:30:00.000Z", "2026-10-24", "2026-10-24", "2026-10-24"],
    ["Sun 00:00 EET", "2026-10-24T22:00:00.000Z", "2026-10-25", "2026-10-24", "2026-10-24"],
    ["Sun 02:59 EET", "2026-10-25T00:59:00.000Z", "2026-10-25", "2026-10-24", "2026-10-24"],
    ["Sun 03:00 EET", "2026-10-25T01:00:00.000Z", "2026-10-25", "2026-10-25", "2026-10-24"],
    ["Sun 05:59 EET", "2026-10-25T03:59:00.000Z", "2026-10-25", "2026-10-25", "2026-10-24"],
    ["Sun 06:00 EET", "2026-10-25T04:00:00.000Z", "2026-10-25", "2026-10-25", "2026-10-25"],
  ])("fall back: %s", (_label, instant, h0, h3, h6) => {
    expect(day(instant, 0)).toBe(h0);
    expect(day(instant, 3)).toBe(h3);
    expect(day(instant, 6)).toBe(h6);
  });
});

describe("businessDayUtcRange", () => {
  it.each([
    [0, "2026-09-10T21:00:00.000Z", "2026-09-11T21:00:00.000Z"],
    [3, "2026-09-11T00:00:00.000Z", "2026-09-12T00:00:00.000Z"],
    [6, "2026-09-11T03:00:00.000Z", "2026-09-12T03:00:00.000Z"],
  ])("hour %i is [D at hour, D+1 at hour) local on a normal day", (hour, start, end) => {
    const range = businessDayUtcRange({ year: 2026, month: 9, day: 11 }, hour);
    expect(range.start.toISOString()).toBe(start);
    expect(range.end.toISOString()).toBe(end);
  });

  it("is 23 hours long across spring forward, still ending at the local day start", () => {
    const six = businessDayUtcRange({ year: 2026, month: 3, day: 28 }, 6);
    expect(six.start.toISOString()).toBe("2026-03-28T04:00:00.000Z"); // 06:00 EET
    expect(six.end.toISOString()).toBe("2026-03-29T03:00:00.000Z"); // 06:00 EEST
    expect(six.end.getTime() - six.start.getTime()).toBe(23 * 3_600_000);
    const three = businessDayUtcRange({ year: 2026, month: 3, day: 28 }, 3);
    expect(three.start.toISOString()).toBe("2026-03-28T01:00:00.000Z"); // 03:00 EET
    expect(three.end.toISOString()).toBe("2026-03-29T00:00:00.000Z"); // 03:00 EEST
  });

  it("is 25 hours long across fall back, still ending at the local day start", () => {
    const six = businessDayUtcRange({ year: 2026, month: 10, day: 24 }, 6);
    expect(six.start.toISOString()).toBe("2026-10-24T03:00:00.000Z"); // 06:00 EEST
    expect(six.end.toISOString()).toBe("2026-10-25T04:00:00.000Z"); // 06:00 EET
    expect(six.end.getTime() - six.start.getTime()).toBe(25 * 3_600_000);
    const three = businessDayUtcRange({ year: 2026, month: 10, day: 24 }, 3);
    expect(three.start.toISOString()).toBe("2026-10-24T00:00:00.000Z"); // 03:00 EEST
    expect(three.end.toISOString()).toBe("2026-10-25T01:00:00.000Z"); // 03:00 EET
  });

  it("agrees with businessDate at both edges", () => {
    const dates = [
      { year: 2026, month: 9, day: 11 },
      { year: 2026, month: 10, day: 24 },
    ];
    for (const hour of [0, 3, 6]) {
      const list = hour === 0 ? dates : [...dates, { year: 2026, month: 3, day: 28 }];
      for (const date of list) {
        const range = businessDayUtcRange(date, hour);
        expect(businessDate(range.start, hour)).toEqual(date);
        expect(businessDate(new Date(range.end.getTime() - 60_000), hour)).toEqual(date);
        expect(businessDate(range.end, hour)).not.toEqual(date);
      }
    }
  });
});

describe("isNightStart", () => {
  it("is true from midnight to the day start and false from it", () => {
    const at0030 = new Date("2026-09-11T21:30:00.000Z");
    const at0559 = new Date("2026-09-12T02:59:00.000Z");
    const at0600 = new Date("2026-09-12T03:00:00.000Z");
    const at2359 = new Date("2026-09-11T20:59:00.000Z");
    expect(isNightStart(at0030, 6)).toBe(true);
    expect(isNightStart(at0559, 6)).toBe(true);
    expect(isNightStart(at0600, 6)).toBe(false);
    expect(isNightStart(at2359, 6)).toBe(false);
    expect(isNightStart(at0030, 0)).toBe(false);
    expect(isNightStart(at0030, 3)).toBe(true);
    expect(isNightStart(at0559, 3)).toBe(false);
  });
});

describe("startHoursInsideWindows", () => {
  it("lists the start hours that fall strictly inside an opening window", () => {
    expect(startHoursInsideWindows([{ open: "18:00", close: "02:00" }])).toEqual([0, 1]);
    expect(startHoursInsideWindows([{ open: "18:00", close: "23:00" }])).toEqual([]);
    expect(startHoursInsideWindows([{ open: "02:00", close: "10:00" }])).toEqual([3, 4, 5, 6]);
    expect(startHoursInsideWindows([{ open: "16:00", close: "06:00" }])).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
