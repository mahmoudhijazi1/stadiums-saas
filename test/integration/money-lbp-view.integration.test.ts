import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { loadActivityPage } from "@/app/owner/(app)/money/_components/activity-load";
import { platformDb } from "@/lib/platform-db";
import { summarizeLedgerPeriod } from "@/modules/ledger/application/summarize-ledger-period";
import { summarizeLbpPeriod } from "@/modules/payment/application/summarize-lbp-period";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * DR-007: the Money page in pounds counts each payment at its own value. An LBP tender is its amount,
 * a USD tender is amount x the rate stored on it, a USD tender with no stored rate uses the current
 * one and is counted. The period is the ledger's: an expense by its business date, a booking or sale
 * by the moment of the payment. The USD view keeps reading the ledger.
 */
const OCTOBER = { from: "2026-10-01", to: "2026-10-31" };
const TODAY_RATE = new Decimal(95000);

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
});

type Tender = { currency: "USD" | "LBP"; amount: string; rate: string | null; usd: string };
const lbp = (amount: string, rate: string, usd: string): Tender => ({ currency: "LBP", amount, rate, usd });
const dollars = (amount: string, rate: string | null): Tender => ({ currency: "USD", amount, rate, usd: amount });

/** A payment, its tenders and its ledger row, the way recordPayment writes them (times set by hand). */
async function pay(input: { sourceType: "BOOKING" | "SALE"; sourceId: string; at: string; tenders: Tender[] }) {
  await write({ ...input, ledgerAt: input.at });
}

/** An expense with its payment: the payment is made `enteredAt`, the ledger row carries the business date. */
async function spend(input: { id: string; occurredAt: string; enteredAt: string; tenders: Tender[] }) {
  await platformDb.expense.create({
    data: { id: input.id, tenantId: fixture.tenantId, category: "SHOP_SUPPLIES", description: `expense ${input.id}`, occurredAt: new Date(input.occurredAt) },
  });
  await write({ sourceType: "EXPENSE", sourceId: input.id, at: input.enteredAt, ledgerAt: input.occurredAt, tenders: input.tenders });
}

async function write(input: {
  sourceType: "BOOKING" | "SALE" | "EXPENSE";
  sourceId: string;
  at: string;
  ledgerAt: string;
  tenders: Tender[];
}) {
  const usd = input.tenders.reduce((sum, tender) => sum.plus(tender.usd), new Decimal(0));
  await platformDb.payment.create({
    data: {
      tenantId: fixture.tenantId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      dueCurrency: "USD",
      amountDueUsd: usd.toFixed(2),
      createdAt: new Date(input.at),
      tenders: {
        create: input.tenders.map((tender) => ({
          tenantId: fixture.tenantId,
          currency: tender.currency,
          amount: tender.amount,
          rateAtTime: tender.rate,
          usdEquivalent: tender.usd,
        })),
      },
    },
  });
  await platformDb.ledgerEntry.create({
    data: {
      tenantId: fixture.tenantId,
      direction: input.sourceType === "EXPENSE" ? "OUT" : "IN",
      amountUsd: usd.toFixed(2),
      occurredAt: new Date(input.ledgerAt),
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    },
  });
}

/** September (the period before) and October, at three different rates. */
async function seedTwoMonths() {
  // September: 1,000,000 pounds, and $10 at 85,000.
  await pay({ sourceType: "BOOKING", sourceId: "b-sep-1", at: "2026-09-10T10:00:00.000Z", tenders: [lbp("1000000", "88000", "11.36")] });
  await pay({ sourceType: "BOOKING", sourceId: "b-sep-2", at: "2026-09-12T10:00:00.000Z", tenders: [dollars("10.00", "85000")] });
  // October: 2,000,000 pounds at 89,500; $20 at 90,000; a $10 sale at 100,000.
  await pay({ sourceType: "BOOKING", sourceId: "b-oct-1", at: "2026-10-05T10:00:00.000Z", tenders: [lbp("2000000", "89500", "22.35")] });
  await pay({ sourceType: "BOOKING", sourceId: "b-oct-2", at: "2026-10-10T10:00:00.000Z", tenders: [dollars("20.00", "90000")] });
  await pay({ sourceType: "SALE", sourceId: "s-oct-1", at: "2026-10-12T10:00:00.000Z", tenders: [dollars("10.00", "100000")] });
  // An expense paid in pounds in October.
  await spend({ id: "x-oct", occurredAt: "2026-10-08T09:00:00.000Z", enteredAt: "2026-10-08T09:00:00.000Z", tenders: [lbp("500000", "89500", "5.59")] });
}

