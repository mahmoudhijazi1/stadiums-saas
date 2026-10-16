import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import db from "@/lib/db";
import { platformDb } from "@/lib/platform-db";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture, seedTwoTenants } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * DR-007 slice 3: the database keeps a game's money in exactly one currency. Each table accepts a
 * USD row as today and an LBP row, and refuses both, neither, or the pair of the other currency
 * (migration 20261016090000_game_price_currency). BookingSettlement is tenant-scoped.
 */
afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

type Money = {
  currency?: "USD" | "LBP";
  priceUsd?: string | null;
  amountDueUsd?: string | null;
  priceLbp?: string | null;
  amountDueLbp?: string | null;
};

let hourSeq = 0;

/** A PENDING booking (no exclusion constraint), written by raw SQL as the app does. */
async function insertBooking(tenantId: string, pitchId: string, money: Money): Promise<string> {
  const id = `bk_${randomUUID()}`;
  hourSeq += 1;
  const start = new Date(Date.UTC(2030, 0, 1, 0) + hourSeq * 3_600_000);
  const end = new Date(start.getTime() + 3_600_000);
  const currency = money.currency ?? "USD";
  await platformDb.$executeRaw`
    INSERT INTO "Booking" ("id", "tenantId", "pitchId", "during", "status", "source",
      "priceCurrency", "priceUsd", "amountDueUsd", "priceLbp", "amountDueLbp")
    VALUES (${id}, ${tenantId}, ${pitchId}, tstzrange(${start}, ${end}, '[)'),
      'PENDING'::"BookingStatus", 'OWNER'::"BookingSource", ${currency}::"Currency",
      ${money.priceUsd ?? null}::decimal, ${money.amountDueUsd ?? null}::decimal,
      ${money.priceLbp ?? null}::decimal, ${money.amountDueLbp ?? null}::decimal)`;
  return id;
}

/** A USD booking exactly as the app inserted it before this migration (no currency column named). */
async function insertBookingAsToday(tenantId: string, pitchId: string): Promise<string> {
  const id = `bk_${randomUUID()}`;
  hourSeq += 1;
  const start = new Date(Date.UTC(2030, 0, 1, 0) + hourSeq * 3_600_000);
  const end = new Date(start.getTime() + 3_600_000);
  await platformDb.$executeRaw`
    INSERT INTO "Booking" ("id", "tenantId", "pitchId", "during", "status", "source", "priceUsd", "amountDueUsd")
    VALUES (${id}, ${tenantId}, ${pitchId}, tstzrange(${start}, ${end}, '[)'),
      'PENDING'::"BookingStatus", 'OWNER'::"BookingSource", 30.00, 30.00)`;
  return id;
}

