import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import db from "@/lib/db";
import { platformDb } from "@/lib/platform-db";
import { collectBookingPayment } from "@/modules/booking/application/collect-booking-payment";
import { collectAllRemaining, collectSlotPayment } from "@/modules/booking/application/collect-player-payment";
import { considerSharePaid } from "@/modules/booking/application/consider-share-paid";
import { listOwed } from "@/modules/booking/application/list-owed";
import { loadOwnerDay } from "@/modules/booking/application/load-owner-day";
import { switchToPerPlayer, switchToWhole } from "@/modules/booking/application/switch-collection-mode";
import { collapseToWhole } from "@/modules/booking/infrastructure/bookings";
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
 * DR-007 slice 7: a game priced in pounds splits into shares in whole 5,000 LBP units and collects
 * them in pounds, on an LBP stadium at 89,500. WRITTEN, NOT RUN when authored (the task forbade
 * running suites): treat every expectation as unverified until `npm run test:integration` has been run.
 *
 * 2,000,000 LBP over 7 is 290,000 on slot 1 and six of 285,000.
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
    data: { settings: { gamePriceCurrency: "LBP", perPlayerSplitEnabled: true } },
  });
  clearReactCache();
  setTenantSlug(fixture.tenantSlug);
  setSessionCookie(fixture.sessionId);
  await setExchangeRate(D(89500));
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

async function slotsOf(bookingId = game.bookingId) {
  return platformDb.bookingParticipant.findMany({ where: { bookingId, slotNumber: { not: null } }, orderBy: { slotNumber: "asc" } });
}

const pounds = (value: { toString(): string } | null | undefined) => D(value?.toString() ?? "NaN").toFixed(0);

async function split(count = 7) {
  await switchToPerPlayer({ bookingId: game.bookingId, count });
  return slotsOf();
}

async function settlements(bookingId = game.bookingId) {
  const rows = await platformDb.bookingSettlement.findMany({ where: { bookingId }, orderBy: { createdAt: "asc" } });
  return rows.map((row) => [pounds(row.lbpApplied), D(row.usdApplied.toString()).toFixed(2)]);
}

async function allocations(bookingId = game.bookingId) {
  const rows = await platformDb.paymentAllocation.findMany({
    where: { participant: { bookingId } },
    include: { participant: true },
    orderBy: [{ payment: { createdAt: "asc" } }, { participant: { slotNumber: "asc" } }],
  });
  return rows.map((row) => [row.participant.slotNumber, pounds(row.amountLbp), row.amountUsd]);
}

async function tenders(bookingId = game.bookingId) {
  const rows = await platformDb.paymentTender.findMany({ where: { payment: { sourceId: bookingId } }, orderBy: { payment: { createdAt: "asc" } } });
  return rows.map((row) => [row.currency, D(row.amount.toString()).toString(), D(row.usdEquivalent.toString()).toFixed(2), pounds(row.rateAtTime)]);
}

async function ledgerIn(bookingId = game.bookingId) {
  const sum = await platformDb.ledgerEntry.aggregate({ where: { sourceId: bookingId, direction: "IN" }, _sum: { amountUsd: true } });
  return D(sum._sum.amountUsd?.toString() ?? "0").toFixed(2);
}

