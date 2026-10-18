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
} from "@/modules/booking/infrastructure/bookings";
import { findOrCreatePerson } from "@/modules/people/application/find-or-create-person";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { endedGame, nextPhone, slotOn } from "./shop-helpers";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * DR-007 slice 3b: every raw SQL reader of game money is currency-aware. One LBP game is inserted
 * directly (valid under the CHECKs) next to a USD one; every reader that would see it refuses with
 * booking.lbp_not_supported. None returns a dollar figure that silently leaves the LBP game out.
 * Readers that list one person's games are per person by design: for a person with no LBP game
 * they work as before (said next to each such case).
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

  it("Today's earlier debts (ended games with money left): a USD total never leaves the LBP game out", async () => {
    await expect(listEndedWithRemaining(db, new Date(), 50)).rejects.toMatchObject(LBP_REFUSED);
  });

  it("the Owed page and Money's owed total", async () => {
    await expect(listOwedParticipations(db, new Date())).rejects.toMatchObject(LBP_REFUSED);
  });

  it("debt warnings: refused for a person with an LBP game; per person by design otherwise", async () => {
    await expect(listDebtParticipations(db, [lbp.personId, usd.personId])).rejects.toMatchObject(LBP_REFUSED);
    // Only this person's games are read, and none of them is in LBP: unchanged.
    const rows = await listDebtParticipations(db, [usd.personId]);
    expect(rows.map((row) => row.amountDueUsd.toFixed(2))).toEqual(["30.00"]);
  });

  it("the person page history (both pages) returns the LBP game in pounds (slice 5); stats still refuse it; per person by design otherwise", async () => {
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
    // The stats reader is an owed total: it changes in the next slice.
    await expect(listPersonStatRows(db, lbp.personId)).rejects.toMatchObject(LBP_REFUSED);
    // Only this person's games are read, and none of them is in LBP: unchanged.
    expect((await listPersonStatRows(db, usd.personId)).map((row) => row.amountDueUsd.toFixed(2))).toEqual(["30.00"]);
  });

  it("the per-player slots of an LBP game", async () => {
    await expect(listSlotsForBookings(db, [lbp.bookingId])).rejects.toMatchObject(LBP_REFUSED);
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

  it("the fee state behind the WhatsApp texts", async () => {
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
    expect(ended.map((row) => [row.id, row.amountDueUsd.toFixed(2)])).toEqual([[usd.bookingId, "30.00"]]);
    const owed = await listOwedParticipations(db, new Date());
    expect(owed.map((row) => [row.bookingId, row.amountDueUsd.toFixed(2)])).toEqual([[usd.bookingId, "30.00"]]);
  });
});
