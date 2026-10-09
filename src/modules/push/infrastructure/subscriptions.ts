import db, { type TenantTx } from "@/lib/db";
import { getCurrentTenantId } from "@/lib/tenant-context";

/** Most devices one user may keep in one stadium. The oldest are dropped first. */
export const MAX_SUBSCRIPTIONS_PER_USER = 10;

export type StoredSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  locale: string;
};

/**
 * One browser belongs to one user, session and tenant at a time (endpoint is UNIQUE). A raw
 * ON CONFLICT upsert, because the conflicting row may belong to ANOTHER tenant (a phone shared
 * between stadiums) that the scoped client cannot see. tenantId is stamped from the tenant
 * context, not passed by the caller; the query extension does not stamp raw SQL (DR-001).
 * createdAt is renewed, so "oldest" means "least recently synced".
 */
export async function upsertSubscription(
  tx: TenantTx,
  row: { userId: string; sessionId: string; endpoint: string; p256dh: string; auth: string; locale: string },
): Promise<void> {
  const tenantId = await getCurrentTenantId();
  await tx.$executeRaw`
    INSERT INTO "PushSubscription"
      ("id", "tenantId", "userId", "sessionId", "endpoint", "p256dh", "auth", "locale", "createdAt")
    VALUES
      (gen_random_uuid()::text, ${tenantId}, ${row.userId}, ${row.sessionId}, ${row.endpoint},
       ${row.p256dh}, ${row.auth}, ${row.locale}, now())
    ON CONFLICT ("endpoint") DO UPDATE SET
      "tenantId" = EXCLUDED."tenantId",
      "userId" = EXCLUDED."userId",
      "sessionId" = EXCLUDED."sessionId",
      "p256dh" = EXCLUDED."p256dh",
      "auth" = EXCLUDED."auth",
      "locale" = EXCLUDED."locale",
      "createdAt" = now()`;
}

/** Keep the newest MAX per user in this tenant; delete the rest. */
export async function trimUserSubscriptions(tx: TenantTx, userId: string): Promise<void> {
  const tenantId = await getCurrentTenantId();
  await tx.$executeRaw`
    DELETE FROM "PushSubscription" WHERE "id" IN (
      SELECT "id" FROM "PushSubscription"
      WHERE "tenantId" = ${tenantId} AND "userId" = ${userId}
      ORDER BY "createdAt" DESC, "id" DESC
      OFFSET ${MAX_SUBSCRIPTIONS_PER_USER})`;
}

/** Only the caller's own row, only in this tenant (the extension adds tenantId). */
export async function deleteOwnByEndpoint(userId: string, endpoint: string): Promise<number> {
  const result = await db.pushSubscription.deleteMany({ where: { userId, endpoint } });
  return result.count;
}

export async function listOwnSubscriptions(userId: string): Promise<StoredSubscription[]> {
  return db.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true, locale: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteSubscriptionById(id: string): Promise<void> {
  await db.pushSubscription.deleteMany({ where: { id } });
}

export type AlertSubscription = StoredSubscription & { userId: string };

/** Every device of these users in this tenant (the extension adds tenantId). */
export async function listSubscriptionsForUsers(userIds: string[]): Promise<AlertSubscription[]> {
  if (userIds.length === 0) return [];
  return db.pushSubscription.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, userId: true, endpoint: true, p256dh: true, auth: true, locale: true },
    orderBy: { createdAt: "desc" },
  });
}
