import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import db from "@/lib/db";
import { platformDb } from "@/lib/platform-db";
import { collectBookingPayment } from "@/modules/booking/application/collect-booking-payment";
import { considerGamePaid } from "@/modules/booking/application/consider-game-paid";
import { getPersonBookingStats } from "@/modules/booking/application/get-person-booking-stats";
import { listOwed } from "@/modules/booking/application/list-owed";
import { loadOwnerDay } from "@/modules/booking/application/load-owner-day";
import type { TenderDraft } from "@/modules/payment/domain/collect";
import { setExchangeRate } from "@/modules/payment/application/set-exchange-rate";
import { findOrCreatePerson } from "@/modules/people/application/find-or-create-person";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { assertMoneyInvariants } from "./invariants";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { clearReactCache } from "./setup-mocks";
import { endedGame, nextPhone, slotOn } from "./shop-helpers";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * DR-007 slice 6: collecting a whole LBP game and "Consider it paid", on an LBP stadium at 89,500.
 * WRITTEN, NOT RUN when authored (the task forbade running suites): treat every expectation as
 * unverified until `npm run test:integration` has been run.
 */
let fixture: TestFixture;
let game: { bookingId: string; personId: string };

const D = (value: number | string) => new Decimal(value);
const lbp = (amount: number): TenderDraft => ({ currency: "LBP", amount: D(amount) });
const usd = (amount: number | string): TenderDraft => ({ currency: "USD", amount: D(amount) });

beforeEach(async () => {
  await truncateAll();
  clearRequestStubs();
  fixture = await seedMinimalFixture();
  await platformDb.tenant.update({
    where: { id: fixture.tenantId },
    data: { settings: { gamePriceCurrency: "LBP" } },
  });
  clearReactCache();
  setTenantSlug(fixture.tenantSlug);
  setSessionCookie(fixture.sessionId);
  game = await endedLbpGame(2, "Lina", "2000000");
});

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

/** An APPROVED, ended game priced in pounds, booked for `name`. */
async function endedLbpGame(daysAgo: number, name: string, pounds: string) {
  const slot = await slotOn(fixture, -daysAgo);
  const person = await db.$transaction((tx) => findOrCreatePerson(tx, { name, phone: nextPhone() }));
  const bookingId = `bk_${randomUUID()}`;
  await platformDb.$executeRaw`
    INSERT INTO "Booking" ("id", "tenantId", "pitchId", "during", "status", "source",
      "priceCurrency", "priceLbp", "amountDueLbp")
    VALUES (${bookingId}, ${fixture.tenantId}, ${fixture.pitchId}, tstzrange(${slot.start}, ${slot.end}, '[)'),
      'APPROVED'::"BookingStatus", 'OWNER'::"BookingSource", 'LBP'::"Currency", ${pounds}::decimal, ${pounds}::decimal)`;
  await platformDb.bookingParticipant.create({
    data: { tenantId: fixture.tenantId, bookingId, personId: person.id, isRequester: true, amountDueLbp: pounds },
  });
  return { bookingId, personId: person.id };
}

function rate(lbpPerUsd: number) {
  return setExchangeRate(D(lbpPerUsd));
}

const collect = (tenders: TenderDraft[], bookingId = game.bookingId) => collectBookingPayment({ bookingId, tenders });

async function settlements(bookingId = game.bookingId) {
  const rows = await platformDb.bookingSettlement.findMany({ where: { bookingId }, orderBy: { createdAt: "asc" } });
  return rows.map((row) => [D(row.lbpApplied.toString()).toFixed(0), D(row.usdApplied.toString()).toFixed(2)]);
}

async function ledgerIn(bookingId = game.bookingId) {
  const sum = await platformDb.ledgerEntry.aggregate({ where: { sourceId: bookingId, direction: "IN" }, _sum: { amountUsd: true } });
  return D(sum._sum.amountUsd?.toString() ?? "0").toFixed(2);
}

async function tenderRows(bookingId = game.bookingId) {
  const rows = await platformDb.paymentTender.findMany({
    where: { payment: { sourceId: bookingId } },
    orderBy: { payment: { createdAt: "asc" } },
  });
  return rows.map((row) => [row.currency, D(row.amount.toString()).toString(), D(row.usdEquivalent.toString()).toFixed(2), D(row.rateAtTime?.toString() ?? "0").toFixed(0)]);
}

