import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import db from "@/lib/db";
import { platformDb } from "@/lib/platform-db";
import { adjustBookingDue } from "@/modules/booking/application/adjust-booking-due";
import { cancelBooking } from "@/modules/booking/application/cancel-booking";
import { collectBookingPayment } from "@/modules/booking/application/collect-booking-payment";
import { collectSlotPayment } from "@/modules/booking/application/collect-player-payment";
import { extendBooking } from "@/modules/booking/application/extend-booking";
import { listOwed } from "@/modules/booking/application/list-owed";
import { loadOutcomeNotify } from "@/modules/booking/application/load-outcome-notify";
import { recordNoShow } from "@/modules/booking/application/record-no-show";
import { switchToPerPlayer } from "@/modules/booking/application/switch-collection-mode";
import { setExchangeRate } from "@/modules/payment/application/set-exchange-rate";
import { findOrCreatePerson } from "@/modules/people/application/find-or-create-person";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { assertMoneyInvariants } from "./invariants";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { clearReactCache } from "./setup-mocks";
import { nextPhone, slotOn } from "./shop-helpers";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * DR-007 slice 8: cancel and no-show fees, the 30-minute extension and adjust-due on a game priced in
 * pounds (2,000,000 LBP), on an LBP stadium at 89,500. WRITTEN, NOT RUN when authored (the task
 * forbade running suites): treat every expectation as unverified until `npm run test:integration` has
 * been run. The cancellation window is 1440 hours and the late fee 50%, so a cancel of any future game
 * is a late cancel.
 */
let fixture: TestFixture;

const D = (value: number | string) => new Decimal(value);

beforeEach(async () => {
  await truncateAll();
  clearRequestStubs();
  fixture = await seedMinimalFixture();
  await platformDb.tenant.update({
    where: { id: fixture.tenantId },
    data: {
      settings: {
        gamePriceCurrency: "LBP",
        perPlayerSplitEnabled: true,
        cancellationWindowHours: 1440,
        lateCancellationFeePercent: 50,
        noShowFeePercent: 100,
      },
    },
  });
  clearReactCache();
  setTenantSlug(fixture.tenantSlug);
  setSessionCookie(fixture.sessionId);
  await setExchangeRate(D(89500));
});

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

/** An APPROVED game priced in pounds, `days` days from now (negative: it ended that many days ago). */
async function lbpGame(days: number, pounds = "2000000") {
  const slot = await slotOn(fixture, days);
  const person = await db.$transaction((tx) => findOrCreatePerson(tx, { name: "Lina", phone: nextPhone() }));
  const bookingId = `bk_${randomUUID()}`;
  await platformDb.$executeRaw`
    INSERT INTO "Booking" ("id", "tenantId", "pitchId", "during", "status", "source",
      "priceCurrency", "priceLbp", "amountDueLbp")
    VALUES (${bookingId}, ${fixture.tenantId}, ${fixture.pitchId}, tstzrange(${slot.start}, ${slot.end}, '[)'),
      'APPROVED'::"BookingStatus", 'OWNER'::"BookingSource", 'LBP'::"Currency", ${pounds}::decimal, ${pounds}::decimal)`;
  await platformDb.bookingParticipant.create({
    data: { tenantId: fixture.tenantId, bookingId, personId: person.id, isRequester: true, amountDueLbp: pounds },
  });
  return { bookingId, personId: person.id, slot };
}

const pounds = (value: { toString(): string } | null | undefined) => (value ? D(value.toString()).toFixed(0) : null);

async function bookingOf(bookingId: string) {
  const row = await platformDb.booking.findUniqueOrThrow({ where: { id: bookingId } });
  return {
    status: row.status,
    mode: row.collectionMode,
    priceLbp: pounds(row.priceLbp),
    dueLbp: pounds(row.amountDueLbp),
    priceUsd: row.priceUsd,
    dueUsd: row.amountDueUsd,
  };
}

