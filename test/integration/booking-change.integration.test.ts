import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { platformDb } from "@/lib/platform-db";
import { collectBookingPayment } from "@/modules/booking/application/collect-booking-payment";
import { setExchangeRate } from "@/modules/payment/application/set-exchange-rate";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { assertMoneyInvariants } from "./invariants";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { outcomes, soonBooking } from "./shop-helpers";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Change on a game (DR-007 decision 6): cash handed over beyond what the game owes is change, never
 * income. The tenders and the ledger IN record only what the game used; the use case returns the
 * rest, in the currency it was handed over in. All games here are USD-priced ($30).
 */
let fixture: TestFixture;

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
  await setExchangeRate(new Decimal("90000"));
});

const usd = (amount: string) => [{ currency: "USD" as const, amount: new Decimal(amount) }];
const lbp = (amount: string) => [{ currency: "LBP" as const, amount: new Decimal(amount) }];

async function recordedOf(bookingId: string) {
  const tenders = await platformDb.paymentTender.findMany({
    where: { payment: { sourceType: "BOOKING", sourceId: bookingId } },
    orderBy: { id: "asc" },
  });
  const ledger = await platformDb.ledgerEntry.findMany({ where: { sourceType: "BOOKING", sourceId: bookingId } });
  return {
    tenders: tenders.map((t) => [t.currency, t.amount.toFixed(t.currency === "USD" ? 2 : 0), t.usdEquivalent.toFixed(2)]),
    ledger: ledger.reduce((sum, entry) => sum.plus(entry.amountUsd.toString()), new Decimal(0)).toFixed(2),
    collected: tenders.reduce((sum, t) => sum.plus(t.usdEquivalent.toString()), new Decimal(0)).toFixed(2),
  };
}

async function remainingOf(bookingId: string): Promise<string> {
  const booking = await platformDb.booking.findUniqueOrThrow({ where: { id: bookingId } });
  const { collected } = await recordedOf(bookingId);
  return new Decimal(booking.amountDueUsd!.toString()).minus(collected).toFixed(2);
}

describe("a game collection gives change", () => {
  it("$50 on a $30 game records $30, returns $20 change and leaves nothing owed", async () => {
    const bookingId = await soonBooking(fixture);
    const done = await collectBookingPayment({ bookingId, tenders: usd("50.00") });
    expect([done.changeUsd.toFixed(2), done.changeLbp.toFixed(0)]).toEqual(["20.00", "0"]);
    expect(await recordedOf(bookingId)).toEqual({ tenders: [["USD", "30.00", "30.00"]], ledger: "30.00", collected: "30.00" });
    expect(await remainingOf(bookingId)).toBe("0.00");
    await assertMoneyInvariants([]);
  });

  it("3,000,000 pounds on a $30 game (rate 90,000) records 2,700,000, returns 300,000 pounds and leaves nothing owed", async () => {
    const bookingId = await soonBooking(fixture);
    const done = await collectBookingPayment({ bookingId, tenders: lbp("3000000") });
    expect([done.changeLbp.toFixed(0), done.changeUsd.toFixed(2)]).toEqual(["300000", "0.00"]);
    expect(await recordedOf(bookingId)).toEqual({ tenders: [["LBP", "2700000", "30.00"]], ledger: "30.00", collected: "30.00" });
    expect(await remainingOf(bookingId)).toBe("0.00");
    await assertMoneyInvariants([]);
  });

  it("exact cash gives no change", async () => {
    const bookingId = await soonBooking(fixture);
    const done = await collectBookingPayment({ bookingId, tenders: usd("30.00") });
    expect([done.changeUsd.toFixed(2), done.changeLbp.toFixed(0)]).toEqual(["0.00", "0"]);
    expect((await recordedOf(bookingId)).ledger).toBe("30.00");
  });

  it("a partial payment, then an overpaying one: the total stays at the due", async () => {
    const bookingId = await soonBooking(fixture);
    const first = await collectBookingPayment({ bookingId, tenders: usd("10.00") });
    expect([first.changeUsd.toFixed(2), first.changeLbp.toFixed(0)]).toEqual(["0.00", "0"]);
    expect(await remainingOf(bookingId)).toBe("20.00");

    const second = await collectBookingPayment({ bookingId, tenders: usd("50.00") });
    expect(second.changeUsd.toFixed(2)).toBe("30.00");
    expect(await recordedOf(bookingId)).toEqual({
      tenders: [
        ["USD", "10.00", "10.00"],
        ["USD", "20.00", "20.00"],
      ],
      ledger: "30.00",
      collected: "30.00",
    });
    expect(await remainingOf(bookingId)).toBe("0.00");
    await assertMoneyInvariants([]);
  });

  it("a game that owes nothing is refused, as before", async () => {
    const bookingId = await soonBooking(fixture);
    await collectBookingPayment({ bookingId, tenders: usd("30.00") });
    await expect(collectBookingPayment({ bookingId, tenders: usd("5.00") })).rejects.toMatchObject({ key: "payment.nothing_due" });
    expect(await platformDb.payment.count({ where: { sourceType: "BOOKING", sourceId: bookingId } })).toBe(1);
  });

  it("two concurrent overpaying collections never record more than the due", async () => {
    for (let i = 0; i < 5; i += 1) {
      const bookingId = await soonBooking(fixture, `Booker ${i}`);
      const results = await Promise.allSettled([
        collectBookingPayment({ bookingId, tenders: usd("50.00") }),
        collectBookingPayment({ bookingId, tenders: usd("50.00") }),
      ]);
      expect(outcomes(results).sort()).toEqual(["ok", "payment.nothing_due"]);
      expect(await recordedOf(bookingId)).toEqual({ tenders: [["USD", "30.00", "30.00"]], ledger: "30.00", collected: "30.00" });
      expect(await remainingOf(bookingId)).toBe("0.00");
    }
    await assertMoneyInvariants([]);
  }, 60_000);
});
