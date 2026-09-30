import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import { parseTenantSettings } from "@/lib/tenant-settings";
import { verifyPassword } from "@/modules/access/infrastructure/password";
import { createTenant } from "@/modules/platform/application/create-tenant";
import { listTenants } from "@/modules/platform/application/list-tenants";
import { resumeTenant } from "@/modules/platform/application/resume-tenant";
import { setSubscription } from "@/modules/platform/application/set-subscription";
import { suspendTenant } from "@/modules/platform/application/suspend-tenant";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Decision 12: the platform use cases take an explicit actor and work with no
 * terminal at all. Each mutating one writes exactly one audit row in its
 * transaction; no password ever reaches the audit detail.
 */
const ACTOR = "test:jest@ci";
const PASSWORD = "a long owner password";

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
});

async function create(slug = "al-nour", extra: Partial<Parameters<typeof createTenant>[0]> = {}) {
  return createTenant({ slug, name: "Al Nour", ownerPassword: PASSWORD, actor: ACTOR, ...extra });
}

async function auditRows() {
  return platformDb.platformAuditLog.findMany({ orderBy: { createdAt: "asc" } });
}

describe("createTenant", () => {
  it("creates tenant (default settings), owner user + OWNER membership, first subscription and one audit row", async () => {
    const result = await create("al-nour", { plan: "basic", paidUntil: new Date("2026-12-31T00:00:00Z") });
    expect(result).toEqual({ tenantId: expect.any(String), slug: "al-nour", ownerIdentifier: "owner@al-nour" });

    const tenant = await platformDb.tenant.findUniqueOrThrow({ where: { slug: "al-nour" } });
    expect(tenant.name).toBe("Al Nour");
    expect(parseTenantSettings(tenant.settings)).toEqual(parseTenantSettings({}));
    expect(tenant.suspendedAt).toBeNull();

    const user = await platformDb.user.findUniqueOrThrow({ where: { identifier: "owner@al-nour" } });
    expect(await verifyPassword(PASSWORD, user.passwordHash)).toBe(true);
    const memberships = await platformDb.membership.findMany({ where: { userId: user.id } });
    expect(memberships.map((m) => [m.tenantId, m.role])).toEqual([[tenant.id, "OWNER"]]);

    const subscriptions = await platformDb.subscription.findMany({ where: { tenantId: tenant.id } });
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]).toMatchObject({ plan: "basic", recordedBy: ACTOR });
    expect(subscriptions[0]!.paidUntil?.toISOString()).toBe("2026-12-31T00:00:00.000Z");

    // Nothing else: no pitches, no exchange rate, no sessions.
    expect(await platformDb.pitch.count()).toBe(0);
    expect(await platformDb.exchangeRate.count()).toBe(0);
    expect(await platformDb.session.count()).toBe(0);

    const audit = await auditRows();
    expect(audit.map((row) => [row.action, row.tenantId, row.actor])).toEqual([["tenant.create", tenant.id, ACTOR]]);
    expect(JSON.stringify(audit)).not.toContain(PASSWORD);
    expect(JSON.stringify(audit)).not.toContain(user.passwordHash);
  });

  it("uses an overriding owner identifier on the same slug", async () => {
    const result = await create("al-nour", { ownerIdentifier: "Ahmad@al-nour" });
    expect(result.ownerIdentifier).toBe("ahmad@al-nour");
  });

  it("a duplicate identifier rolls everything back: no orphan tenant, subscription or audit row", async () => {
    await create("al-nour");
    const before = {
      tenants: await platformDb.tenant.count(),
      subscriptions: await platformDb.subscription.count(),
      audit: await platformDb.platformAuditLog.count(),
    };
    await expect(create("al-nour-2", { ownerIdentifier: "owner@al-nour" })).rejects.toMatchObject({
      key: "platform.identifier_invalid",
    });
    // Same slug suffix but the user already exists: taken.
    await platformDb.user.create({ data: { identifier: "owner@sami-club", passwordHash: "x" } });
    await expect(create("sami-club")).rejects.toMatchObject({ key: "platform.identifier_taken" });
    expect(await platformDb.tenant.findUnique({ where: { slug: "sami-club" } })).toBeNull();
    expect({
      tenants: await platformDb.tenant.count(),
      subscriptions: await platformDb.subscription.count(),
      audit: await platformDb.platformAuditLog.count(),
    }).toEqual(before);
  });

  it("refuses a taken slug, an invalid slug, a short password and a blank name", async () => {
    await create("al-nour");
    await expect(create("al-nour")).rejects.toMatchObject({ key: "platform.slug_taken" });
    await expect(create("www")).rejects.toMatchObject({ key: "platform.slug_invalid" });
    await expect(create("xn--abc")).rejects.toMatchObject({ key: "platform.slug_invalid" });
    await expect(create("ok-slug", { ownerPassword: "short" })).rejects.toMatchObject({
      key: "platform.password_too_short",
    });
    await expect(create("ok-slug", { name: "   " })).rejects.toMatchObject({ key: "platform.name_required" });
    await expect(create("ok-slug", { actor: " " })).rejects.toMatchObject({ key: "platform.actor_required" });
    expect(await platformDb.platformAuditLog.count()).toBe(1);
  });
});

