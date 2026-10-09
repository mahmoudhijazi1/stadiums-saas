import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { platformDb } from "@/lib/platform-db";
import { addBookingItems } from "@/modules/booking/application/add-booking-items";
import { collectBookingPayment } from "@/modules/booking/application/collect-booking-payment";
import { listOwed } from "@/modules/booking/application/list-owed";
import { loadOwnerDay } from "@/modules/booking/application/load-owner-day";
import { setExchangeRate } from "@/modules/payment/application/set-exchange-rate";
import { collectTabPayment } from "@/modules/shop/application/collect-tab-payment";
import { listBookingItems } from "@/modules/shop/application/list-booking-items";
import { createProduct } from "@/modules/shop/application/products";
import { recordWalkInSale } from "@/modules/shop/application/record-walk-in-sale";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { endedGame, futureBooking } from "./shop-helpers";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Change at the counter: a walk-in sale or a tab collection records what the sale used, never the
 * excess; the last tender is reduced and the rest is change in the currency it was handed over in.
 * A booking collection keeps recording an overpay in full.
 */
let fixture: TestFixture;
let water: { id: string }; // 20,000 LBP
let cola: { id: string }; // $1.50
let chips: { id: string }; // $2.25

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
  water = await createProduct({ name: "Water", priceLbp: "20000" });
  cola = await createProduct({ name: "Cola", priceUsd: "1.50" });
  chips = await createProduct({ name: "Chips", priceUsd: "2.25" });
});

const booker = { kind: "game" } as const;

async function recordedOf(saleId: string) {
  const tenders = await platformDb.paymentTender.findMany({ where: { payment: { sourceType: "SALE", sourceId: saleId } }, orderBy: { id: "asc" } });
  const ledger = await platformDb.ledgerEntry.findMany({ where: { sourceType: "SALE", sourceId: saleId } });
  return {
    tenders: tenders.map((t) => [t.currency, t.amount.toFixed(t.currency === "USD" ? 2 : 0), t.usdEquivalent.toFixed(2)]),
    ledger: ledger.reduce((sum, entry) => sum.plus(entry.amountUsd.toString()), new Decimal(0)).toFixed(2),
  };
}

describe("a walk-in sale gives change", () => {
  it("100,000 for 60,000 records 60,000 and gives 40,000 ل.ل back", async () => {
    const sold = await recordWalkInSale({ lines: [{ productId: water.id, qty: 3 }], lbpAmount: "100000" });
    expect([sold.changeLbp.toFixed(0), sold.changeUsd.toFixed(2)]).toEqual(["40000", "0.00"]);
    expect(await recordedOf(sold.saleId)).toEqual({ tenders: [["LBP", "60000", "0.67"]], ledger: "0.67" });
  });

  it("$10 for a $4.50 USD item records $4.50 and gives $5.50 back", async () => {
    const sold = await recordWalkInSale({ lines: [{ productId: chips.id, qty: 2 }], usdAmount: "10.00" });
    expect([sold.changeUsd.toFixed(2), sold.changeLbp.toFixed(0)]).toEqual(["5.50", "0"]);
    expect(await recordedOf(sold.saleId)).toEqual({ tenders: [["USD", "4.50", "4.50"]], ledger: "4.50" });
  });

  it("pounds against a dollar item: the pounds used are converted, the rest comes back in pounds", async () => {
    const sold = await recordWalkInSale({ lines: [{ productId: chips.id, qty: 2 }], lbpAmount: "500000" }); // $4.50 = 405,000
    expect([sold.changeLbp.toFixed(0), sold.changeUsd.toFixed(2)]).toEqual(["95000", "0.00"]);
    expect(await recordedOf(sold.saleId)).toEqual({ tenders: [["LBP", "405000", "4.50"]], ledger: "4.50" });
  });

  it("exact cash gives no change, and a part is still refused", async () => {
    const sold = await recordWalkInSale({ lines: [{ productId: cola.id, qty: 1 }], usdAmount: "1.50" });
    expect([sold.changeUsd.toFixed(2), sold.changeLbp.toFixed(0)]).toEqual(["0.00", "0"]);
    await expect(recordWalkInSale({ lines: [{ productId: cola.id, qty: 1 }], usdAmount: "1.00" })).rejects.toMatchObject({
      key: "shop.sale_not_fully_paid",
    });
    expect(await platformDb.sale.count()).toBe(1);
  });
});

