import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import { login } from "@/modules/access/application/login";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Security audit S-4: an unknown account costs one password verify at the same
 * cost as a real one, and fails with the same error, so neither timing nor the
 * message tells whether the account exists.
 */
let fixture: TestFixture;

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
  fixture = await seedMinimalFixture();
});

async function timedAttempt(identifier: string): Promise<{ ms: number; key: string }> {
  clearRequestStubs();
  setTenantSlug(fixture.tenantSlug);
  // Keep the brute-force limit out of the measurement.
  await platformDb.rateLimit.deleteMany();
  const started = process.hrtime.bigint();
  let key = "ok";
  try {
    await login({ identifier, password: "wrong-password" });
  } catch (error) {
    key = (error as { key?: string }).key ?? String(error);
  }
  return { ms: Number(process.hrtime.bigint() - started) / 1e6, key };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

describe("login timing (S-4)", () => {
  it("an unknown account takes about as long as a wrong password, with the same error", async () => {
    // Warm up (the dummy hash is made once per process).
    await timedAttempt("warmup@test-stadium");
    await timedAttempt(fixture.ownerIdentifier);

    const known: number[] = [];
    const unknown: number[] = [];
    for (let i = 0; i < 7; i += 1) {
      const a = await timedAttempt(fixture.ownerIdentifier);
      const b = await timedAttempt(`nobody${i}@test-stadium`);
      expect(a.key).toBe("access.invalid_login");
      expect(b.key).toBe("access.invalid_login");
      known.push(a.ms);
      unknown.push(b.ms);
    }
    const knownMs = median(known);
    const unknownMs = median(unknown);
    // Before the fix: about 50 ms vs 6 ms. Allow 30% noise.
    expect(Math.abs(knownMs - unknownMs)).toBeLessThan(knownMs * 0.3);
  });
});
