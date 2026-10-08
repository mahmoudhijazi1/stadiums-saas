import { describe, expect, it } from "@jest/globals";
import {
  addCivilDays,
  civilRangeLength,
  isCalendarMonth,
  periodBoundsFromCivilRange,
  previousRange,
  rangeForPeriod,
} from "@/modules/ledger/domain/period";

const TZ = "Asia/Beirut";
const at = (iso: string) => new Date(iso);

describe("rangeForPeriod", () => {
  it.each([
    ["today", "2026-10-15T09:00:00Z", { from: "2026-10-15", to: "2026-10-15" }],
    ["month", "2026-10-15T09:00:00Z", { from: "2026-10-01", to: "2026-10-31" }],
    ["last", "2026-10-15T09:00:00Z", { from: "2026-09-01", to: "2026-09-30" }],
    ["last", "2026-01-10T09:00:00Z", { from: "2025-12-01", to: "2025-12-31" }],
    ["month", "2026-02-10T09:00:00Z", { from: "2026-02-01", to: "2026-02-28" }],
    ["month", "2028-02-10T09:00:00Z", { from: "2028-02-01", to: "2028-02-29" }],
    // Saturday 12 Sep 2026: the week is Monday 7 to Sunday 13.
    ["week", "2026-09-12T09:00:00Z", { from: "2026-09-07", to: "2026-09-13" }],
    // Monday itself, and Sunday itself.
    ["week", "2026-09-07T09:00:00Z", { from: "2026-09-07", to: "2026-09-13" }],
    ["week", "2026-09-13T09:00:00Z", { from: "2026-09-07", to: "2026-09-13" }],
  ] as const)("%s at %s", (kind, now, expected) => {
    expect(rangeForPeriod(kind, at(now), TZ)).toEqual(expected);
  });

  it("uses the calendar day in Beirut, not in UTC", () => {
    // 00:30 on 1 October in Beirut is still 30 September in UTC.
    const now = at("2026-09-30T21:30:00Z");
    expect(rangeForPeriod("today", now, TZ)).toEqual({ from: "2026-10-01", to: "2026-10-01" });
    expect(rangeForPeriod("month", now, TZ)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  });
});

describe("period bounds at month edges and on DST days", () => {
  it("a month starts and ends at local midnight, whatever the offset", () => {
    const october = periodBoundsFromCivilRange("2026-10-01", "2026-10-31", TZ);
    expect(october.startInclusive.toISOString()).toBe("2026-09-30T21:00:00.000Z"); // 00:00 EEST
    expect(october.endExclusive.toISOString()).toBe("2026-10-31T22:00:00.000Z"); // 00:00 EET, clocks went back on the 25th
  });

  it("the spring-forward day (29 Mar) is 23 hours, the day the clocks go back (24 Oct, they change at midnight) is 25", () => {
    const spring = periodBoundsFromCivilRange("2026-03-29", "2026-03-29", TZ);
    expect(spring.endExclusive.getTime() - spring.startInclusive.getTime()).toBe(23 * 3_600_000);
    const fall = periodBoundsFromCivilRange("2026-10-24", "2026-10-24", TZ);
    expect(fall.endExclusive.getTime() - fall.startInclusive.getTime()).toBe(25 * 3_600_000);
  });

  it("two neighbouring periods share their boundary exactly", () => {
    const a = periodBoundsFromCivilRange("2026-03-01", "2026-03-31", TZ);
    const b = periodBoundsFromCivilRange("2026-04-01", "2026-04-30", TZ);
    expect(a.endExclusive.getTime()).toBe(b.startInclusive.getTime());
  });
});

describe("previousRange", () => {
  it.each([
    [{ from: "2026-10-01", to: "2026-10-31" }, { from: "2026-09-01", to: "2026-09-30" }],
    [{ from: "2026-03-01", to: "2026-03-31" }, { from: "2026-02-01", to: "2026-02-28" }],
    [{ from: "2026-01-01", to: "2026-01-31" }, { from: "2025-12-01", to: "2025-12-31" }],
    // Not a calendar month: the same number of days straight before.
    [{ from: "2026-09-07", to: "2026-09-13" }, { from: "2026-08-31", to: "2026-09-06" }],
    [{ from: "2026-10-15", to: "2026-10-15" }, { from: "2026-10-14", to: "2026-10-14" }],
    [{ from: "2026-10-05", to: "2026-10-20" }, { from: "2026-09-19", to: "2026-10-04" }],
  ])("%j -> %j", (range, expected) => {
    expect(previousRange(range)).toEqual(expected);
  });

  it("helpers", () => {
    expect(isCalendarMonth({ from: "2026-02-01", to: "2026-02-28" })).toBe(true);
    expect(isCalendarMonth({ from: "2026-02-01", to: "2026-02-27" })).toBe(false);
    expect(civilRangeLength({ from: "2026-10-01", to: "2026-10-31" })).toBe(31);
    expect(addCivilDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addCivilDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});
