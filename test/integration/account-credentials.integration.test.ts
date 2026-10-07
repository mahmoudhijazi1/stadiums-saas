import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import { hitRateLimit } from "@/lib/rate-limit";
import { changeOwnPassword } from "@/modules/access/application/change-own-password";
import { login } from "@/modules/access/application/login";
import { pwChangeKeys } from "@/modules/access/domain/credential-limits";
import { verifyPassword } from "@/modules/access/infrastructure/password";
import { hashSessionToken } from "@/modules/access/infrastructure/session-token";
import { createSession } from "@/modules/access/infrastructure/sessions";
import type { TestFixture } from "./fixtures";
import { createStaffSession, seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Change your own password. The user always comes from the session; a wrong current
 * password is counted under "pwchange:<userId>", separate from the login counter.
 */
const OLD = "test-owner-password";
const NEW = "a brand new passphrase";
const MINUTE = 60 * 1000;

let fixture: TestFixture;

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
  clearRequestStubs();
  fixture = await seedMinimalFixture();
  actAs(fixture.sessionId);
});

function actAs(token: string) {
  clearRequestStubs();
  setTenantSlug(fixture.tenantSlug);
  setSessionCookie(token);
}

async function hashOf(userId: string): Promise<string> {
  return (await platformDb.user.findUniqueOrThrow({ where: { id: userId } })).passwordHash;
}

async function sessionCount(userId: string): Promise<number> {
  return platformDb.session.count({ where: { userId } });
}

const future = () => new Date(Date.now() + 86_400_000);