async function changesOf(bookingId: string) {
  const rows = await platformDb.bookingDueChange.findMany({ where: { bookingId }, orderBy: { createdAt: "asc" } });
  return rows.map((row) => [row.reason, row.currency, pounds(row.fromLbp), pounds(row.toLbp), row.fromUsd, row.toUsd, row.note]);
}

describe("cancelling a game in pounds", () => {
  it("a player cancel inside the window charges the suggested fee, 50% of 2,000,000, in pounds", async () => {
    const { bookingId } = await lbpGame(2);
    await cancelBooking({ bookingId, initiator: "PLAYER" });

    expect(await bookingOf(bookingId)).toMatchObject({ status: "CANCELLED", dueLbp: "1000000", priceLbp: "2000000", dueUsd: null });
    expect(await changesOf(bookingId)).toEqual([["LATE_CANCELLATION_FEE", "LBP", "2000000", "1000000", null, null, "PLAYER"]]);
    // The fee is owed in pounds, next to nothing in dollars.
    const owed = await listOwed();
    expect([owed.totalLbp.toFixed(0), owed.totalUsd.toFixed(2)]).toEqual(["1000000", "0.00"]);
    await assertMoneyInvariants([]);
  });

  it("an owner cancel charges nothing", async () => {
    const { bookingId } = await lbpGame(2);
    await cancelBooking({ bookingId, initiator: "OWNER" });
    expect(await bookingOf(bookingId)).toMatchObject({ status: "CANCELLED", dueLbp: "0" });
    expect(await changesOf(bookingId)).toEqual([["CANCELLATION_NO_FEE", "LBP", "2000000", "0", null, null, "OWNER"]]);
    await assertMoneyInvariants([]);
  });

  it("a fee typed in pounds must be a multiple of the unit: 12,345 is refused, 1,500,000 is kept", async () => {
    const { bookingId } = await lbpGame(2);
    await expect(cancelBooking({ bookingId, initiator: "PLAYER", feeLbp: D(12345) })).rejects.toMatchObject({ key: "booking.fee_unit" });
    expect((await bookingOf(bookingId)).status).toBe("APPROVED");
    expect(await changesOf(bookingId)).toEqual([]);

    await cancelBooking({ bookingId, initiator: "PLAYER", feeLbp: D(1500000) });
    expect(await bookingOf(bookingId)).toMatchObject({ status: "CANCELLED", dueLbp: "1500000" });
    await assertMoneyInvariants([]);
  });

  it("a fee above the due, and a dollar fee on a game in pounds, are refused", async () => {
    const { bookingId } = await lbpGame(2);
    await expect(cancelBooking({ bookingId, initiator: "PLAYER", feeLbp: D(2005000) })).rejects.toMatchObject({ key: "booking.fee_above_due" });
    await expect(cancelBooking({ bookingId, initiator: "PLAYER", feeUsd: D("5.00") })).rejects.toMatchObject({ key: "form.invalid" });
    expect((await bookingOf(bookingId)).status).toBe("APPROVED");
  });

  it("the WhatsApp text names the fee in pounds", async () => {
    const { bookingId } = await lbpGame(2);
    await cancelBooking({ bookingId, initiator: "PLAYER" });
    const notify = await loadOutcomeNotify({ bookingId, kind: "cancelled" });
    expect(notify?.message).toMatch(/1,000,000/);
    expect(notify?.message).not.toContain("$");
  });

  it("cancelling a split game after one share is paid keeps the settlement and the remaining is right", async () => {
    const { bookingId } = await lbpGame(2);
    await switchToPerPlayer({ bookingId, count: 7 });
    const [, second] = await platformDb.bookingParticipant.findMany({ where: { bookingId, slotNumber: { not: null } }, orderBy: { slotNumber: "asc" } });
    await collectSlotPayment({ bookingId, participantId: second!.id });
    const settledBefore = await platformDb.bookingSettlement.findMany({ where: { bookingId } });
    const paymentsBefore = await platformDb.payment.count({ where: { sourceId: bookingId } });

    await cancelBooking({ bookingId, initiator: "PLAYER" });

    expect(await bookingOf(bookingId)).toMatchObject({ status: "CANCELLED", mode: "WHOLE", dueLbp: "1000000" });
    expect(await platformDb.bookingParticipant.count({ where: { bookingId } })).toBe(1);
    expect(await platformDb.paymentAllocation.count({ where: { participant: { bookingId } } })).toBe(0);
    // Every payment and settlement stays: 285,000 was settled, so 715,000 of the 1,000,000 fee is left.
    expect(await platformDb.payment.count({ where: { sourceId: bookingId } })).toBe(paymentsBefore);
    expect((await platformDb.bookingSettlement.findMany({ where: { bookingId } })).map((row) => pounds(row.lbpApplied))).toEqual(
      settledBefore.map((row) => pounds(row.lbpApplied)),
    );
    expect(settledBefore.map((row) => pounds(row.lbpApplied))).toEqual(["285000"]);
    expect((await listOwed()).totalLbp.toFixed(0)).toBe("715000");
    await assertMoneyInvariants([]);
  });

  it("an owner cancel of a game with money settled keeps exactly what was settled as the due", async () => {
    const { bookingId } = await lbpGame(2);
    await collectBookingPayment({ bookingId, tenders: [{ currency: "LBP", amount: D(600000) }] });
    await cancelBooking({ bookingId, initiator: "OWNER" });
    expect(await bookingOf(bookingId)).toMatchObject({ status: "CANCELLED", dueLbp: "600000" });
    expect((await listOwed()).totalLbp.toFixed(0)).toBe("0");
    await assertMoneyInvariants([]);
  });
});

