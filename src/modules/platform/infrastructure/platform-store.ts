import { Prisma } from "@/app/generated/prisma/client";
import { platformDb } from "@/lib/platform-db";

/**
 * Platform tables and cross-tenant reads. The only module besides tenant
 * lookup, sessions and users that uses platformDb (see the import guard test).
 * The CLI runs in its own process. The few request-time callers (stadium info, brand identity)
 * run outside any tenant `$transaction`, with the tenant id taken from the request's Host.
 */
export type PlatformTx = Prisma.TransactionClient;

export function platformTransaction<T>(fn: (tx: PlatformTx) => Promise<T>): Promise<T> {
  return platformDb.$transaction(fn);
}

export async function findTenantBySlug(slug: string) {
  return platformDb.tenant.findUnique({
    where: { slug },
    select: { id: true, slug: true, suspendedAt: true },
  });
}

/** The tenant's name and raw settings by id (the id comes from the request context, never from input). */
export async function findTenantNameAndSettings(tx: PlatformTx, tenantId: string) {
  return tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true, settings: true } });
}

/**
 * Write the display name and the settings of ONE tenant by id. The slug is not a column of this
 * write, so it cannot change.
 */
export async function updateTenantNameAndSettings(
  tx: PlatformTx,
  tenantId: string,
  data: { name: string; settings: Prisma.InputJsonObject },
): Promise<void> {
  await tx.tenant.update({ where: { id: tenantId }, data: { name: data.name, settings: data.settings } });
}

/** The inputs of a stadium's generated logo by host slug: name, settings and suspension only. */
export async function findTenantBrandSource(slug: string) {
  return platformDb.tenant.findUnique({
    where: { slug },
    select: { name: true, settings: true, suspendedAt: true },
  });
}

export async function writeAudit(
  tx: PlatformTx,
  entry: { action: string; tenantId: string | null; actor: string; detail: Prisma.InputJsonObject },
): Promise<void> {
  await tx.platformAuditLog.create({ data: entry });
}

/** P2002 on the given column: a unique constraint the caller maps to a domain key. */
export function isUniqueViolation(error: unknown, field: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = (error.meta as { target?: unknown; driverAdapterError?: unknown } | undefined) ?? {};
  return JSON.stringify(target).includes(field);
}

export type TenantListRow = {
  slug: string;
  name: string;
  suspendedAt: Date | null;
  createdAt: Date;
  plan: string | null;
  paidUntil: Date | null;
  pitchCount: number;
  bookingsLast30Days: number;
};

export async function listTenantRows(since: Date): Promise<TenantListRow[]> {
  const tenants = await platformDb.tenant.findMany({
    orderBy: { slug: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      suspendedAt: true,
      createdAt: true,
      _count: { select: { pitches: true } },
      subscriptions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { plan: true, paidUntil: true },
      },
    },
  });
  const recent = await platformDb.booking.groupBy({
    by: ["tenantId"],
    where: { requestedAt: { gte: since } },
    _count: { _all: true },
  });
  const byTenant = new Map(recent.map((row) => [row.tenantId, row._count._all]));
  return tenants.map((tenant) => ({
    slug: tenant.slug,
    name: tenant.name,
    suspendedAt: tenant.suspendedAt,
    createdAt: tenant.createdAt,
    plan: tenant.subscriptions[0]?.plan ?? null,
    paidUntil: tenant.subscriptions[0]?.paidUntil ?? null,
    pitchCount: tenant._count.pitches,
    bookingsLast30Days: byTenant.get(tenant.id) ?? 0,
  }));
}
