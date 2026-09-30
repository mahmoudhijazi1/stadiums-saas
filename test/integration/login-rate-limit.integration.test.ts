import { afterAll, afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import { hitRateLimit } from "@/lib/rate-limit";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { login } from "@/modules/access/application/login";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import {
  clearRequestStubs,
  setRequestHeader,
  setSessionCookie,
  setTenantSlug,
  writtenCookies,
} from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Security audit S-3: Postgres counters; login blocked for 15 minutes after
 * 8 failures per account in 15 minutes; per-IP limits only when
 * TRUSTED_CLIENT_IP_HEADER is set.
 */
const PASSWORD = "test-owner-password";
const MINUTE = 60 * 1000;

let fixture: TestFixture;

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
  delete process.env.TRUSTED_CLIENT_IP_HEADER;
  fixture = await seedMinimalFixture();
});

afterEach(() => {
  delete process.env.TRUSTED_CLIENT_IP_HEADER;
});

function request(ip?: string) {
  clearRequestStubs();
  setTenantSlug(fixture.tenantSlug);
  if (ip) setRequestHeader("x-real-ip", ip);
}

async function attempt(identifier: string, password: string, ip?: string): Promise<string> {
  request(ip);
  try {
    await login({ identifier, password });
    return "ok";
  } catch (error) {
    return (error as { key?: string }).key ?? String(error);
  }
}

async function fail(times: number, identifier = fixture.ownerIdentifier, ip?: string) {
  const results: string[] = [];
  for (let i = 0; i < times; i += 1) results.push(await attempt(identifier, "wrong-password", ip));
  return results;
}

/** Move every counter and block back in time, as if this much time had passed. */
async function elapse(ms: number) {
  await platformDb.$executeRaw`UPDATE "RateLimit" SET "windowStart" = "windowStart" - ${ms} * interval '1 millisecond'`;
}

describe("hitRateLimit", () => {
  it("counts atomically under concurrency and restarts after the window", async () => {
    const counts = await Promise.all(
      Array.from({ length: 20 }, () => hitRateLimit("test:key", 15 * MINUTE)),
    );
    expect([...counts].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    await elapse(15 * MINUTE);
    expect(await hitRateLimit("test:key", 15 * MINUTE)).toBe(1);
  });
});

describe("login: per account", () => {
  it("8 failures, then a 15-minute block with a generic error even for the right password", async () => {
    expect(await fail(8)).toEqual(Array(8).fill("access.invalid_login"));
    expect(await attempt(fixture.ownerIdentifier, PASSWORD)).toBe("access.login_throttled");
    expect(writtenCookies().some((cookie) => cookie.name === "stadium_session")).toBe(false);

    await elapse(14 * MINUTE);
    expect(await attempt(fixture.ownerIdentifier, PASSWORD)).toBe("access.login_throttled");
    await elapse(MINUTE + 1000);
    expect(await attempt(fixture.ownerIdentifier, PASSWORD)).toBe("ok");
  });

  it("7 failures do not block", async () => {
    await fail(7);
    expect(await attempt(fixture.ownerIdentifier, PASSWORD)).toBe("ok");
  });

  it("failures older than 15 minutes do not count", async () => {
    await fail(7);
    await elapse(15 * MINUTE);
    await fail(7);
    expect(await attempt(fixture.ownerIdentifier, PASSWORD)).toBe("ok");
  });

  it("a successful login resets the count", async () => {
    await fail(7);
    expect(await attempt(fixture.ownerIdentifier, PASSWORD)).toBe("ok");
    await fail(7);
    expect(await attempt(fixture.ownerIdentifier, PASSWORD)).toBe("ok");
  });

  it("an unknown account is throttled the same way (no enumeration)", async () => {
    expect(await fail(8, "nobody@test-stadium")).toEqual(Array(8).fill("access.invalid_login"));
    expect(await attempt("nobody@test-stadium", "anything")).toBe("access.login_throttled");
  });

  it("blocks only that account; its live session keeps working", async () => {
    const other = await seedMinimalFixture({
      tenantSlug: "other-stadium",
      tenantName: "Other",
      pitchName: "PO",
      ownerIdentifier: "owner@other-stadium",
    });
    await fail(8);
    expect(await attempt(fixture.ownerIdentifier, PASSWORD)).toBe("access.login_throttled");

    clearRequestStubs();
    setTenantSlug(other.tenantSlug);
    expect(await attempt(other.ownerIdentifier, PASSWORD)).not.toBe("access.login_throttled");

    clearRequestStubs();
    setTenantSlug(fixture.tenantSlug);
    setSessionCookie(fixture.sessionId);
    expect((await getCurrentMembership())?.userId).toBe(fixture.ownerUserId);
  });
});

describe("login: per IP", () => {
  it("without TRUSTED_CLIENT_IP_HEADER, no IP limit even with a client-sent IP header", async () => {
    for (let i = 0; i < 6; i += 1) await fail(7, `user${i}@test-stadium`, "203.0.113.9");
    expect(await attempt(fixture.ownerIdentifier, PASSWORD, "203.0.113.9")).toBe("ok");
  });

  it("with TRUSTED_CLIENT_IP_HEADER, 40 failures from one IP block that IP for 15 minutes", async () => {
    process.env.TRUSTED_CLIENT_IP_HEADER = "x-real-ip";
    for (let i = 0; i < 5; i += 1) await fail(7, `user${i}@test-stadium`, "203.0.113.9");
    await fail(5, "user9@test-stadium", "203.0.113.9"); // 40 in total, no account over 7
    expect(await attempt(fixture.ownerIdentifier, PASSWORD, "203.0.113.9")).toBe(
      "access.login_throttled",
    );
    // Another IP is not affected.
    expect(await attempt(fixture.ownerIdentifier, PASSWORD, "198.51.100.7")).toBe("ok");
    await elapse(15 * MINUTE + 1000);
    expect(await attempt(fixture.ownerIdentifier, PASSWORD, "203.0.113.9")).toBe("ok");
  });

  it("with the setting on but the header missing, only the account limit applies", async () => {
    process.env.TRUSTED_CLIENT_IP_HEADER = "x-real-ip";
    for (let i = 0; i < 6; i += 1) await fail(7, `user${i}@test-stadium`);
    expect(await attempt(fixture.ownerIdentifier, PASSWORD)).toBe("ok");
  });
});
