import { afterAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import { checkPassword } from "@/modules/access/domain/password-policy";
import { verifyPassword } from "@/modules/access/infrastructure/password";
import { createPlatformAdmin } from "@/modules/platform/application/platform-admins";
import { ADMIN_SESSION_ABSOLUTE_MS } from "@/modules/platform/domain/admin-session";
import { createPlatformSession } from "@/modules/platform/infrastructure/platform-sessions";
import { adminCookie } from "@/modules/platform/infrastructure/platform-session-cookie";
import { platformTransaction } from "@/modules/platform/infrastructure/platform-store";
import { clearRequestStubs, setCookie, setRequestHeader } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * DR-006 slice 6: create, suspend and resume through the web Server Actions, called as functions.
 * The host and the admin cookie come from the shared `next/headers` stub (setup-mocks.ts,
 * request-stubs.ts); only `next/cache` is mocked (revalidatePath needs a request). Written, not run
 * when authored: unverified until `npm run test:integration` has run.
 */
jest.mock("next/cache", () => ({ revalidatePath: () => undefined }));

/** The bare APP_BASE_DOMAIN of the integration setup (setup-env.ts). */
const BARE_HOST = "lebstads.test";

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

let adminId = "";

beforeEach(async () => {
  await truncateAll();
  clearRequestStubs(); // also clears React.cache, so a session is never remembered between tests
  setRequestHeader("host", BARE_HOST);
  await createPlatformAdmin({ identifier: "ops.one", password: "a long admin passphrase", actor: "cli:t@h" });
  adminId = (await platformDb.platformAdmin.findUniqueOrThrow({ where: { identifier: "ops.one" } })).id;
  const { token } = await platformTransaction((tx) => createPlatformSession(tx, adminId, new Date(Date.now() + ADMIN_SESSION_ABSOLUTE_MS)));
  setCookie(adminCookie().name, token);
});

const actions = () => import("@/app/(platform)/platform/actions");
const NEW = { name: "Al Nour", slug: "al-nour", dayStartHour: 6 };
const audits = async (action: string) => platformDb.platformAuditLog.findMany({ where: { action } });

describe("submitCreateStadium", () => {
  it("creates the tenant, its owner user and OWNER membership, and one audit row by admin:<id>", async () => {
    const { submitCreateStadium } = await actions();
    const result = await submitCreateStadium({ ...NEW, plan: "basic", paidUntil: "2027-01-31" });
    expect(result).toMatchObject({ ok: true, slug: "al-nour", ownerIdentifier: "owner@al-nour" });
    if (!result.ok) return;

    const tenant = await platformDb.tenant.findUniqueOrThrow({ where: { slug: "al-nour" }, include: { memberships: true, subscriptions: true } });
    expect(tenant.name).toBe("Al Nour");
    expect(tenant.memberships.map((membership) => membership.role)).toEqual(["OWNER"]);
    expect(tenant.subscriptions[0]).toMatchObject({ plan: "basic", recordedBy: `admin:${adminId}` });
    const user = await platformDb.user.findUniqueOrThrow({ where: { identifier: "owner@al-nour" } });
    expect(tenant.memberships[0]!.userId).toBe(user.id);

    const created = await audits("tenant.create");
    expect(created).toHaveLength(1);
    expect(created[0]!.actor).toBe(`admin:${adminId}`);
  });

  it("returns a policy-passing password once; the database keeps only its hash and the audit never has it", async () => {
    const { submitCreateStadium } = await actions();
    const result = await submitCreateStadium(NEW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const password = result.ownerPassword;
    expect(password).toHaveLength(16);
    expect(checkPassword(password, { identifier: "owner@al-nour", slug: "al-nour" })).toBeNull();
    const user = await platformDb.user.findUniqueOrThrow({ where: { identifier: "owner@al-nour" } });
    expect(user.passwordHash).not.toContain(password);
    expect(await verifyPassword(password, user.passwordHash)).toBe(true);
    const everyAudit = JSON.stringify(await platformDb.platformAuditLog.findMany());
    expect(everyAudit).not.toContain(password);
  });

  it("refuses a reserved, a taken and a malformed slug with nothing written", async () => {
    const { submitCreateStadium } = await actions();
    expect(await submitCreateStadium({ ...NEW, slug: "admin" })).toEqual({ ok: false, errorKey: "platform.slug_reserved" });
    expect(await submitCreateStadium({ ...NEW, slug: "bad slug!" })).toEqual({ ok: false, errorKey: "platform.slug_format" });
    expect(await submitCreateStadium({ ...NEW, slug: "ab" })).toEqual({ ok: false, errorKey: "platform.slug_length" });
    expect(await platformDb.tenant.count()).toBe(0);
    expect(await platformDb.user.count({ where: { identifier: { startsWith: "owner@" } } })).toBe(0);

    expect((await submitCreateStadium(NEW)).ok).toBe(true);
    const auditsBefore = await platformDb.platformAuditLog.count();
    expect(await submitCreateStadium(NEW)).toEqual({ ok: false, errorKey: "platform.slug_taken" });
    expect(await platformDb.tenant.count()).toBe(1);
    expect(await platformDb.platformAuditLog.count()).toBe(auditsBefore);
  });

  it("refuses a missing name and a bad date with nothing written", async () => {
    const { submitCreateStadium } = await actions();
    expect(await submitCreateStadium({ ...NEW, name: "   " })).toEqual({ ok: false, errorKey: "platform.name_required" });
    expect(await submitCreateStadium({ ...NEW, paidUntil: "2027-02-31" })).toEqual({ ok: false, errorKey: "platform.paid_until_invalid" });
    expect(await platformDb.tenant.count()).toBe(0);
  });
});

describe("submitSuspendStadium and submitResumeStadium", () => {
  async function stadium() {
    const { submitCreateStadium } = await actions();
    await submitCreateStadium(NEW);
  }
  const status = async () => (await platformDb.tenant.findUniqueOrThrow({ where: { slug: "al-nour" } })).suspendedAt;

  it("suspend needs a reason and the matching slug; a wrong slug or no reason writes nothing", async () => {
    await stadium();
    const { submitSuspendStadium } = await actions();
    const before = await platformDb.platformAuditLog.count();

    expect(await submitSuspendStadium({ slug: "al-nour", typedSlug: "al-nor", reason: "not paid" })).toEqual({ ok: false, errorKey: "platform.slug_mismatch" });
    expect(await submitSuspendStadium({ slug: "al-nour", typedSlug: "al-nour", reason: "   " })).toEqual({ ok: false, errorKey: "platform.reason_required" });
    expect(await submitSuspendStadium({ slug: "al-nour", typedSlug: "al-nour", reason: "x".repeat(501) })).toEqual({ ok: false, errorKey: "platform.reason_too_long" });
    expect(await status()).toBeNull();
    expect(await platformDb.platformAuditLog.count()).toBe(before);
  });

  it("suspends with a reason of up to 500 characters and writes one audit row by admin:<id>", async () => {
    await stadium();
    const { submitSuspendStadium } = await actions();
    expect(await submitSuspendStadium({ slug: "al-nour", typedSlug: " al-nour ", reason: "x".repeat(500) })).toEqual({ ok: true });
    expect(await status()).not.toBeNull();
    const rows = await audits("tenant.suspend");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.actor).toBe(`admin:${adminId}`);
    expect(await submitSuspendStadium({ slug: "al-nour", typedSlug: "al-nour", reason: "again" })).toEqual({ ok: false, errorKey: "platform.already_suspended" });
  });

  it("resume needs the slug typed back, works, and writes an audit row; resuming an active stadium is refused", async () => {
    await stadium();
    const { submitSuspendStadium, submitResumeStadium } = await actions();
    expect(await submitResumeStadium({ slug: "al-nour", typedSlug: "al-nour" })).toEqual({ ok: false, errorKey: "platform.not_suspended" });
    await submitSuspendStadium({ slug: "al-nour", typedSlug: "al-nour", reason: "test" });

    expect(await submitResumeStadium({ slug: "al-nour", typedSlug: "wrong" })).toEqual({ ok: false, errorKey: "platform.slug_mismatch" });
    expect(await status()).not.toBeNull();
    expect(await submitResumeStadium({ slug: "al-nour", typedSlug: "al-nour" })).toEqual({ ok: true });
    expect(await status()).toBeNull();
    const rows = await audits("tenant.resume");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.actor).toBe(`admin:${adminId}`);
  });
});

