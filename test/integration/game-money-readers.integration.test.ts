import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import db from "@/lib/db";
import { platformDb } from "@/lib/platform-db";
import {
  findBookingFeeState,
  findBookingForDecision,
  findBookingForUpdate,
  listBookingsForStartDay,
  listDebtParticipations,
  listEndedWithRemaining,
  listOwedParticipations,
  listPersonBookingRows,
  listPersonStatRows,
  listSlotsForBookings,
  setBookingEndAndPrice,
  usdSlots,
} from "@/modules/booking/infrastructure/bookings";
import { findOrCreatePerson } from "@/modules/people/application/find-or-create-person";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { endedGame, nextPhone, slotOn } from "./shop-helpers";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * DR-007 slice 3b and the readers slice: every raw SQL reader of game money is currency-aware. One
 * LBP game is inserted directly (valid under the CHECKs) next to a USD one. The money-writing reads
 * (the locked single-booking reads, the fee state behind the WhatsApp texts, the dollar slot
 * charging) still refuse the LBP game with booking.lbp_not_supported; every reader that shows what
 * is owed returns it in pounds, next to the USD game in dollars, and never leaves it out.
 */
let fixture: TestFixture;
let usd: { bookingId: string; personId: string };
let lbp: { bookingId: string; personId: string; start: Date; end: Date };

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
  clearRequestStubs();
  fixture = await seedMinimalFixture();
  setTenantSlug(fixture.tenantSlug);
  setSessionCookie(fixture.sessionId);
  usd = await endedGame(fixture, 2, "Ali", nextPhone());
  lbp = await insertEndedLbpGame(3);
});

/** An APPROVED game priced 2,000,000 LBP that ended `daysAgo` days ago, with a requester and one LBP slot. */
async function insertEndedLbpGame(daysAgo: number) {
  const slot = await slotOn(fixture, -daysAgo);
  const person = await db.$transaction((tx) => findOrCreatePerson(tx, { name: "Lina", phone: nextPhone() }));
  const bookingId = `bk_${randomUUID()}`;
  await platformDb.$executeRaw`
    INSERT INTO "Booking" ("id", "tenantId", "pitchId", "during", "status", "source",
      "priceCurrency", "priceLbp", "amountDueLbp")
    VALUES (${bookingId}, ${fixture.tenantId}, ${fixture.pitchId}, tstzrange(${slot.start}, ${slot.end}, '[)'),
      'APPROVED'::"BookingStatus", 'OWNER'::"BookingSource", 'LBP'::"Currency", 2000000, 2000000)`;
  await platformDb.bookingParticipant.create({
    data: { tenantId: fixture.tenantId, bookingId, personId: person.id, isRequester: true, amountDueLbp: "2000000" },
  });
  await platformDb.bookingParticipant.create({
    data: { tenantId: fixture.tenantId, bookingId, isRequester: false, slotNumber: 1, amountDueLbp: "285000" },
  });
  return { bookingId, personId: person.id, start: slot.start, end: slot.end };
}

const LBP_REFUSED = { key: "booking.lbp_not_supported" };

