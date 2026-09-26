import { describe, expect, it } from "@jest/globals";
import {
  latestRequestedAtIso,
  liveQueueChanged,
  nextPollDelayMs,
} from "@/modules/booking/domain/live-queue";

const empty = { pendingCount: 0, latestRequestedAt: null };
const one = {
  pendingCount: 1,
  latestRequestedAt: "2026-09-26T02:00:00.000Z",
};

describe("liveQueueChanged", () => {
  it("is quiet when the snapshot matches", () => {
    expect(liveQueueChanged(one, { ...one })).toBe(false);
    expect(liveQueueChanged(empty, { ...empty })).toBe(false);
  });

  it("notices a new count or a newer request at the same count", () => {
    expect(liveQueueChanged(empty, one)).toBe(true);
    expect(
      liveQueueChanged(one, {
        pendingCount: 1,
        latestRequestedAt: "2026-09-26T02:05:00.000Z",
      }),
    ).toBe(true);
    expect(liveQueueChanged(one, empty)).toBe(true);
  });
});

describe("nextPollDelayMs", () => {
  it("stays at 20s until two failures, then 60s", () => {
    expect(nextPollDelayMs(0)).toBe(20_000);
    expect(nextPollDelayMs(1)).toBe(20_000);
    expect(nextPollDelayMs(2)).toBe(60_000);
    expect(nextPollDelayMs(5)).toBe(60_000);
  });
});

describe("latestRequestedAtIso", () => {
  it("picks the newest request", () => {
    expect(
      latestRequestedAtIso([
        { requestedAt: new Date("2026-09-26T01:00:00.000Z") },
        { requestedAt: new Date("2026-09-26T03:00:00.000Z") },
      ]),
    ).toBe("2026-09-26T03:00:00.000Z");
    expect(latestRequestedAtIso([])).toBeNull();
  });
});
