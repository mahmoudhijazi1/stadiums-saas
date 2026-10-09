import Decimal from "decimal.js";
import { describe, expect, it } from "@jest/globals";
import { summarizeDay } from "@/modules/booking/domain/day-summary";
import { summarizeOwed, type OwedParticipation, type OwedTab } from "@/modules/booking/domain/owed";
import { assertRemovalQty, isTab, netLines, netTotal, type StoredLine } from "@/modules/shop/domain/booking-items";

const d = (value: string) => new Decimal(value);

function line(over: Partial<StoredLine> & Pick<StoredLine, "id" | "qty">): StoredLine {
  const unitPriceUsd = over.unitPriceUsd ?? d("1.50");
  return {
    productId: "p1",
    name: "Cola",
    unitPriceUsd,
    lineTotalUsd: unitPriceUsd.times(over.qty),
    unitPriceLbp: null,
    lineTotalLbp: null,
    rateAtTime: null,
    reversesItemId: null,
    ...over,
  };
}

describe("netLines", () => {
  it("keeps original lines, takes reversals off them and drops a line that is fully removed", () => {
    const lines = [
      line({ id: "a", qty: 3 }),
      line({ id: "b", qty: 2, productId: "p2", name: "Chips", unitPriceUsd: d("2.25") }),
      line({ id: "r1", qty: -1, reversesItemId: "a" }),
      line({ id: "r2", qty: -2, reversesItemId: "b", productId: "p2", name: "Chips", unitPriceUsd: d("2.25") }),
    ];
    const net = netLines(lines);
    expect(net.map((l) => [l.id, l.qty, l.totalUsd.toFixed(2)])).toEqual([["a", 2, "3.00"]]);
    expect(netTotal(net).toFixed(2)).toBe("3.00");
  });

  it("an untouched list is returned as it is", () => {
    expect(netLines([line({ id: "a", qty: 1 })]).map((l) => l.qty)).toEqual([1]);
    expect(netLines([])).toEqual([]);
  });
});

describe("removals and tabs", () => {
  it("a removal takes 1 up to what is left", () => {
    expect(() => assertRemovalQty(3, 3)).not.toThrow();
    for (const qty of [0, 4, -1, 1.5]) expect(() => assertRemovalQty(3, qty)).toThrow();
  });

  it("a sale with a payer is a tab; without one it is on the game", () => {
    expect(isTab({ payerPersonId: "x", payerName: null })).toBe(true);
    expect(isTab({ payerPersonId: null, payerName: "Sami" })).toBe(true);
    expect(isTab({ payerPersonId: null, payerName: null })).toBe(false);
  });
});

const now = new Date("2026-10-15T12:00:00Z");
const ended = { start: new Date("2026-10-14T10:00:00Z"), end: new Date("2026-10-14T11:00:00Z") };

function participation(over: Partial<OwedParticipation> = {}): OwedParticipation {
  return {
    bookingId: "b1",
    status: "APPROVED",
    ...ended,
    collectionMode: "WHOLE",
    pitchName: "P1",
    personId: "p-ali",
    personName: "Ali",
    personPhone: "03111111",
    isRequester: true,
    bookingRemainingUsd: d("30.00"),
    participantRemainingUsd: d("30.00"),
    ...over,
  };
}

function tab(over: Partial<OwedTab> = {}): OwedTab {
  return {
    saleId: "s1",
    bookingId: "b1",
    status: "APPROVED",
    ...ended,
    pitchName: "P1",
    personId: null,
    name: "Friend",
    phone: null,
    remainingUsd: d("4.50"),
    ...over,
  };
}

describe("summarizeOwed with tabs", () => {
  it("adds a tab to the person it belongs to, as one game", () => {
    const owed = summarizeOwed([participation()], now, [tab({ personId: "p-ali", name: "Ali", remainingUsd: d("4.50") })]);
    expect(owed.totalUsd.toFixed(2)).toBe("34.50");
    expect(owed.games).toBe(1);
    expect(owed.groups).toHaveLength(1);
    expect(owed.groups[0]!.debts.map((debt) => [debt.kind, debt.owedUsd.toFixed(2)]).sort()).toEqual([
      ["game", "30.00"],
      ["tab", "4.50"],
    ]);
  });

  it("groups tabs opened under a typed name by that name, ignoring case, apart from every person", () => {
    const owed = summarizeOwed([], now, [
      tab({ saleId: "s1", name: "Friend", remainingUsd: d("1.50") }),
      tab({ saleId: "s2", bookingId: "b2", name: "friend ", remainingUsd: d("2.00") }),
      tab({ saleId: "s3", name: "Other", remainingUsd: d("1.00") }),
    ]);
    expect(owed.groups.map((group) => [group.personId, group.name, group.totalUsd.toFixed(2), group.games])).toEqual([
      [null, "Friend", "3.50", 2],
      [null, "Other", "1.00", 1],
    ]);
  });

  it("a tab on a game that has not ended yet is not owed; one on a cancelled or no-show game is", () => {
    const running = { start: new Date("2026-10-15T11:30:00Z"), end: new Date("2026-10-15T12:30:00Z") };
    expect(summarizeOwed([], now, [tab({ ...running })]).totalUsd.toFixed(2)).toBe("0.00");
    expect(summarizeOwed([], now, [tab({ ...running, status: "CANCELLED" })]).totalUsd.toFixed(2)).toBe("4.50");
    expect(summarizeOwed([], now, [tab({ status: "NO_SHOW" })]).totalUsd.toFixed(2)).toBe("4.50");
  });

  it("without tabs the result is what it always was", () => {
    const owed = summarizeOwed([participation()], now);
    expect(owed.totalUsd.toFixed(2)).toBe("30.00");
    expect(owed.groups[0]!.debts[0]!.kind).toBe("game");
  });
});

describe("summarizeDay with tabs", () => {
  const row = (over: object) => ({
    status: "APPROVED" as const,
    ...ended,
    amountDueUsd: d("30.00"),
    collectedUsd: d("30.00"),
    ...over,
  });

  it("a paid game with an open tab is owed by the tab; a game still to play expects it", () => {
    expect(summarizeDay([row({ tabsRemainingUsd: d("4.50") })], now).owedUsd.toFixed(2)).toBe("4.50");
    const future = { start: new Date("2026-10-16T10:00:00Z"), end: new Date("2026-10-16T11:00:00Z") };
    const summary = summarizeDay([row({ ...future, tabsRemainingUsd: d("4.50") })], now);
    expect([summary.owedUsd.toFixed(2), summary.expectedUsd.toFixed(2)]).toEqual(["0.00", "4.50"]);
  });

  it("rows without tabs behave as before", () => {
    expect(summarizeDay([row({ collectedUsd: d("10.00") })], now).owedUsd.toFixed(2)).toBe("20.00");
  });
});
