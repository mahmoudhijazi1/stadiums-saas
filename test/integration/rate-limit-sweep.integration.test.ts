import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import {
  RATE_LIMIT_RETENTION_MS,
  RATE_LIMIT_SWEEP_BATCH,
  hitRateLimit,
} from "@/lib/rate-limit";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Hardening round 2, item 7. WRITTEN, NOT RUN when authored: unverified until
 * `npm run test:integration` has been run.
 */
const NOW = new Date("2026-10-14T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

async function seed(prefix: string, count: number, ageMs: number) {
  await platformDb.rateLimit.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      key: `${prefix}:${i}`,
      windowStart: new Date(NOW.getTime() - ageMs),
      count: 3,
    })),
  });
}

describe("rate-limit cleanup on write", () => {
  it("a hit deletes expired rows and keeps rows inside their window", async () => {
    await seed("old", 5, RATE_LIMIT_RETENTION_MS + HOUR);
    await seed("recent", 5, HOUR);

    const count = await hitRateLimit("fresh:key", 15 * 60 * 1000, NOW);
    expect(count).toBe(1);

    expect(await platformDb.rateLimit.count({ where: { key: { startsWith: "old:" } } })).toBe(0);
    expect(await platformDb.rateLimit.count({ where: { key: { startsWith: "recent:" } } })).toBe(5);
    expect(await platformDb.rateLimit.count({ where: { key: "fresh:key" } })).toBe(1);
  });

  it("deletes at most one batch per hit", async () => {
    await seed("old", RATE_LIMIT_SWEEP_BATCH + 5, RATE_LIMIT_RETENTION_MS + HOUR);
    await hitRateLimit("fresh:key", 15 * 60 * 1000, NOW);
    expect(await platformDb.rateLimit.count({ where: { key: { startsWith: "old:" } } })).toBe(5);
    // The next write finishes the job.
    await hitRateLimit("fresh:key", 15 * 60 * 1000, NOW);
    expect(await platformDb.rateLimit.count({ where: { key: { startsWith: "old:" } } })).toBe(0);
  });

  it("never deletes the row it is counting, even when that window just restarted", async () => {
    await seed("stale", 1, RATE_LIMIT_RETENTION_MS + HOUR);
    await platformDb.rateLimit.update({ where: { key: "stale:0" }, data: { windowStart: new Date(NOW.getTime() - RATE_LIMIT_RETENTION_MS - HOUR) } });
    expect(await hitRateLimit("stale:0", 15 * 60 * 1000, NOW)).toBe(1);
    expect(await platformDb.rateLimit.findUnique({ where: { key: "stale:0" } })).toMatchObject({ count: 1 });
  });
});
