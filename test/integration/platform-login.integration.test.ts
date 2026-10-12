import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import { createPlatformAdmin } from "@/modules/platform/application/platform-admins";
import { platformLogin } from "@/modules/platform/application/platform-login";
import { endPlatformSession, resolvePlatformSession } from "@/modules/platform/application/platform-session";
import { ADMIN_SESSION_ABSOLUTE_MS } from "@/modules/platform/domain/admin-session";
import { decodeBase32, } from "@/modules/platform/domain/base32";
import { stepAt, totpCode } from "@/modules/platform/domain/totp";
import { createPlatformSession } from "@/modules/platform/infrastructure/platform-sessions";
import { platformTransaction } from "@/modules/platform/infrastructure/platform-store";
import { encryptTotpSecret, loadTotpKey, newTotpSecretBase32 } from "@/modules/platform/infrastructure/totp-crypto";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * DR-006 slice 4: the admin login (password and code), its limits, the session lifetime and
 * logout, through the use cases (no cookie, no request). Written, not run when authored:
 * unverified until `npm run test:integration` has run.
 */
const PASSWORD = "a long admin passphrase";
const ACTOR = "cli:tester@host";
const ID = "ops.one";

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
});

/** An admin with a password and an enrolled secret (the secret is returned to make codes). */
async function enrolled(identifier = ID) {
  await createPlatformAdmin({ identifier, password: PASSWORD, actor: ACTOR });
  const admin = await platformDb.platformAdmin.findUniqueOrThrow({ where: { identifier } });
  const secretBase32 = newTotpSecretBase32();
  await platformDb.platformAdmin.update({
    where: { id: admin.id },
    data: { totpSecretEnc: encryptTotpSecret(secretBase32, loadTotpKey(), admin.id), lastTotpStep: null },
  });
  return { admin, secret: decodeBase32(secretBase32)! };
}

const codeAt = (secret: Uint8Array, now: Date, offsetSteps = 0) => totpCode(secret, stepAt(now.getTime() / 1000) + offsetSteps);
const login = (overrides: Partial<Parameters<typeof platformLogin>[0]> = {}) =>
  platformLogin({ identifier: ID, password: PASSWORD, code: "000000", ip: null, ...overrides });
const auditActions = async () => (await platformDb.platformAuditLog.findMany({ orderBy: { createdAt: "asc" } })).map((row) => row.action);

describe("platformLogin", () => {
  it("creates one session and one admin.login audit row (actor admin:<id>, no secret)", async () => {
    const { admin, secret } = await enrolled();
    const now = new Date();
    const { token } = await login({ identifier: "  Ops.One ", code: codeAt(secret, now), now });
    expect(token.length).toBeGreaterThanOrEqual(40);

    const sessions = await platformDb.platformSession.findMany();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.adminId).toBe(admin.id);
    expect(sessions[0]!.tokenHash).not.toBe(token); // only the hash is stored
    const audits = await platformDb.platformAuditLog.findMany({ where: { action: "admin.login" } });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.actor).toBe(`admin:${admin.id}`);
    expect(JSON.stringify(audits[0]!.detail)).not.toMatch(new RegExp(`${PASSWORD}|${token}`));
    const row = await platformDb.platformAdmin.findUniqueOrThrow({ where: { id: admin.id } });
    expect(row.lastTotpStep).toBe(BigInt(stepAt(now.getTime() / 1000)));
  });

  it("answers platform.login_failed and writes nothing for a wrong password, a wrong code, an unknown identifier and a not-enrolled admin", async () => {
    const { secret } = await enrolled();
    await createPlatformAdmin({ identifier: "not.enrolled", password: PASSWORD, actor: ACTOR });
    const now = new Date();
    const good = codeAt(secret, now);
    const attempts = [
      login({ password: "wrong password here", code: good }),
      login({ code: codeAt(secret, now, 5) }), // five steps away: outside the window
      login({ identifier: "nobody.here", code: good }),
      login({ identifier: "not.enrolled", code: good }),
    ];
    for (const attempt of attempts) {
      await expect(attempt).rejects.toMatchObject({ key: "platform.login_failed" });
    }
    expect(await platformDb.platformSession.count()).toBe(0);
    expect(await auditActions()).not.toContain("admin.login");
    const row = await platformDb.platformAdmin.findUniqueOrThrow({ where: { identifier: ID } });
    expect(row.lastTotpStep).toBeNull(); // a refused login burns no step
  });

  it("accepts a code once: the same code a second time fails", async () => {
    const { secret } = await enrolled();
    const now = new Date();
    const code = codeAt(secret, now);
    await login({ code, now });
    await expect(login({ code, now })).rejects.toMatchObject({ key: "platform.login_failed" });
    expect(await platformDb.platformSession.count()).toBe(1);
  });

  it("blocks after 5 failures in 15 minutes, even with correct credentials", async () => {
    const { secret } = await enrolled();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(login({ password: "wrong password here" })).rejects.toMatchObject({ key: "platform.login_failed" });
    }
    await expect(login({ code: codeAt(secret, new Date()) })).rejects.toMatchObject({ key: "platform.login_blocked" });
    expect(await platformDb.platformSession.count()).toBe(0);
  });

  it("blocks an IP after 5 failures across accounts when the IP is known", async () => {
    const { secret } = await enrolled();
    const ip = "203.0.113.9";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(login({ identifier: `ghost${attempt}`, ip })).rejects.toMatchObject({ key: "platform.login_failed" });
    }
    await expect(login({ code: codeAt(secret, new Date()), ip })).rejects.toMatchObject({ key: "platform.login_blocked" });
    // Another address is not blocked.
    await expect(login({ code: codeAt(secret, new Date()), ip: "203.0.113.10" })).resolves.toHaveProperty("token");
  });
});

