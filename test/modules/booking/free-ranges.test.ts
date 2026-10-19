import { describe, expect, it } from "@jest/globals";
import { freeRanges, type FreeChip } from "@/modules/booking/domain/free-strip";

/** A pitch's free hours as ranges. Written, not run. */
const chip = (start: string, end: string, startLocal: string, endLocal: string): FreeChip => ({
  startIso: start,
  endIso: end,
  startLocal,
  endLocal,
  price: null,
  fullPrice: null,
  pending: 0,
});

describe("freeRanges", () => {
  it("merges consecutive slots into one range", () => {
    const ranges = freeRanges([
      chip("2026-10-20T13:00:00Z", "2026-10-20T14:00:00Z", "4:00 PM", "5:00 PM"),
      chip("2026-10-20T14:00:00Z", "2026-10-20T15:00:00Z", "5:00 PM", "6:00 PM"),
      chip("2026-10-20T15:00:00Z", "2026-10-20T16:00:00Z", "6:00 PM", "7:00 PM"),
    ]);
    expect(ranges).toEqual([
      { startIso: "2026-10-20T13:00:00Z", endIso: "2026-10-20T16:00:00Z", startLocal: "4:00 PM", endLocal: "7:00 PM" },
    ]);
  });

  it("a gap starts a new range", () => {
    const ranges = freeRanges([
      chip("2026-10-20T13:00:00Z", "2026-10-20T14:00:00Z", "4:00 PM", "5:00 PM"),
      chip("2026-10-20T16:00:00Z", "2026-10-20T17:00:00Z", "7:00 PM", "8:00 PM"),
      chip("2026-10-20T17:00:00Z", "2026-10-20T18:00:00Z", "8:00 PM", "9:00 PM"),
    ]);
    expect(ranges.map((range) => `${range.startLocal} – ${range.endLocal}`)).toEqual(["4:00 PM – 5:00 PM", "7:00 PM – 9:00 PM"]);
  });

  it("runs on past midnight", () => {
    const ranges = freeRanges([
      chip("2026-10-20T19:00:00Z", "2026-10-20T20:00:00Z", "10:00 PM", "11:00 PM"),
      chip("2026-10-20T20:00:00Z", "2026-10-20T21:00:00Z", "11:00 PM", "12:00 AM"),
      chip("2026-10-20T21:00:00Z", "2026-10-20T22:00:00Z", "12:00 AM", "1:00 AM"),
    ]);
    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toMatchObject({ startLocal: "10:00 PM", endLocal: "1:00 AM" });
  });

  it("none free, no ranges", () => {
    expect(freeRanges([])).toEqual([]);
  });

  it("does not change the chips it was given", () => {
    const chips = [
      chip("2026-10-20T13:00:00Z", "2026-10-20T14:00:00Z", "4:00 PM", "5:00 PM"),
      chip("2026-10-20T14:00:00Z", "2026-10-20T15:00:00Z", "5:00 PM", "6:00 PM"),
    ];
    freeRanges(chips);
    expect(chips[0]!.endLocal).toBe("5:00 PM");
  });
});
