import { platformDb } from "@/lib/platform-db";

/**
 * One stadium for the web admin's detail page (DR-006), read only. Select lists name every column
 * read: never a password hash, a session token, a secret or the audit `detail` JSON.
 */
export type TenantDetailRow = {
  slug: string;
  name: string;
  suspendedAt: Date | null;
  suspendedReason: string | null;
  createdAt: Date;
  subscriptions: {
    plan: string;
    startsAt: Date;
    paidUntil: Date | null;
    amountUsd: string | null;
    note: string | null;
    recordedBy: string;
    createdAt: Date;
  }[];
  ownerIdentifiers: string[];
  pitchCount: number;
  personCount: number;
  bookingsLast30Days: number;
  audit: { action: string; actor: string; createdAt: Date }[];
};

export async function findTenantDetailRow(slug: string, since: Date): Promise<TenantDetailRow | null> {
  const tenant = await platformDb.tenant.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      suspendedAt: true,
      suspendedReason: true,
      createdAt: true,
      _count: { select: { pitches: true } },
      subscriptions: {
        orderBy: { createdAt: "desc" },
        select: { plan: true, startsAt: true, paidUntil: true, amountUsd: true, note: true, recordedBy: true, createdAt: true },
      },
      memberships: {
        where: { role: "OWNER" },
        orderBy: { createdAt: "asc" },
        select: { user: { select: { identifier: true } } },
      },
    },
  });
  if (!tenant) return null;

  const [personCount, bookingsLast30Days, audit] = await Promise.all([
    platformDb.person.count({ where: { tenantId: tenant.id } }),
    platformDb.booking.count({ where: { tenantId: tenant.id, requestedAt: { gte: since } } }),
    platformDb.platformAuditLog.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { action: true, actor: true, createdAt: true },
    }),
  ]);

  return {
    slug: tenant.slug,
    name: tenant.name,
    suspendedAt: tenant.suspendedAt,
    suspendedReason: tenant.suspendedReason,
    createdAt: tenant.createdAt,
    subscriptions: tenant.subscriptions.map((row) => ({ ...row, amountUsd: row.amountUsd?.toFixed(2) ?? null })),
    ownerIdentifiers: tenant.memberships.map((membership) => membership.user.identifier),
    pitchCount: tenant._count.pitches,
    personCount,
    bookingsLast30Days,
    audit,
  };
}
