import Decimal from "decimal.js";
import { describe, expect, it } from "@jest/globals";
import {
  anchorFromInstant,
  bookableCount,
  buildSeriesPreview,
  classifyOccurrence,
  declineTotal,
  isSeriesCount,
  occurrenceIndex,
  occurrencePrice,
  seriesOccurrences,
  seriesWeekdayAndTime,
} from "@/modules/booking/domain/series";
import { CLOSED_WEEK_SCHEDULE, parseScheduleConfig, type Weekday } from "@/modules/venue/schemas/schedule-config";

/**
 * Written, not run when authored. Beirut is UTC+3 in summer and UTC+2 in winter; the clocks go
 * back on Sunday 2026-10-25 at 00:00 local (Saturday 23:00 repeats). 2026-10-13 is a Tuesday.
 */
const TZ = "Asia/Beirut";
const DAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function config(hours: Partial<Record<Weekday, { start: string; end: string }[]>>, rules: object[] = []) {
  const full = { ...CLOSED_WEEK_SCHEDULE.hours } as Record<Weekday, { start: string; end: string }[]>;
  for (const day of DAYS) full[day] = hours[day] ?? [];
  return parseScheduleConfig({
    slotDurationMinutes: 60,
    gapMinutes: 0,
    hours: full,
    defaultPriceUsd: "30.00",
    priceRules: rules,
  });
}

const evenings = config(Object.fromEntries(DAYS.map((day) => [day, [{ start: "16:00", end: "22:00" }]])));
const at = (iso: string) => new Date(`${iso}Z`);
const iso = (dates: Date[]) => dates.map((d) => d.toISOString().slice(0, 16) + "Z");

describe("seriesOccurrences", () => {
  it("keeps the local time across the October clock change", () => {
    // Tue 2026-10-13 20:00 local = 17:00Z (UTC+3). After the change it is UTC+2: 18:00Z.
    const anchor = anchorFromInstant(at("2026-10-13T17:00:00"), TZ);
    expect(anchor).toEqual({ date: { year: 2026, month: 10, day: 13 }, hour: 20, minute: 0 });
    expect(iso(seriesOccurrences(anchor, 4, TZ))).toEqual([
      "2026-10-13T17:00Z", // Oct 13, +03:00
      "2026-10-20T17:00Z", // Oct 20, +03:00
      "2026-10-27T18:00Z", // Oct 27, +02:00: same 20:00 local, the UTC hour moved
      "2026-11-03T18:00Z",
    ]);
  });

  it("keeps a 00:30 game on the same night, after midnight, across the change", () => {
    // Wed 2026-10-14 00:30 local (the Tuesday night game) = Tue 21:30Z.
    const anchor = anchorFromInstant(at("2026-10-13T21:30:00"), TZ);
    expect(anchor).toEqual({ date: { year: 2026, month: 10, day: 14 }, hour: 0, minute: 30 });
    expect(iso(seriesOccurrences(anchor, 3, TZ))).toEqual([
      "2026-10-13T21:30Z",
      "2026-10-20T21:30Z",
      "2026-10-27T22:30Z", // Wed Oct 28 00:30 local at +02:00
    ]);
  });

  it("starts the numbering at firstIndex (renew and make-weekly)", () => {
    const anchor = anchorFromInstant(at("2026-10-13T17:00:00"), TZ);
    expect(iso(seriesOccurrences(anchor, 2, TZ, 1))).toEqual(["2026-10-20T17:00Z", "2026-10-27T18:00Z"]);
    expect(iso(seriesOccurrences(anchor, 2, TZ, 5))).toEqual(["2026-11-17T18:00Z", "2026-11-24T18:00Z"]);
  });

  it("returns the right number for 4, 8 and 12 weeks, one per seven days", () => {
    const anchor = anchorFromInstant(at("2026-07-14T17:00:00"), TZ);
    for (const count of [4, 8, 12]) {
      const starts = seriesOccurrences(anchor, count, TZ);
      expect(starts).toHaveLength(count);
      // Summer to summer: no clock change, exactly 7 days apart.
      if (count === 4) {
        for (let i = 1; i < starts.length; i += 1) {
          expect(starts[i]!.getTime() - starts[i - 1]!.getTime()).toBe(7 * 86_400_000);
        }
      }
    }
  });

  it("only 4, 8 and 12 are series counts", () => {
    expect([4, 8, 12].every(isSeriesCount)).toBe(true);
    expect([0, 1, 3, 6, 7, 10, 13, 52].some(isSeriesCount)).toBe(false);
  });
});

