import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { ZodError } from "zod";
import { platformDb } from "@/lib/platform-db";
import { setExchangeRate } from "@/modules/payment/application/set-exchange-rate";
import { archiveProduct, createProduct, updateProduct } from "@/modules/shop/application/products";
import { recordWalkInSale } from "@/modules/shop/application/record-walk-in-sale";
import type { TestFixture } from "./fixtures";
import { createStaffSession, seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * A walk-in sale: sale, lines, a SALE payment with its tenders and one ledger IN, written in one
 * transaction. Prices come from the database; the sale is paid in full or not at all.
 */
let fixture: TestFixture;
let cola: { id: string };
let chips: { id: string };

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
  clearRequestStubs();
  fixture = await seedMinimalFixture();
  actAs(fixture.sessionId);
  cola = await createProduct({ name: "Cola", priceUsd: "1.50" });
  chips = await createProduct({ name: "Chips", priceUsd: "2.25" });
});

function actAs(token: string, slug = fixture.tenantSlug) {
  clearRequestStubs();
  setTenantSlug(slug);
  setSessionCookie(token);
}

async function counts() {
  const [sales, items, payments, tenders, ledger] = await Promise.all([
    platformDb.sale.count(),
    platformDb.saleItem.count(),
    platformDb.payment.count({ where: { sourceType: "SALE" } }),
    platformDb.paymentTender.count(),
    platformDb.ledgerEntry.count({ where: { sourceType: "SALE" } }),
  ]);
  return { sales, items, payments, tenders, ledger };
}

describe("recordWalkInSale", () => {
  it("writes the sale, its lines, the payment, the tenders and the ledger IN together", async () => {
    const result = await recordWalkInSale({
      lines: [{ productId: cola.id, qty: 2 }, { productId: chips.id, qty: 1 }],
      usdAmount: "5.25",
    });
    expect(result.totalUsd.toFixed(2)).toBe("5.25");
    expect(result.itemCount).toBe(3);

    const sale = await platformDb.sale.findUniqueOrThrow({ where: { id: result.saleId }, include: { items: true } });
    expect(sale.items.map((line) => [line.qty, line.unitPriceUsd.toFixed(2), line.lineTotalUsd.toFixed(2)]).sort()).toEqual([
      [1, "2.25", "2.25"],
      [2, "1.50", "3.00"],
    ]);
    const payment = await platformDb.payment.findFirstOrThrow({ where: { sourceType: "SALE", sourceId: sale.id }, include: { tenders: true } });
    expect(payment.amountDueUsd.toFixed(2)).toBe("5.25");
    expect(payment.tenders.map((tender) => [tender.currency, tender.usdEquivalent.toFixed(2)])).toEqual([["USD", "5.25"]]);
    const ledger = await platformDb.ledgerEntry.findMany({ where: { sourceType: "SALE", sourceId: sale.id } });
    expect(ledger.map((entry) => [entry.direction, entry.amountUsd.toFixed(2)])).toEqual([["IN", "5.25"]]);
    const owner = await platformDb.membership.findFirstOrThrow({ where: { tenantId: fixture.tenantId, role: "OWNER" } });
    expect(sale.createdByMembershipId).toBe(owner.id);
  });

  it("writes nothing at all when a step fails part-way", async () => {
    // The tender is far larger than the column holds: the sale and its lines are already inserted
    // when the database refuses it, so everything must roll back.
    await expect(
      recordWalkInSale({ lines: [{ productId: cola.id, qty: 1 }], lbpAmount: "9".repeat(17) }),
    ).rejects.toBeDefined();
    await setExchangeRate(new Decimal("90000"));
    await expect(
      recordWalkInSale({ lines: [{ productId: cola.id, qty: 1 }], lbpAmount: "9".repeat(17) }),
    ).rejects.toBeDefined();
    expect(await counts()).toEqual({ sales: 0, items: 0, payments: 0, tenders: 0, ledger: 0 });
  });

  it("ignores a price sent by the client: the database price is used and must be paid", async () => {
    await expect(
      recordWalkInSale({ lines: [{ productId: cola.id, qty: 1, unitPriceUsd: "0.01" }], usdAmount: "0.01" }),
    ).rejects.toBeInstanceOf(ZodError);
    expect(await counts()).toEqual({ sales: 0, items: 0, payments: 0, tenders: 0, ledger: 0 });

    // The client thinks Cola is $1.00; the server charges the real $1.50.
    await expect(recordWalkInSale({ lines: [{ productId: cola.id, qty: 1 }], usdAmount: "1.00" })).rejects.toMatchObject({
      key: "shop.sale_not_fully_paid",
    });
    const sold = await recordWalkInSale({ lines: [{ productId: cola.id, qty: 1 }], usdAmount: "1.50" });
    expect(sold.totalUsd.toFixed(2)).toBe("1.50");
  });

  it("a price edit after a sale leaves that sale's lines unchanged and applies to the next sale", async () => {
    const first = await recordWalkInSale({ lines: [{ productId: cola.id, qty: 2 }], usdAmount: "3.00" });
    await updateProduct(cola.id, { name: "Cola", priceUsd: "2.00" });
    const line = await platformDb.saleItem.findFirstOrThrow({ where: { saleId: first.saleId } });
    expect([line.unitPriceUsd.toFixed(2), line.lineTotalUsd.toFixed(2)]).toEqual(["1.50", "3.00"]);
    const second = await recordWalkInSale({ lines: [{ productId: cola.id, qty: 2 }], usdAmount: "4.00" });
    expect(second.totalUsd.toFixed(2)).toBe("4.00");
  });

  it("refuses an archived item, an unknown item and another stadium's item", async () => {
    await archiveProduct(chips.id);
    await expect(recordWalkInSale({ lines: [{ productId: chips.id, qty: 1 }], usdAmount: "9.00" })).rejects.toMatchObject({
      key: "shop.product_unavailable",
    });
    await expect(recordWalkInSale({ lines: [{ productId: "nope", qty: 1 }], usdAmount: "9.00" })).rejects.toMatchObject({
      key: "shop.product_unavailable",
    });
    const other = await seedMinimalFixture({ tenantSlug: "sami", tenantName: "Sami", ownerIdentifier: "owner@sami" });
    actAs(other.sessionId, "sami");
    const theirs = await createProduct({ name: "Theirs", priceUsd: "1.00" });
    actAs(fixture.sessionId);
    await expect(recordWalkInSale({ lines: [{ productId: theirs.id, qty: 1 }], usdAmount: "9.00" })).rejects.toMatchObject({
      key: "shop.product_unavailable",
    });
    expect(await counts()).toEqual({ sales: 0, items: 0, payments: 0, tenders: 0, ledger: 0 });
  });

  it("keeps an LBP tender's frozen rate", async () => {
    await setExchangeRate(new Decimal("90000"));
    const sold = await recordWalkInSale({ lines: [{ productId: chips.id, qty: 2 }], lbpAmount: "405000" }); // $4.50
    await setExchangeRate(new Decimal("100000"));
    const tender = await platformDb.paymentTender.findFirstOrThrow({ where: { payment: { sourceId: sold.saleId } } });
    expect(tender.currency).toBe("LBP");
    expect(tender.rateAtTime?.toFixed(0)).toBe("90000");
    expect(tender.usdEquivalent.toFixed(2)).toBe("4.50");
  });

  it("mixes USD and LBP, and refuses a partial payment", async () => {
    await setExchangeRate(new Decimal("90000"));
    const sold = await recordWalkInSale({
      lines: [{ productId: chips.id, qty: 2 }],
      usdAmount: "2.00",
      lbpAmount: "225000", // $2.50
    });
    expect(sold.totalUsd.toFixed(2)).toBe("4.50");
    await expect(
      recordWalkInSale({ lines: [{ productId: chips.id, qty: 2 }], usdAmount: "2.00", lbpAmount: "180000" }),
    ).rejects.toMatchObject({ key: "shop.sale_not_fully_paid" });
    expect((await counts()).sales).toBe(1);
  });

  it("accepts more than the total and records everything received, like a booking collection", async () => {
    const sold = await recordWalkInSale({ lines: [{ productId: cola.id, qty: 1 }], usdAmount: "5.00" });
    const ledger = await platformDb.ledgerEntry.findFirstOrThrow({ where: { sourceType: "SALE", sourceId: sold.saleId } });
    expect(ledger.amountUsd.toFixed(2)).toBe("5.00");
    expect(sold.totalUsd.toFixed(2)).toBe("1.50");
  });

  it("merges the same item twice and refuses quantities outside 1 to 99", async () => {
    const sold = await recordWalkInSale({
      lines: [{ productId: cola.id, qty: 2 }, { productId: cola.id, qty: 3 }],
      usdAmount: "7.50",
    });
    expect(await platformDb.saleItem.count({ where: { saleId: sold.saleId } })).toBe(1);
    await expect(recordWalkInSale({ lines: [{ productId: cola.id, qty: 0 }], usdAmount: "1.00" })).rejects.toBeInstanceOf(ZodError);
    await expect(recordWalkInSale({ lines: [{ productId: cola.id, qty: 100 }], usdAmount: "999.00" })).rejects.toBeInstanceOf(ZodError);
    await expect(
      recordWalkInSale({ lines: [{ productId: cola.id, qty: 60 }, { productId: cola.id, qty: 60 }], usdAmount: "999.00" }),
    ).rejects.toMatchObject({ key: "shop.qty_invalid" });
    await expect(recordWalkInSale({ lines: [], usdAmount: "1.00" })).rejects.toBeInstanceOf(ZodError);
  });
});

