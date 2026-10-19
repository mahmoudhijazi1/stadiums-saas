import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { loadActivityPage } from "@/app/owner/(app)/money/_components/activity-load";
import db from "@/lib/db";
import { platformDb } from "@/lib/platform-db";
import { collectBookingPayment } from "@/modules/booking/application/collect-booking-payment";
import { collectSlotPayment } from "@/modules/booking/application/collect-player-payment";
import { listOwed } from "@/modules/booking/application/list-owed";
import { switchToPerPlayer } from "@/modules/booking/application/switch-collection-mode";
import { summarizeLedgerPeriod } from "@/modules/ledger/application/summarize-ledger-period";
import { setExchangeRate } from "@/modules/payment/application/set-exchange-rate";
import { summarizeLbpPeriod } from "@/modules/payment/application/summarize-lbp-period";
import { sumCollectedUsd, sumTendersByDirectionAndCurrency } from "@/modules/payment/infrastructure/payments";
import { findOrCreatePerson } from "@/modules/people/application/find-or-create-person";
import { civilDateInTimeZone, formatCivilDate } from "@/modules/venue/domain/availability";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { assertMoneyInvariants } from "./invariants";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { clearReactCache } from "./setup-mocks";
import { nextPhone, slotOn, soonBooking } from "./shop-helpers";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * DR-007 decision 15, "keep it": the change a player leaves is recorded as its own KEPT_CHANGE payment,
 * in the same transaction as the game's payment, for a whole game and for a per-player share. WRITTEN,
 * NOT RUN when authored: treat every expectation as unverified until the integration suite has run.
 */
let fixture: TestFixture;

const D = (value: number | string) => new Decimal(value);
const RATE = 89500;

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

async function start(settings: Record<string, string | number | boolean> = {}) {
  await truncateAll();
  clearRequestStubs();
  fixture = await seedMinimalFixture();
  if (Object.keys(settings).length > 0) {
    await platformDb.tenant.update({ where: { id: fixture.tenantId }, data: { settings } });
  }
  clearReactCache();
  setTenantSlug(fixture.tenantSlug);
  setSessionCookie(fixture.sessionId);
  await setExchangeRate(D(RATE));
}

const today = () => {
  const day = formatCivilDate(civilDateInTimeZone(new Date(), "Asia/Beirut"));
  return { from: day, to: day };
};

async function payments(bookingId: string) {
  return platformDb.payment.findMany({
    where: { sourceId: bookingId },
    orderBy: { createdAt: "asc" },
    include: { tenders: true },
  });
}

async function cashIn() {
  const rows = await sumTendersByDirectionAndCurrency(db, new Date(Date.now() - 3_600_000), new Date(Date.now() + 3_600_000));
  const of = (currency: "USD" | "LBP") => rows.find((row) => row.direction === "IN" && row.currency === currency)?.amount.toFixed(0) ?? "0";
  return { usd: of("USD"), lbp: of("LBP") };
}

async function activityRows() {
  const page = await loadActivityPage({ ...today(), filter: "all" }, "en");
  return page.rows.map((row) => [row.amountText, row.secondary]);
}

describe("a $30 game paid with $50", () => {
  beforeEach(() => start());

  it("with keepChange: the game payment is $30 as ever, the $20 is its own KEPT_CHANGE payment with a ledger row and paymentId", async () => {
    const bookingId = await soonBooking(fixture);
    const change = await collectBookingPayment({ bookingId, tenders: [{ currency: "USD", amount: D("50") }], keepChange: true });
    expect([change.changeUsd.toFixed(2), change.changeLbp.toFixed(0)]).toEqual(["20.00", "0"]);

    const rows = await payments(bookingId);
    expect(rows.map((payment) => [payment.sourceType, payment.tenders.map((tender) => tender.amount.toFixed(2))])).toEqual([
      ["BOOKING", ["30.00"]],
      ["KEPT_CHANGE", ["20.00"]],
    ]);
    const kept = rows[1]!;
    expect(await platformDb.bookingSettlement.count({ where: { paymentId: kept.id } })).toBe(0);
    expect(await platformDb.paymentAllocation.count({ where: { paymentId: kept.id } })).toBe(0);

    const ledger = await platformDb.ledgerEntry.findMany({ where: { sourceId: bookingId }, orderBy: { createdAt: "asc" } });
    expect(ledger.map((row) => [row.sourceType, row.direction, row.amountUsd.toFixed(2), row.paymentId])).toEqual([
      ["BOOKING", "IN", "30.00", rows[0]!.id],
      ["KEPT_CHANGE", "IN", "20.00", kept.id],
    ]);

    // The game is Paid, never overpaid.
    expect((await sumCollectedUsd(db, "BOOKING", bookingId)).toFixed(2)).toBe("30.00");
    expect((await listOwed()).games).toBe(0);

    // Money In and Cash today count the $50 that is really in the drawer, in both views.
    expect((await summarizeLedgerPeriod(today())).inUsd.toFixed(2)).toBe("50.00");
    expect((await summarizeLbpPeriod({ ...today(), fallbackRate: D(RATE) })).inLbp.toFixed(0)).toBe(D(50).times(RATE).toFixed(0));
    expect(await cashIn()).toEqual({ usd: "50", lbp: "0" });

    // The activity row of the kept change is labelled, in its real currency.
    expect(await activityRows()).toEqual(expect.arrayContaining([["+$30", "Game"], ["+$20", "Kept change"]]));
    await assertMoneyInvariants([]);
  });

  it("without keepChange it is exactly slice 1: one payment, the $20 comes back as change, Money In is the $30", async () => {
    const bookingId = await soonBooking(fixture);
    const change = await collectBookingPayment({ bookingId, tenders: [{ currency: "USD", amount: D("50") }] });
    expect(change.changeUsd.toFixed(2)).toBe("20.00");
    expect((await payments(bookingId)).map((payment) => payment.sourceType)).toEqual(["BOOKING"]);
    expect((await summarizeLedgerPeriod(today())).inUsd.toFixed(2)).toBe("30.00");
    expect(await cashIn()).toEqual({ usd: "30", lbp: "0" });
    await assertMoneyInvariants([]);
  });

  it("keepChange with no change writes nothing extra", async () => {
    const bookingId = await soonBooking(fixture);
    const change = await collectBookingPayment({ bookingId, tenders: [{ currency: "USD", amount: D("30") }], keepChange: true });
    expect([change.changeUsd.toFixed(2), change.changeLbp.toFixed(0)]).toEqual(["0.00", "0"]);
    expect((await payments(bookingId)).map((payment) => payment.sourceType)).toEqual(["BOOKING"]);
    expect(await platformDb.ledgerEntry.count({ where: { sourceType: "KEPT_CHANGE" } })).toBe(0);
    await assertMoneyInvariants([]);
  });
});

