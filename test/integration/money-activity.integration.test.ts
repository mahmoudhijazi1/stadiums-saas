import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { loadActivityPage } from "@/app/owner/(app)/money/activity-load";
import { platformDb } from "@/lib/platform-db";
import { collectBookingPayment } from "@/modules/booking/application/collect-booking-payment";
import { createOwnerBooking } from "@/modules/booking/application/create-owner-booking";
import { recordExpense } from "@/modules/expense/application/record-expense";
import { listLedgerActivity } from "@/modules/ledger/application/list-ledger-activity";
import {
  addCalendarDays,
  civilDateInTimeZone,
  generateSlotsForDay,
} from "@/modules/venue/domain/availability";
import { parseScheduleConfig } from "@/modules/venue/domain/schedule-config";
import type { TestFixture } from "./fixtures";
import { createStaffSession, seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Money > Activity: the ledger as a list. Keyset pages of 20 on (occurredAt, id), filters,
 * the names behind each source type (one batched read per type), and who may look.
 */
const RANGE = { from: "2026-10-01", to: "2026-10-31" };

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

async function seedEntries(tenantId: string, count: number) {
  // Several entries share a timestamp, which is what makes paging by time alone unsafe.
  for (let i = 0; i < count; i += 1) {
    await platformDb.ledgerEntry.create({
      data: {
        tenantId,
        direction: i % 3 === 0 ? "OUT" : "IN",
        amountUsd: `${i + 1}.00`,
        occurredAt: new Date(Date.UTC(2026, 9, 10, 8, Math.floor(i / 3), 0)),
        sourceType: i % 3 === 0 ? "EXPENSE" : "BOOKING",
        sourceId: `s${i}`,
      },
    });
  }
}

describe("listLedgerActivity", () => {
  it("pages 20 at a time without repeating or skipping a row at the boundary", async () => {
    await seedEntries(fixture.tenantId, 45);
    const seen: string[] = [];
    let cursor: string | undefined;
    const sizes: number[] = [];
    for (let guard = 0; guard < 10; guard += 1) {
      const page = await listLedgerActivity({ ...RANGE, cursor });
      sizes.push(page.entries.length);
      seen.push(...page.entries.map((entry) => entry.id));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    expect(sizes).toEqual([20, 20, 5]);
    expect(new Set(seen).size).toBe(45);

    const all = await platformDb.ledgerEntry.findMany({
      where: { tenantId: fixture.tenantId },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    });
    expect(seen).toEqual(all.map((entry) => entry.id));
  });

  it("an exact multiple of the page size has no empty last page", async () => {
    await seedEntries(fixture.tenantId, 40);
    const first = await listLedgerActivity(RANGE);
    const second = await listLedgerActivity({ ...RANGE, cursor: first.nextCursor ?? undefined });
    expect(first.entries).toHaveLength(20);
    expect(second.entries).toHaveLength(20);
    expect(second.nextCursor).toBeNull();
  });

  it("filters In and Out, and keeps to the period", async () => {
    await seedEntries(fixture.tenantId, 12);
    await platformDb.ledgerEntry.create({
      data: {
        tenantId: fixture.tenantId,
        direction: "IN",
        amountUsd: "99.00",
        occurredAt: new Date("2026-09-30T20:59:00Z"), // 23:59 on 30 Sep in Beirut
        sourceType: "BOOKING",
        sourceId: "september",
      },
    });
    const all = await listLedgerActivity(RANGE);
    const incoming = await listLedgerActivity({ ...RANGE, filter: "in" });
    const outgoing = await listLedgerActivity({ ...RANGE, filter: "out" });
    expect(all.entries).toHaveLength(12);
    expect(incoming.entries.every((entry) => entry.direction === "IN")).toBe(true);
    expect(outgoing.entries.every((entry) => entry.direction === "OUT")).toBe(true);
    expect(incoming.entries.length + outgoing.entries.length).toBe(12);
    expect(all.entries.some((entry) => entry.sourceId === "september")).toBe(false);
  });

  it("never lists another stadium's movements", async () => {
    const other = await seedMinimalFixture({ tenantSlug: "sami", tenantName: "Sami", ownerIdentifier: "owner@sami" });
    await seedEntries(other.tenantId, 5);
    await seedEntries(fixture.tenantId, 3);
    actAs(fixture.sessionId);
    expect((await listLedgerActivity(RANGE)).entries).toHaveLength(3);
  });

  it("needs reports.view, here and in the name reads", async () => {
    await seedEntries(fixture.tenantId, 2);
    actAs(await createStaffSession(fixture.tenantId, { "expenses.record": true }));
    await expect(listLedgerActivity(RANGE)).rejects.toMatchObject({ key: "access.not_allowed" });
    await expect(loadActivityPage({ ...RANGE, filter: "all" }, "en")).rejects.toMatchObject({
      key: "access.not_allowed",
    });
    actAs(await createStaffSession(fixture.tenantId, { "reports.view": true }));
    expect((await listLedgerActivity(RANGE)).entries).toHaveLength(2);
  });
});

describe("loadActivityPage: the names behind each source type", () => {
  it("labels a collected game with its player and a recorded expense with its note, and keeps a source it does not know", async () => {
    const pitch = await platformDb.pitch.findUniqueOrThrow({ where: { id: fixture.pitchId } });
    const day = addCalendarDays(civilDateInTimeZone(new Date(), "Asia/Beirut"), 3);
    const slot = generateSlotsForDay({
      config: parseScheduleConfig(pitch.scheduleConfig),
      localDate: day,
      timeZone: "Asia/Beirut",
      occupied: [],
    })[0]!;
    const { bookingId } = await createOwnerBooking({
      pitchId: fixture.pitchId,
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
      name: "Ali Hassan",
      phone: "03123456",
    });
    await collectBookingPayment({
      bookingId,
      tenders: [{ currency: "USD", amount: new Decimal("10.00") }],
    });
    await recordExpense({
      category: "WATER",
      description: "Water tank",
      occurredOn: "2026-10-10",
      tenders: [{ currency: "USD", amount: new Decimal("12.50") }],
    });
    await platformDb.ledgerEntry.create({
      data: {
        tenantId: fixture.tenantId,
        direction: "IN",
        amountUsd: "5.00",
        occurredAt: new Date("2026-10-10T07:00:00Z"),
        sourceType: "BOOKING", // stands in for a source type added later: see the unit test for the fallback
        sourceId: "no-such-booking",
      },
    });

    const week = { from: "2026-01-01", to: "2027-12-31" };
    const page = await loadActivityPage({ ...week, filter: "all" }, "en");
    const labels = page.rows.map((row) => [row.icon, row.label, row.direction, row.amountUsd]);
    expect(labels).toContainEqual(["booking", "Ali Hassan", "IN", "10.00"]);
    expect(labels).toContainEqual(["expense", "Water tank", "OUT", "12.50"]);
    expect(labels).toContainEqual(["booking", "Player", "IN", "5.00"]);
    const expense = page.rows.find((row) => row.icon === "expense");
    expect(expense?.open?.kind).toBe("expense");
    const game = page.rows.find((row) => row.label === "Ali Hassan");
    expect(game?.open).toMatchObject({ kind: "link" });
  });
});
