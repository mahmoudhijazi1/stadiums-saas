import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import {
  groupPendingBySlot,
  partitionHomeConfirmed,
  slotDateKind,
  upcomingStatus,
} from "@/modules/booking/domain/home-inbox";

const BEIRUT = "Asia/Beirut";
const NOW = new Date("2026-09-13T07:00:00.000Z"); // Sunday 10:00 Beirut

function pending(partial: {
  id: string;
  pitchId?: string;
  start: string;
  requestedAt: string;
  name: string;
}) {
  const start = new Date(partial.start);
  return {
    id: partial.id,
    pitchId: partial.pitchId ?? "p1",
    pitchName: "Pitch A",
    start,
    end: new Date(start.getTime() + 60 * 60 * 1000),
    requestedAt: new Date(partial.requestedAt),
    requesterName: partial.name,
    requesterPhone: "70111111",
  };
}

describe("groupPendingBySlot", () => {
  it("keeps soonest-slot order and stacks competing requesters", () => {
    const later = pending({
      id: "b",
      start: "2026-09-13T14:00:00.000Z",
      requestedAt: "2026-09-12T10:00:00.000Z",
      name: "Later",
    });
    const first = pending({
      id: "a1",
      start: "2026-09-13T13:00:00.000Z",
      requestedAt: "2026-09-12T08:00:00.000Z",
      name: "Ahmad",
    });
    const second = pending({
      id: "a2",
      start: "2026-09-13T13:00:00.000Z",
      requestedAt: "2026-09-12T09:00:00.000Z",
      name: "Sami",
    });
    const groups = groupPendingBySlot([first, second, later]);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.requesters.map((r) => r.id)).toEqual(["a1", "a2"]);
    expect(groups[1]?.requesters.map((r) => r.id)).toEqual(["b"]);
  });
});

describe("upcomingStatus", () => {
  const start = new Date("2026-09-13T13:00:00.000Z");

  it("is upcoming when the slot has not started", () => {
    expect(upcomingStatus(start, new Decimal("30.00"), NOW)).toBe("upcoming");
  });

  it("is due when start has passed and remaining is positive", () => {
    expect(
      upcomingStatus(start, new Decimal("10.00"), new Date("2026-09-13T13:01:00.000Z")),
    ).toBe("due");
  });

  it("is paid when remaining is zero, even before start", () => {
    expect(upcomingStatus(start, new Decimal(0), NOW)).toBe("paid");
  });
});

describe("slotDateKind", () => {
  it("is today on the same Beirut civil day", () => {
    expect(slotDateKind(new Date("2026-09-13T13:00:00.000Z"), NOW, BEIRUT)).toBe(
      "today",
    );
  });

  it("is weekday within six civil days", () => {
    expect(slotDateKind(new Date("2026-09-12T13:00:00.000Z"), NOW, BEIRUT)).toBe(
      "weekday",
    );
    expect(slotDateKind(new Date("2026-09-19T13:00:00.000Z"), NOW, BEIRUT)).toBe(
      "weekday",
    );
  });

  it("is a numeric date beyond six civil days", () => {
    expect(slotDateKind(new Date("2026-09-05T13:00:00.000Z"), NOW, BEIRUT)).toBe(
      "date",
    );
  });
});

describe("partitionHomeConfirmed", () => {
  it("puts unpaid past in overdue, keeps today, and drops paid past", () => {
    const overdue = {
      start: new Date("2026-09-12T13:00:00.000Z"),
      remaining: new Decimal("30.00"),
    };
    const paidPast = {
      start: new Date("2026-09-12T14:00:00.000Z"),
      remaining: new Decimal(0),
    };
    const todayDue = {
      start: new Date("2026-09-13T13:00:00.000Z"),
      remaining: new Decimal("10.00"),
    };
    const later = {
      start: new Date("2026-09-14T13:00:00.000Z"),
      remaining: new Decimal("30.00"),
    };
    const split = partitionHomeConfirmed(
      [overdue, paidPast, todayDue, later],
      NOW,
      BEIRUT,
    );
    expect(split.overdue).toEqual([overdue]);
    expect(split.today).toEqual([todayDue]);
    expect(split.later).toEqual([later]);
  });
});