describe("without a session or off the bare host", () => {
  it("every action is refused without a session and writes nothing", async () => {
    const { submitCreateStadium, submitSuspendStadium, submitResumeStadium } = await actions();
    clearRequestStubs(); // no admin cookie (and a fresh React.cache)
    setRequestHeader("host", BARE_HOST);
    const refused = { ok: false, errorKey: "platform.not_signed_in" };
    expect(await submitCreateStadium(NEW)).toEqual(refused);
    expect(await submitSuspendStadium({ slug: "al-nour", typedSlug: "al-nour", reason: "x" })).toEqual(refused);
    expect(await submitResumeStadium({ slug: "al-nour", typedSlug: "al-nour" })).toEqual(refused);
    expect(await platformDb.tenant.count()).toBe(0);
    expect(await audits("tenant.create")).toHaveLength(0);
  });

  it("every action answers 404 off the bare host, even with a valid session", async () => {
    const { submitCreateStadium, submitSuspendStadium, submitResumeStadium } = await actions();
    setRequestHeader("host", "ahmad.lebstads.test");
    await expect(submitCreateStadium(NEW)).rejects.toMatchObject({ digest: expect.stringContaining("404") });
    await expect(submitSuspendStadium({ slug: "a", typedSlug: "a", reason: "x" })).rejects.toMatchObject({ digest: expect.stringContaining("404") });
    await expect(submitResumeStadium({ slug: "a", typedSlug: "a" })).rejects.toMatchObject({ digest: expect.stringContaining("404") });
    expect(await platformDb.tenant.count()).toBe(0);
  });
});
