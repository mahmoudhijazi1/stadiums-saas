import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import { createTenant } from "@/modules/platform/application/create-tenant";
import { getTenantDetail } from "@/modules/platform/application/get-tenant-detail";
import { listTenants } from "@/modules/platform/application/list-tenants";
import { setSubscription } from "@/modules/platform/application/set-subscription";
import { suspendTenant } from "@/modules/platform/application/suspend-tenant";
import { orderTenantsForAdmin } from "@/modules/platform/domain/tenant-order";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * DR-006 slice 5: the web admin's read side. The detail use case returns the fields of one
 * stadium and never the audit `detail` JSON, a hash or a token; the list order puts suspended, then
 * overdue, first. Written, not run when authored: unverified until `npm run test:integration` has run.
 */
const ACTOR = "test:jest@ci";
const PASSWORD = "a long owner password";
const NOW = new Date("2026-10-01T12:00:00Z");

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
});

const create = (slug: string, name: string, extra: Partial<Parameters<typeof createTenant>[0]> = {}) =>
  createTenant({ slug, name, ownerPassword: PASSWORD, actor: ACTOR, ...extra });

describe("getTenantDetail", () => {
  it("returns the stadium with two subscriptions, its owner, counts and the latest audit rows", async () => {
    await create("al-nour", "Al Nour", { plan: "trial", paidUntil: new Date("2026-01-31T00:00:00Z") });
    await setSubscription({ slug: "al-nour", plan: "basic", paidUntil: new Date("2027-03-31T00:00:00Z"), amountUsd: "25", note: "paid in cash", actor: ACTOR });
    const tenant = await platformDb.tenant.findUniqueOrThrow({ where: { slug: "al-nour" } });
    await platformDb.pitch.create({ data: { tenantId: tenant.id, name: "P1", scheduleConfig: {} } } as Parameters<typeof platformDb.pitch.create>[0]);
    await platformDb.person.create({ data: { tenantId: tenant.id, name: "Hassan", phone: null, searchName: "hassan" } });

    const detail = await getTenantDetail({ slug: "al-nour", now: NOW });

    expect(detail).toMatchObject({ slug: "al-nour", name: "Al Nour", status: "ACTIVE", suspendedAt: null, suspendedReason: null });
    expect(detail.createdAt).toBeInstanceOf(Date);
    expect(detail.subscriptions.map((row) => row.plan)).toEqual(["basic", "trial"]); // newest first
    expect(detail.subscriptions[0]).toMatchObject({ amountUsd: "25.00", note: "paid in cash", recordedBy: ACTOR });
    expect(detail.overdue).toBe(false); // the latest subscription is paid up
    expect(detail.ownerIdentifiers).toEqual(["owner@al-nour"]);
    expect(detail).toMatchObject({ pitchCount: 1, personCount: 1, bookingsLast30Days: 0 });
    expect(detail.audit.map((entry) => entry.action)).toEqual(["subscription.set", "tenant.create"]);
    expect(detail.audit.length).toBeLessThanOrEqual(10);
  });

  it("never carries the audit detail JSON, a password hash or a token", async () => {
    await create("al-nour", "Al Nour");
    await suspendTenant({ slug: "al-nour", reason: "not paid", actor: ACTOR });
    const detail = await getTenantDetail({ slug: "al-nour", now: NOW });

    expect(detail.status).toBe("SUSPENDED");
    expect(detail.suspendedReason).toBe("not paid"); // the tenant's own field, shown on purpose
    for (const entry of detail.audit) expect(Object.keys(entry).sort()).toEqual(["action", "actor", "createdAt"]);
    expect(detail.audit[0]!.action).toBe("tenant.suspend");
    const serialized = JSON.stringify(detail);
    expect(serialized).not.toMatch(/"detail"|scrypt:|passwordHash|tokenHash/);
  });

  it("keeps only the 10 latest audit rows of this stadium, not another one's", async () => {
    await create("al-nour", "Al Nour");
    await create("sami-club", "Sami Club");
    for (let index = 0; index < 12; index += 1) {
      await setSubscription({ slug: "al-nour", plan: `p${index}`, paidUntil: new Date("2027-01-01T00:00:00Z"), actor: ACTOR });
    }
    const detail = await getTenantDetail({ slug: "al-nour", now: NOW });
    expect(detail.audit).toHaveLength(10);
    const other = await getTenantDetail({ slug: "sami-club", now: NOW });
    expect(other.audit.map((entry) => entry.action)).toEqual(["tenant.create"]);
  });

  it("answers platform.tenant_not_found for an unknown slug", async () => {
    await expect(getTenantDetail({ slug: "nobody" })).rejects.toMatchObject({ key: "platform.tenant_not_found" });
  });
});

describe("the list order for the web admin", () => {
  it("puts suspended first, then overdue, then the rest by name", async () => {
    await create("zeta", "Zeta", { paidUntil: new Date("2027-01-31T00:00:00Z") });
    await create("alpha", "Alpha", { paidUntil: new Date("2026-01-31T00:00:00Z") }); // overdue
    await create("mid", "Mid", { paidUntil: new Date("2027-01-31T00:00:00Z") });
    await create("beta", "Beta", { paidUntil: new Date("2027-01-31T00:00:00Z") });
    await create("late-and-off", "Aardvark", { paidUntil: new Date("2026-01-31T00:00:00Z") });
    await suspendTenant({ slug: "mid", reason: "test", actor: ACTOR });
    await suspendTenant({ slug: "late-and-off", reason: "test", actor: ACTOR }); // suspended AND overdue

    const rows = await listTenants({ now: NOW });
    expect(orderTenantsForAdmin(rows).map((row) => row.slug)).toEqual(["late-and-off", "mid", "alpha", "beta", "zeta"]);
    // The CLI order (by slug) is unchanged.
    expect(rows.map((row) => row.slug)).toEqual(["alpha", "beta", "late-and-off", "mid", "zeta"]);
  });
});
