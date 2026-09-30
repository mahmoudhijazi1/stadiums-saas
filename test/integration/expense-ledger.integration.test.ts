import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import db from "@/lib/db";
import { platformDb } from "@/lib/platform-db";
import { recordExpense } from "@/modules/expense/application/record-expense";
import { summarizeLedgerPeriod } from "@/modules/ledger/application/summarize-ledger-period";
import { periodBoundsFromCivilRange } from "@/modules/ledger/domain/period";
import { sumAmountUsdByDirection } from "@/modules/ledger/infrastructure/entries";
import { recordPayment } from "@/modules/payment/application/record-payment";
import { setExchangeRate } from "@/modules/payment/application/set-exchange-rate";
import type { TestFixture } from "./fixtures";
import { createStaffSession, seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Audit §6: the money-out path (recordExpense) and the Money tab totals
 * (summarizeLedgerPeriod / sumAmountUsdByDirection) on the real database.
 */
const TIME_ZONE = "Asia/Beirut";

let fixture: TestFixture;

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
  fixture = await seedMinimalFixture();
  asOwner();
});

function asOwner() {
  signIn(fixture.tenantSlug, fixture.sessionId);
}

/** Switch identity. Clears the per-request cache so the new session is read. */
function signIn(tenantSlug: string, sessionId: string) {
  clearRequestStubs();
  setTenantSlug(tenantSlug);
  setSessionCookie(sessionId);
}

describe("recordExpense", () => {
  it("records a USD expense: expense, payment, tender and one ledger OUT", async () => {
    await recordExpense({
      category: "WATER",
      description: "Water tank",
      occurredOn: "2026-09-10",
      tenders: [{ currency: "USD", amount: new Decimal("12.50") }],
    });
    const expense = await platformDb.expense.findFirstOrThrow();
    expect(expense.occurredAt.toISOString()).toBe("2026-09-10T09:00:00.000Z"); // 12:00 Beirut
    const state = await moneyOfExpense(expense.id);
    expect(state.tenders).toEqual([["USD", "12.50", null, "12.50"]]);
    expect(state.ledger).toEqual([["OUT", "12.50", expense.occurredAt.toISOString()]]);
    expect(state.paymentDue).toBe("12.50");
  });

  it("freezes the rate on each LBP tender and keeps it after the rate changes", async () => {
    await setExchangeRate(new Decimal(90000));
    await recordExpense({
      category: "ELECTRICITY",
      description: "Generator",
      occurredOn: "2026-09-11",
      tenders: [{ currency: "LBP", amount: new Decimal(1_350_000) }],
    });
    await setExchangeRate(new Decimal(100000));
    await recordExpense({
      category: "MAINTENANCE",
      description: "Net and paint",
      occurredOn: "2026-09-12",
      tenders: [
        { currency: "USD", amount: new Decimal("20.00") },
        { currency: "LBP", amount: new Decimal(500_000) },
      ],
    });

    const [generator, paint] = await platformDb.expense.findMany({ orderBy: { occurredAt: "asc" } });
    const first = await moneyOfExpense(generator!.id);
    expect(first.tenders).toEqual([["LBP", "1350000.00", "90000", "15.00"]]);
    expect(first.ledger.map((row) => row.slice(0, 2))).toEqual([["OUT", "15.00"]]);

    const mixed = await moneyOfExpense(paint!.id);
    expect(mixed.tenders).toEqual([
      ["USD", "20.00", "100000", "20.00"],
      ["LBP", "500000.00", "100000", "5.00"],
    ]);
    // One ledger OUT equal to the sum of the tenders' USD equivalents.
    expect(mixed.ledger.map((row) => row.slice(0, 2))).toEqual([["OUT", "25.00"]]);
    expect(mixed.paymentDue).toBe("25.00");
  });

  it("refuses staff without expenses.record and writes nothing; allows it with the flag", async () => {
    const input = {
      category: "OTHER" as const,
      description: "Balls",
      occurredOn: "2026-09-10",
      tenders: [{ currency: "USD" as const, amount: new Decimal("8.00") }],
    };
    signIn(fixture.tenantSlug, await createStaffSession(fixture.tenantId, { "payments.collect": true }));
    await expect(recordExpense(input)).rejects.toMatchObject({ key: "access.not_allowed" });
    expect(await counts()).toEqual({ expenses: 0, payments: 0, tenders: 0, ledger: 0 });

    signIn(fixture.tenantSlug, await createStaffSession(fixture.tenantId, { "expenses.record": true }));
    await recordExpense(input);
    expect(await counts()).toEqual({ expenses: 1, payments: 1, tenders: 1, ledger: 1 });
  });

  it("rolls everything back when a tender fails (LBP with no rate)", async () => {
    await expect(
      recordExpense({
        category: "SALARY",
        description: "Guard",
        occurredOn: "2026-09-10",
        tenders: [
          { currency: "USD", amount: new Decimal("10.00") },
          { currency: "LBP", amount: new Decimal(900_000) },
        ],
      }),
    ).rejects.toMatchObject({ key: "payment.rate_required" });
    // The expense row is inserted before the tenders are frozen; it must not survive.
    expect(await counts()).toEqual({ expenses: 0, payments: 0, tenders: 0, ledger: 0 });
  });
});

