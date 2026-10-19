import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import db from "@/lib/db";
import { platformDb } from "@/lib/platform-db";
import { collectBookingPayment } from "@/modules/booking/application/collect-booking-payment";
import { collectSlotPayment } from "@/modules/booking/application/collect-player-payment";
import { listOwed } from "@/modules/booking/application/list-owed";
import { switchToPerPlayer } from "@/modules/booking/application/switch-collection-mode";
import { setExchangeRate } from "@/modules/payment/application/set-exchange-rate";
import { findOrCreatePerson } from "@/modules/people/application/find-or-create-person";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { assertMoneyInvariants } from "./invariants";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { clearReactCache } from "./setup-mocks";
import { endedGame, nextPhone, slotOn, soonBooking } from "./shop-helpers";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Early collection stays allowed on the server, for both currencies: the confirm lives in the screen
 * only. A collection on a game that has not been played is recorded exactly like one on an ended game.
 * WRITTEN, NOT RUN when authored.
 */
let fixture: TestFixture;
const D = (value: number | string) => new Decimal(value);

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

async function start(settings?: Record<string, string | number | boolean>) {
  await truncateAll();
  clearRequestStubs();
  fixture = await seedMinimalFixture();
  if (settings) await platformDb.tenant.update({ where: { id: fixture.tenantId }, data: { settings } });
  clearReactCache();
  setTenantSlug(fixture.tenantSlug);
  setSessionCookie(fixture.sessionId);
  await setExchangeRate(D(89500));
}

/** What a collection leaves behind, without ids or times: comparable between two games. */
async function shape(bookingId: string) {
  const payments = await platformDb.payment.findMany({ where: { sourceId: bookingId }, orderBy: { createdAt: "asc" }, include: { tenders: true } });
  const ledger = await platformDb.ledgerEntry.findMany({ where: { sourceId: bookingId } });
  const settlements = await platformDb.bookingSettlement.findMany({ where: { bookingId } });
  return {
    payments: payments.map((payment) => [payment.sourceType, payment.dueCurrency, payment.tenders.map((t) => `${t.currency}${t.amount.toFixed(0)}`)]),
    ledger: ledger.map((row) => [row.sourceType, row.direction, row.amountUsd.toFixed(2), row.paymentId !== null]),
    settlements: settlements.map((row) => [row.lbpApplied.toFixed(0), row.usdApplied.toFixed(0)]),
  };
}

describe("a game in dollars", () => {
  beforeEach(() => start());

  it("collects before it is played, recorded exactly like a collection after it", async () => {
    const early = await soonBooking(fixture, "Early");
    const late = (await endedGame(fixture, 1, "Late")).bookingId;
    for (const bookingId of [early, late]) {
      await collectBookingPayment({ bookingId, tenders: [{ currency: "USD", amount: D("30") }] });
    }
    expect(await shape(early)).toEqual(await shape(late));
    expect((await shape(early)).payments).toEqual([["BOOKING", "USD", ["USD30"]]]);
    expect((await listOwed()).games).toBe(0);
    await assertMoneyInvariants([]);
  });

  it("a share of a split game is collected before the game too", async () => {
    const bookingId = await soonBooking(fixture, "Split");
    await switchToPerPlayer({ bookingId, count: 10 });
    const [first] = await platformDb.bookingParticipant.findMany({ where: { bookingId, slotNumber: { not: null } }, orderBy: { slotNumber: "asc" } });
    await collectSlotPayment({ bookingId, participantId: first!.id });
    const payments = await platformDb.payment.findMany({ where: { sourceId: bookingId } });
    expect(payments).toHaveLength(1);
    expect(await platformDb.paymentAllocation.count({ where: { paymentId: payments[0]!.id } })).toBe(1);
    await assertMoneyInvariants([]);
  });
});

describe("a game in pounds", () => {
  beforeEach(() => start({ gamePriceCurrency: "LBP", perPlayerSplitEnabled: true }));

  /** An APPROVED game priced 2,000,000 LBP; `days` negative is a game that already ended. */
  async function lbpGame(days: number) {
    const slot = await slotOn(fixture, days);
    const person = await db.$transaction((tx) => findOrCreatePerson(tx, { name: "Lina", phone: nextPhone() }));
    const bookingId = `bk_${randomUUID()}`;
    await platformDb.$executeRaw`
      INSERT INTO "Booking" ("id", "tenantId", "pitchId", "during", "status", "source",
        "priceCurrency", "priceLbp", "amountDueLbp")
      VALUES (${bookingId}, ${fixture.tenantId}, ${fixture.pitchId}, tstzrange(${slot.start}, ${slot.end}, '[)'),
        'APPROVED'::"BookingStatus", 'OWNER'::"BookingSource", 'LBP'::"Currency", 2000000::decimal, 2000000::decimal)`;
    await platformDb.bookingParticipant.create({
      data: { tenantId: fixture.tenantId, bookingId, personId: person.id, isRequester: true, amountDueLbp: "2000000" },
    });
    return bookingId;
  }

  it("collects before it is played, recorded exactly like a collection after it", async () => {
    const early = await lbpGame(3);
    const late = await lbpGame(-3);
    for (const bookingId of [early, late]) {
      await collectBookingPayment({ bookingId, tenders: [{ currency: "LBP", amount: D("2000000") }] });
    }
    expect(await shape(early)).toEqual(await shape(late));
    expect((await shape(early)).settlements).toEqual([["2000000", "0"]]);
    expect((await listOwed()).totalLbp.toFixed(0)).toBe("0");
    await assertMoneyInvariants([]);
  });

  it("a share of a split game is collected before the game too", async () => {
    const bookingId = await lbpGame(4);
    await switchToPerPlayer({ bookingId, count: 4 });
    const [first] = await platformDb.bookingParticipant.findMany({ where: { bookingId, slotNumber: { not: null } }, orderBy: { slotNumber: "asc" } });
    await collectSlotPayment({ bookingId, participantId: first!.id, tenders: [{ currency: "LBP", amount: D("500000") }] });
    expect(await platformDb.bookingSettlement.count({ where: { bookingId } })).toBe(1);
    await assertMoneyInvariants([]);
  });
});
