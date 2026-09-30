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
  return Number(rows[0]?.count ?? 0);
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