describe("a game in pounds", () => {
  beforeEach(() => start({ gamePriceCurrency: "LBP", perPlayerSplitEnabled: true }));

  /** An APPROVED game priced 2,000,000 LBP, `days` days from now. */
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

  it("2,100,000 on a 2,000,000 game with keepChange: 100,000 LBP is kept, the game is settled exactly as before", async () => {
    const bookingId = await lbpGame(2);
    const change = await collectBookingPayment({ bookingId, tenders: [{ currency: "LBP", amount: D("2100000") }], keepChange: true });
    expect([change.changeLbp.toFixed(0), change.changeUsd.toFixed(2)]).toEqual(["100000", "0.00"]);

    const rows = await payments(bookingId);
    expect(rows.map((payment) => [payment.sourceType, payment.tenders.map((tender) => `${tender.currency}${tender.amount.toFixed(0)}`)])).toEqual([
      ["BOOKING", ["LBP2000000"]],
      ["KEPT_CHANGE", ["LBP100000"]],
    ]);
    const settlements = await platformDb.bookingSettlement.findMany({ where: { bookingId } });
    expect(settlements.map((row) => [row.paymentId, row.lbpApplied.toFixed(0)])).toEqual([[rows[0]!.id, "2000000"]]);
    expect(rows[1]!.tenders[0]!.rateAtTime?.toFixed(0)).toBe(String(RATE));

    const ledger = await platformDb.ledgerEntry.findMany({ where: { sourceId: bookingId }, orderBy: { createdAt: "asc" } });
    expect(ledger.map((row) => [row.sourceType, row.paymentId])).toEqual([["BOOKING", rows[0]!.id], ["KEPT_CHANGE", rows[1]!.id]]);

    expect((await listOwed()).totalLbp.toFixed(0)).toBe("0");
    expect((await summarizeLbpPeriod({ ...today(), fallbackRate: D(RATE) })).inLbp.toFixed(0)).toBe("2100000");
    expect(await cashIn()).toEqual({ usd: "0", lbp: "2100000" });
    expect(await activityRows()).toEqual(expect.arrayContaining([["+2,000,000 LBP", "Game"], ["+100,000 LBP", "Kept change"]]));
    await assertMoneyInvariants([]);
  });

  it("without keepChange the 100,000 comes back as change and nothing extra is written", async () => {
    const bookingId = await lbpGame(2);
    const change = await collectBookingPayment({ bookingId, tenders: [{ currency: "LBP", amount: D("2100000") }] });
    expect(change.changeLbp.toFixed(0)).toBe("100000");
    expect((await payments(bookingId)).map((payment) => payment.sourceType)).toEqual(["BOOKING"]);
    expect(await cashIn()).toEqual({ usd: "0", lbp: "2000000" });
    await assertMoneyInvariants([]);
  });

  it("a per-player share paid with 600,000 on a 500,000 share, kept: the share is paid, 100,000 LBP is its own KEPT_CHANGE payment", async () => {
    const bookingId = await lbpGame(3);
    await switchToPerPlayer({ bookingId, count: 4 });
    const [first] = await platformDb.bookingParticipant.findMany({
      where: { bookingId, slotNumber: { not: null } },
      orderBy: { slotNumber: "asc" },
    });
    const change = await collectSlotPayment({
      bookingId,
      participantId: first!.id,
      tenders: [{ currency: "LBP", amount: D("600000") }],
      keepChange: true,
    });
    expect(change.changeLbp.toFixed(0)).toBe("100000");

    const rows = await payments(bookingId);
    expect(rows.map((payment) => [payment.sourceType, payment.tenders.map((tender) => tender.amount.toFixed(0))])).toEqual([
      ["BOOKING", ["500000"]],
      ["KEPT_CHANGE", ["100000"]],
    ]);
    // The share is credited as without the flag: one settlement and one allocation, on the game payment.
    expect(await platformDb.bookingSettlement.count({ where: { bookingId } })).toBe(1);
    const allocations = await platformDb.paymentAllocation.findMany({ where: { paymentId: { in: rows.map((payment) => payment.id) } } });
    expect(allocations.map((row) => [row.paymentId, row.participantId, row.amountLbp?.toFixed(0)])).toEqual([[rows[0]!.id, first!.id, "500000"]]);
    expect(await cashIn()).toEqual({ usd: "0", lbp: "600000" });
    await assertMoneyInvariants([]);
  });
});
