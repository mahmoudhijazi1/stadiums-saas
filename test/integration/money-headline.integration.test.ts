import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import { summarizeLedgerPeriod } from "@/modules/ledger/application/summarize-ledger-period";
import type { TestFixture } from "./fixtures";
import { createStaffSession, seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * The Money headline reads the ledger by calendar day in Asia/Beirut and compares with the
 * previous period (one more aggregate). Reports.view is checked inside the use case.
 */
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

async function entry(tenantId: string, direction: "IN" | "OUT", amountUsd: string, occurredAt: string, n = 0) {
  await platformDb.ledgerEntry.create({
    data: {
      tenantId,
      direction,
      amountUsd,
      occurredAt: new Date(occurredAt),
      sourceType: direction === "IN" ? "BOOKING" : "EXPENSE",
      sourceId: `src-${direction}-${occurredAt}-${n}`,
    },
  });
}

describe("summarizeLedgerPeriod with a comparison", () => {
  it("counts month edges by Beirut midnight, not UTC", async () => {
    // 23:30 UTC on 30 Sep is 02:30 on 1 Oct in Beirut (UTC+3): October.
    await entry(fixture.tenantId, "IN", "10.00", "2026-09-30T23:30:00Z");
    // 20:59 UTC on 30 Sep is 23:59 on 30 Sep: September.
    await entry(fixture.tenantId, "IN", "7.00", "2026-09-30T20:59:00Z");
    // After 25 Oct Beirut is UTC+2: 21:59Z on 31 Oct is 23:59, still October.
    await entry(fixture.tenantId, "IN", "3.00", "2026-10-31T21:59:00Z");
    await entry(fixture.tenantId, "IN", "100.00", "2026-10-31T22:00:00Z"); // 00:00 on 1 Nov: November

    const october = await summarizeLedgerPeriod({ from: "2026-10-01", to: "2026-10-31", compare: true });
    expect(october.inUsd.toFixed(2)).toBe("13.00");
    expect(october.previous?.from).toBe("2026-09-01");
    expect(october.previous?.inUsd.toFixed(2)).toBe("7.00");
  });

  it("compares a month with the month before and a custom range with the same number of days", async () => {
    await entry(fixture.tenantId, "IN", "50.00", "2026-09-15T10:00:00Z");
    await entry(fixture.tenantId, "OUT", "20.00", "2026-09-16T10:00:00Z");
    await entry(fixture.tenantId, "IN", "80.00", "2026-10-15T10:00:00Z");
    await entry(fixture.tenantId, "OUT", "10.00", "2026-10-16T10:00:00Z");

    const month = await summarizeLedgerPeriod({ from: "2026-10-01", to: "2026-10-31", compare: true });
    expect(month.netUsd.toFixed(2)).toBe("70.00");
    expect(month.previous?.netUsd.toFixed(2)).toBe("30.00");
    expect(month.netUsd.minus(month.previous!.netUsd).toFixed(2)).toBe("40.00");

    const week = await summarizeLedgerPeriod({ from: "2026-10-12", to: "2026-10-18", compare: true });
    expect(week.previous).toMatchObject({ from: "2026-10-05", to: "2026-10-11" });
    expect(week.netUsd.toFixed(2)).toBe("70.00");
    expect(week.previous?.netUsd.toFixed(2)).toBe("0.00");
  });

  it("a period where out is more than in is a loss (negative net)", async () => {
    await entry(fixture.tenantId, "IN", "10.00", "2026-10-15T10:00:00Z");
    await entry(fixture.tenantId, "OUT", "40.00", "2026-10-16T10:00:00Z");
    const summary = await summarizeLedgerPeriod({ from: "2026-10-01", to: "2026-10-31" });
    expect(summary.netUsd.isNegative()).toBe(true);
    expect(summary.netUsd.toFixed(2)).toBe("-30.00");
    expect(summary.previous).toBeUndefined(); // the comparison is only computed when asked for
  });

  it("never counts another stadium's money", async () => {
    const other = await seedMinimalFixture({ tenantSlug: "sami", tenantName: "Sami", ownerIdentifier: "owner@sami" });
    await entry(other.tenantId, "IN", "999.00", "2026-10-15T10:00:00Z");
    await entry(fixture.tenantId, "IN", "5.00", "2026-10-15T10:00:00Z");
    actAs(fixture.sessionId);
    const summary = await summarizeLedgerPeriod({ from: "2026-10-01", to: "2026-10-31", compare: true });
    expect(summary.inUsd.toFixed(2)).toBe("5.00");
  });

  it("needs reports.view", async () => {
    actAs(await createStaffSession(fixture.tenantId, { "expenses.record": true }));
    await expect(summarizeLedgerPeriod({ from: "2026-10-01", to: "2026-10-31" })).rejects.toMatchObject({
      key: "access.not_allowed",
    });
    actAs(await createStaffSession(fixture.tenantId, { "reports.view": true }));
    await expect(summarizeLedgerPeriod({ from: "2026-10-01", to: "2026-10-31" })).resolves.toMatchObject({
      from: "2026-10-01",
    });
  });
});