describe("the LBP view of a period", () => {
  it("In is the pounds received plus each dollar payment at its own rate, and differs from the ledger at today's rate", async () => {
    await seedTwoMonths();
    const october = await summarizeLbpPeriod({ ...OCTOBER, fallbackRate: TODAY_RATE });

    // 2,000,000 + 20 x 90,000 (1,800,000) + a sale of 10 x 100,000 (1,000,000).
    expect(october.inLbp.toFixed(0)).toBe("4800000");
    expect(october.salesLbp.toFixed(0)).toBe("1000000");
    expect(october.unrated).toBe(0);

    const ledger = await summarizeLedgerPeriod(OCTOBER);
    expect(ledger.inUsd.times(TODAY_RATE).toFixed(0)).not.toBe(october.inLbp.toFixed(0));
  });

  it("an expense paid in pounds counts as those pounds in Out, and Profit is In minus Out", async () => {
    await seedTwoMonths();
    const october = await summarizeLbpPeriod({ ...OCTOBER, fallbackRate: TODAY_RATE });
    expect(october.outLbp.toFixed(0)).toBe("500000");
    expect(october.netLbp.toFixed(0)).toBe("4300000");
  });

  it("the comparison uses the same method for the previous period", async () => {
    await seedTwoMonths();
    const october = await summarizeLbpPeriod({ ...OCTOBER, compare: true, fallbackRate: TODAY_RATE });
    // September: 1,000,000 pounds + $10 at 85,000 (850,000), nothing out.
    expect(october.previous?.inLbp.toFixed(0)).toBe("1850000");
    expect(october.previous?.outLbp.toFixed(0)).toBe("0");
    expect(october.previous?.netLbp.toFixed(0)).toBe("1850000");
    expect([october.previous?.from, october.previous?.to]).toEqual(["2026-09-01", "2026-09-30"]);
  });

  it("an expense back-dated to last month counts in last month's Out, not this month's", async () => {
    await seedTwoMonths();
    // Entered on 15 October for 20 September: its ledger row is in September, so its payment must be too.
    await spend({ id: "x-back", occurredAt: "2026-09-20T09:00:00.000Z", enteredAt: "2026-10-15T09:00:00.000Z", tenders: [lbp("300000", "89500", "3.35")] });

    const october = await summarizeLbpPeriod({ ...OCTOBER, compare: true, fallbackRate: TODAY_RATE });
    expect(october.outLbp.toFixed(0)).toBe("500000");
    expect(october.previous?.outLbp.toFixed(0)).toBe("300000");
    expect(october.previous?.netLbp.toFixed(0)).toBe("1550000");

    // The ledger agrees on the period: the same expense is September's Out there too.
    const ledger = await summarizeLedgerPeriod({ ...OCTOBER, compare: true });
    expect(ledger.outUsd.toFixed(2)).toBe("5.59");
    expect(ledger.previous?.outUsd.toFixed(2)).toBe("3.35");
  });

  it("a dollar payment with no stored rate is counted at the fallback rate and reported", async () => {
    await pay({ sourceType: "BOOKING", sourceId: "b-norate", at: "2026-10-03T10:00:00.000Z", tenders: [dollars("4.00", null)] });
    await pay({ sourceType: "BOOKING", sourceId: "b-rate", at: "2026-10-04T10:00:00.000Z", tenders: [dollars("10.00", "90000")] });
    const october = await summarizeLbpPeriod({ ...OCTOBER, fallbackRate: TODAY_RATE });
    expect(october.inLbp.toFixed(0)).toBe("1280000");
    expect(october.unrated).toBe(1);
  });

  it("a mixed payment counts its pounds and its dollars each at their own value", async () => {
    await pay({
      sourceType: "BOOKING",
      sourceId: "b-mixed",
      at: "2026-10-06T10:00:00.000Z",
      tenders: [dollars("20.00", "90000"), lbp("1500000", "90000", "16.67")],
    });
    const october = await summarizeLbpPeriod({ ...OCTOBER, fallbackRate: TODAY_RATE });
    expect(october.inLbp.toFixed(0)).toBe("3300000");
  });

  it("the USD view's numbers are unchanged: the ledger", async () => {
    await seedTwoMonths();
    const ledger = await summarizeLedgerPeriod({ ...OCTOBER, compare: true });
    expect(ledger.inUsd.toFixed(2)).toBe("52.35");
    expect(ledger.outUsd.toFixed(2)).toBe("5.59");
    expect(ledger.netUsd.toFixed(2)).toBe("46.76");
    expect(ledger.previous?.inUsd.toFixed(2)).toBe("21.36");
  });
});

