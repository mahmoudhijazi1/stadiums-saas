import Decimal from "decimal.js";
import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { loadActivityPage } from "@/app/owner/(app)/money/activity-load";
import { platformDb } from "@/lib/platform-db";
import { businessDayUtcRange } from "@/modules/booking/domain/business-day";
import { recordExpense } from "@/modules/expense/application/record-expense";
import { sumExpenseCategory } from "@/modules/expense/application/sum-expense-category";
import { summarizeLedgerPeriod } from "@/modules/ledger/application/summarize-ledger-period";
import { setExchangeRate } from "@/modules/payment/application/set-exchange-rate";
import { summarizeCash } from "@/modules/payment/application/summarize-cash";
import { createProduct } from "@/modules/shop/application/products";
import { recordWalkInSale } from "@/modules/shop/application/record-walk-in-sale";
import { summarizeShopPeriod } from "@/modules/shop/application/summarize-shop-period";
import type { TestFixture } from "./fixtures";
import { createStaffSession, seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Money page v2. WRITTEN, NOT RUN when authored: unverified until `npm run test:integration` has
 * been run. Rows that need a chosen time are written straight to the tables (as the other money
 * suites do); the sale and the expense go through their use cases.
 */
let fixture: TestFixture;

beforeEach(async () => {
  await truncateAll();
  fixture = await seedMinimalFixture();
  actAs(fixture.sessionId);
});

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

function actAs(token: string, slug = fixture.tenantSlug) {
  clearRequestStubs();
  setTenantSlug(slug);
  setSessionCookie(token);
}

type Tender = { currency: "USD" | "LBP"; amount: string; usd: string };

/** One payment with its tenders, recorded at `createdAt` (the moment cash changed hands). */
async function payment(
  sourceType: "BOOKING" | "EXPENSE" | "SALE",
  createdAt: string,
  tenders: Tender[],
  tenantId = fixture.tenantId,
) {
  await platformDb.payment.create({
    data: {
      tenantId,
      sourceType,
      sourceId: `src-${sourceType}-${createdAt}-${tenders.map((t) => t.currency).join("")}`,
      amountDueUsd: "0.00",
      createdAt: new Date(createdAt),
      tenders: {
        create: tenders.map((t) => ({
          tenantId,
          currency: t.currency,
          amount: t.amount,
          rateAtTime: t.currency === "LBP" ? "90000" : null,
          usdEquivalent: t.usd,
        })),
      },
    },
  });
}

async function ledger(direction: "IN" | "OUT", amountUsd: string, occurredAt: string, sourceType: "BOOKING" | "EXPENSE" | "SALE", n = 0) {
  await platformDb.ledgerEntry.create({
    data: { tenantId: fixture.tenantId, direction, amountUsd, occurredAt: new Date(occurredAt), sourceType, sourceId: `l-${direction}-${occurredAt}-${n}` },
  });
}

const day = (date: { year: number; month: number; day: number }) => businessDayUtcRange(date, 6);

describe("the summary: In by source and the previous period", () => {
  it("splits In by source, counts rows, and keeps In and Out", async () => {
    await ledger("IN", "175.00", "2026-10-10T10:00:00Z", "BOOKING");
    await ledger("IN", "22.00", "2026-10-11T10:00:00Z", "SALE");
    await ledger("OUT", "80.00", "2026-10-12T10:00:00Z", "EXPENSE");

    const october = await summarizeLedgerPeriod({ from: "2026-10-01", to: "2026-10-31", compare: true });
    expect(october.inUsd.toFixed(2)).toBe("197.00");
    expect(october.outUsd.toFixed(2)).toBe("80.00");
    expect(october.rows).toBe(3);
    expect(october.inBySource.map((s) => [s.sourceType, s.usd.toFixed(2)])).toEqual([
      ["BOOKING", "175.00"],
      ["SALE", "22.00"],
    ]);
  });

  it("a period with one source has one entry (the line hides itself)", async () => {
    await ledger("IN", "50.00", "2026-10-10T10:00:00Z", "BOOKING");
    const october = await summarizeLedgerPeriod({ from: "2026-10-01", to: "2026-10-31" });
    expect(october.inBySource).toHaveLength(1);
  });

  it("the previous period reports zero rows when empty, and its rows when not", async () => {
    await ledger("IN", "10.00", "2026-10-10T10:00:00Z", "BOOKING");
    const empty = await summarizeLedgerPeriod({ from: "2026-10-01", to: "2026-10-31", compare: true });
    expect(empty.previous?.rows).toBe(0);

    await ledger("OUT", "5.00", "2026-09-10T10:00:00Z", "EXPENSE");
    const withPrevious = await summarizeLedgerPeriod({ from: "2026-10-01", to: "2026-10-31", compare: true });
    expect(withPrevious.previous?.rows).toBe(1);
    expect(withPrevious.previous?.netUsd.toFixed(2)).toBe("-5.00");
  });

  it("a loss has a negative net", async () => {
    await ledger("IN", "10.00", "2026-10-10T10:00:00Z", "BOOKING");
    await ledger("OUT", "40.00", "2026-10-11T10:00:00Z", "EXPENSE");
    expect((await summarizeLedgerPeriod({ from: "2026-10-01", to: "2026-10-31" })).netUsd.isNegative()).toBe(true);
  });
});

describe("cash today: the business day, per currency", () => {
  const oct14 = day({ year: 2026, month: 10, day: 14 });
  const oct15 = day({ year: 2026, month: 10, day: 15 });

  it("is IN tenders minus OUT tenders, per currency and never converted", async () => {
    await payment("BOOKING", "2026-10-14T12:00:00Z", [{ currency: "USD", amount: "140.00", usd: "140.00" }]);
    await payment("SALE", "2026-10-14T13:00:00Z", [{ currency: "LBP", amount: "3000000", usd: "33.33" }]);
    await payment("EXPENSE", "2026-10-14T14:00:00Z", [{ currency: "LBP", amount: "300000", usd: "3.33" }]);

    const cash = await summarizeCash(oct14);
    expect(cash.net.USD.toFixed(2)).toBe("140.00");
    expect(cash.net.LBP.toFixed(0)).toBe("2700000");
    expect(cash.in.LBP.toFixed(0)).toBe("3000000");
    expect(cash.out.LBP.toFixed(0)).toBe("300000");
  });

  it("an expense paid in pounds lowers only the pound net", async () => {
    await payment("BOOKING", "2026-10-14T12:00:00Z", [{ currency: "USD", amount: "50.00", usd: "50.00" }]);
    await payment("EXPENSE", "2026-10-14T13:00:00Z", [{ currency: "LBP", amount: "900000", usd: "10.00" }]);
    const cash = await summarizeCash(oct14);
    expect(cash.net.USD.toFixed(2)).toBe("50.00");
    expect(cash.net.LBP.toFixed(0)).toBe("-900000");
  });

  it("a payment at 00:30 belongs to the previous business day (day start 6)", async () => {
    // 21:30Z on 14 Oct is 00:30 on 15 Oct in Beirut: still the 14th's business day.
    await payment("BOOKING", "2026-10-14T21:30:00Z", [{ currency: "USD", amount: "20.00", usd: "20.00" }]);
    // 05:00Z on 15 Oct is 08:00 in Beirut: the 15th.
    await payment("BOOKING", "2026-10-15T05:00:00Z", [{ currency: "USD", amount: "7.00", usd: "7.00" }]);

    expect((await summarizeCash(oct14)).net.USD.toFixed(2)).toBe("20.00");
    expect((await summarizeCash(oct15)).net.USD.toFixed(2)).toBe("7.00");
  });

  it("an empty day is zero and says there was nothing", async () => {
    const cash = await summarizeCash(oct14);
    expect(cash.any).toBe(false);
    expect(cash.net.USD.isZero() && cash.net.LBP.isZero()).toBe(true);
  });

  it("never counts another stadium's cash", async () => {
    const other = await seedMinimalFixture({ tenantSlug: "sami", tenantName: "Sami", ownerIdentifier: "owner@sami" });
    await payment("BOOKING", "2026-10-14T12:00:00Z", [{ currency: "USD", amount: "99.00", usd: "99.00" }], other.tenantId);
    actAs(fixture.sessionId);
    expect((await summarizeCash(oct14)).net.USD.toFixed(2)).toBe("0.00");
  });

  it("change handed back at the counter is not counted: a $20 note for a $4.50 sale is $4.50 of cash", async () => {
    await setExchangeRate(new Decimal("90000"));
    const chips = await createProduct({ name: "Chips", priceUsd: "2.25" });
    await recordWalkInSale({ lines: [{ productId: chips.id, qty: 2 }], usdAmount: "20.00" });

    const now = Date.now();
    const cash = await summarizeCash({ start: new Date(now - 3_600_000), end: new Date(now + 3_600_000) });
    expect(cash.in.USD.toFixed(2)).toBe("4.50");
    expect(cash.net.USD.toFixed(2)).toBe("4.50");
  });

  it("an expense recorded through the use case is cash OUT in the currency it was paid in", async () => {
    await setExchangeRate(new Decimal("90000"));
    await recordExpense({
      category: "WATER",
      description: "Tank",
      occurredOn: "2026-10-14",
      tenders: [{ currency: "LBP", amount: new Decimal("450000") }],
    });
    const now = Date.now();
    const cash = await summarizeCash({ start: new Date(now - 3_600_000), end: new Date(now + 3_600_000) });
    expect(cash.out.LBP.toFixed(0)).toBe("450000");
    expect(cash.net.LBP.toFixed(0)).toBe("-450000");
    expect(cash.net.USD.isZero()).toBe(true);
  });

  it("needs reports.view: staff with no flags or only expenses.record get no cash and no summary", async () => {
    const flagSets: Record<string, true>[] = [{}, { "expenses.record": true }, { "shop.sell": true }];
    for (const flags of flagSets) {
      actAs(await createStaffSession(fixture.tenantId, flags));
      await expect(summarizeCash(oct14)).rejects.toMatchObject({ key: "access.not_allowed" });
      await expect(summarizeLedgerPeriod({ from: "2026-10-01", to: "2026-10-31" })).rejects.toMatchObject({ key: "access.not_allowed" });
    }
    actAs(await createStaffSession(fixture.tenantId, { "reports.view": true }));
    await expect(summarizeCash(oct14)).resolves.toBeDefined();
  });
});

describe("recent activity and the activity page", () => {
  async function manyEntries(inCount: number, outCount: number) {
    for (let i = 0; i < inCount; i += 1) {
      await ledger("IN", "1.00", new Date(Date.UTC(2026, 9, 10, 8, i)).toISOString(), "BOOKING", i);
    }
    for (let i = 0; i < outCount; i += 1) {
      await ledger("OUT", "2.00", new Date(Date.UTC(2026, 9, 11, 8, i)).toISOString(), "EXPENSE", i);
    }
  }
  const range = { from: "2026-10-01", to: "2026-10-31" };

  it("recent activity shows at most 5 rows, newest first, and says there is more", async () => {
    await manyEntries(6, 4);
    const recent = await loadActivityPage({ ...range, filter: "all", limit: 5 }, "en");
    expect(recent.rows).toHaveLength(5);
    expect(recent.nextCursor).not.toBeNull();
    const times = recent.rows.map((row) => row.occurredAt);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it("fewer than 5 rows shows them all with no next page", async () => {
    await manyEntries(2, 1);
    const recent = await loadActivityPage({ ...range, filter: "all", limit: 5 }, "en");
    expect(recent.rows).toHaveLength(3);
    expect(recent.nextCursor).toBeNull();
  });

  it("the limit cannot exceed the page size of 20", async () => {
    await manyEntries(25, 0);
    expect((await loadActivityPage({ ...range, filter: "all", limit: 500 }, "en")).rows).toHaveLength(20);
  });

  it("the activity page keeps its filter and pages with a keyset, with no row repeated or skipped", async () => {
    await manyEntries(25, 5);

    const firstIn = await loadActivityPage({ ...range, filter: "in" }, "en");
    expect(firstIn.rows).toHaveLength(20);
    expect(firstIn.rows.every((row) => row.direction === "IN")).toBe(true);
    expect(firstIn.nextCursor).not.toBeNull();

    const secondIn = await loadActivityPage({ ...range, filter: "in", cursor: firstIn.nextCursor! }, "en");
    expect(secondIn.rows).toHaveLength(5);
    expect(secondIn.nextCursor).toBeNull();
    const ids = [...firstIn.rows, ...secondIn.rows].map((row) => row.id);
    expect(new Set(ids).size).toBe(25);

    const out = await loadActivityPage({ ...range, filter: "out" }, "en");
    expect(out.rows).toHaveLength(5);
    expect(out.rows.every((row) => row.direction === "OUT")).toBe(true);

    const all = await loadActivityPage({ ...range, filter: "all" }, "en");
    expect(all.rows).toHaveLength(20);
  });

  it("staff without reports.view cannot read the activity", async () => {
    actAs(await createStaffSession(fixture.tenantId, { "expenses.record": true }));
    await expect(loadActivityPage({ ...range, filter: "all", limit: 5 }, "en")).rejects.toMatchObject({ key: "access.not_allowed" });
  });
});

describe("the shop page sums by period", () => {
  it("sales and supplies are summed for the period asked for, not another", async () => {
    await setExchangeRate(new Decimal("90000"));
    const cola = await createProduct({ name: "Cola", priceUsd: "1.50" });
    const chips = await createProduct({ name: "Chips", priceUsd: "2.25" });

    const first = await recordWalkInSale({ lines: [{ productId: cola.id, qty: 2 }], usdAmount: "3.00" }); // $3.00
    const second = await recordWalkInSale({ lines: [{ productId: chips.id, qty: 4 }], usdAmount: "9.00" }); // $9.00
    // Put the first sale in September and the second in October.
    await platformDb.$executeRaw`UPDATE "SaleItem" SET "addedAt" = ${new Date("2026-09-15T10:00:00Z")} WHERE "saleId" = ${first.saleId}`;
    await platformDb.$executeRaw`UPDATE "SaleItem" SET "addedAt" = ${new Date("2026-10-15T10:00:00Z")} WHERE "saleId" = ${second.saleId}`;

    await recordExpense({ category: "SHOP_SUPPLIES", description: "Restock", occurredOn: "2026-10-05", tenders: [{ currency: "USD", amount: new Decimal("12.00") }] });
    await recordExpense({ category: "WATER", description: "Not shop", occurredOn: "2026-10-06", tenders: [{ currency: "USD", amount: new Decimal("5.00") }] });

    const september = await summarizeShopPeriod({ from: "2026-09-01", to: "2026-09-30" });
    expect(september.salesUsd.toFixed(2)).toBe("3.00");
    expect(september.items.map((item) => [item.name, item.qty])).toEqual([["Cola", 2]]);

    const october = await summarizeShopPeriod({ from: "2026-10-01", to: "2026-10-31" });
    expect(october.salesUsd.toFixed(2)).toBe("9.00");
    expect(october.items.map((item) => [item.name, item.qty])).toEqual([["Chips", 4]]);

    expect((await sumExpenseCategory({ from: "2026-10-01", to: "2026-10-31", category: "SHOP_SUPPLIES" })).toFixed(2)).toBe("12.00");
    expect((await sumExpenseCategory({ from: "2026-09-01", to: "2026-09-30", category: "SHOP_SUPPLIES" })).toFixed(2)).toBe("0.00");
  });

  it("staff without reports.view cannot read the shop numbers", async () => {
    actAs(await createStaffSession(fixture.tenantId, { "shop.sell": true }));
    await expect(summarizeShopPeriod({ from: "2026-10-01", to: "2026-10-31" })).rejects.toMatchObject({ key: "access.not_allowed" });
  });
});
