import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { debtWarnings } from "@/modules/booking/domain/debt-warning";
import { summarizeDay } from "@/modules/booking/domain/day-summary";
import {
  addParts,
  gameOwing,
  hasParts,
  noParts,
  partsOf,
  remainingInput,
  remainingOf,
  shareOwing,
} from "@/modules/booking/domain/game-owing";
import { summarizeOwed } from "@/modules/booking/domain/owed";
import { summarizePersonBookings, type PersonStatRow } from "@/modules/booking/domain/person-stats";

/**
 * DR-007 readers slice: what a game has collected and still owes, per currency, and the totals built
 * from it. Written, not run when authored.
 */
const usdGame = { priceCurrency: "USD" as const, amountDueUsd: "30.00", amountDueLbp: null, collectedUsd: "12.50", settledLbp: 0 };
const lbpGame = { priceCurrency: "LBP" as const, amountDueUsd: null, amountDueLbp: "2000000", collectedUsd: 0, settledLbp: 0 };

function thrownKey(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return (error as { key?: string }).key;
  }
  return undefined;
}

describe("gameOwing", () => {
  it("a USD game: the tenders collected, as today", () => {
    const owing = gameOwing(usdGame);
    expect([owing.currency, owing.due.toFixed(2), owing.collected.toFixed(2), owing.remaining.toFixed(2)]).toEqual([
      "USD",
      "30.00",
      "12.50",
      "17.50",
    ]);
  });

  it("an unpaid LBP game owes its whole due", () => {
    const owing = gameOwing(lbpGame);
    expect([owing.currency, owing.collected.toFixed(0), owing.remaining.toFixed(0)]).toEqual(["LBP", "0", "2000000"]);
  });

  it("an LBP game with 1,790,000 settled owes 210,000, whatever the dollar tenders say", () => {
    const owing = gameOwing({ ...lbpGame, settledLbp: "1790000", collectedUsd: "19.89" });
    expect([owing.collected.toFixed(0), owing.remaining.toFixed(0)]).toEqual(["1790000", "210000"]);
  });

  it("does not clamp: an overpaid USD game stays negative, like bookingRemaining", () => {
    expect(gameOwing({ ...usdGame, collectedUsd: "35.00" }).remaining.toFixed(2)).toBe("-5.00");
  });
});

describe("shareOwing", () => {
  it("a USD share and its dollar allocations", () => {
    const share = shareOwing({ currency: "USD", amountDueUsd: "10.00", amountDueLbp: null, allocatedUsd: "4.00", allocatedLbp: 0, where: "t" });
    expect([share.due.toFixed(2), share.allocated.toFixed(2), share.remaining.toFixed(2)]).toEqual(["10.00", "4.00", "6.00"]);
  });

  it("an LBP share and its pound allocations", () => {
    const share = shareOwing({ currency: "LBP", amountDueUsd: null, amountDueLbp: "285000", allocatedUsd: 0, allocatedLbp: "100000", where: "t" });
    expect([share.currency, share.due.toFixed(0), share.allocated.toFixed(0), share.remaining.toFixed(0)]).toEqual([
      "LBP",
      "285000",
      "100000",
      "185000",
    ]);
  });

  it("refuses an allocation or a share in the other currency instead of dropping it", () => {
    const base = { amountDueUsd: "10.00" as string | null, amountDueLbp: null as string | null, allocatedUsd: 0 as string | number, allocatedLbp: 0 as string | number, where: "t" };
    expect(thrownKey(() => shareOwing({ ...base, currency: "USD", allocatedLbp: "90000" }))).toBe("booking.lbp_not_supported");
    expect(thrownKey(() => shareOwing({ ...base, currency: "LBP", amountDueUsd: null, amountDueLbp: "285000", allocatedUsd: "5.00" }))).toBe(
      "booking.lbp_not_supported",
    );
    expect(thrownKey(() => shareOwing({ ...base, currency: "LBP" }))).toBe("booking.lbp_not_supported");
  });
});

describe("parts", () => {
  it("keeps dollars and pounds apart", () => {
    const sum = addParts(partsOf("USD", new Decimal(30)), partsOf("LBP", new Decimal(2000000)));
    expect([sum.usd.toFixed(0), sum.lbp.toFixed(0)]).toEqual(["30", "2000000"]);
    expect(hasParts(noParts())).toBe(false);
    expect(hasParts(partsOf("LBP", new Decimal(1)))).toBe(true);
  });

  it("remainingInput and remainingOf round-trip each currency", () => {
    const usd = remainingOf(remainingInput("USD", new Decimal(30), new Decimal(10)));
    const lbp = remainingOf(remainingInput("LBP", new Decimal(2000000), new Decimal(285000)));
    expect([usd.currency, usd.booking.toFixed(0), usd.participant.toFixed(0)]).toEqual(["USD", "30", "10"]);
    expect([lbp.currency, lbp.booking.toFixed(0), lbp.participant.toFixed(0)]).toEqual(["LBP", "2000000", "285000"]);
  });
});