/** Paid on every reader: off the Owed page and To collect, and the person owes nothing. */
async function expectPaidEverywhere() {
  const owed = await listOwed();
  expect([owed.totalLbp.toFixed(0), owed.games]).toEqual(["0", 0]);
  expect((await loadOwnerDay(undefined)).toCollect.map((row) => row.id)).not.toContain(game.bookingId);
  const stats = await getPersonBookingStats(game.personId);
  expect(stats.owesNowLbp.toFixed(0)).toBe("0");
}

describe("collecting a whole LBP game", () => {
  beforeEach(async () => {
    await rate(89500);
  });

  it("2,000,000 LBP exact: Paid, ledger IN is its value at 89,500, one settlement row", async () => {
    const change = await collect([lbp(2000000)]);
    expect([change.changeLbp.toFixed(0), change.changeUsd.toFixed(2)]).toEqual(["0", "0.00"]);

    const [payment] = await platformDb.payment.findMany({ where: { sourceId: game.bookingId } });
    expect([payment!.dueCurrency, payment!.amountDueLbp?.toString(), payment!.amountDueUsd]).toEqual(["LBP", "2000000", null]);
    expect(await tenderRows()).toEqual([["LBP", "2000000", "22.35", "89500"]]);
    expect(await ledgerIn()).toBe("22.35");
    expect(await settlements()).toEqual([["2000000", "0.00"]]);

    await expectPaidEverywhere();
    expect((await getPersonBookingStats(game.personId)).totalPaidLbp.toFixed(0)).toBe("2000000");
    await expect(collect([lbp(1000)])).rejects.toMatchObject({ key: "payment.nothing_due" });
    await assertMoneyInvariants([game.personId]);
  });

  it("$20, then the rest in LBP: Paid, and the pounds settled add up to 2,000,000", async () => {
    await collect([usd(20)]);
    expect(await settlements()).toEqual([["1790000", "20.00"]]);
    const owed = await listOwed();
    expect(owed.totalLbp.toFixed(0)).toBe("210000");

    await collect([lbp(210000)]);
    expect(await settlements()).toEqual([["1790000", "20.00"], ["210000", "0.00"]]);
    expect(await tenderRows()).toEqual([["USD", "20", "20.00", "89500"], ["LBP", "210000", "2.35", "89500"]]);
    expect(await ledgerIn()).toBe("22.35");
    await expectPaidEverywhere();
    await assertMoneyInvariants([game.personId]);
  });

  it("2,100,000 LBP gives back 100,000 LBP; nothing over is recorded", async () => {
    const change = await collect([lbp(2100000)]);
    expect([change.changeLbp.toFixed(0), change.changeUsd.toFixed(2)]).toEqual(["100000", "0.00"]);
    expect(await tenderRows()).toEqual([["LBP", "2000000", "22.35", "89500"]]);
    expect(await settlements()).toEqual([["2000000", "0.00"]]);
    await assertMoneyInvariants([game.personId]);
  });

  it("$25 on an unpaid 2,000,000 game gives back dollars; $22.35 is recorded", async () => {
    const change = await collect([usd(25)]);
    expect([change.changeUsd.toFixed(2), change.changeLbp.toFixed(0)]).toEqual(["2.65", "0"]);
    expect(await tenderRows()).toEqual([["USD", "22.35", "22.35", "89500"]]);
    expect(await ledgerIn()).toBe("22.35");
    expect(await settlements()).toEqual([["2000000", "22.35"]]);
    await expectPaidEverywhere();
    await assertMoneyInvariants([game.personId]);
  });

  it("a partial payment, a rate change, then the rest: the pounds owed did not move with the rate", async () => {
    await collect([lbp(1000000)]);
    await rate(100000);
    clearReactCache();
    expect((await listOwed()).totalLbp.toFixed(0)).toBe("1000000");
    expect((await getPersonBookingStats(game.personId)).owesNowLbp.toFixed(0)).toBe("1000000");

    // $10 at 100,000 is exactly the 1,000,000 left.
    const change = await collect([usd(10)]);
    expect([change.changeUsd.toFixed(2), change.changeLbp.toFixed(0)]).toEqual(["0.00", "0"]);
    expect(await tenderRows()).toEqual([["LBP", "1000000", "11.17", "89500"], ["USD", "10", "10.00", "100000"]]);
    expect(await ledgerIn()).toBe("21.17");
    expect(await settlements()).toEqual([["1000000", "0.00"], ["1000000", "10.00"]]);
    await expectPaidEverywhere();
    await assertMoneyInvariants([game.personId]);
  });

  it("two concurrent collections never settle more than the due", async () => {
    const results = await Promise.allSettled([collect([lbp(1500000)]), collect([lbp(1500000)])]);
    expect(results.filter((result) => result.status === "fulfilled").length).toBeGreaterThanOrEqual(1);
    const settled = (await settlements()).reduce((sum, [pounds]) => sum.plus(D(pounds!)), D(0));
    expect(settled.toFixed(0)).toBe("2000000");
    await assertMoneyInvariants([game.personId]);
  });

  it("a USD game in the same stadium collects exactly as before", async () => {
    const old = await endedGame(fixture, 3, "Ali", nextPhone());
    const change = await collect([usd(35)], old.bookingId);
    expect(change.changeUsd.toFixed(2)).toBe("5.00");
    expect(await settlements(old.bookingId)).toEqual([]);
    const [payment] = await platformDb.payment.findMany({ where: { sourceId: old.bookingId } });
    expect([payment!.dueCurrency, payment!.amountDueUsd?.toString(), payment!.amountDueLbp]).toEqual(["USD", "30", null]);
    await assertMoneyInvariants([old.personId, game.personId]);
  });
});