describe("game money lives in one currency (CHECKs)", () => {
  let fixture: TestFixture;
  let membershipId: string;

  beforeEach(async () => {
    await truncateAll();
    clearRequestStubs();
    fixture = await seedMinimalFixture();
    membershipId = (await platformDb.membership.findFirstOrThrow({ where: { tenantId: fixture.tenantId } })).id;
  });

  const usdGame = { priceUsd: "30.00", amountDueUsd: "30.00" };
  const lbpGame = { currency: "LBP" as const, priceLbp: "2000000", amountDueLbp: "2000000" };

  it("Booking: a USD booking still inserts as today and reads as USD", async () => {
    const id = await insertBookingAsToday(fixture.tenantId, fixture.pitchId);
    const row = await platformDb.booking.findUniqueOrThrow({ where: { id } });
    expect([row.priceCurrency, row.priceUsd?.toFixed(2), row.amountDueUsd?.toFixed(2), row.priceLbp, row.amountDueLbp]).toEqual([
      "USD", "30.00", "30.00", null, null,
    ]);
  });

  it("Booking: one currency only, and the LBP due is never negative", async () => {
    const { tenantId, pitchId } = fixture;
    await expect(insertBooking(tenantId, pitchId, usdGame)).resolves.toBeDefined();
    await expect(insertBooking(tenantId, pitchId, lbpGame)).resolves.toBeDefined();
    // Both currencies set.
    await expect(insertBooking(tenantId, pitchId, { ...usdGame, priceLbp: "2000000", amountDueLbp: "2000000" })).rejects.toBeDefined();
    await expect(insertBooking(tenantId, pitchId, { ...lbpGame, priceUsd: "30.00", amountDueUsd: "30.00" })).rejects.toBeDefined();
    // Neither.
    await expect(insertBooking(tenantId, pitchId, {})).rejects.toBeDefined();
    await expect(insertBooking(tenantId, pitchId, { currency: "LBP" })).rejects.toBeDefined();
    // The pair of the other currency.
    await expect(insertBooking(tenantId, pitchId, { currency: "LBP", ...usdGame })).rejects.toBeDefined();
    await expect(insertBooking(tenantId, pitchId, { priceLbp: "2000000", amountDueLbp: "2000000" })).rejects.toBeDefined();
    // Half a pair.
    await expect(insertBooking(tenantId, pitchId, { priceUsd: "30.00" })).rejects.toBeDefined();
    // A negative LBP due.
    await expect(insertBooking(tenantId, pitchId, { ...lbpGame, amountDueLbp: "-5000" })).rejects.toBeDefined();
    expect(await platformDb.booking.count()).toBe(2);
  });

  it("BookingParticipant: exactly one of the two dues, the LBP one never negative", async () => {
    const bookingId = await insertBooking(fixture.tenantId, fixture.pitchId, usdGame);
    const share = (amountDueUsd: string | null, amountDueLbp: string | null) =>
      platformDb.bookingParticipant.create({
        data: { tenantId: fixture.tenantId, bookingId, isRequester: false, amountDueUsd, amountDueLbp },
      });
    await expect(share("10.00", null)).resolves.toBeDefined();
    await expect(share(null, "285000")).resolves.toBeDefined();
    await expect(share("10.00", "285000")).rejects.toBeDefined();
    await expect(share(null, null)).rejects.toBeDefined();
    await expect(share(null, "-5000")).rejects.toBeDefined();
    expect(await platformDb.bookingParticipant.count({ where: { bookingId } })).toBe(2);
  });

  it("BookingDueChange: the pair matches the currency; USD by default as today; ROUNDING exists", async () => {
    const bookingId = await insertBooking(fixture.tenantId, fixture.pitchId, usdGame);
    const change = (data: Record<string, unknown>) =>
      platformDb.bookingDueChange.create({
        data: { tenantId: fixture.tenantId, bookingId, reason: "DISCOUNT", actorMembershipId: membershipId, ...data } as Parameters<
          typeof platformDb.bookingDueChange.create
        >[0]["data"],
      });
    const asToday = await change({ fromUsd: "30.00", toUsd: "20.00" });
    expect(asToday.currency).toBe("USD");
    await expect(change({ currency: "LBP", fromLbp: "2000000", toLbp: "1500000" })).resolves.toBeDefined();
    await expect(change({ currency: "LBP", fromLbp: "4999", toLbp: "0", reason: "ROUNDING" })).resolves.toBeDefined();
    // Both pairs.
    await expect(change({ fromUsd: "30.00", toUsd: "20.00", fromLbp: "1", toLbp: "1" })).rejects.toBeDefined();
    // Neither.
    await expect(change({})).rejects.toBeDefined();
    // The pair of the other currency.
    await expect(change({ currency: "USD", fromLbp: "2000000", toLbp: "1500000" })).rejects.toBeDefined();
    await expect(change({ currency: "LBP", fromUsd: "30.00", toUsd: "20.00" })).rejects.toBeDefined();
    // Half a pair, and a negative LBP amount.
    await expect(change({ currency: "LBP", fromLbp: "2000000" })).rejects.toBeDefined();
    await expect(change({ currency: "LBP", fromLbp: "2000000", toLbp: "-5000" })).rejects.toBeDefined();
    expect(await platformDb.bookingDueChange.count({ where: { bookingId } })).toBe(3);
  });

  it("Payment: the due snapshot matches dueCurrency; only a booking payment may be in LBP", async () => {
    const bookingId = await insertBooking(fixture.tenantId, fixture.pitchId, usdGame);
    const payment = (data: Record<string, unknown>) =>
      platformDb.payment.create({
        data: { tenantId: fixture.tenantId, sourceType: "BOOKING", sourceId: bookingId, ...data } as Parameters<
          typeof platformDb.payment.create
        >[0]["data"],
      });
    const asToday = await payment({ amountDueUsd: "30.00" });
    expect(asToday.dueCurrency).toBe("USD");
    await expect(payment({ dueCurrency: "LBP", amountDueLbp: "2000000" })).resolves.toBeDefined();
    await expect(payment({ amountDueUsd: "30.00", amountDueLbp: "2000000" })).rejects.toBeDefined();
    await expect(payment({})).rejects.toBeDefined();
    await expect(payment({ dueCurrency: "LBP", amountDueUsd: "30.00" })).rejects.toBeDefined();
    await expect(payment({ dueCurrency: "USD", amountDueLbp: "2000000" })).rejects.toBeDefined();
    // Expense and sale payments stay USD.
    await expect(payment({ sourceType: "EXPENSE", dueCurrency: "LBP", amountDueLbp: "900000" })).rejects.toBeDefined();
    await expect(payment({ sourceType: "SALE", dueCurrency: "LBP", amountDueLbp: "900000" })).rejects.toBeDefined();
    await expect(payment({ sourceType: "EXPENSE", amountDueUsd: "10.00" })).resolves.toBeDefined();
    expect(await platformDb.payment.count()).toBe(3);
  });

  it("PaymentAllocation: exactly one currency, above zero", async () => {
    const bookingId = await insertBooking(fixture.tenantId, fixture.pitchId, usdGame);
    const participant = await platformDb.bookingParticipant.create({
      data: { tenantId: fixture.tenantId, bookingId, isRequester: false, amountDueUsd: "10.00" },
    });
    const allocate = async (amountUsd: string | null, amountLbp: string | null) => {
      const payment = await platformDb.payment.create({
        data: { tenantId: fixture.tenantId, sourceType: "BOOKING", sourceId: bookingId, amountDueUsd: "30.00" },
      });
      return platformDb.paymentAllocation.create({
        data: { tenantId: fixture.tenantId, paymentId: payment.id, participantId: participant.id, amountUsd, amountLbp },
      });
    };
    await expect(allocate("10.00", null)).resolves.toBeDefined();
    await expect(allocate(null, "285000")).resolves.toBeDefined();
    await expect(allocate("10.00", "285000")).rejects.toBeDefined();
    await expect(allocate(null, null)).rejects.toBeDefined();
    await expect(allocate(null, "0")).rejects.toBeDefined();
    await expect(allocate("0.00", null)).rejects.toBeDefined();
    expect(await platformDb.paymentAllocation.count()).toBe(2);
  });

  it("BookingSettlement: defaults to 0 applied, never negative, one row per payment", async () => {
    const bookingId = await insertBooking(fixture.tenantId, fixture.pitchId, lbpGame);
    const settle = (paymentId: string, data: Record<string, unknown> = {}) =>
      platformDb.bookingSettlement.create({
        data: { tenantId: fixture.tenantId, bookingId, paymentId, ...data } as Parameters<typeof platformDb.bookingSettlement.create>[0]["data"],
      });
    const row = await settle("pay_1");
    expect([row.lbpApplied.toFixed(0), row.usdApplied.toFixed(2)]).toEqual(["0", "0.00"]);
    await expect(settle("pay_2", { lbpApplied: "285000" })).resolves.toBeDefined();
    await expect(settle("pay_1", { lbpApplied: "5000" })).rejects.toBeDefined();
    await expect(settle("pay_3", { lbpApplied: "-5000" })).rejects.toBeDefined();
    await expect(settle("pay_4", { usdApplied: "-1.00" })).rejects.toBeDefined();
    await expect(settle("pay_5", { bookingId: "no-such-booking" })).rejects.toBeDefined();
    expect(await platformDb.bookingSettlement.count()).toBe(2);
  });
});