async function sessionFor(adminId: string, expiresAt = new Date(Date.now() + ADMIN_SESSION_ABSOLUTE_MS)) {
  return platformTransaction((tx) => createPlatformSession(tx, adminId, expiresAt));
}

describe("platform sessions", () => {
  it("reads a live session as its admin", async () => {
    const { admin } = await enrolled();
    const { token } = await sessionFor(admin.id);
    expect(await resolvePlatformSession(token)).toEqual({ adminId: admin.id, identifier: ID });
    expect(await resolvePlatformSession("not a token")).toBeNull();
    expect(await resolvePlatformSession(undefined)).toBeNull();
  });

  it("reads an idle-expired session (30 minutes) as null and deletes it", async () => {
    const { admin } = await enrolled();
    const { token } = await sessionFor(admin.id);
    const later = new Date(Date.now() + 31 * 60_000);
    expect(await resolvePlatformSession(token, later)).toBeNull();
    expect(await platformDb.platformSession.count()).toBe(0);
  });

  it("reads an absolute-expired session (8 hours) as null and deletes it, even if it was just used", async () => {
    const { admin } = await enrolled();
    const { token } = await sessionFor(admin.id, new Date(Date.now() + 100 * 3_600_000));
    await platformDb.platformSession.updateMany({
      data: { createdAt: new Date(Date.now() - 9 * 3_600_000), lastSeenAt: new Date() },
    });
    expect(await resolvePlatformSession(token)).toBeNull();
    expect(await platformDb.platformSession.count()).toBe(0);
  });

  it("marks a session seen at most once a minute", async () => {
    const { admin } = await enrolled();
    const { token } = await sessionFor(admin.id);
    const seenAt = async () => (await platformDb.platformSession.findFirstOrThrow()).lastSeenAt.getTime();
    const first = await seenAt();
    await resolvePlatformSession(token, new Date(first + 30_000));
    expect(await seenAt()).toBe(first); // under a minute: not touched
    const later = new Date(first + 90_000);
    await resolvePlatformSession(token, later);
    expect(await seenAt()).toBe(later.getTime());
  });

  it("logout deletes the session, and a second logout finds nothing", async () => {
    const { admin } = await enrolled();
    const { token } = await sessionFor(admin.id);
    expect(await endPlatformSession(token)).toBe(true);
    expect(await resolvePlatformSession(token)).toBeNull();
    expect(await platformDb.platformSession.count()).toBe(0);
    expect(await endPlatformSession(token)).toBe(false);
    expect(await endPlatformSession(undefined)).toBe(false);
  });
});