describe("a tab collection gives change", () => {
  it("$10 on a $4.50 tab records $4.50 with $5.50 change, and the tab then owes nothing", async () => {
    const bookingId = await futureBooking(fixture, 30);
    const { saleId } = await addBookingItems({ bookingId, lines: [{ productId: chips.id, qty: 2 }], payer: booker });
    const change = await collectTabPayment({ saleId, usdAmount: "10.00" });
    expect([change.changeUsd.toFixed(2), change.changeLbp.toFixed(0)]).toEqual(["5.50", "0"]);
    expect(await recordedOf(saleId)).toEqual({ tenders: [["USD", "4.50", "4.50"]], ledger: "4.50" });
    const tab = (await listBookingItems([bookingId])).get(bookingId)!.tabs[0]!;
    expect([tab.remainingLbp.toFixed(0), tab.remainingUsd.toFixed(2)]).toEqual(["0", "0.00"]);
    await expect(collectTabPayment({ saleId, usdAmount: "1.00" })).rejects.toMatchObject({ key: "payment.nothing_due" });
  });

  it("100,000 on a 20,000 tab records 20,000 and gives 80,000 ل.ل back; a part leaves the rest in pounds", async () => {
    const bookingId = await futureBooking(fixture, 30);
    const { saleId } = await addBookingItems({ bookingId, lines: [{ productId: water.id, qty: 2 }], payer: booker }); // 40,000
    await collectTabPayment({ saleId, lbpAmount: "10000" });
    const change = await collectTabPayment({ saleId, lbpAmount: "100000" }); // owes 30,000
    expect(change.changeLbp.toFixed(0)).toBe("70000");
    const recorded = await recordedOf(saleId);
    expect(recorded.tenders).toEqual([["LBP", "10000", "0.11"], ["LBP", "30000", "0.33"]]);
    expect(recorded.ledger).toBe("0.44");
  });

  it("the booker's tab is collected on its own and the booking due is untouched", async () => {
    const bookingId = await futureBooking(fixture, 30);
    const { saleId } = await addBookingItems({ bookingId, lines: [{ productId: cola.id, qty: 1 }], payer: booker });
    await collectTabPayment({ saleId, usdAmount: "2.00" });
    expect((await platformDb.booking.findUniqueOrThrow({ where: { id: bookingId } })).amountDueUsd.toFixed(2)).toBe("30.00");
    expect(await platformDb.bookingDueChange.count({ where: { bookingId } })).toBe(0);
    expect(await platformDb.payment.count({ where: { sourceType: "BOOKING", sourceId: bookingId } })).toBe(0);
  });
});

describe("a booking collection is unchanged", () => {
  it("an overpay is still recorded in full", async () => {
    const bookingId = await futureBooking(fixture, 30);
    await collectBookingPayment({ bookingId, tenders: [{ currency: "USD", amount: new Decimal("35.00") }] });
    const ledger = await platformDb.ledgerEntry.findMany({ where: { sourceType: "BOOKING", sourceId: bookingId } });
    expect(ledger.map((entry) => entry.amountUsd.toFixed(2))).toEqual(["35.00"]);
  });
});

describe("totals after change", () => {
  it("Today's owed total still equals Money's, with a partly paid pounds tab", async () => {
    const game = await endedGame(fixture, 1, "Ali", "03111111"); // owes the $30 game
    const { saleId } = await addBookingItems({ bookingId: game.bookingId, lines: [{ productId: water.id, qty: 3 }, { productId: cola.id, qty: 1 }], payer: booker });
    // The 60,000 pounds are settled; the 40,000 left over cross to the dollar part at the rate (0.44).
    const change = await collectTabPayment({ saleId, lbpAmount: "100000" });
    expect(change.changeLbp.toFixed(0)).toBe("0");
    const owed = await listOwed();
    const today = await loadOwnerDay(undefined);
    expect(owed.totalUsd.toFixed(2)).toBe("31.06"); // 30.00 game + (1.50 - 0.44) still on the tab
    expect(today.toCollect.reduce((sum, row) => sum.plus(row.owedUsd), new Decimal(0)).toFixed(2)).toBe("31.06");
    const tab = (await listBookingItems([game.bookingId])).get(game.bookingId)!.tabs[0]!;
    expect([tab.remainingLbp.toFixed(0), tab.remainingUsd.toFixed(2)]).toEqual(["0", "1.06"]);
  });
});
