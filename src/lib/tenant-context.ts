import { AsyncLocalStorage } from "node:async_hooks";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { DomainError } from "@/lib/errors";
import { platformDb } from "@/lib/platform-db";
import { resolveTenantFromHeaders } from "@/lib/tenant-slug";
import {
  parseTenantSettings,
  type TimeDisplay,
} from "@/lib/tenant-settings";

export type CurrentTenant = {
  id: string;
  slug: string;
  name: string;
  /** Owner + public UI clocks. WhatsApp formatters ignore this and use h23. */
  timeDisplay: TimeDisplay;
  cancellationWindowHours: number;
  lateCancellationFeePercent: number;
  noShowFeePercent: number;
  perPlayerSplitEnabled: boolean;
  /** Local hour a business day starts (0..6). */
  dayStartHour: number;
  /** Suspended by the platform operator (decision 7). Loaded in the same query. */
  suspended: boolean;
};

/**
 * Request-scoped tenant (DR-001: app code establishes context after the header).
 * Prisma query extensions do not see React cache(); they do see this store
 * when the call sits inside `withCurrentTenant` / `db.$transaction`.
 *
 * ALS exists so Prisma ops can read tenant **id** without a nested lookup.
 * Extra fields on CurrentTenant (e.g. timeDisplay) ride along only because
 * loadTenant builds one object for React cache() — not a pattern for stuffing
 * UI-display data into ALS. Owner formatters read via getCurrentTenant() in
 * Server Components; they do not depend on ALS being set.
 */
const tenantAls = new AsyncLocalStorage<CurrentTenant>();

async function loadTenant(): Promise<CurrentTenant> {
  // From the validated Host, never from a client header (security audit S-9).
  const resolved = resolveTenantFromHeaders(await headers());
  if (resolved.kind !== "tenant") {
    notFound();
  }
  const slug = resolved.slug;

  const tenant = await platformDb.tenant.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, settings: true, suspendedAt: true },
  });

  if (!tenant) {
    notFound();
  }

  const settings = parseTenantSettings(tenant.settings);
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    timeDisplay: settings.timeDisplay,
    cancellationWindowHours: settings.cancellationWindowHours,
    lateCancellationFeePercent: settings.lateCancellationFeePercent,
    noShowFeePercent: settings.noShowFeePercent,
    perPlayerSplitEnabled: settings.perPlayerSplitEnabled,
    dayStartHour: settings.dayStartHour,
    suspended: tenant.suspendedAt !== null,
  };
}

/**
 * Resolve the current tenant for this request.
 *
 * 1. Resolve the slug from the validated Host (resolveTenantFromHeaders)
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

/**
 * The suspension choke point (decision 7): every tenant-scoped query (the
 * Prisma extension) and every raw SQL tenant stamp goes through here, so no
 * entry point can read or write a suspended tenant's data.
 */
export async function getCurrentTenantId(): Promise<string> {
  const tenant = tenantAls.getStore() ?? (await getCurrentTenant());
  if (tenant.suspended) {
    throw new DomainError("tenant.suspended");
  }
  return tenant.id;
}

/**
 * Tenant id for unexpected logs (DR-004 / SPEC-12). ALS first; else a lookup.
 * Do not call from inside an open `$transaction` when ALS is empty (deadlock).
 * Catch sites are outside `$transaction`. Missing tenant → omit, do not throw.
 */
export async function safeTenantId(): Promise<string | undefined> {
  const fromAls = tenantAls.getStore();
  if (fromAls) return fromAls.id;
  try {
    return (await getCurrentTenant()).id;
  } catch {
    return undefined;
  }
}

/** Load tenant (if needed), then run `fn` with ALS set — no nested Prisma lookup. */
export async function withCurrentTenant<T>(fn: () => Promise<T>): Promise<T> {
  const existing = tenantAls.getStore();
  if (existing) return fn();
  const tenant = await getCurrentTenant();
  return tenantAls.run(tenant, fn);
}