describe("splitting an LBP game", () => {
  it("shares are whole 5,000 LBP units in amountDueLbp: 290,000 on slot 1 and six of 285,000", async () => {
    const slots = await split(7);
    expect(slots.map((slot) => pounds(slot.amountDueLbp))).toEqual(["290000", "285000", "285000", "285000", "285000", "285000", "285000"]);
    expect(slots.every((slot) => slot.amountDueUsd === null)).toBe(true);
    expect(slots[0]?.isRequester).toBe(true);
    expect(slots[0]?.personId).toBe(game.personId);
    const booking = await platformDb.booking.findUniqueOrThrow({ where: { id: game.bookingId } });
    expect([booking.collectionMode, pounds(booking.amountDueLbp)]).toEqual(["PER_PLAYER", "2000000"]);
    expect(await platformDb.bookingDueChange.count({ where: { bookingId: game.bookingId } })).toBe(0);
    await assertMoneyInvariants([]);
  });

  it("Today shows the slots in pounds", async () => {
    await split(7);
    const row = (await loadOwnerDay(undefined)).toCollect.find((candidate) => candidate.id === game.bookingId);
    if (!row || row.currency !== "LBP") throw new Error("expected the LBP game in To collect");
    expect(row.slots.map((slot) => [slot.currency, slot.due.toFixed(0), slot.paid.toFixed(0)]).slice(0, 2)).toEqual([
      ["LBP", "290000", "0"],
      ["LBP", "285000", "0"],
    ]);
    expect(row.unassignedLbp.toFixed(0)).toBe("0");
  });

  it("a new split of a USD game is in whole dollars too: $30 over 7 is $5, $5 and five of $4", async () => {
    const old = await endedGame(fixture, 3, "Ali", nextPhone());
    await switchToPerPlayer({ bookingId: old.bookingId, count: 7 });
    const slots = await slotsOf(old.bookingId);
    expect(slots.map((slot) => D(slot.amountDueUsd!.toString()).toFixed(2))).toEqual(["5.00", "5.00", "4.00", "4.00", "4.00", "4.00", "4.00"]);
    expect(slots.every((slot) => slot.amountDueLbp === null)).toBe(true);
    await assertMoneyInvariants([]);
  });
});