describe("suspendTenant / resumeTenant", () => {
  it("suspends with a reason and resumes, one audit row each, actor as given", async () => {
    await create("al-nour");
    await suspendTenant({ slug: "al-nour", reason: "Unpaid since September", actor: "admin:42" });
    let tenant = await platformDb.tenant.findUniqueOrThrow({ where: { slug: "al-nour" } });
    expect(tenant.suspendedAt).not.toBeNull();
    expect(tenant.suspendedReason).toBe("Unpaid since September");

    await expect(suspendTenant({ slug: "al-nour", reason: "again", actor: ACTOR })).rejects.toMatchObject({
      key: "platform.already_suspended",
    });

    await resumeTenant({ slug: "al-nour", actor: ACTOR });
    tenant = await platformDb.tenant.findUniqueOrThrow({ where: { slug: "al-nour" } });
    expect(tenant.suspendedAt).toBeNull();
    expect(tenant.suspendedReason).toBeNull();
    await expect(resumeTenant({ slug: "al-nour", actor: ACTOR })).rejects.toMatchObject({
      key: "platform.not_suspended",
    });

    const audit = await auditRows();
    expect(audit.map((row) => [row.action, row.actor])).toEqual([
      ["tenant.create", ACTOR],
      ["tenant.suspend", "admin:42"],
      ["tenant.resume", ACTOR],
    ]);
    expect(audit[1]!.detail).toEqual({ reason: "Unpaid since September" });
  });

  it("an unknown slug is refused", async () => {
    await expect(suspendTenant({ slug: "nobody", reason: "x", actor: ACTOR })).rejects.toMatchObject({
      key: "platform.tenant_not_found",
    });
    await expect(resumeTenant({ slug: "nobody", actor: ACTOR })).rejects.toMatchObject({
      key: "platform.tenant_not_found",
    });
  });
});

describe("setSubscription", () => {
  it("appends a row and an audit row; earlier rows stay", async () => {
    await create("al-nour", { plan: "trial" });
    await setSubscription({
      slug: "al-nour",
      plan: "basic",
      paidUntil: new Date("2027-01-31T00:00:00Z"),
      amountUsd: "25.00",
      note: "cash, October",
      actor: ACTOR,
    });
    const rows = await platformDb.subscription.findMany({ orderBy: { createdAt: "asc" } });
    expect(rows.map((row) => row.plan)).toEqual(["trial", "basic"]);
    expect(rows[1]!.amountUsd?.toString()).toBe("25");
    expect(rows[1]!.note).toBe("cash, October");
    expect((await auditRows()).map((row) => row.action)).toEqual(["tenant.create", "subscription.set"]);
  });

  it("refuses a blank plan or a negative amount", async () => {
    await create("al-nour");
    const base = { slug: "al-nour", paidUntil: new Date("2027-01-31T00:00:00Z"), actor: ACTOR };
    await expect(setSubscription({ ...base, plan: " " })).rejects.toMatchObject({ key: "platform.plan_required" });
    await expect(setSubscription({ ...base, plan: "basic", amountUsd: "-1" })).rejects.toMatchObject({
      key: "platform.amount_invalid",
    });
  });
});

describe("listTenants", () => {
  it("returns status, latest plan, OVERDUE, counts, and nothing secret", async () => {
    await create("al-nour", { plan: "trial", paidUntil: new Date("2026-01-31T00:00:00Z") });
    await create("sami-club", { plan: "basic", paidUntil: new Date("2027-01-31T00:00:00Z") });
    await suspendTenant({ slug: "sami-club", reason: "test", actor: ACTOR });
    const tenant = await platformDb.tenant.findUniqueOrThrow({ where: { slug: "al-nour" } });
    await platformDb.pitch.create({
      data: { tenantId: tenant.id, name: "P1", scheduleConfig: {} },
    } as Parameters<typeof platformDb.pitch.create>[0]);

    const rows = await listTenants({ now: new Date("2026-10-01T12:00:00Z") });
    expect(rows.map((row) => [row.slug, row.status, row.plan, row.overdue, row.pitchCount, row.bookingsLast30Days])).toEqual([
      ["al-nour", "ACTIVE", "trial", true, 1, 0],
      ["sami-club", "SUSPENDED", "basic", false, 0, 0],
    ]);
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toMatch(/scrypt:|passwordHash|tokenHash|suspendedReason/);
  });
});

describe("audit log", () => {
  it("is append-only for rows written by the use cases", async () => {
    await create("al-nour");
    await expect(platformDb.platformAuditLog.updateMany({ data: { actor: "x" } })).rejects.toThrow(/append-only/);
    await expect(platformDb.platformAuditLog.deleteMany()).rejects.toThrow(/append-only/);
    expect(await platformDb.platformAuditLog.count()).toBe(1);
  });
});