describe("ledger period totals", () => {
  it("sums IN, OUT and net for a period and ignores other stadiums", async () => {
    await ledgerRow("IN", "30.00", "2026-09-10T15:00:00.000Z");
    await ledgerRow("IN", "12.50", "2026-09-12T15:00:00.000Z");
    await ledgerRow("OUT", "8.00", "2026-09-11T09:00:00.000Z");
    await ledgerRow("IN", "99.00", "2026-09-20T15:00:00.000Z"); // outside

    const other = await seedMinimalFixture({
      tenantSlug: "other-stadium",
      tenantName: "Other",
      pitchName: "PO",
      ownerIdentifier: "owner@other-stadium",
    });
    signIn(other.tenantSlug, other.sessionId);
    await ledgerRow("IN", "500.00", "2026-09-11T15:00:00.000Z");
    asOwner();

    const summary = await summarizeLedgerPeriod({ from: "2026-09-10", to: "2026-09-12" });
    expect(summary.inUsd.toFixed(2)).toBe("42.50");
    expect(summary.outUsd.toFixed(2)).toBe("8.00");
    expect(summary.netUsd.toFixed(2)).toBe("34.50");
  });

  it("puts rows on the right side of each day boundary on the fall-back day (25 hours)", async () => {
    // Sat 24 Oct 2026: 00:00 EEST (21:00Z on the 23rd) to Sun 00:00 EET (22:00Z).
    const bounds = periodBoundsFromCivilRange("2026-10-24", "2026-10-24", TIME_ZONE);
    expect(bounds.startInclusive.toISOString()).toBe("2026-10-23T21:00:00.000Z");
    expect(bounds.endExclusive.toISOString()).toBe("2026-10-24T22:00:00.000Z");

    await ledgerRow("IN", "1.00", "2026-10-23T20:59:59.000Z"); // Fri 23:59:59 → Friday
    await ledgerRow("IN", "2.00", "2026-10-23T21:00:00.000Z"); // Sat 00:00 → Saturday
    await ledgerRow("IN", "4.00", "2026-10-24T21:30:00.000Z"); // repeated 23:30 → Saturday
    await expenseOn("2026-10-24", "8.00"); // 12:00 Saturday
    await ledgerRow("IN", "16.00", "2026-10-24T22:00:00.000Z"); // Sun 00:00 → Sunday

    const saturday = await sumAmountUsdByDirection(db, bounds.startInclusive, bounds.endExclusive);
    expect(saturday.IN.toFixed(2)).toBe("6.00");
    expect(saturday.OUT.toFixed(2)).toBe("8.00");
    const sunday = await summarizeLedgerPeriod({ from: "2026-10-25", to: "2026-10-25" });
    expect(sunday.inUsd.toFixed(2)).toBe("16.00");
  });

  it("puts rows on the right side of each day boundary on the spring-forward day (23 hours)", async () => {
    // Sun 29 Mar 2026: 00:00 EET does not exist, the clock jumps to 01:00 EEST (22:00Z on
    // the 28th). Saturday must end, and Sunday begin, at that jump.
    const saturday = periodBoundsFromCivilRange("2026-03-28", "2026-03-28", TIME_ZONE);
    const sunday = periodBoundsFromCivilRange("2026-03-29", "2026-03-29", TIME_ZONE);
    expect(saturday.endExclusive.toISOString()).toBe(sunday.startInclusive.toISOString());

    await ledgerRow("IN", "1.00", "2026-03-28T21:30:00.000Z"); // Sat 23:30 EET → Saturday
    await ledgerRow("IN", "2.00", "2026-03-28T22:00:00.000Z"); // Sun 01:00 EEST → Sunday

    const sat = await summarizeLedgerPeriod({ from: "2026-03-28", to: "2026-03-28" });
    const sun = await summarizeLedgerPeriod({ from: "2026-03-29", to: "2026-03-29" });
    expect(sat.inUsd.toFixed(2)).toBe("1.00");
    expect(sun.inUsd.toFixed(2)).toBe("2.00");
  });
});

/** One booking-style payment with its ledger IN at a chosen instant (real recordPayment). */
async function ledgerRow(direction: "IN" | "OUT", usd: string, at: string): Promise<void> {
  await db.$transaction(async (tx) => {
    await recordPayment(tx, {
      direction,
      sourceType: direction === "IN" ? "BOOKING" : "EXPENSE",
      sourceId: crypto.randomUUID(),
      amountDueUsd: new Decimal(usd),
      tenders: [
        {
          currency: "USD",
          amount: new Decimal(usd),
          rateAtTime: null,
          usdEquivalent: new Decimal(usd),
        },
      ],
      occurredAt: new Date(at),
    });
  });
}

async function expenseOn(occurredOn: string, usd: string): Promise<void> {
  await recordExpense({
    category: "OTHER",
    description: "Boundary",
    occurredOn,
    tenders: [{ currency: "USD", amount: new Decimal(usd) }],
  });
}

async function counts() {
  return {
    expenses: await platformDb.expense.count(),
    payments: await platformDb.payment.count(),
    tenders: await platformDb.paymentTender.count(),
    ledger: await platformDb.ledgerEntry.count(),
  };
}

async function moneyOfExpense(expenseId: string) {
  const payment = await platformDb.payment.findFirstOrThrow({
    where: { sourceType: "EXPENSE", sourceId: expenseId },
    include: { tenders: { orderBy: { currency: "asc" } } },
  });
  const ledger = await platformDb.ledgerEntry.findMany({
    where: { sourceType: "EXPENSE", sourceId: expenseId },
  });
  const fix = (value: { toString(): string }) => new Decimal(value.toString()).toFixed(2);
  return {
    paymentDue: fix(payment.amountDueUsd),
    tenders: payment.tenders.map((tender) => [
      tender.currency,
      fix(tender.amount),
      tender.rateAtTime ? new Decimal(tender.rateAtTime.toString()).toFixed(0) : null,
      fix(tender.usdEquivalent),
    ]),
    ledger: ledger.map((row) => [row.direction, fix(row.amountUsd), row.occurredAt.toISOString()]),
  };
}
