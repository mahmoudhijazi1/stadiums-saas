import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import { addBookingItems } from "@/modules/booking/application/add-booking-items";
import { removeBookingItem } from "@/modules/booking/application/remove-booking-item";
import { createProduct } from "@/modules/shop/application/products";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { bookingStartingIn } from "./shop-helpers";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Items on a game open 60 minutes before its start. Written, not run when authored: unverified
 * until `npm run test:integration` has run.
 */
let fixture: TestFixture;
let cola: { id: string };

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
  cola = await createProduct({ name: "Cola", priceUsd: "1.50" });
});

const game = { kind: "game" } as const;

describe("the shop window of a game", () => {
  it("refuses items 2 hours before the start with shop.items_not_open, and writes nothing", async () => {
    const bookingId = await bookingStartingIn(fixture, 120);
    await expect(addBookingItems({ bookingId, lines: [{ productId: cola.id, qty: 1 }], payer: game })).rejects.toMatchObject({
      key: "shop.items_not_open",
    });
    expect(await platformDb.sale.count({ where: { bookingId } })).toBe(0);
    expect(await platformDb.saleItem.count()).toBe(0);
  });

  it("accepts items 30 minutes before the start", async () => {
    const bookingId = await bookingStartingIn(fixture, 30);
    const added = await addBookingItems({ bookingId, lines: [{ productId: cola.id, qty: 2 }], payer: game });
    expect(added.itemCount).toBe(2);
    expect(await platformDb.sale.count({ where: { bookingId } })).toBe(1);
  });

  it("still removes an existing item 2 hours before the start", async () => {
    const bookingId = await bookingStartingIn(fixture, 30);
    const { saleId } = await addBookingItems({ bookingId, lines: [{ productId: cola.id, qty: 1 }], payer: game });
    const item = await platformDb.saleItem.findFirstOrThrow({ where: { saleId } });
    // The game is now 2 hours away: the window is closed for adding, not for removing.
    await platformDb.$executeRaw`
      UPDATE "Booking" SET during = tstzrange(now() + interval '2 hours', now() + interval '3 hours', '[)') WHERE id = ${bookingId}`;
    await removeBookingItem({ itemId: item.id, qty: 1 });
    // A removal is a correcting row, so the lines of the tab net to zero.
    const rows = await platformDb.saleItem.findMany({ where: { saleId } });
    expect(rows.reduce((sum, row) => sum + row.qty, 0)).toBe(0);
  });
});