describe("occurrenceIndex", () => {
  it("is the number of weeks since the anchor, also over the clock change", () => {
    const anchor = anchorFromInstant(at("2026-10-13T17:00:00"), TZ);
    expect(occurrenceIndex(anchor, at("2026-10-13T17:00:00"), TZ)).toBe(0);
    expect(occurrenceIndex(anchor, at("2026-10-20T17:00:00"), TZ)).toBe(1);
    expect(occurrenceIndex(anchor, at("2026-10-27T18:00:00"), TZ)).toBe(2);
    expect(occurrenceIndex(anchor, at("2026-12-01T18:00:00"), TZ)).toBe(7);
  });

  it("agrees with seriesOccurrences for a 00:30 anchor", () => {
    const anchor = anchorFromInstant(at("2026-10-13T21:30:00"), TZ);
    seriesOccurrences(anchor, 8, TZ).forEach((start, index) => {
      expect(occurrenceIndex(anchor, start, TZ)).toBe(index);
    });
  });
});

describe("occurrencePrice", () => {
  it("is the grid slot's price at that time, scaled to the series length", () => {
    const priced = config(
      Object.fromEntries(DAYS.map((day) => [day, [{ start: "16:00", end: "22:00" }]])),
      [{ days: DAYS, start: "20:00", end: "22:00", priceUsd: "40.00" }],
    );
    expect(occurrencePrice(priced, at("2026-10-13T13:00:00"), 60, TZ)?.toFixed(2)).toBe("30.00"); // 16:00
    expect(occurrencePrice(priced, at("2026-10-13T17:00:00"), 60, TZ)?.toFixed(2)).toBe("40.00"); // 20:00
    expect(occurrencePrice(priced, at("2026-10-13T17:00:00"), 90, TZ)?.toFixed(2)).toBe("60.00"); // 1.5 slots
    expect(occurrencePrice(priced, at("2026-10-13T13:00:00"), 45, TZ)?.toFixed(2)).toBe("22.50");
  });

  it("is null when no slot starts at that time (the hours changed)", () => {
    expect(occurrencePrice(evenings, at("2026-10-13T05:00:00"), 60, TZ)).toBeNull(); // 08:00
    expect(occurrencePrice(evenings, at("2026-10-13T13:30:00"), 60, TZ)).toBeNull(); // 16:30
  });

  it("prices a 00:30 game from the window it belongs to", () => {
    const late = config({ tue: [{ start: "22:00", end: "02:00" }] }, [
      { days: ["tue"], priceUsd: "50.00" },
    ]);
    // Wed 00:30 local is Tuesday's window (22:00-02:00) only when the grid has a 00:30 slot: 60-minute
    // slots start 22:00, 23:00, 00:00, 01:00, so 00:30 has none.
    expect(occurrencePrice(late, at("2026-10-13T21:30:00"), 60, TZ)).toBeNull();
    // 00:00 local Wednesday = Tuesday 21:00Z, in Tuesday's window: Tuesday's $50 rule.
    expect(occurrencePrice(late, at("2026-10-13T21:00:00"), 60, TZ)?.toFixed(2)).toBe("50.00");
  });
});

