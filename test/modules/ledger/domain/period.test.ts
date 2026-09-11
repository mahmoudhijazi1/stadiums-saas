import { describe, expect, it } from "@jest/globals";
import {
  currentMonthCivilRange,
  periodBoundsFromCivilRange,
} from "@/modules/ledger/domain/period";

const BEIRUT = "Asia/Beirut";

function wallInZone(instant: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(instant)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) === 24 ? 0 : Number(map.hour),
    minute: Number(map.minute),
  };
}

describe("periodBoundsFromCivilRange", () => {
  it("puts a Beirut summer month at midnight on from through the day after to", () => {
    const { startInclusive, endExclusive } = periodBoundsFromCivilRange(
      "2026-07-01",
      "2026-07-31",
      BEIRUT,
    );
    expect(wallInZone(startInclusive, BEIRUT)).toEqual({
      year: 2026,
      month: 7,
      day: 1,
      hour: 0,
      minute: 0,
    });
    expect(wallInZone(endExclusive, BEIRUT)).toEqual({
      year: 2026,
      month: 8,
      day: 1,
      hour: 0,
      minute: 0,
    });
  });

  it("puts a Beirut winter single day at midnight through the next civil day", () => {
    const { startInclusive, endExclusive } = periodBoundsFromCivilRange(
      "2026-01-15",
      "2026-01-15",
      BEIRUT,
    );
    expect(wallInZone(startInclusive, BEIRUT)).toEqual({
      year: 2026,
      month: 1,
      day: 15,
      hour: 0,
      minute: 0,
    });
    expect(wallInZone(endExclusive, BEIRUT)).toEqual({
      year: 2026,
      month: 1,
      day: 16,
      hour: 0,
      minute: 0,
    });
  });

  it("uses DST so summer and winter midnights are different UTC hours", () => {
    const summer = periodBoundsFromCivilRange("2026-07-15", "2026-07-15", BEIRUT);
    const winter = periodBoundsFromCivilRange("2026-01-15", "2026-01-15", BEIRUT);
    expect(summer.startInclusive.getUTCHours()).not.toBe(
      winter.startInclusive.getUTCHours(),
    );
  });

  it("rejects a malformed or impossible calendar day", () => {
    expect(() => periodBoundsFromCivilRange("30", "2026-07-01", BEIRUT)).toThrow();
    expect(() =>
      periodBoundsFromCivilRange("2026-02-31", "2026-03-01", BEIRUT),
    ).toThrow();
  });

  it("rejects from after to", () => {
    expect(() =>
      periodBoundsFromCivilRange("2026-07-31", "2026-07-01", BEIRUT),
    ).toThrow();
  });
});

describe("currentMonthCivilRange", () => {
  it("returns July 2026 for a Beirut summer instant in that month", () => {
    expect(
      currentMonthCivilRange(new Date("2026-07-15T12:00:00+03:00"), BEIRUT),
    ).toEqual({ from: "2026-07-01", to: "2026-07-31" });
  });

  it("returns January 2026 for a Beirut winter instant in that month", () => {
    expect(
      currentMonthCivilRange(new Date("2026-01-15T12:00:00+02:00"), BEIRUT),
    ).toEqual({ from: "2026-01-01", to: "2026-01-31" });
  });
});
