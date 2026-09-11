import { describe, expect, it } from "@jest/globals";
import { occurredAtFromCivilDate } from "@/modules/expense/domain/occurred-at";

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

describe("occurredAtFromCivilDate", () => {
  it("puts a Beirut summer date at noon on that civil day", () => {
    const instant = occurredAtFromCivilDate("2026-07-15", BEIRUT);
    expect(wallInZone(instant, BEIRUT)).toEqual({
      year: 2026,
      month: 7,
      day: 15,
      hour: 12,
      minute: 0,
    });
  });

  it("puts a Beirut winter date at noon on that civil day", () => {
    const instant = occurredAtFromCivilDate("2026-01-15", BEIRUT);
    expect(wallInZone(instant, BEIRUT)).toEqual({
      year: 2026,
      month: 1,
      day: 15,
      hour: 12,
      minute: 0,
    });
  });

  it("uses DST so summer and winter noon are different UTC instants", () => {
    const summer = occurredAtFromCivilDate("2026-07-15", BEIRUT);
    const winter = occurredAtFromCivilDate("2026-01-15", BEIRUT);
    expect(summer.getUTCHours()).not.toBe(winter.getUTCHours());
  });

  it("rejects a malformed or impossible calendar day", () => {
    expect(() => occurredAtFromCivilDate("30", BEIRUT)).toThrow();
    expect(() => occurredAtFromCivilDate("2026-02-31", BEIRUT)).toThrow();
    expect(() => occurredAtFromCivilDate("2026-13-01", BEIRUT)).toThrow();
  });
});
