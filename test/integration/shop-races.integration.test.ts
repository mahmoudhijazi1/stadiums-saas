import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { platformDb } from "@/lib/platform-db";
import { addBookingItems } from "@/modules/booking/application/add-booking-items";
import { cancelBooking } from "@/modules/booking/application/cancel-booking";
import { collectBookingPayment } from "@/modules/booking/application/collect-booking-payment";
import { removeBookingItem } from "@/modules/booking/application/remove-booking-item";
import { collectTabPayment } from "@/modules/shop/application/collect-tab-payment";
import { createProduct } from "@/modules/shop/application/products";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { assertMoneyInvariants } from "./invariants";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { futureBooking, outcomes } from "./shop-helpers";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Items on a game against the paths that already change a booking. Lock order: the booking row
 * first, then the sale row, for adding and removing; collecting a tab locks only the sale row.
 * Ten real concurrent runs per pair, and the outcome must be one of the allowed serial orders.
 */
const RUNS = 10;

let fixture: TestFixture;
let cola: { id: string };

describe("shop races (booking row, then sale row)", () => {
  beforeEach(async () => {
    await truncateAll();
    clearRequestStubs();
    fixture = await seedMinimalFixture();
    setTenantSlug(fixture.tenantSlug);
    setSessionCookie(fixture.sessionId);
    cola = await createProduct({ name: "Cola", priceUsd: "1.50" });
  });

  afterAll(async () => {
    await truncateAll();
    await finishIntegrationFile();
  });

  it("add on the game (booker) x cancel: either order is fine, and a cancelled game takes no items", async () => {
    for (let i = 0; i < RUNS; i += 1) {
      const bookingId = await futureBooking(fixture, 2 + i);
      const results = await Promise.allSettled([
        addBookingItems({ bookingId, lines: [{ productId: cola.id, qty: 2 }], payer: { kind: "game" } }),
        cancelBooking({ bookingId, initiator: "OWNER" }),
      ]);
      const [add, cancel] = outcomes(results);
      // A tab never blocks a cancel, so the cancel always works.
      expect(cancel).toBe("ok");
      const booking = await platformDb.booking.findUniqueOrThrow({ where: { id: bookingId } });
      expect(booking.status).toBe("CANCELLED");
      if (add === "ok") {
        // The add ran first: the tab exists and stays owed.
        expect(await platformDb.sale.count({ where: { bookingId } })).toBe(1);
      } else {
        // The cancel ran first: the game was no longer confirmed.
        expect(add).toBe("shop.booking_not_open");
        expect(await platformDb.sale.count({ where: { bookingId } })).toBe(0);
      }
    }
    await assertMoneyInvariants([]);
  }, 120_000);

  it("add on the game (booker) x booking collection: both succeed in either order and the due never moves", async () => {
    for (let i = 0; i < RUNS; i += 1) {
      const bookingId = await futureBooking(fixture, 2 + i);
      const results = await Promise.allSettled([
        addBookingItems({ bookingId, lines: [{ productId: cola.id, qty: 2 }], payer: { kind: "game" } }),
        collectBookingPayment({ bookingId, tenders: [{ currency: "USD", amount: new Decimal("30.00") }] }),
      ]);
      expect(outcomes(results)).toEqual(["ok", "ok"]);
      const booking = await platformDb.booking.findUniqueOrThrow({ where: { id: bookingId } });
      expect(booking.amountDueUsd.toFixed(2)).toBe("30.00");
      expect(await platformDb.bookingDueChange.count({ where: { bookingId } })).toBe(0);
      expect(await platformDb.sale.count({ where: { bookingId } })).toBe(1);
    }
    await assertMoneyInvariants([]);
  }, 120_000);

  it("remove from a tab x collect on that tab: one wins, and a paid tab never loses an item", async () => {
    for (let i = 0; i < RUNS; i += 1) {
      const bookingId = await futureBooking(fixture, 2 + i);
      const { saleId } = await addBookingItems({ bookingId, lines: [{ productId: cola.id, qty: 2 }], payer: { kind: "name", name: `Racer ${i}` } });
      const item = await platformDb.saleItem.findFirstOrThrow({ where: { saleId } });
      const results = await Promise.allSettled([
        removeBookingItem({ itemId: item.id, qty: 2 }),
        collectTabPayment({ saleId, usdAmount: "3.00" }),
      ]);
      const [remove, collect] = outcomes(results);
      const lines = await platformDb.saleItem.findMany({ where: { saleId } });
      const total = lines.reduce((sum, line) => sum.plus(line.lineTotalUsd.toString()), new Decimal(0));
      const paid = await platformDb.paymentTender.aggregate({
        _sum: { usdEquivalent: true },
        where: { payment: { sourceType: "SALE", sourceId: saleId } },
      });
      if (remove === "ok") {
        // The removal ran first: the tab is empty and nothing is due, so the collect found nothing to take.
        expect(collect).toBe("payment.nothing_due");
        expect(total.toFixed(2)).toBe("0.00");
        expect(paid._sum.usdEquivalent).toBeNull();
      } else {
        // The collect ran first: the removal saw a payment and refused.
        expect(remove).toBe("shop.tab_has_payments");
        expect(collect).toBe("ok");
        expect(total.toFixed(2)).toBe("3.00");
        expect(paid._sum.usdEquivalent?.toFixed(2)).toBe("3.00");
      }
    }
  }, 120_000);
});