describe("who may sell", () => {
  it("staff with shop.sell sell; without it they are refused", async () => {
    actAs(await createStaffSession(fixture.tenantId, { "shop.sell": true }));
    const sold = await recordWalkInSale({ lines: [{ productId: cola.id, qty: 1 }], usdAmount: "1.50" });
    const staff = await platformDb.membership.findFirstOrThrow({ where: { tenantId: fixture.tenantId, role: "STAFF" } });
    expect((await platformDb.sale.findUniqueOrThrow({ where: { id: sold.saleId } })).createdByMembershipId).toBe(staff.id);

    actAs(await createStaffSession(fixture.tenantId, { "payments.collect": true }));
    await expect(recordWalkInSale({ lines: [{ productId: cola.id, qty: 1 }], usdAmount: "1.50" })).rejects.toMatchObject({
      key: "access.not_allowed",
    });
  });

  it("an anonymous visitor and a suspended stadium are refused", async () => {
    clearRequestStubs();
    setTenantSlug(fixture.tenantSlug);
    await expect(recordWalkInSale({ lines: [{ productId: cola.id, qty: 1 }], usdAmount: "1.50" })).rejects.toMatchObject({
      key: "access.not_allowed",
    });
    await platformDb.tenant.update({ where: { id: fixture.tenantId }, data: { suspendedAt: new Date() } });
    actAs(fixture.sessionId);
    await expect(recordWalkInSale({ lines: [{ productId: cola.id, qty: 1 }], usdAmount: "1.50" })).rejects.toMatchObject({
      key: "access.not_allowed",
    });
    expect((await counts()).sales).toBe(0);
  });
});
