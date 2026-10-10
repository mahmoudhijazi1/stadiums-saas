import { platformDb } from "@/lib/platform-db";

/**
 * Postgres rate-limit counters (security audit S-3). One row per key; a hit
 * is one atomic upsert, so concurrent requests never lose a count. The window
 * starts at the first hit and restarts at the first hit after it ends.
 * Keys are global (like Session): put the account, IP or tenant in the key.
 * Never call inside a tenant $transaction (one-pool rule).
 */
export async function hitRateLimit(key: string, windowMs: number, now = new Date()): Promise<number> {
  const windowOpenAfter = new Date(now.getTime() - windowMs);
  const rows = await platformDb.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "windowStart", "count")
    VALUES (${key}, ${now}, 1)
    ON CONFLICT ("key") DO UPDATE SET
      "windowStart" = CASE WHEN "RateLimit"."windowStart" <= ${windowOpenAfter}
        THEN ${now} ELSE "RateLimit"."windowStart" END,
      "count" = CASE WHEN "RateLimit"."windowStart" <= ${windowOpenAfter}
        THEN 1 ELSE "RateLimit"."count" + 1 END
    RETURNING "count"`;
  await dropExpiredRateLimits(RATE_LIMIT_RETENTION_MS, RATE_LIMIT_SWEEP_BATCH, now, key);
  return Number(rows[0]?.count ?? 0);
}

/**
 * A row older than this is past every window and block time in use (the longest is under a day),
 * so nothing reads it any more. Every write sweeps a few such rows, so the table cannot grow
 * without bound even when nobody logs in (the login prune is no longer the only cleanup).
 */
export const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1000;
/** Rows one write may delete: bounded so a hit never turns into a big delete. */
export const RATE_LIMIT_SWEEP_BATCH = 20;

/** Delete up to `limit` rows whose window started before `now - olderThanMs`, never `exceptKey`. */
export async function dropExpiredRateLimits(
  olderThanMs: number,
  limit: number,
  now = new Date(),
  exceptKey?: string,
): Promise<number> {
  const cutoff = new Date(now.getTime() - olderThanMs);
  return platformDb.$executeRaw`
    DELETE FROM "RateLimit" WHERE "key" IN (
      SELECT "key" FROM "RateLimit"
      WHERE "windowStart" < ${cutoff} AND "key" <> ${exceptKey ?? ""}
      ORDER BY "windowStart" ASC LIMIT ${limit})`;
}

/** Hits so far in the key's current window (0 when none or the window ended). */
export async function rateLimitCount(key: string, windowMs: number, now = new Date()): Promise<number> {
  const row = await platformDb.rateLimit.findUnique({ where: { key } });
  if (!row || row.windowStart.getTime() <= now.getTime() - windowMs) return 0;
  return row.count;
}

export async function resetRateLimit(key: string): Promise<void> {
  await platformDb.rateLimit.deleteMany({ where: { key } });
}

/** Drop rows whose window ended long ago. Cheap (indexed); called on login. */
export async function pruneRateLimits(olderThanMs: number, now = new Date()): Promise<void> {
  await platformDb.rateLimit.deleteMany({
    where: { windowStart: { lt: new Date(now.getTime() - olderThanMs) } },
  });
}