describe("collecting shares in pounds", () => {
  it("one share, exact in pounds: one payment, tender, ledger IN, allocation and settlement", async () => {
    const [, second] = await split();
    const change = await collectSlotPayment({ bookingId: game.bookingId, participantId: second!.id });
    expect([change.changeLbp.toFixed(0), change.changeUsd.toFixed(2)]).toEqual(["0", "0.00"]);

    const [payment] = await platformDb.payment.findMany({ where: { sourceId: game.bookingId } });
    expect([payment!.dueCurrency, pounds(payment!.amountDueLbp), payment!.amountDueUsd]).toEqual(["LBP", "2000000", null]);
    expect(await tenders()).toEqual([["LBP", "285000", "3.18", "89500"]]);
    expect(await ledgerIn()).toBe("3.18");
    expect(await allocations()).toEqual([[2, "285000", null]]);
    expect(await settlements()).toEqual([["285000", "0.00"]]);
    expect((await listOwed()).totalLbp.toFixed(0)).toBe("1715000");
    await assertMoneyInvariants([]);
  });

  it("two shares with one payment: pay-all with exactly 575,000 credits slots 1 and 2", async () => {
    await split();
    await collectAllRemaining({ bookingId: game.bookingId, tenders: [lbp(575000)] });
    expect(await platformDb.payment.count({ where: { sourceId: game.bookingId } })).toBe(1);
    expect(await allocations()).toEqual([[1, "290000", null], [2, "285000", null]]);
    expect(await settlements()).toEqual([["575000", "0.00"]]);
    expect((await listOwed()).totalLbp.toFixed(0)).toBe("1425000");
    await assertMoneyInvariants([]);
  });

  it("pay-all without cash takes exactly what is owed, in pounds, and the game is Paid", async () => {
    await split();
    await collectAllRemaining({ bookingId: game.bookingId });
    expect((await allocations()).reduce((sum, row) => sum.plus(row[1] as string), D(0)).toFixed(0)).toBe("2000000");
    expect(await settlements()).toEqual([["2000000", "0.00"]]);
    expect((await listOwed()).totalLbp.toFixed(0)).toBe("0");
    await expect(collectAllRemaining({ bookingId: game.bookingId })).rejects.toMatchObject({ key: "payment.nothing_due" });
    await assertMoneyInvariants([]);
  });

  it("overpaying a share gives the rest back as change; only the share is recorded", async () => {
    const [, second] = await split();
    const change = await collectSlotPayment({ bookingId: game.bookingId, participantId: second!.id, tenders: [lbp(300000)] });
    expect([change.changeLbp.toFixed(0), change.changeUsd.toFixed(2)]).toEqual(["15000", "0.00"]);
    expect(await tenders()).toEqual([["LBP", "285000", "3.18", "89500"]]);
    expect(await allocations()).toEqual([[2, "285000", null]]);
    expect(await settlements()).toEqual([["285000", "0.00"]]);
    await assertMoneyInvariants([]);
  });

  it("paying a share in dollars: $4 keeps $3.19 and gives back $0.81", async () => {
    const [, second] = await split();
    const change = await collectSlotPayment({ bookingId: game.bookingId, participantId: second!.id, tenders: [usd(4)] });
    expect([change.changeUsd.toFixed(2), change.changeLbp.toFixed(0)]).toEqual(["0.81", "0"]);
    expect(await tenders()).toEqual([["USD", "3.19", "3.19", "89500"]]);
    expect(await ledgerIn()).toBe("3.19");
    expect(await allocations()).toEqual([[2, "285000", null]]);
    expect(await settlements()).toEqual([["285000", "3.19"]]);
    await assertMoneyInvariants([]);
  });

  it("a rate change between two shares does not move the pounds owed", async () => {
    const [, second, third] = await split();
    await collectSlotPayment({ bookingId: game.bookingId, participantId: second!.id });
    await setExchangeRate(D(100000));
    clearReactCache();
    expect((await listOwed()).totalLbp.toFixed(0)).toBe("1715000");

    // $2.85 at 100,000 is exactly the 285,000 of the third share.
    const change = await collectSlotPayment({ bookingId: game.bookingId, participantId: third!.id, tenders: [usd("2.85")] });
    expect([change.changeUsd.toFixed(2), change.changeLbp.toFixed(0)]).toEqual(["0.00", "0"]);
    expect(await tenders()).toEqual([["LBP", "285000", "3.18", "89500"], ["USD", "2.85", "2.85", "100000"]]);
    expect(await settlements()).toEqual([["285000", "0.00"], ["285000", "2.85"]]);
    expect((await listOwed()).totalLbp.toFixed(0)).toBe("1430000");
    await assertMoneyInvariants([]);
  });

  it("money settled before the split is Unassigned and caps the charge", async () => {
    await collectBookingPayment({ bookingId: game.bookingId, tenders: [lbp(1900000)] });
    const [, second, third] = await split();
    const day = (await loadOwnerDay(undefined)).toCollect.find((row) => row.id === game.bookingId);
    expect(day?.currency === "LBP" && day.unassignedLbp.toFixed(0)).toBe("1900000");

    // 100,000 is all the game still owes: the first tap takes it, the second finds nothing due.
    await collectSlotPayment({ bookingId: game.bookingId, participantId: second!.id });
    await expect(collectSlotPayment({ bookingId: game.bookingId, participantId: third!.id })).rejects.toMatchObject({ key: "payment.nothing_due" });
    expect(await allocations()).toEqual([[2, "100000", null]]);
    expect(await settlements()).toEqual([["1900000", "0.00"], ["100000", "0.00"]]);
    expect((await listOwed()).totalLbp.toFixed(0)).toBe("0");
    await assertMoneyInvariants([]);
  });

  it("two concurrent collections never settle more than the game owes", async () => {
    await collectBookingPayment({ bookingId: game.bookingId, tenders: [lbp(1900000)] });
    const [, second, third] = await split();
    const results = await Promise.allSettled([
      collectSlotPayment({ bookingId: game.bookingId, participantId: second!.id }),
      collectSlotPayment({ bookingId: game.bookingId, participantId: third!.id }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ key: "payment.nothing_due" });
    const settled = (await settlements()).reduce((sum, [applied]) => sum.plus(applied!), D(0));
    expect(settled.toFixed(0)).toBe("2000000");
    await assertMoneyInvariants([]);
  });

  it("the same share tapped twice at once is paid once", async () => {
    const [, second] = await split();
    const results = await Promise.allSettled([
      collectSlotPayment({ bookingId: game.bookingId, participantId: second!.id }),
      collectSlotPayment({ bookingId: game.bookingId, participantId: second!.id }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await settlements()).toEqual([["285000", "0.00"]]);
    await assertMoneyInvariants([]);
  });
});

describe("Consider it paid on one share", () => {
  async function dueChanges() {
    const rows = await platformDb.bookingDueChange.findMany({ where: { bookingId: game.bookingId } });
    return rows.map((row) => [row.reason, row.currency, pounds(row.fromLbp), pounds(row.toLbp)]);
  }

  it("3,000 left on a share: the share and the game's due drop by 3,000 and the share is Paid", async () => {
    const [, second] = await split();
    await collectSlotPayment({ bookingId: game.bookingId, participantId: second!.id, tenders: [lbp(282000)] });
    await considerSharePaid({ bookingId: game.bookingId, participantId: second!.id });

    expect(await dueChanges()).toEqual([["ROUNDING", "LBP", "2000000", "1997000"]]);
    const booking = await platformDb.booking.findUniqueOrThrow({ where: { id: game.bookingId } });
    expect(pounds(booking.amountDueLbp)).toBe("1997000");
    const slots = await slotsOf();
    expect(pounds(slots[1]?.amountDueLbp)).toBe("282000");
    expect(slots.reduce((sum, slot) => sum.plus(slot.amountDueLbp!.toString()), D(0)).toFixed(0)).toBe("1997000");
    await expect(considerSharePaid({ bookingId: game.bookingId, participantId: second!.id })).rejects.toMatchObject({ key: "booking.not_forgivable" });
    await assertMoneyInvariants([]);
  });

  it("6,000 left on a share is refused and nothing is written", async () => {
    const [, second] = await split();
    await collectSlotPayment({ bookingId: game.bookingId, participantId: second!.id, tenders: [lbp(279000)] });
    await expect(considerSharePaid({ bookingId: game.bookingId, participantId: second!.id })).rejects.toMatchObject({ key: "booking.not_forgivable" });
    expect(await dueChanges()).toEqual([]);
    expect(pounds((await slotsOf())[1]?.amountDueLbp)).toBe("285000");
  });

  it("a share that money from before the split covers is refused", async () => {
    await collectBookingPayment({ bookingId: game.bookingId, tenders: [lbp(1999000)] });
    const [, second] = await split();
    await expect(considerSharePaid({ bookingId: game.bookingId, participantId: second!.id })).rejects.toMatchObject({ key: "booking.not_forgivable" });
    expect(await dueChanges()).toEqual([]);
  });
});

describe("going back to whole", () => {
  it("the switch is refused once a share is paid, as for a USD game", async () => {
    const [, second] = await split();
    await collectSlotPayment({ bookingId: game.bookingId, participantId: second!.id });
    await expect(switchToWhole({ bookingId: game.bookingId })).rejects.toMatchObject({ key: "booking.switch_has_allocations" });
    expect(await slotsOf()).toHaveLength(7);
  });

  it("collapsing after two shares are paid keeps every payment, tender, ledger row and settlement", async () => {
    const [, second, third] = await split();
    await collectSlotPayment({ bookingId: game.bookingId, participantId: second!.id });
    await collectSlotPayment({ bookingId: game.bookingId, participantId: third!.id, tenders: [lbp(285000)] });
    const before = {
      payments: await platformDb.payment.count({ where: { sourceId: game.bookingId } }),
      tenders: await tenders(),
      ledger: await ledgerIn(),
      settlements: await settlements(),
    };

    await db.$transaction((tx) =>
      collapseToWhole(tx, { bookingId: game.bookingId, due: { currency: "LBP", amount: D(2000000) } }),
    );

    const booking = await platformDb.booking.findUniqueOrThrow({ where: { id: game.bookingId } });
    expect(booking.collectionMode).toBe("WHOLE");
    const participants = await platformDb.bookingParticipant.findMany({ where: { bookingId: game.bookingId } });
    expect(participants).toHaveLength(1);
    expect([participants[0]?.slotNumber, pounds(participants[0]?.amountDueLbp), participants[0]?.amountDueUsd]).toEqual([null, "2000000", null]);
    expect(await platformDb.paymentAllocation.count({ where: { participant: { bookingId: game.bookingId } } })).toBe(0);
    expect({
      payments: await platformDb.payment.count({ where: { sourceId: game.bookingId } }),
      tenders: await tenders(),
      ledger: await ledgerIn(),
      settlements: await settlements(),
    }).toEqual(before);

    // The remaining is the due minus what was settled, and the game collects as a whole again.
    expect((await listOwed()).totalLbp.toFixed(0)).toBe("1430000");
    await collectBookingPayment({ bookingId: game.bookingId, tenders: [lbp(1430000)] });
    expect((await listOwed()).totalLbp.toFixed(0)).toBe("0");
    expect((await settlements()).reduce((sum, [applied]) => sum.plus(applied!), D(0)).toFixed(0)).toBe("2000000");
    await assertMoneyInvariants([]);
  });
});