const NOW = new Date("2026-10-20T12:00:00Z");
const ENDED = { start: new Date("2026-10-19T16:00:00Z"), end: new Date("2026-10-19T17:00:00Z") };
const D = (value: number | string) => new Decimal(value);

describe("totals per currency", () => {
  it("summarizeOwed: a USD game and an LBP game are two totals, one game each", () => {
    const summary = summarizeOwed(
      [
        { bookingId: "u", status: "APPROVED", ...ENDED, collectionMode: "WHOLE", pitchName: "A", personId: "p1", personName: "Ali", personPhone: null, isRequester: true, ...remainingInput("USD", D(30), D(30)) },
        { bookingId: "l", status: "APPROVED", ...ENDED, collectionMode: "WHOLE", pitchName: "A", personId: "p2", personName: "Lina", personPhone: null, isRequester: true, ...remainingInput("LBP", D(210000), D(210000)) },
      ],
      NOW,
    );
    expect([summary.totalUsd.toFixed(2), summary.totalLbp.toFixed(0), summary.games]).toEqual(["30.00", "210000", 2]);
    const lina = summary.groups.find((group) => group.name === "Lina")!;
    expect([lina.totalUsd.toFixed(0), lina.totalLbp.toFixed(0), lina.debts[0]!.owedUsd.toFixed(0), lina.debts[0]!.owedLbp.toFixed(0)]).toEqual(["0", "210000", "0", "210000"]);
  });

  it("summarizeOwed: a USD-only stadium has no pounds", () => {
    const summary = summarizeOwed(
      [{ bookingId: "u", status: "APPROVED", ...ENDED, collectionMode: "WHOLE", pitchName: "A", personId: "p1", personName: "Ali", personPhone: null, isRequester: true, bookingRemainingUsd: D(30), participantRemainingUsd: D(30) }],
      NOW,
    );
    expect([summary.totalUsd.toFixed(2), summary.totalLbp.toFixed(0)]).toEqual(["30.00", "0"]);
  });

  it("debtWarnings: one person owing in both currencies gets both totals", () => {
    const base = { personId: "p1", status: "APPROVED" as const, ...ENDED, collectionMode: "WHOLE" as const, isRequester: true, reason: null };
    const [warning] = debtWarnings(
      [
        { ...base, bookingId: "u", ...remainingInput("USD", D(30), D(30)) },
        { ...base, bookingId: "l", start: new Date("2026-10-18T16:00:00Z"), end: new Date("2026-10-18T17:00:00Z"), ...remainingInput("LBP", D(2000000), D(2000000)) },
      ],
      NOW,
    );
    expect([warning!.totalUsd.toFixed(0), warning!.totalLbp.toFixed(0)]).toEqual(["30", "2000000"]);
  });

  it("summarizePersonBookings: owes now and total paid per currency", () => {
    const common = { status: "APPROVED" as const, ...ENDED, collectionMode: "WHOLE" as const, isRequester: true };
    const usd: PersonStatRow = { ...common, amountDueUsd: D(30), collectedUsd: D(10), participantDueUsd: D(30), allocatedUsd: D(0) };
    const lbp: PersonStatRow = {
      ...common,
      currency: "LBP",
      amountDueUsd: D(0),
      collectedUsd: D(0),
      participantDueUsd: D(0),
      allocatedUsd: D(0),
      amountDueLbp: D(2000000),
      settledLbp: D(1790000),
      participantDueLbp: D(2000000),
      allocatedLbp: D(0),
    };
    const stats = summarizePersonBookings([usd, lbp], NOW);
    expect([stats.owesNowUsd.toFixed(0), stats.owesNowLbp.toFixed(0)]).toEqual(["20", "210000"]);
    expect([stats.totalPaidUsd.toFixed(0), stats.totalPaidLbp.toFixed(0)]).toEqual(["10", "1790000"]);
    expect(stats.gamesPlayed).toBe(2);
  });

  it("summarizeDay: pounds owed by an LBP game are kept apart from dollars", () => {
    const summary = summarizeDay(
      [
        { status: "APPROVED", ...ENDED, amountDueUsd: D(30), collectedUsd: D(0) },
        { status: "APPROVED", ...ENDED, amountDueLbp: D(2000000), settledLbp: D(1790000), collectedUsd: D(0) },
      ],
      NOW,
    );
    expect([summary.owedUsd.toFixed(0), summary.owedLbp.toFixed(0), summary.games]).toEqual(["30", "210000", 2]);
  });
});
