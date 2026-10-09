import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { platformDb } from "@/lib/platform-db";
import { addBookingItems } from "@/modules/booking/application/add-booking-items";
import { listOwed } from "@/modules/booking/application/list-owed";
import { loadOwnerDay } from "@/modules/booking/application/load-owner-day";
import { removeBookingItem } from "@/modules/booking/application/remove-booking-item";
import { setExchangeRate } from "@/modules/payment/application/set-exchange-rate";
import { collectTabPayment } from "@/modules/shop/application/collect-tab-payment";
import { listBookingItems } from "@/modules/shop/application/list-booking-items";
import { createProduct, listProducts, updateProduct } from "@/modules/shop/application/products";
import { recordWalkInSale } from "@/modules/shop/application/record-walk-in-sale";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { endedGame, futureBooking } from "./shop-helpers";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Items priced in LBP: the pounds are what is owed and what is paid, the frozen USD value is what is
 * recorded and reported. 90,000 pounds to the dollar unless a test says otherwise.
 */
let fixture: TestFixture;
let water: { id: string }; // 20,000 LBP
let juice: { id: string }; // 30,000 LBP
let cola: { id: string }; // $1.50

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
  juice = await createProduct({ name: "Juice", priceLbp: "30000" });
  cola = await createProduct({ name: "Cola", priceUsd: "1.50" });
});

const booker = { kind: "game" } as const;

async function tabOf(bookingId: string) {
  return (await listBookingItems([bookingId])).get(bookingId)!.tabs[0]!;
}

async function ledgerOf(sourceId: string) {
  return (await platformDb.ledgerEntry.findMany({ where: { sourceType: "SALE", sourceId }, orderBy: { occurredAt: "asc" } })).map((entry) =>
    entry.amountUsd.toFixed(2),
  );
}

describe("the catalog in two currencies", () => {
  it("an item is priced in pounds or in dollars, never both, and can be re-priced into the other", async () => {
    const items = await listProducts({ forSale: false });
    expect(items.map((item) => [item.name, item.priceCurrency, item.priceLbp?.toFixed(0) ?? null, item.priceUsd?.toFixed(2) ?? null]).sort()).toEqual([
      ["Cola", "USD", null, "1.50"],
      ["Juice", "LBP", "30000", null],
      ["Water", "LBP", "20000", null],
    ]);
    await updateProduct(water.id, { name: "Water", priceUsd: "0.50" });
    const row = await platformDb.product.findUniqueOrThrow({ where: { id: water.id } });
    expect([row.priceCurrency, row.priceLbp, row.priceUsd?.toFixed(2)]).toEqual(["USD", null, "0.50"]);
    // The database holds the line too.
    await expect(
      platformDb.$executeRaw`UPDATE "Product" SET "priceUsd" = 1.00 WHERE id = ${juice.id}`,
    ).rejects.toBeDefined();
  });
});

