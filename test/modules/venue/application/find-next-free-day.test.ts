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
        hours: { ...CLOSED_WEEK_SCHEDULE.hours, fri: [{ start: "18:00", end: "20:00" }] },
      },
    },
  ],
}));
jest.mock("../../../../src/lib/logger", () => ({ logger: { error: () => {} } }));

const TZ = "Asia/Beirut";
// Wed 14 Oct 2026; the pitch opens on Fridays only (16 Oct is the next one).
const wed = { year: 2026, month: 10, day: 14 };
const now = new Date("2026-10-14T09:00:00Z");
const base = { after: wed, lastDay: { year: 2026, month: 12, day: 13 }, timeZone: TZ, now };

// jest.mock is not hoisted above imports here, so the module under test is imported after it.
const load = async () => (await import("@/modules/venue/application/find-next-free-day")).findNextFreeDay;

describe("findNextFreeDay", () => {
  it("finds the next open day", async () => {
    expect(await (await load())({ ...base, occupied: [] })).toEqual({ year: 2026, month: 10, day: 16 });
  });

  it("skips a Friday that is fully taken and lands on the one after", async () => {
    const taken = [{ pitchId: "p1", start: new Date("2026-10-16T14:00:00Z"), end: new Date("2026-10-16T17:30:00Z") }];
    expect(await (await load())({ ...base, occupied: taken })).toEqual({ year: 2026, month: 10, day: 23 });
  });

  it("is null when nothing is free before the last public day", async () => {
    expect(await (await load())({ ...base, lastDay: { year: 2026, month: 10, day: 15 }, occupied: [] })).toBeNull();
  });
});