describe("BookingSettlement tenant isolation (RULE-7)", () => {
  let a: TestFixture;
  let b: TestFixture;

  beforeEach(async () => {
    await truncateAll();
    clearRequestStubs();
    ({ a, b } = await seedTwoTenants());
    setTenantSlug(a.tenantSlug);
    setSessionCookie(a.sessionId);
  });

  it("reads, writes and updates stay inside the current tenant", async () => {
    const bookingA = await insertBooking(a.tenantId, a.pitchId, { priceUsd: "30.00", amountDueUsd: "30.00" });
    const bookingB = await insertBooking(b.tenantId, b.pitchId, { priceUsd: "30.00", amountDueUsd: "30.00" });
    const rowB = await platformDb.bookingSettlement.create({
      data: { tenantId: b.tenantId, bookingId: bookingB, paymentId: "pay_b", usdApplied: "30.00" },
    });

    // Create under A: the extension stamps A's tenant.
    const rowA = await db.bookingSettlement.create({
      data: { bookingId: bookingA, paymentId: "pay_a", usdApplied: "10.00" } as Parameters<typeof db.bookingSettlement.create>[0]["data"],
    });
    expect(rowA.tenantId).toBe(a.tenantId);

    // Read under A: only A's row.
    expect((await db.bookingSettlement.findMany()).map((row) => row.id)).toEqual([rowA.id]);
    expect(await db.bookingSettlement.findFirst({ where: { id: rowB.id } })).toBeNull();

    // Update under A cannot reach B's row.
    const updated = await db.bookingSettlement.updateMany({ where: { id: rowB.id }, data: { usdApplied: "0.00" } });
    expect(updated.count).toBe(0);
    const stillB = await platformDb.bookingSettlement.findUniqueOrThrow({ where: { id: rowB.id } });
    expect(stillB.usdApplied.toFixed(2)).toBe("30.00");
  });
});
