import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import { addBookingItems } from "@/modules/booking/application/add-booking-items";
import { setExchangeRate } from "@/modules/payment/application/set-exchange-rate";
import { collectTabPayment } from "@/modules/shop/application/collect-tab-payment";
import { listBookingItems } from "@/modules/shop/application/list-booking-items";
import { createProduct } from "@/modules/shop/application/products";
import { recordWalkInSale } from "@/modules/shop/application/record-walk-in-sale";
import Decimal from "decimal.js";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { assertMoneyInvariants } from "./invariants";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { bookingStartingIn, requesterPersonId, soonBooking } from "./shop-helpers";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Add items from a game, the three ways out: "Pay now" is a walk-in sale with no payer, "On a tab" is
 * the booker's tab (or one that already exists), "New" is a tab under a nickname alone. Nothing about
 * money changes; these are the writes each path leaves. WRITTEN, NOT RUN when authored.
 */
let fixture: TestFixture;
let cola: { id: string };
let water: { id: string };

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
  await setExchangeRate(new Decimal(89500));
  cola = await createProduct({ name: "Cola", priceUsd: "1.50" });
  water = await createProduct({ name: "Water", priceLbp: "20000" });
});

describe("Pay now", () => {
  it("is a walk-in sale: paid in full, no payer, no booking", async () => {
    const result = await recordWalkInSale({ lines: [{ productId: cola.id, qty: 2 }], usdAmount: "3.00", lbpAmount: "" });
    const sale = await platformDb.sale.findUniqueOrThrow({ where: { id: result.saleId } });
    expect(sale.payerPersonId).toBeNull();
    expect(sale.payerName).toBeNull();
    expect(sale.bookingId).toBeNull();
    expect(await platformDb.payment.count({ where: { sourceType: "SALE", sourceId: sale.id } })).toBe(1);
    await assertMoneyInvariants([]);
  });

  it("gives change in the currency handed over", async () => {
    const result = await recordWalkInSale({ lines: [{ productId: cola.id, qty: 1 }], usdAmount: "", lbpAmount: "200000" });
    expect(result.changeLbp.gt(0)).toBe(true);
  });
});

describe("On a tab", () => {
  it("for the booker: her tab, the game's amount untouched, nothing paid", async () => {
    const bookingId = await soonBooking(fixture, "Huda");
    const added = await addBookingItems({ bookingId, lines: [{ productId: cola.id, qty: 1 }], payer: { kind: "game" } });
    const sale = await platformDb.sale.findUniqueOrThrow({ where: { id: added.saleId } });
    expect(sale.bookingId).toBe(bookingId);
    expect(sale.payerPersonId).toBe(await requesterPersonId(bookingId));
    expect(await platformDb.payment.count({ where: { sourceId: sale.id } })).toBe(0);
  });

  it("a second item for an existing tab joins the same tab, picked by the person with no typing", async () => {
    const bookingId = await soonBooking(fixture, "Huda");
    const first = await addBookingItems({ bookingId, lines: [{ productId: cola.id, qty: 1 }], payer: { kind: "game" } });
    const personId = await requesterPersonId(bookingId);
    const second = await addBookingItems({ bookingId, lines: [{ productId: water.id, qty: 1 }], payer: { kind: "person", personId } });
    expect(second.saleId).toBe(first.saleId);
    expect(await platformDb.saleItem.count({ where: { saleId: first.saleId } })).toBe(2);
  });

  it("New with only a nickname: a tab by name, no person and no phone, and the same nickname reaches the same tab", async () => {
    const bookingId = await soonBooking(fixture, "Huda");
    const first = await addBookingItems({ bookingId, lines: [{ productId: cola.id, qty: 1 }], payer: { kind: "name", name: "Abu Karim" } });
    const sale = await platformDb.sale.findUniqueOrThrow({ where: { id: first.saleId } });
    expect(sale).toMatchObject({ payerPersonId: null, payerName: "Abu Karim", payerPhone: null, bookingId });
    const again = await addBookingItems({ bookingId, lines: [{ productId: cola.id, qty: 1 }], payer: { kind: "name", name: "abu karim" } });
    expect(again.saleId).toBe(first.saleId);
  });
});

describe("Tabs on this game", () => {
  it("lists exactly the tabs of this game, with their totals per currency, and Collect works", async () => {
    const bookingId = await soonBooking(fixture, "Huda");
    const other = await bookingStartingIn(fixture, -120, "Other");
    await addBookingItems({
      bookingId,
      lines: [{ productId: cola.id, qty: 2 }, { productId: water.id, qty: 1 }],
      payer: { kind: "game" },
    });
    await addBookingItems({ bookingId, lines: [{ productId: cola.id, qty: 1 }], payer: { kind: "name", name: "Abu Karim" } });
    await addBookingItems({ bookingId: other, lines: [{ productId: cola.id, qty: 1 }], payer: { kind: "game" } });

    const tabs = (await listBookingItems([bookingId])).get(bookingId)!.tabs;
    expect(tabs.map((tab) => tab.name).sort()).toEqual(["Abu Karim", "Huda"]);
    const huda = tabs.find((tab) => tab.name === "Huda")!;
    expect([huda.remainingUsd.toFixed(2), huda.remainingLbp.toFixed(0)]).toEqual(["3.00", "20000"]);

    await collectTabPayment({ saleId: huda.saleId, usdAmount: "3.00", lbpAmount: "20000" });
    const after = (await listBookingItems([bookingId])).get(bookingId)!.tabs.find((tab) => tab.name === "Huda")!;
    expect([after.remainingUsd.toFixed(2), after.remainingLbp.toFixed(0)]).toEqual(["0.00", "0"]);
    await assertMoneyInvariants([]);
  });
});

describe("the 60-minute window", () => {
  it("still refuses a tab on a game that starts in more than an hour, and opens at 60 minutes", async () => {
    const early = await bookingStartingIn(fixture, 90, "Early");
    await expect(addBookingItems({ bookingId: early, lines: [{ productId: cola.id, qty: 1 }], payer: { kind: "game" } })).rejects.toMatchObject({
      key: "shop.items_not_open",
    });
    const open = await bookingStartingIn(fixture, 59, "Open");
    await expect(addBookingItems({ bookingId: open, lines: [{ productId: cola.id, qty: 1 }], payer: { kind: "game" } })).resolves.toBeTruthy();
  });
});