describe("a no-show on a game in pounds", () => {
  it("charges the suggested fee, 100% of the due", async () => {
    const { bookingId } = await lbpGame(-2);
    await recordNoShow({ bookingId });
    expect(await bookingOf(bookingId)).toMatchObject({ status: "NO_SHOW", dueLbp: "2000000" });
    expect(await changesOf(bookingId)).toEqual([]);
    expect((await listOwed()).totalLbp.toFixed(0)).toBe("2000000");
    await assertMoneyInvariants([]);
  });

  it("with an edited fee writes the fee as a due change in pounds", async () => {
    const { bookingId } = await lbpGame(-2);
    await recordNoShow({ bookingId, feeLbp: D(500000) });
    expect(await bookingOf(bookingId)).toMatchObject({ status: "NO_SHOW", dueLbp: "500000" });
    expect(await changesOf(bookingId)).toEqual([["NO_SHOW_FEE", "LBP", "2000000", "500000", null, null, null]]);
    await assertMoneyInvariants([]);
  });

  it("refuses a fee that is not a multiple of the unit and leaves the game as it was", async () => {
    const { bookingId } = await lbpGame(-2);
    await expect(recordNoShow({ bookingId, feeLbp: D(12345) })).rejects.toMatchObject({ key: "booking.fee_unit" });
    expect((await bookingOf(bookingId)).status).toBe("APPROVED");
  });

  it("the WhatsApp reminder names the fee in pounds", async () => {
    const { bookingId } = await lbpGame(-2);
    await recordNoShow({ bookingId });
    const notify = await loadOutcomeNotify({ bookingId, kind: "no_show" });
    expect(notify?.message).toMatch(/2,000,000/);
    expect(notify?.message).not.toContain("$");
  });
});

