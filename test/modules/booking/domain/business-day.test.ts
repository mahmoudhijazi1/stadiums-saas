import { describe, expect, it } from "@jest/globals";
import {
  BUSINESS_DAY_ROLLOVER_HOUR,
  businessDate,
  businessDayUtcRange,
  isNightStart,
} from "@/modules/booking/domain/business-day";
import { formatCivilDate } from "@/modules/venue/domain/availability";

const day = (instant: string) => formatCivilDate(businessDate(new Date(instant)));

describe("businessDate", () => {
  it("rolls over at 06:00", () => {
    expect(BUSINESS_DAY_ROLLOVER_HOUR).toBe(6);
  });

  // Friday 11 Sep 2026, Beirut UTC+3.
  it.each([
    ["Fri 23:59", "2026-09-11T20:59:00.000Z", "2026-09-11"],
    ["Sat 00:00", "2026-09-11T21:00:00.000Z", "2026-09-11"],
    ["Sat 00:30", "2026-09-11T21:30:00.000Z", "2026-09-11"],
    ["Sat 05:59", "2026-09-12T02:59:00.000Z", "2026-09-11"],
    ["Sat 06:00", "2026-09-12T03:00:00.000Z", "2026-09-12"],
    ["Sat 06:01", "2026-09-12T03:01:00.000Z", "2026-09-12"],
  ])("normal night: %s belongs to %s", (_label, instant, expected) => {
    expect(day(instant)).toBe(expected);
  });

  // Spring forward, Sun 29 Mar 2026: 00:00 EET jumps to 01:00 EEST (00:xx never exists).
  it.each([
    ["Sat 23:30 EET", "2026-03-28T21:30:00.000Z", "2026-03-28"],
    ["Sun 01:00 EEST, first minute after the skipped hour", "2026-03-28T22:00:00.000Z", "2026-03-28"],
    ["Sun 05:59 EEST", "2026-03-29T02:59:00.000Z", "2026-03-28"],
    // "Instant minus 6h" would say 23:00 Sat here: the boundary must be 06:00 local.
    ["Sun 06:00 EEST", "2026-03-29T03:00:00.000Z", "2026-03-29"],
  ])("spring forward: %s belongs to %s", (_label, instant, expected) => {
    expect(day(instant)).toBe(expected);
  });

  // Fall back, Sun 25 Oct 2026: 00:00 EEST goes back to Sat 23:00 EET (23:xx twice).
  it.each([
    ["Sat 23:30 EEST, first time", "2026-10-24T20:30:00.000Z", "2026-10-24"],
    ["Sat 23:30 EET, repeated hour", "2026-10-24T21:30:00.000Z", "2026-10-24"],
    ["Sun 00:00 EET", "2026-10-24T22:00:00.000Z", "2026-10-24"],
    ["Sun 05:59 EET", "2026-10-25T03:59:00.000Z", "2026-10-24"],
    ["Sun 06:00 EET", "2026-10-25T04:00:00.000Z", "2026-10-25"],
  ])("fall back: %s belongs to %s", (_label, instant, expected) => {
    expect(day(instant)).toBe(expected);
  });
});

describe("businessDayUtcRange", () => {
  it("is [06:00, next 06:00) local on a normal day", () => {
    const range = businessDayUtcRange({ year: 2026, month: 9, day: 11 });
    expect(range.start.toISOString()).toBe("2026-09-11T03:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-09-12T03:00:00.000Z");
  });

  it("is 23 hours long across spring forward, still ending at 06:00 local", () => {
    const range = businessDayUtcRange({ year: 2026, month: 3, day: 28 });
    expect(range.start.toISOString()).toBe("2026-03-28T04:00:00.000Z"); // 06:00 EET
    expect(range.end.toISOString()).toBe("2026-03-29T03:00:00.000Z"); // 06:00 EEST
    expect(range.end.getTime() - range.start.getTime()).toBe(23 * 3_600_000);
  });

  it("is 25 hours long across fall back, still ending at 06:00 local", () => {
    const range = businessDayUtcRange({ year: 2026, month: 10, day: 24 });
    expect(range.start.toISOString()).toBe("2026-10-24T03:00:00.000Z"); // 06:00 EEST
    expect(range.end.toISOString()).toBe("2026-10-25T04:00:00.000Z"); // 06:00 EET
    expect(range.end.getTime() - range.start.getTime()).toBe(25 * 3_600_000);
  });

  it("agrees with businessDate at both edges", () => {
    for (const date of [
      { year: 2026, month: 9, day: 11 },
      { year: 2026, month: 3, day: 28 },
      { year: 2026, month: 10, day: 24 },
    ]) {
      const range = businessDayUtcRange(date);
      expect(businessDate(range.start)).toEqual(date);
      expect(businessDate(new Date(range.end.getTime() - 60_000))).toEqual(date);
      expect(businessDate(range.end)).not.toEqual(date);
    }
  });
});

describe("isNightStart", () => {
  it("is true from 00:00 to 05:59 local and false from 06:00", () => {
    expect(isNightStart(new Date("2026-09-11T21:30:00.000Z"))).toBe(true); // 00:30
    expect(isNightStart(new Date("2026-09-12T02:59:00.000Z"))).toBe(true); // 05:59
    expect(isNightStart(new Date("2026-09-12T03:00:00.000Z"))).toBe(false); // 06:00
    expect(isNightStart(new Date("2026-09-11T20:59:00.000Z"))).toBe(false); // 23:59
  });
});
