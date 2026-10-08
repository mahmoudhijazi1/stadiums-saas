import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { loadActivityPage } from "@/app/owner/(app)/money/activity-load";
import { platformDb } from "@/lib/platform-db";
import { recordExpense } from "@/modules/expense/application/record-expense";
import { sumExpenseCategory } from "@/modules/expense/application/sum-expense-category";
import { createProduct } from "@/modules/shop/application/products";
import { listSaleDetails } from "@/modules/shop/application/list-sale-details";
import { recordWalkInSale } from "@/modules/shop/application/record-walk-in-sale";
import { summarizeShopPeriod } from "@/modules/shop/application/summarize-shop-period";
import { civilDateInTimeZone, formatCivilDate } from "@/modules/venue/domain/availability";
import type { TestFixture } from "./fixtures";
import { createStaffSession, seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * The Money screen's Shop card and the Activity row of a sale: sums by period (Beirut days, by sale
 * time), per-item totals, shop supplies, and a SALE row that opens the right sale.
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

async function sell(lines: { productId: string; qty: number }[], usd: string, soldAt: string) {
  const sold = await recordWalkInSale({ lines, usdAmount: usd });
  await platformDb.sale.update({ where: { id: sold.saleId }, data: { soldAt: new Date(soldAt) } });
  return sold;
}

describe("the Shop card", () => {
  it("sums sales and items by period, on Beirut calendar days", async () => {
    // 20:30Z on the 14th is 23:30 Beirut on the 14th; 21:30Z is 00:30 on the 15th.
    await sell([{ productId: cola.id, qty: 2 }], "3.00", "2026-10-14T20:30:00Z");
    await sell([{ productId: cola.id, qty: 1 }, { productId: chips.id, qty: 2 }], "6.00", "2026-10-14T21:30:00Z");

    const fourteenth = await summarizeShopPeriod({ from: "2026-10-14", to: "2026-10-14" });
    expect(fourteenth.salesUsd.toFixed(2)).toBe("3.00");
    expect(fourteenth.items.map((item) => [item.name, item.qty, item.totalUsd.toFixed(2)])).toEqual([["Cola", 2, "3.00"]]);

    const fifteenth = await summarizeShopPeriod({ from: "2026-10-15", to: "2026-10-15" });
    expect(fifteenth.salesUsd.toFixed(2)).toBe("6.00");
    expect(fifteenth.items.map((item) => [item.name, item.qty, item.totalUsd.toFixed(2)])).toEqual([
      ["Chips", 2, "4.50"],
      ["Cola", 1, "1.50"],
    ]);

    const both = await summarizeShopPeriod({ from: "2026-10-14", to: "2026-10-15" });
    expect(both.salesUsd.toFixed(2)).toBe("9.00");
    expect(both.items.find((item) => item.name === "Cola")).toMatchObject({ qty: 3 });
    expect(both.items.reduce((sum, item) => sum.plus(item.totalUsd), new Decimal(0)).toFixed(2)).toBe("9.00");

    const empty = await summarizeShopPeriod({ from: "2026-10-16", to: "2026-10-20" });
    expect(empty.salesUsd.toFixed(2)).toBe("0.00");
    expect(empty.items).toEqual([]);
  });

  it("sums only shop supplies, by the day they were spent, not other expenses", async () => {
    await recordExpense({ category: "SHOP_SUPPLIES", description: "Crate of cola", occurredOn: "2026-10-14", tenders: [{ currency: "USD", amount: new Decimal("12.00") }] });
    await recordExpense({ category: "SHOP_SUPPLIES", description: "Chips box", occurredOn: "2026-10-15", tenders: [{ currency: "USD", amount: new Decimal("8.50") }] });
    await recordExpense({ category: "WATER", description: "Water", occurredOn: "2026-10-14", tenders: [{ currency: "USD", amount: new Decimal("30.00") }] });

    expect((await sumExpenseCategory({ from: "2026-10-14", to: "2026-10-14", category: "SHOP_SUPPLIES" })).toFixed(2)).toBe("12.00");
    expect((await sumExpenseCategory({ from: "2026-10-14", to: "2026-10-15", category: "SHOP_SUPPLIES" })).toFixed(2)).toBe("20.50");
    expect((await sumExpenseCategory({ from: "2026-10-16", to: "2026-10-16", category: "SHOP_SUPPLIES" })).toFixed(2)).toBe("0.00");
  });

  it("is hidden from staff without reports.view, and one stadium never sees another's numbers", async () => {
    await sell([{ productId: cola.id, qty: 1 }], "1.50", "2026-10-14T10:00:00Z");
    const other = await seedMinimalFixture({ tenantSlug: "sami", tenantName: "Sami", ownerIdentifier: "owner@sami" });
    actAs(other.sessionId, "sami");
    expect((await summarizeShopPeriod({ from: "2026-10-14", to: "2026-10-14" })).salesUsd.toFixed(2)).toBe("0.00");

    actAs(await createStaffSession(fixture.tenantId, { "shop.sell": true }));
    await expect(summarizeShopPeriod({ from: "2026-10-14", to: "2026-10-14" })).rejects.toMatchObject({ key: "access.not_allowed" });
    await expect(sumExpenseCategory({ from: "2026-10-14", to: "2026-10-14", category: "SHOP_SUPPLIES" })).rejects.toMatchObject({
      key: "access.not_allowed",
    });
    await expect(listSaleDetails(["x"])).rejects.toMatchObject({ key: "access.not_allowed" });
  });
});

describe("Activity", () => {
  it("a SALE row opens the right sale: its lines and its tenders", async () => {
    // Activity lists the ledger by payment time, so these two are simply sold now.
    const first = await recordWalkInSale({ lines: [{ productId: cola.id, qty: 2 }], usdAmount: "3.00" });
    const second = await recordWalkInSale({ lines: [{ productId: chips.id, qty: 1 }], usdAmount: "2.25" });

    const today = formatCivilDate(civilDateInTimeZone(new Date(), "Asia/Beirut"));
    const page = await loadActivityPage({ from: today, to: today, filter: "all" }, "en");
    expect(page.rows).toHaveLength(2);
    const byAmount = Object.fromEntries(page.rows.map((row) => [row.amountUsd, row]));
    expect(byAmount["3.00"]).toMatchObject({ label: "Shop · 2 items", icon: "shop", direction: "IN" });
    expect(byAmount["2.25"]).toMatchObject({ label: "Shop · 1 item", icon: "shop" });

    for (const [sale, name, total] of [
      [first, "Cola", "3.00"],
      [second, "Chips", "2.25"],
    ] as const) {
      const row = page.rows.find((candidate) => candidate.amountUsd === total)!;
      if (row.open?.kind !== "sale") throw new Error("expected a sale sheet");
      expect(row.open.detail.lines.map((line) => line.name)).toEqual([name]);
      expect(row.open.detail.tenders).toEqual([{ currency: "USD", amount: total, rate: null, usd: total }]);
      expect((await listSaleDetails([sale.saleId])).get(sale.saleId)?.lines[0]?.name).toBe(name);
    }
  });
});