describe("raw SQL readers refuse an LBP game instead of reading it as dollars", () => {
  it("the locked and plain single-booking reads (slice 3)", async () => {
    await expect(db.$transaction((tx) => findBookingForUpdate(tx, lbp.bookingId))).rejects.toMatchObject(LBP_REFUSED);
    await expect(findBookingForDecision(db, lbp.bookingId)).rejects.toMatchObject(LBP_REFUSED);
    expect((await findBookingForDecision(db, usd.bookingId))?.amountDueUsd.toFixed(2)).toBe("30.00");
  });

  it("the day view of the day the LBP game was played returns it with its price and due in LBP (slice 5)", async () => {
    const from = new Date(lbp.start.getTime() - 60 * 60_000);
    const to = new Date(lbp.end.getTime() + 60 * 60_000);
    const rows = await listBookingsForStartDay(db, from, to);
    const row = rows.find((item) => item.id === lbp.bookingId);
    expect(row?.price.currency).toBe("LBP");
    expect(row?.price.amount.toFixed(0)).toBe("2000000");
    expect(row?.amountDue.currency).toBe("LBP");
    expect(row?.amountDue.amount.toFixed(0)).toBe("2000000");
    // The stored row: the currency is LBP and the USD columns are null.
    const stored = await platformDb.booking.findUniqueOrThrow({ where: { id: lbp.bookingId } });
    expect([stored.priceCurrency, stored.priceUsd, stored.amountDueUsd]).toEqual(["LBP", null, null]);
    expect(stored.priceLbp?.toFixed(0)).toBe("2000000");
  });

  it("Today's earlier debts (ended games with money left) list the LBP game next to the USD one, each in its currency", async () => {
    const rows = await listEndedWithRemaining(db, new Date(), 50);
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.size).toBe(2);
    expect([byId.get(usd.bookingId)!.amountDue.currency, byId.get(usd.bookingId)!.amountDue.amount.toFixed(2)]).toEqual(["USD", "30.00"]);
    const pounds = byId.get(lbp.bookingId)!;
    expect([pounds.amountDue.currency, pounds.amountDue.amount.toFixed(0), pounds.settledLbp.toFixed(0)]).toEqual(["LBP", "2000000", "0"]);
  });

  it("the Owed page and Money's owed total read the LBP game in pounds", async () => {
    const rows = await listOwedParticipations(db, new Date());
    const requesterOf = (bookingId: string) => rows.find((row) => row.bookingId === bookingId && row.isRequester)!;
    expect([requesterOf(usd.bookingId).currency, requesterOf(usd.bookingId).amountDue.toFixed(2), requesterOf(usd.bookingId).collected.toFixed(2)]).toEqual(["USD", "30.00", "0.00"]);
    expect([requesterOf(lbp.bookingId).currency, requesterOf(lbp.bookingId).amountDue.toFixed(0), requesterOf(lbp.bookingId).collected.toFixed(0)]).toEqual(["LBP", "2000000", "0"]);
  });

  it("debt warnings read both people, each in the currency of their game", async () => {
    const rows = await listDebtParticipations(db, [lbp.personId, usd.personId]);
    expect(rows.map((row) => [row.personId === lbp.personId ? "lbp-player" : "usd-player", row.currency, row.amountDue.toFixed(2)]).sort()).toEqual([
      ["lbp-player", "LBP", "2000000.00"],
      ["usd-player", "USD", "30.00"],
    ]);
    // Only this person's games are read: unchanged for the dollar player.
    const only = await listDebtParticipations(db, [usd.personId]);
    expect(only.map((row) => row.amountDue.toFixed(2))).toEqual(["30.00"]);
  });

  it("the person page history (both pages) returns the LBP game in pounds, and the stats rows carry its currency", async () => {
    const first = await listPersonBookingRows(db, lbp.personId, null, 10);
    const cursor = { start: new Date(Date.now() + 86_400_000), id: "zzz" };
    const second = await listPersonBookingRows(db, lbp.personId, cursor, 10);
    for (const rows of [first, second]) {
      expect(rows.map((row) => row.id)).toEqual([lbp.bookingId]);
      const row = rows[0]!;
      expect([row.price.currency, row.price.amount.toFixed(0)]).toEqual(["LBP", "2000000"]);
      expect([row.amountDue.currency, row.amountDue.amount.toFixed(0)]).toEqual(["LBP", "2000000"]);
      expect([row.participantDue.currency, row.participantDue.amount.toFixed(0)]).toEqual(["LBP", "2000000"]);
      expect([row.collected.currency, row.collected.amount.toFixed(0)]).toEqual(["LBP", "0"]);
    }
    // The stats rows: the LBP player's game in pounds, the USD player's in dollars.
    const stats = await listPersonStatRows(db, lbp.personId);
    expect(stats.map((row) => [row.currency, row.amountDue.toFixed(0), row.collected.toFixed(0)])).toEqual([["LBP", "2000000", "0"]]);
    expect((await listPersonStatRows(db, usd.personId)).map((row) => [row.currency, row.amountDue.toFixed(2)])).toEqual([["USD", "30.00"]]);
  });

  it("the per-player slots of an LBP game are in pounds; the dollar slot charging refuses them", async () => {
    const slots = await listSlotsForBookings(db, [lbp.bookingId]);
    expect(slots.map((slot) => [slot.currency, slot.due.toFixed(0), slot.paid.toFixed(0)])).toEqual([["LBP", "285000", "0"]]);
    expect(() => usdSlots(slots)).toThrow(expect.objectContaining(LBP_REFUSED));
  });

  it("pounds allocated on a USD game's slot are refused, never dropped from the paid total", async () => {
    const participant = await platformDb.bookingParticipant.create({
      data: { tenantId: fixture.tenantId, bookingId: usd.bookingId, isRequester: false, slotNumber: 2, amountDueUsd: "10.00" },
    });
    const payment = await platformDb.payment.create({
      data: { tenantId: fixture.tenantId, sourceType: "BOOKING", sourceId: usd.bookingId, amountDueUsd: "30.00" },
    });
    await platformDb.paymentAllocation.create({
      data: { tenantId: fixture.tenantId, paymentId: payment.id, participantId: participant.id, amountLbp: "90000" },
    });
    await expect(listSlotsForBookings(db, [usd.bookingId])).rejects.toMatchObject(LBP_REFUSED);
  });

  it("the fee state behind the cancel and no-show WhatsApp texts stays dollars (fees in pounds are DR-007 slice 8)", async () => {
    await expect(findBookingFeeState(db, lbp.bookingId)).rejects.toMatchObject(LBP_REFUSED);
    expect((await findBookingFeeState(db, usd.bookingId))?.amountDueUsd.toFixed(2)).toBe("30.00");
  });

  it("extending an LBP game in dollars is refused, not reported as not found", async () => {
    await expect(
      db.$transaction((tx) =>
        setBookingEndAndPrice(tx, {
          bookingId: lbp.bookingId,
          newEnd: new Date(lbp.end.getTime() + 30 * 60_000),
          priceUsd: new Decimal("45.00"),
        }),
      ),
    ).rejects.toMatchObject(LBP_REFUSED);
    await expect(
      db.$transaction((tx) =>
        setBookingEndAndPrice(tx, { bookingId: "no-such-booking", newEnd: new Date(), priceUsd: new Decimal("1.00") }),
      ),
    ).rejects.toMatchObject({ key: "booking.not_found" });
  });

  it("with no LBP game in the stadium, the USD readers read as before", async () => {
    await platformDb.bookingParticipant.deleteMany({ where: { bookingId: lbp.bookingId } });
    await platformDb.booking.delete({ where: { id: lbp.bookingId } });
    const ended = await listEndedWithRemaining(db, new Date(), 50);
    expect(ended.map((row) => [row.id, row.amountDue.amount.toFixed(2)])).toEqual([[usd.bookingId, "30.00"]]);
    const owed = await listOwedParticipations(db, new Date());
    expect(owed.map((row) => [row.bookingId, row.amountDue.toFixed(2)])).toEqual([[usd.bookingId, "30.00"]]);
  });
});
