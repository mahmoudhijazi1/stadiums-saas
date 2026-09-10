import { AsyncLocalStorage } from "node:async_hooks";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { platformDb } from "@/lib/platform-db";

type CurrentTenant = {
  id: string;
  slug: string;
  name: string;
};

/**
 * Request-scoped tenant (DR-001: app code establishes context after the header).
 * Prisma query extensions do not see React cache(); they do see this store
 * when the call sits inside `withCurrentTenant` / `db.$transaction`.
 */
const tenantAls = new AsyncLocalStorage<CurrentTenant>();

async function loadTenant(): Promise<CurrentTenant> {
  const slug = (await headers()).get("x-tenant-slug");
  if (!slug) {
    notFound();
  }

  const tenant = await platformDb.tenant.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true },
  });

  if (!tenant) {
    notFound();
  }

  return tenant;
}

/**
 * Resolve the current tenant for this request.
 *
 * 1. Read x-tenant-slug (set by proxy in Step 2)
 * 2. Load that row from Tenant with platformDb
 * 3. If missing header or unknown slug → 404
 *
 * React cache() = one lookup per request on the React side.
 * ALS = same id inside Prisma $allOperations (cache() does not apply there).
 */
export const getCurrentTenant = cache(async () => {
  const fromAls = tenantAls.getStore();
  if (fromAls) return fromAls;
  return loadTenant();
});

export async function getCurrentTenantId(): Promise<string> {
  const fromAls = tenantAls.getStore();
  if (fromAls) return fromAls.id;
  const tenant = await getCurrentTenant();
  return tenant.id;
}

/** Load tenant (if needed), then run `fn` with ALS set — no nested Prisma lookup. */
export async function withCurrentTenant<T>(fn: () => Promise<T>): Promise<T> {
  const existing = tenantAls.getStore();
  if (existing) return fn();
  const tenant = await getCurrentTenant();
  return tenantAls.run(tenant, fn);
}