describe("walk-in sales", () => {
  it("3 x 20,000 paid with 60,000 leaves nothing owed and records the frozen USD", async () => {
    const sold = await recordWalkInSale({ lines: [{ productId: water.id, qty: 3 }], lbpAmount: "60000" });
    expect(sold.totalLbp.toFixed(0)).toBe("60000");
    expect(sold.totalUsd.toFixed(2)).toBe("0.67");
    expect(sold.changeLbp.toFixed(0)).toBe("0");
    expect(await ledgerOf(sold.saleId)).toEqual(["0.67"]);
    const tender = await platformDb.paymentTender.findFirstOrThrow({ where: { payment: { sourceId: sold.saleId } } });
    expect([tender.currency, tender.amount.toFixed(0), tender.rateAtTime?.toFixed(0), tender.usdEquivalent.toFixed(2)]).toEqual(["LBP", "60000", "90000", "0.67"]);
    const line = await platformDb.saleItem.findFirstOrThrow({ where: { saleId: sold.saleId } });
    expect([line.unitPriceLbp?.toFixed(0), line.lineTotalLbp?.toFixed(0), line.rateAtTime?.toFixed(0), line.lineTotalUsd.toFixed(2)]).toEqual(["20000", "60000", "90000", "0.67"]);
    const allocation = await platformDb.saleAllocation.findFirstOrThrow({ where: { saleId: sold.saleId } });
    expect([allocation.lbpApplied.toFixed(0), allocation.usdApplied.toFixed(2)]).toEqual(["60000", "0.00"]);
  });

  it("a mixed sale ($1.50 + 40,000) is settled by exactly those parts; a part is not enough", async () => {
    const lines = [{ productId: cola.id, qty: 1 }, { productId: water.id, qty: 2 }];
    await expect(recordWalkInSale({ lines, usdAmount: "1.50", lbpAmount: "20000" })).rejects.toMatchObject({ key: "shop.sale_not_fully_paid" });
    const sold = await recordWalkInSale({ lines, usdAmount: "1.50", lbpAmount: "40000" });
    expect([sold.totalLbp.toFixed(0), sold.totalUsdPart.toFixed(2), sold.totalUsd.toFixed(2)]).toEqual(["40000", "1.50", "1.94"]);
    expect(await ledgerOf(sold.saleId)).toEqual(["1.94"]);
  });

  it("dollars can pay an LBP item at the current rate", async () => {
    const sold = await recordWalkInSale({ lines: [{ productId: water.id, qty: 1 }], usdAmount: "0.23" });
    expect(sold.totalUsd.toFixed(2)).toBe("0.22");
    expect(await ledgerOf(sold.saleId)).toEqual(["0.22"]);
  });

  it("with no exchange rate an LBP item cannot be sold, and a USD item still can", async () => {
    await truncateAll();
    clearRequestStubs();
    fixture = await seedMinimalFixture();
    setTenantSlug(fixture.tenantSlug);
    setSessionCookie(fixture.sessionId);
    const lbp = await createProduct({ name: "Water", priceLbp: "20000" });
    const usd = await createProduct({ name: "Cola", priceUsd: "1.50" });
    await expect(recordWalkInSale({ lines: [{ productId: lbp.id, qty: 1 }], lbpAmount: "20000" })).rejects.toMatchObject({ key: "shop.rate_required" });
    expect(await platformDb.sale.count()).toBe(0);
    await recordWalkInSale({ lines: [{ productId: usd.id, qty: 1 }], usdAmount: "1.50" });
    const bookingId = await futureBooking(fixture, 30);
    await expect(addBookingItems({ bookingId, lines: [{ productId: lbp.id, qty: 1 }], payer: booker })).rejects.toMatchObject({ key: "shop.rate_required" });
    expect(await platformDb.sale.count({ where: { bookingId } })).toBe(0);
  });
});

