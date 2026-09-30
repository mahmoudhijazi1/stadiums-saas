import { randomBytes, scryptSync } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { login } from "@/modules/access/application/login";
import { logout } from "@/modules/access/application/logout";
import {
  passwordNeedsRehash,
  verifyPassword,
} from "@/modules/access/infrastructure/password";
import { createSession } from "@/modules/access/infrastructure/sessions";
import { hashSessionToken } from "@/modules/access/infrastructure/session-token";
import { requireOwnerMembership } from "@/app/owner/shared";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import {
  clearRequestStubs,
  setSessionCookie,
  setTenantSlug,
  writtenCookies,
} from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Login, session lookup and logout on the real database (security audit S-2).
 */
const PASSWORD = "test-owner-password";

let fixture: TestFixture;

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
  clearRequestStubs();
  fixture = await seedMinimalFixture();
  setTenantSlug(fixture.tenantSlug);
});

/** New request with only this cookie (clears the per-request cache). */
function request(cookie?: string) {
  clearRequestStubs();
  setTenantSlug(fixture.tenantSlug);
  if (cookie !== undefined) setSessionCookie(cookie);
}

async function loginAndReadCookie(): Promise<string> {
  request();
  await login({ identifier: fixture.ownerIdentifier, password: PASSWORD });
  const cookie = writtenCookies().find((entry) => entry.name === "stadium_session");
  if (!cookie) throw new Error("login wrote no session cookie");
  return cookie.value;
}

describe("session tokens (S-2)", () => {
  it("login sets a 256-bit random token; the database stores only its SHA-256", async () => {
    const token = await loginAndReadCookie();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const rows = await platformDb.session.findMany({ where: { userId: fixture.ownerUserId } });
    const row = rows.find((entry) => entry.tokenHash === hashSessionToken(token));
    expect(row).toBeDefined();
    // The raw token is in no column of any session row.
    for (const entry of rows) {
      expect(Object.values(entry).map(String)).not.toContain(token);
    }
  });

  it("the raw token authenticates; the row id or the stored hash does not", async () => {
    const token = await loginAndReadCookie();
    const row = await platformDb.session.findUniqueOrThrow({
      where: { tokenHash: hashSessionToken(token) },
    });

    request(token);
    expect((await getCurrentMembership())?.userId).toBe(fixture.ownerUserId);

    request(row.id);
    expect(await getCurrentMembership()).toBeNull();

    request(row.tokenHash);
    expect(await getCurrentMembership()).toBeNull();
  });

  it("two logins get different tokens", async () => {
    const first = await loginAndReadCookie();
    const second = await loginAndReadCookie();
    expect(first).not.toBe(second);
  });

  it("logout deletes the row for that token only and clears the cookie", async () => {
    const token = await loginAndReadCookie();
    const other = await loginAndReadCookie();

    request(token);
    await logout();
    expect(writtenCookies()).toContainEqual(
      expect.objectContaining({ name: "stadium_session", deleted: true }),
    );
    expect(
      await platformDb.session.count({ where: { tokenHash: hashSessionToken(token) } }),
    ).toBe(0);
    expect(
      await platformDb.session.count({ where: { tokenHash: hashSessionToken(other) } }),
    ).toBe(1);

    request(token);
    expect(await getCurrentMembership()).toBeNull();
  });
});

