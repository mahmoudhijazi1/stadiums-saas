import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import db from "@/lib/db";
import { platformDb } from "@/lib/platform-db";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Platform tables (decision 8): Subscription and PlatformAuditLog are
 * append-only (triggers block UPDATE and DELETE; TRUNCATE still works for
 * tests) and never reachable through the tenant-scoped client.
 */
let fixture: TestFixture;

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
  fixture = await seedMinimalFixture();
  clearRequestStubs();
  setTenantSlug(fixture.tenantSlug);
});

async function seedRows() {
  await platformDb.subscription.create({
    data: { tenantId: fixture.tenantId, plan: "basic", startsAt: new Date(), recordedBy: "test" },
  });
  await platformDb.platformAuditLog.create({
    data: { action: "tenant.create", tenantId: fixture.tenantId, actor: "test", detail: { slug: "x" } },
  });
}

describe("append-only platform tables", () => {
  it("blocks UPDATE and DELETE on PlatformAuditLog", async () => {
    await seedRows();
    await expect(platformDb.$executeRaw`UPDATE "PlatformAuditLog" SET actor = 'x'`).rejects.toThrow(/append-only/);
    await expect(platformDb.$executeRaw`DELETE FROM "PlatformAuditLog"`).rejects.toThrow(/append-only/);
    expect(await platformDb.platformAuditLog.count()).toBe(1);
  });

  it("blocks UPDATE and DELETE on Subscription", async () => {
    await seedRows();
    await expect(platformDb.$executeRaw`UPDATE "Subscription" SET plan = 'x'`).rejects.toThrow(/append-only/);
    await expect(platformDb.$executeRaw`DELETE FROM "Subscription"`).rejects.toThrow(/append-only/);
    expect(await platformDb.subscription.count()).toBe(1);
  });

  it("TRUNCATE still works (the test helper)", async () => {
    await seedRows();
    await truncateAll();
    expect(await platformDb.platformAuditLog.count()).toBe(0);
    expect(await platformDb.subscription.count()).toBe(0);
  });

  it("the tenant-scoped client refuses both models", async () => {
    await seedRows();
    const scoped = db as unknown as Record<string, { findMany: () => Promise<unknown> }>;
    await expect(scoped.subscription!.findMany()).rejects.toThrow(/platform-only/);
    await expect(scoped.platformAuditLog!.findMany()).rejects.toThrow(/platform-only/);
  });

  it("Tenant has nullable suspension columns, empty by default", async () => {
    const tenant = await platformDb.tenant.findUniqueOrThrow({ where: { id: fixture.tenantId } });
    expect(tenant.suspendedAt).toBeNull();
    expect(tenant.suspendedReason).toBeNull();
  });
});