describe("player tabs in pounds", () => {
  it("20,000 and 30,000 added separately to one tab, paid with 50,000: nothing owed", async () => {
    const bookingId = await futureBooking(fixture, 30);
    const first = await addBookingItems({ bookingId, lines: [{ productId: water.id, qty: 1 }], payer: booker });
    const second = await addBookingItems({ bookingId, lines: [{ productId: juice.id, qty: 1 }], payer: booker });
    expect(second.saleId).toBe(first.saleId);
    let tab = await tabOf(bookingId);
    expect([tab.remainingLbp.toFixed(0), tab.remainingUsd.toFixed(2), tab.totalUsd.toFixed(2)]).toEqual(["50000", "0.00", "0.55"]);

    await collectTabPayment({ saleId: first.saleId, lbpAmount: "50000" });
    tab = await tabOf(bookingId);
    expect([tab.remainingLbp.toFixed(0), tab.remainingUsd.toFixed(2), tab.outstandingFrozenUsd.toFixed(2)]).toEqual(["0", "0.00", "0.00"]);
    expect(await ledgerOf(first.saleId)).toEqual(["0.55"]);
  });

  it("a tab of $1.50 + 40,000 shows both parts, and paying exactly those parts settles it", async () => {
    const bookingId = await futureBooking(fixture, 30);
    const { saleId } = await addBookingItems({ bookingId, lines: [{ productId: cola.id, qty: 1 }, { productId: water.id, qty: 2 }], payer: booker });
    let tab = await tabOf(bookingId);
    expect([tab.remainingLbp.toFixed(0), tab.remainingUsd.toFixed(2)]).toEqual(["40000", "1.50"]);
    await collectTabPayment({ saleId, usdAmount: "1.50", lbpAmount: "40000" });
    tab = await tabOf(bookingId);
    expect([tab.remainingLbp.toFixed(0), tab.remainingUsd.toFixed(2), tab.outstandingFrozenUsd.toFixed(2)]).toEqual(["0", "0.00", "0.00"]);
    expect(await ledgerOf(saleId)).toEqual(["1.94"]);
  });

  it("paying 10,000 of a 20,000 tab leaves 10,000 pounds, and the rest ends on exactly the frozen USD", async () => {
    const bookingId = await futureBooking(fixture, 30);
    const { saleId } = await addBookingItems({ bookingId, lines: [{ productId: water.id, qty: 1 }], payer: booker });
    await collectTabPayment({ saleId, lbpAmount: "10000" });
    let tab = await tabOf(bookingId);
    expect([tab.remainingLbp.toFixed(0), tab.remainingUsd.toFixed(2), tab.outstandingFrozenUsd.toFixed(2)]).toEqual(["10000", "0.00", "0.11"]);

    await collectTabPayment({ saleId, lbpAmount: "10000" });
    tab = await tabOf(bookingId);
    expect(tab.remainingLbp.isZero()).toBe(true);
    expect((await ledgerOf(saleId)).reduce((sum, value) => sum.plus(value), new Decimal(0)).toFixed(2)).toBe("0.22");
    await expect(collectTabPayment({ saleId, lbpAmount: "1000" })).rejects.toMatchObject({ key: "payment.nothing_due" });
  });

  it("a rate change between adding and collecting still asks 20,000 and records the frozen USD", async () => {
    const bookingId = await futureBooking(fixture, 30);
    const { saleId } = await addBookingItems({ bookingId, lines: [{ productId: water.id, qty: 1 }], payer: booker }); // frozen at 90,000
    await setExchangeRate(new Decimal("100000"));
    const tab = await tabOf(bookingId);
    expect([tab.remainingLbp.toFixed(0), tab.totalUsd.toFixed(2)]).toEqual(["20000", "0.22"]);

    await collectTabPayment({ saleId, lbpAmount: "20000" });
    expect(await ledgerOf(saleId)).toEqual(["0.22"]); // not 20,000 / 100,000 = 0.20
    const tender = await platformDb.paymentTender.findFirstOrThrow({ where: { payment: { sourceId: saleId } } });
    expect(tender.rateAtTime?.toFixed(0)).toBe("100000"); // the rate of the payment, for reference
    expect((await tabOf(bookingId)).remainingLbp.isZero()).toBe(true);
  });

  it("removing part of an LBP line keeps the lines adding up to the conversion of the pounds left", async () => {
    const bookingId = await futureBooking(fixture, 30);
    const { saleId } = await addBookingItems({ bookingId, lines: [{ productId: water.id, qty: 3 }], payer: booker }); // 60,000 = 0.67
    const item = await platformDb.saleItem.findFirstOrThrow({ where: { saleId } });
    await removeBookingItem({ itemId: item.id, qty: 1 });
    const tab = await tabOf(bookingId);
    expect(tab.lines.map((line) => [line.qty, line.totalLbp?.toFixed(0), line.totalUsd.toFixed(2)])).toEqual([[2, "40000", "0.44"]]);
    expect([tab.remainingLbp.toFixed(0), tab.totalUsd.toFixed(2)]).toEqual(["40000", "0.44"]);
    const rows = await platformDb.saleItem.findMany({ where: { saleId }, orderBy: { id: "asc" } });
    expect(rows.map((row) => [row.qty, row.lineTotalLbp?.toFixed(0), row.lineTotalUsd.toFixed(2)])).toEqual([[3, "60000", "0.67"], [-1, "-20000", "-0.23"]]);

    await collectTabPayment({ saleId, lbpAmount: "40000" });
    expect(await ledgerOf(saleId)).toEqual(["0.44"]);
  });
});

describe("what is owed adds up in USD", () => {
  it("an LBP tab counts at its frozen USD in Owed and Today, and Today equals Money", async () => {
    const game = await endedGame(fixture, 1, "Ali", "03111111"); // owes the $30 game
    const { saleId } = await addBookingItems({ bookingId: game.bookingId, lines: [{ productId: water.id, qty: 3 }, { productId: cola.id, qty: 1 }], payer: booker });
    // 60,000 (0.67) + $1.50 = 2.17 on the tab, on top of the 30.00 game.
    let owed = await listOwed();
    expect(owed.totalUsd.toFixed(2)).toBe("32.17");
    let today = await loadOwnerDay(undefined);
    expect(today.toCollect.reduce((sum, row) => sum.plus(row.owedUsd), new Decimal(0)).toFixed(2)).toBe("32.17");

    await collectTabPayment({ saleId, lbpAmount: "30000" }); // half the pounds
    owed = await listOwed();
    expect(owed.totalUsd.toFixed(2)).toBe("31.83"); // 30.00 + (0.67 - 0.34) + 1.50
    today = await loadOwnerDay(undefined);
    expect(today.toCollect.reduce((sum, row) => sum.plus(row.owedUsd), new Decimal(0)).toFixed(2)).toBe(owed.totalUsd.toFixed(2));
  });
});
