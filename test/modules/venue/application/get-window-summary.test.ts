import { describe, expect, it, jest } from "@jest/globals";
import { CLOSED_WEEK_SCHEDULE } from "@/modules/venue/domain/schedule-config";

jest.mock("../../../../src/modules/venue/infrastructure/pitches", () => ({
  listPitches: async () => [
    {
      id: "p1",
      name: "A",
      scheduleConfig: {
        ...CLOSED_WEEK_SCHEDULE,
        defaultPriceUsd: "20.00",
        hours: { ...CLOSED_WEEK_SCHEDULE.hours, fri: [{ start: "18:00", end: "21:00" }] },
      },
    },
  ],
}));

// jest.mock is not hoisted above imports here, so the module under test is imported after it.
const load = async () => await import("@/modules/venue/application/get-window-summary");

// Wed 14 Oct 2026; the pitch opens on Fridays only, 18:00-21:00 (three one-hour games).
const base = {
  from: { year: 2026, month: 10, day: 14 },
  lastDay: { year: 2026, month: 10, day: 24 },
  timeZone: "Asia/Beirut",
  now: new Date("2026-10-14T09:00:00Z"),
};
const taken = (startUtc: string, endUtc: string) => ({ pitchId: "p1", start: new Date(startUtc), end: new Date(endUtc) });

describe("getWindowSummary", () => {
  it("counts free times per day and finds the nearest one", async () => {
    const { getWindowSummary } = await load();
    const { days, nextFree } = await getWindowSummary({ ...base, occupied: [] });
    expect(days).toHaveLength(11);
    expect(days.find((day) => day.key === "2026-10-16")!.freeCount).toBe(3);
    expect(days.find((day) => day.key === "2026-10-15")!.freeCount).toBe(0);
    expect(nextFree).toMatchObject({ dateKey: "2026-10-16", priceUsd: "20.00", durationMinutes: 60, pitchName: null });
    expect(nextFree!.startIso).toBe("2026-10-16T15:00:00.000Z"); // 18:00 Beirut (UTC+3)
  });

  it("counts a taken time out, and the nearest free time skips it", async () => {
    const { getWindowSummary } = await load();
    const { days, nextFree } = await getWindowSummary({
      ...base,
      occupied: [taken("2026-10-16T15:00:00Z", "2026-10-16T16:00:00Z")],
    });
    expect(days.find((day) => day.key === "2026-10-16")!.freeCount).toBe(2);
    expect(nextFree!.startIso).toBe("2026-10-16T16:00:00.000Z");
  });

  it("has no nearest time when nothing is free in the window, and firstFreeDayAfter looks ahead", async () => {
    const { getWindowSummary, firstFreeDayAfter } = await load();
    const none = await getWindowSummary({ ...base, lastDay: { year: 2026, month: 10, day: 15 }, occupied: [] });
    expect(none.nextFree).toBeNull();
    const all = await getWindowSummary({ ...base, occupied: [] });
    expect(firstFreeDayAfter(all.days, "2026-10-14")).toEqual({ year: 2026, month: 10, day: 16 });
    expect(firstFreeDayAfter(all.days, "2026-10-16")).toEqual({ year: 2026, month: 10, day: 23 });
  });
});