describe("extending a game in pounds by 30 minutes", () => {
  it("adds half the price, rounded to the unit, to the price and the due, with an EXTENSION change in pounds", async () => {
    const { bookingId, slot } = await lbpGame(3);
    const result = await extendBooking({ bookingId, expectedEndsAt: slot.end });
    expect([result.currency, result.addedPrice.toFixed(0), result.amountDue.toFixed(0)]).toEqual(["LBP", "1000000", "3000000"]);

    expect(await bookingOf(bookingId)).toMatchObject({ priceLbp: "3000000", dueLbp: "3000000", priceUsd: null, dueUsd: null });
    expect(await changesOf(bookingId)).toEqual([["EXTENSION", "LBP", "2000000", "3000000", null, null, expect.any(String)]]);
    const [row] = await platformDb.$queryRaw<Array<{ end: Date }>>`SELECT upper(during) AS "end" FROM "Booking" WHERE id = ${bookingId}`;
    expect(row!.end.getTime()).toBe(slot.end.getTime() + 30 * 60_000);
    await assertMoneyInvariants([]);
  });

  it("a second extension is priced from the new total, so the per-minute price holds", async () => {
    const { bookingId, slot } = await lbpGame(3);
    await extendBooking({ bookingId, expectedEndsAt: slot.end });
    const second = await extendBooking({ bookingId, expectedEndsAt: new Date(slot.end.getTime() + 30 * 60_000) });
    expect(second.addedPrice.toFixed(0)).toBe("1000000");
    expect(await bookingOf(bookingId)).toMatchObject({ priceLbp: "4000000", dueLbp: "4000000" });
  });

  it("a member who may adjust can type another amount in pounds; a dollar amount is refused", async () => {
    const { bookingId, slot } = await lbpGame(3);
    await expect(extendBooking({ bookingId, expectedEndsAt: slot.end, addedPriceUsd: D("5.00") })).rejects.toMatchObject({ key: "form.invalid" });
    const result = await extendBooking({ bookingId, expectedEndsAt: slot.end, addedPriceLbp: D(600000) });
    expect(result.addedPrice.toFixed(0)).toBe("600000");
    expect(await bookingOf(bookingId)).toMatchObject({ priceLbp: "2600000", dueLbp: "2600000" });
    await assertMoneyInvariants([]);
  });
});

describe("adjusting the due of a game in pounds", () => {
  it("lowers the due in pounds and logs the change in pounds", async () => {
    const { bookingId } = await lbpGame(2);
    await adjustBookingDue({ bookingId, toLbp: D(1500000), reason: "DISCOUNT", note: null });
    expect(await bookingOf(bookingId)).toMatchObject({ dueLbp: "1500000", priceLbp: "2000000" });
    expect(await changesOf(bookingId)).toEqual([["DISCOUNT", "LBP", "2000000", "1500000", null, null, null]]);
    await assertMoneyInvariants([]);
  });

  it("refuses a due below what was collected, in pounds, and accepts one equal to it", async () => {
    const { bookingId } = await lbpGame(2);
    await collectBookingPayment({ bookingId, tenders: [{ currency: "LBP", amount: D(1000000) }] });
    await expect(adjustBookingDue({ bookingId, toLbp: D(900000), reason: "DISCOUNT", note: null })).rejects.toMatchObject({
      key: "booking.due_below_collected",
    });
    expect((await bookingOf(bookingId)).dueLbp).toBe("2000000");

    await adjustBookingDue({ bookingId, toLbp: D(1000000), reason: "DISCOUNT", note: null });
    expect((await bookingOf(bookingId)).dueLbp).toBe("1000000");
    expect((await listOwed()).totalLbp.toFixed(0)).toBe("0");
    await assertMoneyInvariants([]);
  });

  it("a dollar amount on a game in pounds is refused, and so is a split game", async () => {
    const { bookingId } = await lbpGame(2);
    await expect(adjustBookingDue({ bookingId, toUsd: D("10.00"), reason: "DISCOUNT", note: null })).rejects.toMatchObject({ key: "form.invalid" });
    await switchToPerPlayer({ bookingId, count: 7 });
    await expect(adjustBookingDue({ bookingId, toLbp: D(1500000), reason: "DISCOUNT", note: null })).rejects.toMatchObject({
      key: "booking.due_whole_only",
    });
  });
});