describe("changeOwnPassword", () => {
  it("a wrong current password is refused and counted", async () => {
    await expect(
      changeOwnPassword({ currentPassword: "not the password", newPassword: NEW }),
    ).rejects.toMatchObject({ key: "access.current_password_wrong" });
    expect(await verifyPassword(OLD, await hashOf(fixture.ownerUserId))).toBe(true);
    const row = await platformDb.rateLimit.findUnique({ where: { key: pwChangeKeys(fixture.ownerUserId).failures } });
    expect(row?.count).toBe(1);
  });

  it("5 failures block even the right password, and login is not touched", async () => {
    for (let i = 0; i < 5; i += 1) {
      await expect(
        changeOwnPassword({ currentPassword: `wrong ${i}`, newPassword: NEW }),
      ).rejects.toMatchObject({ key: "access.current_password_wrong" });
    }
    await expect(
      changeOwnPassword({ currentPassword: OLD, newPassword: NEW }),
    ).rejects.toMatchObject({ key: "access.password_change_throttled" });
    expect(await verifyPassword(OLD, await hashOf(fixture.ownerUserId))).toBe(true);

    // The login counter has no rows for this account, so login still works.
    const loginRows = await platformDb.rateLimit.count({ where: { key: { startsWith: "login:" } } });
    expect(loginRows).toBe(0);
    clearRequestStubs();
    setTenantSlug(fixture.tenantSlug);
    await login({ identifier: fixture.ownerIdentifier, password: OLD });

    // The block ends when its window does.
    const keys = pwChangeKeys(fixture.ownerUserId);
    await platformDb.rateLimit.updateMany({
      where: { key: keys.block },
      data: { windowStart: new Date(Date.now() - 16 * MINUTE) },
    });
    actAs(fixture.sessionId);
    await changeOwnPassword({ currentPassword: OLD, newPassword: NEW });
    expect(await verifyPassword(NEW, await hashOf(fixture.ownerUserId))).toBe(true);
  });

  it("failed attempts here never count towards the login limit", async () => {
    await hitRateLimit(pwChangeKeys(fixture.ownerUserId).failures, 15 * MINUTE);
    for (let i = 0; i < 4; i += 1) {
      await expect(
        changeOwnPassword({ currentPassword: `wrong ${i}`, newPassword: NEW }),
      ).rejects.toMatchObject({ key: "access.current_password_wrong" });
    }
    expect(await platformDb.rateLimit.count({ where: { key: { startsWith: "login:" } } })).toBe(0);
  });

  it("success keeps the current session, deletes the user's other sessions, leaves other users alone", async () => {
    await createSession(fixture.ownerUserId, future());
    await createSession(fixture.ownerUserId, future());
    const staffToken = await createStaffSession(fixture.tenantId, {});
    const staff = await platformDb.session.findFirstOrThrow({ where: { tokenHash: hashSessionToken(staffToken) } });
    expect(await sessionCount(fixture.ownerUserId)).toBe(3);

    await changeOwnPassword({ currentPassword: OLD, newPassword: NEW });

    const remaining = await platformDb.session.findMany({ where: { userId: fixture.ownerUserId } });
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.tokenHash).toBe(hashSessionToken(fixture.sessionId));
    expect(await sessionCount(staff.userId)).toBe(1);
  });

  it("the old password no longer logs in and the new one does; success resets the counter", async () => {
    await expect(
      changeOwnPassword({ currentPassword: "wrong", newPassword: NEW }),
    ).rejects.toMatchObject({ key: "access.current_password_wrong" });
    await changeOwnPassword({ currentPassword: OLD, newPassword: NEW });
    expect(await platformDb.rateLimit.count({ where: { key: pwChangeKeys(fixture.ownerUserId).failures } })).toBe(0);

    clearRequestStubs();
    setTenantSlug(fixture.tenantSlug);
    await expect(login({ identifier: fixture.ownerIdentifier, password: OLD })).rejects.toMatchObject({
      key: "access.invalid_login",
    });
    await login({ identifier: fixture.ownerIdentifier, password: NEW });
  });

  it.each([
    ["too short", "short one", "access.password_too_short"],
    ["equal to the identifier", "OWNER@test-stadium", "access.password_same_as_identifier"],
    ["denylisted", "Password1234", "access.password_denylisted"],
  ])("refuses a password that is %s, without counting a failure", async (_label, password, key) => {
    await expect(changeOwnPassword({ currentPassword: OLD, newPassword: password })).rejects.toMatchObject({ key });
    expect(await verifyPassword(OLD, await hashOf(fixture.ownerUserId))).toBe(true);
    expect(await platformDb.rateLimit.count()).toBe(0);
  });

  it("refuses the tenant slug as the password", async () => {
    await platformDb.tenant.update({ where: { id: fixture.tenantId }, data: { slug: "a-long-stadium-slug" } });
    fixture.tenantSlug = "a-long-stadium-slug";
    actAs(fixture.sessionId);
    await expect(
      changeOwnPassword({ currentPassword: OLD, newPassword: "a-long-stadium-slug" }),
    ).rejects.toMatchObject({ key: "access.password_same_as_identifier" });
  });

  it("staff with no flags can change their own password and nobody else's", async () => {
    const staffToken = await createStaffSession(fixture.tenantId, {});
    actAs(staffToken);
    const staffSession = await platformDb.session.findFirstOrThrow({ where: { tokenHash: hashSessionToken(staffToken) } });
    // createStaffSession hashes "staff-password".
    await changeOwnPassword({ currentPassword: "staff-password", newPassword: NEW });
    expect(await verifyPassword(NEW, await hashOf(staffSession.userId))).toBe(true);
    expect(await verifyPassword(OLD, await hashOf(fixture.ownerUserId))).toBe(true);
  });

  it("is refused without a session and on a suspended tenant", async () => {
    clearRequestStubs();
    setTenantSlug(fixture.tenantSlug);
    await expect(changeOwnPassword({ currentPassword: OLD, newPassword: NEW })).rejects.toMatchObject({
      key: "access.not_allowed",
    });

    await platformDb.tenant.update({ where: { id: fixture.tenantId }, data: { suspendedAt: new Date() } });
    actAs(fixture.sessionId);
    await expect(changeOwnPassword({ currentPassword: OLD, newPassword: NEW })).rejects.toMatchObject({
      key: "access.not_allowed",
    });
    expect(await verifyPassword(OLD, await hashOf(fixture.ownerUserId))).toBe(true);
  });
});