describe("recent activity shows what was kept", () => {
  it("a row paid in pounds shows pounds, a mixed one both parts, an expense minus pounds, in either view", async () => {
    await seedTwoMonths();
    await pay({
      sourceType: "BOOKING",
      sourceId: "b-mixed",
      at: "2026-10-06T10:00:00.000Z",
      tenders: [dollars("20.00", "90000"), lbp("1500000", "90000", "16.67")],
    });
    const page = await loadActivityPage({ ...OCTOBER, filter: "all" }, "en");
    const textOf = (id: string) => page.rows.find((row) => row.id === id)?.amountText;
    const byEntry = Object.fromEntries(
      (await platformDb.ledgerEntry.findMany({ where: { tenantId: fixture.tenantId } })).map((entry) => [entry.sourceId, entry.id]),
    );
    expect(textOf(byEntry["b-oct-1"]!)).toBe("+2,000,000 LBP");
    expect(textOf(byEntry["b-oct-2"]!)).toBe("+$20");
    expect(textOf(byEntry["b-mixed"]!)).toBe("+$20 + 1,500,000 LBP");
    expect(textOf(byEntry["s-oct-1"]!)).toBe("+$10");
    expect(textOf(byEntry["x-oct"]!)).toBe("−500,000 LBP");

    // The details keep the dollar equivalent and the rate.
    const expense = page.rows.find((row) => row.id === byEntry["x-oct"]);
    if (expense?.open?.kind !== "expense") throw new Error("expected an expense sheet");
    expect(expense.open.detail.tenders).toEqual([{ currency: "LBP", amount: "500000", rate: "89500", usd: "5.59" }]);
  });
});

describe("two payments on the same game", () => {
  it("one minute apart, each row shows its own amount and no amount appears twice", async () => {
    await pay({ sourceType: "BOOKING", sourceId: "b-two", at: "2026-10-07T10:00:00.000Z", tenders: [lbp("700000", "89500", "7.82")] });
    await pay({ sourceType: "BOOKING", sourceId: "b-two", at: "2026-10-07T10:01:00.000Z", tenders: [lbp("1300000", "89500", "14.53")] });
    const page = await loadActivityPage({ ...OCTOBER, filter: "all" }, "en");
    const entries = await platformDb.ledgerEntry.findMany({ where: { tenantId: fixture.tenantId, sourceId: "b-two" }, orderBy: { occurredAt: "asc" } });
    const texts = entries.map((entry) => page.rows.find((row) => row.id === entry.id)?.amountText);
    expect(texts).toEqual(["+700,000 LBP", "+1,300,000 LBP"]);
    expect(new Set(texts).size).toBe(texts.length);
  });
});
