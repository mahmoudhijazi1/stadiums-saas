import { describe, expect, it } from "@jest/globals";
import type { CardDisplay } from "@/modules/booking/domain/card-display";
import { groupDayGames } from "@/modules/booking/domain/today-groups";

/** Today's grouping: now, ended (owed first), upcoming, cancelled. Written, not run. */
type Row = { id: string; display: CardDisplay; startMs: number };
const row = (id: string, kind: CardDisplay["kind"], startMs: number): Row => ({
  id,
  startMs,
  display: kind === "live" ? { kind, minutesLeft: 20 } : ({ kind } as CardDisplay),
});
const ids = (rows: Row[]) => rows.map((item) => item.id);

describe("today", () => {
  const all = [
    row("up2", "before", 90),
    row("paid1", "paid", 10),
    row("cx", "cancelled", 5),
    row("live", "live", 50),
    row("unpaid1", "unpaid", 20),
    row("up1", "before", 70),
  ];

  it("has now, ended, upcoming and cancelled, in that order, each with a heading except the now card", () => {
    const groups = groupDayGames(all, true);
    expect(groups.map((group) => group.kind)).toEqual(["now", "ended", "upcoming", "cancelled"]);
    expect(groups.map((group) => group.showHeading)).toEqual([false, true, true, true]);
    expect(ids(groups[0]!.items)).toEqual(["live"]);
    expect(ids(groups[2]!.items)).toEqual(["up1", "up2"]);
  });

  it("with only upcoming games there is one group and no heading", () => {
    const groups = groupDayGames([row("b", "before", 2), row("a", "before", 1)], true);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ kind: "upcoming", showHeading: false });
    expect(ids(groups[0]!.items)).toEqual(["a", "b"]);
  });

  it("an empty group never shows", () => {
    const groups = groupDayGames([row("p", "paid", 1), row("u", "before", 2)], true);
    expect(groups.map((group) => group.kind)).toEqual(["ended", "upcoming"]);
  });

  it("a no-show is in Ended, paid or not", () => {
    const groups = groupDayGames([row("ns", "no_show_unpaid", 1), row("nsp", "no_show_paid", 2)], true);
    expect(groups.map((group) => group.kind)).toEqual(["ended"]);
    expect(ids(groups[0]!.items)).toEqual(["ns", "nsp"]);
  });

  it("in Ended the unpaid come first, then by time", () => {
    const groups = groupDayGames(
      [row("paidEarly", "paid", 1), row("partial", "partial", 5), row("ns", "no_show_unpaid", 3), row("unpaid", "unpaid", 9), row("paidLate", "paid", 8)],
      true,
    );
    expect(ids(groups[0]!.items)).toEqual(["ns", "partial", "unpaid", "paidEarly", "paidLate"]);
  });

  it("cancelled games are last, by time, with a heading even when alone", () => {
    const groups = groupDayGames([row("c2", "cancelled", 2), row("c1", "cancelled", 1)], true);
    expect(groups).toEqual([{ kind: "cancelled", items: [row("c1", "cancelled", 1), row("c2", "cancelled", 2)], showHeading: true }]);
  });
});

describe("another day", () => {
  it("is one list by time with cancelled at the bottom", () => {
    const groups = groupDayGames([row("c", "cancelled", 1), row("b", "paid", 3), row("a", "before", 2)], false);
    expect(groups.map((group) => group.kind)).toEqual(["day", "cancelled"]);
    expect(ids(groups[0]!.items)).toEqual(["a", "b"]);
    expect(groups[0]!.showHeading).toBe(false);
  });

  it("no games, no groups", () => {
    expect(groupDayGames([], false)).toEqual([]);
    expect(groupDayGames([], true)).toEqual([]);
  });
});
