import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { ZodError } from "zod";
import { platformDb } from "@/lib/platform-db";
import { archiveProduct, createProduct, listProducts, updateProduct } from "@/modules/shop/application/products";
import type { TestFixture } from "./fixtures";
import { createStaffSession, seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/** The shop catalog: owner-only to manage, active items only, ordered by what sold. */
let fixture: TestFixture;

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
  clearRequestStubs();
  fixture = await seedMinimalFixture();
  actAs(fixture.sessionId);
});

function actAs(token: string, slug = fixture.tenantSlug) {
  clearRequestStubs();
  setTenantSlug(slug);
  setSessionCookie(token);
}

/** A past sale made straight in the database (the sell flow has its own tests). */
async function sell(tenantId: string, productId: string, qty: number, unit: string, daysAgo = 1) {
  const membership = await platformDb.membership.findFirstOrThrow({ where: { tenantId, role: "OWNER" } });
  const sale = await platformDb.sale.create({
    data: { tenantId, createdByMembershipId: membership.id, soldAt: new Date(Date.now() - daysAgo * 86_400_000) },
  });
  await platformDb.saleItem.create({
    data: {
      tenantId,
      saleId: sale.id,
      productId,
      qty,
      unitPriceUsd: unit,
      lineTotalUsd: (Number(unit) * qty).toFixed(2),
      addedAt: sale.soldAt,
    },
  });
  return sale.id;
}

describe("catalog", () => {
  it("adds, edits and archives items; names stay as written; archived items vanish from the list", async () => {
    const cola = await createProduct({ name: "  Pepsi   Max ", priceUsd: "1.50" });
    const water = await createProduct({ name: "ماء", priceUsd: "1" });
    expect((await listProducts({ forSale: false })).map((item) => [item.name, item.priceUsd!.toFixed(2)])).toEqual([
      ["Pepsi Max", "1.50"],
      ["ماء", "1.00"],
    ]);

    await updateProduct(cola.id, { name: "Pepsi", priceUsd: "2.00" });
    await archiveProduct(water.id);
    expect((await listProducts({ forSale: false })).map((item) => item.name)).toEqual(["Pepsi"]);
    // Archived, not deleted.
    expect(await platformDb.product.count({ where: { tenantId: fixture.tenantId } })).toBe(2);
    expect((await platformDb.product.findUniqueOrThrow({ where: { id: water.id } })).archivedAt).not.toBeNull();
  });

  it("refuses a bad name or price", async () => {
    await expect(createProduct({ name: "", priceUsd: "1.00" })).rejects.toBeInstanceOf(ZodError);
    await expect(createProduct({ name: "Cola", priceUsd: "0" })).rejects.toBeInstanceOf(ZodError);
    await expect(createProduct({ name: "Cola", priceUsd: "10000.01" })).rejects.toBeInstanceOf(ZodError);
    await expect(createProduct({ name: "x".repeat(61), priceUsd: "1.00" })).rejects.toBeInstanceOf(ZodError);
    expect(await platformDb.product.count()).toBe(0);
  });

  it("orders by quantity sold in the last 30 days, then by name", async () => {
    const [a, b, c, d] = await Promise.all(
      ["Chips", "Cola", "Apple", "Gum"].map((name) => createProduct({ name, priceUsd: "1.00" })),
    );
    await sell(fixture.tenantId, c!.id, 2, "1.00", 3);
    await sell(fixture.tenantId, b!.id, 7, "1.00", 5);
    await sell(fixture.tenantId, d!.id, 40, "1.00", 45); // sold 45 days ago: does not count
    await sell(fixture.tenantId, a!.id, 2, "1.00", 10);
    expect((await listProducts({ forSale: false })).map((item) => [item.name, item.sold30d])).toEqual([
      ["Cola", 7],
      ["Apple", 2],
      ["Chips", 2],
      ["Gum", 0],
    ]);
  });

  it("a price edit leaves earlier sale lines unchanged", async () => {
    const cola = await createProduct({ name: "Cola", priceUsd: "1.50" });
    await sell(fixture.tenantId, cola.id, 2, "1.50");
    await updateProduct(cola.id, { name: "Cola", priceUsd: "2.50" });
    const line = await platformDb.saleItem.findFirstOrThrow({ where: { productId: cola.id } });
    expect(line.unitPriceUsd.toFixed(2)).toBe("1.50");
    expect(line.lineTotalUsd.toFixed(2)).toBe("3.00");
    expect((await platformDb.product.findUniqueOrThrow({ where: { id: cola.id } })).priceUsd!.toFixed(2)).toBe("2.50");
  });

  it("archiving keeps the item on past sales", async () => {
    const cola = await createProduct({ name: "Cola", priceUsd: "1.50" });
    await sell(fixture.tenantId, cola.id, 1, "1.50");
    await archiveProduct(cola.id);
    expect(await platformDb.saleItem.count({ where: { productId: cola.id } })).toBe(1);
    expect(await listProducts({ forSale: false })).toEqual([]);
  });
});

describe("who may manage the catalog", () => {
  it("shop.manage is owner-only: staff are refused even with the flag", async () => {
    const staff = await createStaffSession(fixture.tenantId, { "shop.sell": true, "shop.manage": true });
    actAs(staff);
    await expect(createProduct({ name: "Cola", priceUsd: "1.00" })).rejects.toMatchObject({ key: "access.not_allowed" });
    await expect(listProducts({ forSale: false })).rejects.toMatchObject({ key: "access.not_allowed" });
  });

  it("staff with shop.sell may list the items to sell, staff without it may not", async () => {
    await createProduct({ name: "Cola", priceUsd: "1.00" });
    actAs(await createStaffSession(fixture.tenantId, { "shop.sell": true }));
    expect((await listProducts({ forSale: true })).map((item) => item.name)).toEqual(["Cola"]);
    actAs(await createStaffSession(fixture.tenantId, {}));
    await expect(listProducts({ forSale: true })).rejects.toMatchObject({ key: "access.not_allowed" });
  });

  it("a suspended stadium is refused", async () => {
    await platformDb.tenant.update({ where: { id: fixture.tenantId }, data: { suspendedAt: new Date() } });
    actAs(fixture.sessionId);
    await expect(createProduct({ name: "Cola", priceUsd: "1.00" })).rejects.toMatchObject({ key: "access.not_allowed" });
  });

  it("another stadium's items are neither listed nor editable", async () => {
    const other = await seedMinimalFixture({ tenantSlug: "sami", tenantName: "Sami", ownerIdentifier: "owner@sami" });
    actAs(other.sessionId, "sami");
    const theirs = await createProduct({ name: "Theirs", priceUsd: "9.00" });
    actAs(fixture.sessionId);
    await createProduct({ name: "Mine", priceUsd: "1.00" });
    expect((await listProducts({ forSale: false })).map((item) => item.name)).toEqual(["Mine"]);
    await expect(updateProduct(theirs.id, { name: "Hijacked", priceUsd: "1.00" })).rejects.toMatchObject({
      key: "shop.product_not_found",
    });
    await expect(archiveProduct(theirs.id)).rejects.toMatchObject({ key: "shop.product_not_found" });
    expect((await platformDb.product.findUniqueOrThrow({ where: { id: theirs.id } })).name).toBe("Theirs");
  });
});
