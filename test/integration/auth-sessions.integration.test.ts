import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { login } from "@/modules/access/application/login";
import { logout } from "@/modules/access/application/logout";
import { hashSessionToken } from "@/modules/access/infrastructure/session-token";
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
