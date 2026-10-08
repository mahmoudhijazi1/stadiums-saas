import Decimal from "decimal.js";
import { describe, expect, it } from "@jest/globals";
import {
  dayHeading,
  groupByDay,
  mapActivityEntry,
  signedAmount,
  type ActivityContext,
} from "@/app/owner/(app)/money/activity-map";
import {
  ACTIVITY_PAGE_SIZE,
  decodeActivityCursor,
  encodeActivityCursor,
} from "@/modules/ledger/domain/period";
import type { LedgerEntryRow } from "@/modules/ledger/infrastructure/entries";

function entry(over: Partial<LedgerEntryRow>): LedgerEntryRow {
  return {
    id: "e1",
    direction: "IN",
    amountUsd: new Decimal("30.00"),
    occurredAt: new Date("2026-10-15T10:00:00Z"),
    sourceType: "BOOKING",
    sourceId: "b1",
    ...over,
  };
}

const context: ActivityContext = {
  bookings: new Map([["b1", { id: "b1", requesterName: "Ali", personId: "p1", businessDay: "2026-10-15" }]]),
  expenses: new Map([
    [
      "x1",
      {
        id: "x1",
        category: "ELECTRICITY" as const,
        description: "Generator fuel",
        occurredAt: new Date("2026-10-15T08:00:00Z"),
        tenders: [
          { currency: "USD" as const, amount: new Decimal("10.00"), rateAtTime: null, usdEquivalent: new Decimal("10.00") },
          { currency: "LBP" as const, amount: new Decimal("895000"), rateAtTime: new Decimal("89500"), usdEquivalent: new Decimal("10.00") },
        ],
      },
    ],
  ]),
};

describe("mapActivityEntry: one mapping keyed by sourceType", () => {
  it("BOOKING: the player and 'Game', opens the game on Today", () => {
    const row = mapActivityEntry(entry({}), context, "en");
    expect(row).toMatchObject({ label: "Ali", secondary: "Game", icon: "booking", direction: "IN", amountUsd: "30.00" });
    expect(row.open).toEqual({ kind: "link", href: "/owner/today?date=2026-10-15&highlight=b1&open=1" });
    expect(mapActivityEntry(entry({}), context, "ar").secondary).toBe("مباراة");
  });

  it("BOOKING with no name still shows a row", () => {
    const row = mapActivityEntry(entry({ sourceId: "gone" }), context, "en");
    expect(row.label).toBe("Player");
    expect(row.open).toBeNull();
  });

  it("EXPENSE: the note, the category, and an expense sheet with the tenders and their frozen rates", () => {
    const row = mapActivityEntry(
      entry({ id: "e2", direction: "OUT", sourceType: "EXPENSE", sourceId: "x1", amountUsd: new Decimal("20.00") }),
      context,
      "en",
    );
    expect(row).toMatchObject({ label: "Generator fuel", icon: "expense", direction: "OUT" });
    expect(row.open?.kind).toBe("expense");
    if (row.open?.kind !== "expense") throw new Error("expected an expense sheet");
    expect(row.open.detail.amountUsd).toBe("20.00");
    expect(row.open.detail.tenders).toEqual([
      { currency: "USD", amount: "10.00", rate: null, usd: "10.00" },
      { currency: "LBP", amount: "895000", rate: "89500", usd: "10.00" },
    ]);
  });

  it("an unknown sourceType falls back to a generic row and is never dropped", () => {
    for (const sourceType of ["SHOP", "constructor", "__proto__", ""]) {
      const row = mapActivityEntry(entry({ sourceType, sourceId: "s1" }), context, "en");
      expect(row).toMatchObject({ label: "Payment", icon: "generic", open: null, amountUsd: "30.00" });
    }
    expect(mapActivityEntry(entry({ sourceType: "SHOP" }), context, "ar").label).toBe("حركة");
  });
});

describe("grouping and headings", () => {
  const now = new Date("2026-10-15T09:00:00Z"); // Thursday 15 Oct in Beirut

  it("groups a run of the same Beirut day, newest first", () => {
    const rows = [
      mapActivityEntry(entry({ id: "a", occurredAt: new Date("2026-10-15T10:00:00Z") }), context, "en"),
      mapActivityEntry(entry({ id: "b", occurredAt: new Date("2026-10-15T05:00:00Z") }), context, "en"),
      // 22:30 UTC on the 14th is 01:30 on the 15th in Beirut: still the 15th.
      mapActivityEntry(entry({ id: "c", occurredAt: new Date("2026-10-14T22:30:00Z") }), context, "en"),
      mapActivityEntry(entry({ id: "d", occurredAt: new Date("2026-10-14T10:00:00Z") }), context, "en"),
    ];
    const groups = groupByDay(rows);
    expect(groups.map((g) => [g.day, g.rows.map((r) => r.id)])).toEqual([
      ["2026-10-15", ["a", "b", "c"]],
      ["2026-10-14", ["d"]],
    ]);
  });

  it("says Today, Yesterday, then weekday and date", () => {
    expect(dayHeading("2026-10-15", now, "en")).toBe("Today");
    expect(dayHeading("2026-10-14", now, "en")).toBe("Yesterday");
    expect(dayHeading("2026-10-09", now, "en")).toBe("Friday, Oct 9");
    expect(dayHeading("2026-10-15", now, "ar")).toBe("اليوم");
    expect(dayHeading("2026-10-14", now, "ar")).toBe("أمس");
  });
});

describe("amounts and cursors", () => {
  it("In has a plus, Out a minus, whole dollars lose the cents", () => {
    expect(signedAmount("IN", "30.00")).toBe("+$30");
    expect(signedAmount("OUT", "12.50")).toBe("−$12.50");
  });

  it("a cursor round-trips and garbage means the first page", () => {
    const at = new Date("2026-10-15T10:00:00.123Z");
    const cursor = encodeActivityCursor(at, "cm123");
    expect(decodeActivityCursor(cursor)).toEqual({ at, id: "cm123" });
    for (const bad of [undefined, "", "nope", "_x", "2026-13-45T00:00:00Z_x", `${at.toISOString()}_`]) {
      expect(decodeActivityCursor(bad)).toBeNull();
    }
    expect(ACTIVITY_PAGE_SIZE).toBe(20);
  });
});
