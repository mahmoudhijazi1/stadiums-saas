import { describe, expect, it } from "@jest/globals";
import {
  latestRequestedAtIso,
  liveQueueChanged,
  nextPollDelayMs,
  reconcileAfterRefresh,
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

describe("reconcileAfterRefresh", () => {
  const stale = { pendingCount: 1, latestRequestedAt: one.latestRequestedAt };
  const seen = { pendingCount: 2, latestRequestedAt: "2026-09-26T02:05:00.000Z" };

  it("accepts a render that matches the poll", () => {
    expect(reconcileAfterRefresh(seen, { ...seen }, 0)).toBe("accept");
  });

  it("retries when the render is behind what the poll saw", () => {
    expect(reconcileAfterRefresh(stale, seen, 0)).toBe("retry");
    expect(reconcileAfterRefresh(stale, seen, 1)).toBe("retry");
  });

  it("gives up after the retry budget so it cannot loop", () => {
    expect(reconcileAfterRefresh(stale, seen, 2)).toBe("give-up");
    expect(reconcileAfterRefresh(stale, seen, 1, 1)).toBe("give-up");
  });

  it("catches a same-count render with an older request time", () => {
    const older = { pendingCount: 2, latestRequestedAt: one.latestRequestedAt };
    expect(reconcileAfterRefresh(older, seen, 0)).toBe("retry");
  });
});
