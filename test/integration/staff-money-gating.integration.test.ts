import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { platformDb } from "@/lib/platform-db";
import { listOwed } from "@/modules/booking/application/list-owed";
import { listExpenseDetails } from "@/modules/expense/application/list-expense-details";
import { listRecentExpenses } from "@/modules/expense/application/list-recent-expenses";
import { recordExpense } from "@/modules/expense/application/record-expense";
import { sumExpenseCategory } from "@/modules/expense/application/sum-expense-category";
import { listLedgerActivity } from "@/modules/ledger/application/list-ledger-activity";
import { summarizeLedgerPeriod } from "@/modules/ledger/application/summarize-ledger-period";
import type { TestFixture } from "./fixtures";
import { createStaffSession, seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Hardening round 2, item 3 (N-6). WRITTEN, NOT RUN when authored: unverified until
 * `npm run test:integration` has been run.
 *
 * Money reads need reports.view inside the use case. Recording an expense needs only
 * expenses.record and must not open any read. (The person page's hidden "Total paid" is a
 * component; this file covers the use cases it sits next to.)
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

function actAs(token: string) {
  clearRequestStubs();
  setTenantSlug(fixture.tenantSlug);
  setSessionCookie(token);
}

const RANGE = { from: "2026-09-01", to: "2026-09-30" };

async function recordOne() {
  await recordExpense({
    category: "WATER",
    description: "Water tank",
    occurredOn: "2026-09-10",
    tenders: [{ currency: "USD", amount: new Decimal("12.50") }],
  });
  return (await platformDb.expense.findFirstOrThrow()).id;
}

describe("money reads need reports.view", () => {
  it("staff with no flags are refused by every money read", async () => {
    const expenseId = await recordOne();
    actAs(await createStaffSession(fixture.tenantId, {}));
    const denied = { key: "access.not_allowed" };
    await expect(summarizeLedgerPeriod(RANGE)).rejects.toMatchObject(denied);
    await expect(listLedgerActivity(RANGE)).rejects.toMatchObject(denied);
    await expect(listExpenseDetails([expenseId])).rejects.toMatchObject(denied);
    await expect(listRecentExpenses()).rejects.toMatchObject(denied);
    await expect(sumExpenseCategory({ ...RANGE, category: "WATER" })).rejects.toMatchObject(denied);
    await expect(listOwed()).rejects.toMatchObject(denied);
  });

  it("staff with only expenses.record can record an expense but read nothing", async () => {
    actAs(await createStaffSession(fixture.tenantId, { "expenses.record": true }));
    await recordExpense({
      category: "ELECTRICITY",
      description: "Bill",
      occurredOn: "2026-09-11",
      tenders: [{ currency: "USD", amount: new Decimal("20") }],
    });
    expect(await platformDb.expense.count()).toBe(1);

    const denied = { key: "access.not_allowed" };
    await expect(listRecentExpenses()).rejects.toMatchObject(denied);
    await expect(summarizeLedgerPeriod(RANGE)).rejects.toMatchObject(denied);
    await expect(listLedgerActivity(RANGE)).rejects.toMatchObject(denied);
  });

  it("staff with reports.view can read, and still cannot record without expenses.record", async () => {
    const expenseId = await recordOne();
    actAs(await createStaffSession(fixture.tenantId, { "reports.view": true }));
    expect((await listRecentExpenses()).map((row) => row.id)).toEqual([expenseId]);
    await expect(summarizeLedgerPeriod(RANGE)).resolves.toBeDefined();
    await expect(
      recordExpense({
        category: "WATER",
        description: "No",
        occurredOn: "2026-09-12",
        tenders: [{ currency: "USD", amount: new Decimal("1") }],
      }),
    ).rejects.toMatchObject({ key: "access.not_allowed" });
  });

  it("the owner reads everything", async () => {
    await recordOne();
    expect(await listRecentExpenses()).toHaveLength(1);
    await expect(listOwed()).resolves.toBeDefined();
  });
});