describe("rolling 30-day session", () => {
  const DAY = 24 * 60 * 60 * 1000;

  async function sessionExpiringIn(ms: number, userId = fixture.ownerUserId) {
    const session = await createSession(userId, new Date(Date.now() + ms));
    return session.token;
  }

  async function expiryOf(token: string): Promise<number> {
    const row = await platformDb.session.findUniqueOrThrow({
      where: { tokenHash: hashSessionToken(token) },
    });
    return row.expiresAt.getTime();
  }

  it("login sets a 30-day cookie and a 30-day row", async () => {
    const before = Date.now();
    const token = await loginAndReadCookie();
    const cookie = writtenCookies().find((entry) => entry.name === "stadium_session");
    expect(cookie?.maxAge).toBe(30 * 24 * 60 * 60);
    expect(await expiryOf(token)).toBeGreaterThanOrEqual(before + 30 * DAY - 1000);
  });

  it("use extends the expiry to 30 days from now, at most once a day", async () => {
    const token = await sessionExpiringIn(10 * DAY);
    request(token);
    const before = Date.now();
    expect(await getCurrentMembership()).not.toBeNull();
    const renewed = await expiryOf(token);
    expect(renewed).toBeGreaterThanOrEqual(before + 30 * DAY - 1000);

    // Used again the same day: no second write.
    request(token);
    expect(await getCurrentMembership()).not.toBeNull();
    expect(await expiryOf(token)).toBe(renewed);
  });

  it("a session renewed less than a day ago is left alone", async () => {
    const token = await sessionExpiringIn(29 * DAY + 60 * 60 * 1000);
    const stored = await expiryOf(token);
    request(token);
    expect(await getCurrentMembership()).not.toBeNull();
    expect(await expiryOf(token)).toBe(stored);
  });

  it("an expired session is not revived and the owner shell redirects to /owner/login", async () => {
    const token = await sessionExpiringIn(-1000);
    const stored = await expiryOf(token);
    request(token);
    expect(await getCurrentMembership()).toBeNull();
    expect(await expiryOf(token)).toBe(stored);

    request(token);
    await expect(requireOwnerMembership()).rejects.toMatchObject({
      digest: expect.stringContaining("/owner/login"),
    });
  });

  it("login deletes that user's expired sessions, keeps live ones and other users'", async () => {
    const expired = await sessionExpiringIn(-1000);
    const live = await sessionExpiringIn(5 * DAY);
    const other = await seedMinimalFixture({
      tenantSlug: "other-stadium",
      tenantName: "Other",
      pitchName: "PO",
      ownerIdentifier: "owner@other-stadium",
    });
    const othersExpired = await sessionExpiringIn(-1000, other.ownerUserId);

    await loginAndReadCookie();

    const hashes = (await platformDb.session.findMany()).map((row) => row.tokenHash);
    expect(hashes).not.toContain(hashSessionToken(expired));
    expect(hashes).toContain(hashSessionToken(live));
    expect(hashes).toContain(hashSessionToken(othersExpired));
  });
});

describe("hash upgrade on login", () => {
  it("rehashes an old-format hash with the current cost after a successful login, once", async () => {
    const salt = randomBytes(16).toString("hex");
    const legacy = `${salt}:${scryptSync(PASSWORD, salt, 64).toString("hex")}`;
    await platformDb.user.update({
      where: { id: fixture.ownerUserId },
      data: { passwordHash: legacy },
    });

    await loginAndReadCookie();
    const upgraded = (await platformDb.user.findUniqueOrThrow({ where: { id: fixture.ownerUserId } }))
      .passwordHash;
    expect(upgraded).not.toBe(legacy);
    expect(passwordNeedsRehash(upgraded)).toBe(false);
    expect(await verifyPassword(PASSWORD, upgraded)).toBe(true);

    await loginAndReadCookie();
    const again = (await platformDb.user.findUniqueOrThrow({ where: { id: fixture.ownerUserId } }))
      .passwordHash;
    expect(again).toBe(upgraded);
  });

  it("does not touch the hash on a failed login", async () => {
    const salt = randomBytes(16).toString("hex");
    const legacy = `${salt}:${scryptSync(PASSWORD, salt, 64).toString("hex")}`;
    await platformDb.user.update({
      where: { id: fixture.ownerUserId },
      data: { passwordHash: legacy },
    });
    request();
    await expect(
      login({ identifier: fixture.ownerIdentifier, password: "wrong-password" }),
    ).rejects.toMatchObject({ key: "access.invalid_login" });
    const stored = (await platformDb.user.findUniqueOrThrow({ where: { id: fixture.ownerUserId } }))
      .passwordHash;
    expect(stored).toBe(legacy);
  });
});
