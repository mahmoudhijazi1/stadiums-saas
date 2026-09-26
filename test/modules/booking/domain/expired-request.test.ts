import { describe, expect, it } from "@jest/globals";
import {
  actionablePending,
  isExpiredPendingRequest,
  missedPending,
  startsInMinutes,
} from "@/modules/booking/domain/expired-request";

const start = new Date("2026-09-21T13:00:00.000Z");

describe("isExpiredPendingRequest", () => {
  it("is expired when a PENDING slot has started", () => {
    expect(
      isExpiredPendingRequest(
        { status: "PENDING", start },
        new Date(start.getTime()),
      ),
    ).toBe(true);
    expect(
      isExpiredPendingRequest(
        { status: "PENDING", start },
        new Date(start.getTime() + 60_000),
      ),
    ).toBe(true);
  });

  it("is not expired while the slot is still in the future", () => {
    expect(
      isExpiredPendingRequest(
        { status: "PENDING", start },
        new Date(start.getTime() - 1),
      ),
    ).toBe(false);
  });

  it("is not expired for a non-pending status", () => {
    expect(
      isExpiredPendingRequest(
        { status: "APPROVED", start },
        new Date(start.getTime() + 60_000),
      ),
    ).toBe(false);
  });
});

describe("actionablePending", () => {
  const now = new Date("2026-09-26T12:00:00.000Z");
  const rows = [
    { id: "past", start: new Date("2026-09-21T13:00:00.000Z") },
    { id: "soon", start: new Date("2026-09-26T13:00:00.000Z") },
    { id: "later", start: new Date("2026-10-05T13:00:00.000Z") },
  ];

  it("keeps only future slots in the badge count", () => {
    expect(actionablePending(rows, now).map((row) => row.id)).toEqual([
      "soon",
      "later",
    ]);
    expect(missedPending(rows, now).map((row) => row.id)).toEqual(["past"]);
  });
});

describe("startsInMinutes", () => {
  const slot = new Date("2026-09-26T14:00:00.000Z");

  it("is null once the slot has started and beyond two hours", () => {
    expect(startsInMinutes(slot, slot)).toBeNull();
    expect(startsInMinutes(slot, new Date(slot.getTime() - 2 * 60 * 60 * 1000 - 1))).toBeNull();
  });

  it("counts whole minutes inside the two-hour window", () => {
    expect(startsInMinutes(slot, new Date(slot.getTime() - 20 * 60_000))).toBe(20);
    expect(startsInMinutes(slot, new Date(slot.getTime() - 2 * 60 * 60 * 1000))).toBe(120);
    expect(startsInMinutes(slot, new Date(slot.getTime() - 30_000))).toBe(1);
  });
});