describe("classifyOccurrence and buildSeriesPreview", () => {
  const now = at("2026-10-01T10:00:00");
  const base = { durationMinutes: 60, config: evenings, approved: [], pending: [], now, timeZone: TZ };

  it("a free week carries its price and no pending count", () => {
    const week = classifyOccurrence({ ...base, index: 1, start: at("2026-10-13T17:00:00") });
    expect(week).toMatchObject({ state: "free", index: 1, pendingCount: 0 });
    expect(week.priceUsd?.toFixed(2)).toBe("30.00");
    expect(week.end).toEqual(at("2026-10-13T18:00:00"));
  });

  it.each([
    ["taken: an APPROVED game overlaps", { approved: [{ start: at("2026-10-13T17:30:00"), end: at("2026-10-13T18:30:00") }] }, "taken"],
    ["taken: exactly the same hour", { approved: [{ start: at("2026-10-13T17:00:00"), end: at("2026-10-13T18:00:00") }] }, "taken"],
  ] as const)("%s", (_name, extra, state) => {
    expect(classifyOccurrence({ ...base, ...extra, index: 0, start: at("2026-10-13T17:00:00") }).state).toBe(state);
  });

  it("an adjacent game does not make it taken", () => {
    const week = classifyOccurrence({
      ...base,
      index: 0,
      start: at("2026-10-13T17:00:00"),
      approved: [{ start: at("2026-10-13T18:00:00"), end: at("2026-10-13T19:00:00") }],
    });
    expect(week.state).toBe("free");
  });

  it("outside hours when the time is not in the opening window, or when it would run past closing", () => {
    expect(classifyOccurrence({ ...base, index: 0, start: at("2026-10-13T08:00:00") }).state).toBe("outside_hours"); // 11:00
    expect(classifyOccurrence({ ...base, index: 0, start: at("2026-10-13T19:00:00") }).state).toBe("outside_hours"); // 22:00 local
    expect(classifyOccurrence({ ...base, index: 0, start: at("2026-10-13T18:00:00"), durationMinutes: 120 }).state).toBe(
      "outside_hours",
    ); // 21:00 + 2h passes 22:00
  });

  it("past when the start is not in the future", () => {
    expect(classifyOccurrence({ ...base, index: 0, start: at("2026-09-29T17:00:00") }).state).toBe("past");
    expect(classifyOccurrence({ ...base, index: 0, start: now }).state).toBe("past");
  });

  it("a free week counts the pending requests it would decline; other weeks do not", () => {
    const pending = [
      { start: at("2026-10-13T17:00:00"), end: at("2026-10-13T18:00:00") },
      { start: at("2026-10-13T17:30:00"), end: at("2026-10-13T18:30:00") },
      { start: at("2026-10-13T19:00:00"), end: at("2026-10-13T20:00:00") },
    ];
    expect(classifyOccurrence({ ...base, index: 0, start: at("2026-10-13T17:00:00"), pending }).pendingCount).toBe(2);
    const taken = classifyOccurrence({
      ...base,
      index: 0,
      start: at("2026-10-13T17:00:00"),
      pending,
      approved: [{ start: at("2026-10-13T17:00:00"), end: at("2026-10-13T18:00:00") }],
    });
    expect(taken).toMatchObject({ state: "taken", pendingCount: 0 });
  });

  it("buildSeriesPreview marks each week and the totals add up", () => {
    const anchor = anchorFromInstant(at("2026-10-13T17:00:00"), TZ);
    const starts = seriesOccurrences(anchor, 4, TZ); // Oct 13, 20, 27, Nov 3
    const preview = buildSeriesPreview({
      starts,
      durationMinutes: 60,
      config: evenings,
      approved: [{ start: starts[1]!, end: new Date(starts[1]!.getTime() + 3_600_000) }],
      pending: [{ start: starts[2]!, end: new Date(starts[2]!.getTime() + 3_600_000) }],
      now,
      timeZone: TZ,
    });
    expect(preview.map((week) => week.state)).toEqual(["free", "taken", "free", "free"]);
    expect(preview.map((week) => week.index)).toEqual([0, 1, 2, 3]);
    expect(bookableCount(preview)).toBe(3);
    expect(declineTotal(preview)).toBe(1);
  });

  it("buildSeriesPreview numbers from firstIndex", () => {
    const anchor = anchorFromInstant(at("2026-10-13T17:00:00"), TZ);
    const preview = buildSeriesPreview({
      starts: seriesOccurrences(anchor, 2, TZ, 3),
      firstIndex: 3,
      durationMinutes: 60,
      config: evenings,
      approved: [],
      pending: [],
      now,
      timeZone: TZ,
    });
    expect(preview.map((week) => week.index)).toEqual([3, 4]);
    expect(preview.every((week) => week.priceUsd instanceof Decimal)).toBe(true);
  });
});

describe("seriesWeekdayAndTime", () => {
  it("gives the weekday (0 = Sunday) and the clock", () => {
    expect(seriesWeekdayAndTime({ date: { year: 2026, month: 10, day: 13 }, hour: 20, minute: 0 })).toEqual({
      weekday: 2,
      time: "20:00",
    });
    expect(seriesWeekdayAndTime({ date: { year: 2026, month: 10, day: 18 }, hour: 0, minute: 30 })).toEqual({
      weekday: 0,
      time: "00:30",
    });
  });
});