describe("Consider it paid", () => {
  async function dueChanges(bookingId = game.bookingId) {
    const rows = await platformDb.bookingDueChange.findMany({ where: { bookingId } });
    return rows.map((row) => [row.reason, row.currency, row.fromLbp?.toString() ?? row.fromUsd?.toString(), row.toLbp?.toString() ?? row.toUsd?.toString()]);
  }

  it("3,000 LBP left: one ROUNDING due change and the game is Paid", async () => {
    await rate(89500);
    await collect([lbp(1997000)]);
    await considerGamePaid({ bookingId: game.bookingId });
    expect(await dueChanges()).toEqual([["ROUNDING", "LBP", "2000000", "1997000"]]);
    const booking = await platformDb.booking.findUniqueOrThrow({ where: { id: game.bookingId }, select: { amountDueLbp: true } });
    expect(booking.amountDueLbp?.toString()).toBe("1997000");
    await expectPaidEverywhere();
    await expect(considerGamePaid({ bookingId: game.bookingId })).rejects.toMatchObject({ key: "booking.not_forgivable" });
    await assertMoneyInvariants([game.personId]);
  });

  it("6,000 LBP left is refused and nothing is written", async () => {
    await rate(89500);
    await collect([lbp(1994000)]);
    await expect(considerGamePaid({ bookingId: game.bookingId })).rejects.toMatchObject({ key: "booking.not_forgivable" });
    expect(await dueChanges()).toEqual([]);
    expect((await listOwed()).totalLbp.toFixed(0)).toBe("6000");
  });

  it("a USD game with a few cents left is forgivable with a rate", async () => {
    await rate(89500);
    const old = await endedGame(fixture, 3, "Ali", nextPhone());
    await collect([usd("29.95")], old.bookingId);
    await considerGamePaid({ bookingId: old.bookingId });
    expect(await dueChanges(old.bookingId)).toEqual([["ROUNDING", "USD", "30", "29.95"]]);
    expect((await listOwed()).totalUsd.toFixed(2)).toBe("0.00");
    await assertMoneyInvariants([old.personId]);
  });

  it("without a rate the same USD game is not forgivable", async () => {
    const old = await endedGame(fixture, 3, "Ali", nextPhone());
    await collect([usd("29.95")], old.bookingId);
    await expect(considerGamePaid({ bookingId: old.bookingId })).rejects.toMatchObject({ key: "booking.not_forgivable" });
    expect(await dueChanges(old.bookingId)).toEqual([]);
  });
});
