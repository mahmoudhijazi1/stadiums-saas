import { afterAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import { createPlatformAdmin } from "@/modules/platform/application/platform-admins";
import { getTenantDetail } from "@/modules/platform/application/get-tenant-detail";
import { listTenants } from "@/modules/platform/application/list-tenants";
import { setSubscription } from "@/modules/platform/application/set-subscription";
import { ADMIN_SESSION_ABSOLUTE_MS } from "@/modules/platform/domain/admin-session";
import { createPlatformSession } from "@/modules/platform/infrastructure/platform-sessions";
import { adminCookie } from "@/modules/platform/infrastructure/platform-session-cookie";
import { platformTransaction } from "@/modules/platform/infrastructure/platform-store";
import { clearRequestStubs, setCookie, setRequestHeader } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Record a payment from the web admin (`submitRecordSubscription`), called as a function. The host and
 * the admin cookie come from the shared `next/headers` stub (setup-mocks.ts, request-stubs.ts); only
 * `next/cache` is mocked. The use case is `setSubscription`, the one behind `subscriptions set`.
 * Written, not run when authored: unverified until `npm run test:integration` has run.
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
const FORM = { slug: "al-nour", plan: "pro", paidUntil: "2027-03-15" };
const subscriptionCount = () => platformDb.subscription.count();
const audits = () => platformDb.platformAuditLog.findMany({ where: { action: "subscription.set" } });

/** A stadium whose first subscription (from creation) ran out on 2026-01-31, so it starts OVERDUE. */
async function overdueStadium() {
  const { submitCreateStadium } = await actions();
  const created = await submitCreateStadium({ name: "Al Nour", slug: "al-nour", dayStartHour: 6, plan: "basic", paidUntil: "2026-01-31" });
  expect(created.ok).toBe(true);
}

describe("submitRecordSubscription", () => {
  it("writes one Subscription row and one audit row, both by admin:<id>", async () => {
    await overdueStadium();
    const { submitRecordSubscription } = await actions();
    const rowsBefore = await subscriptionCount();
    const auditsBefore = (await audits()).length;

    const result = await submitRecordSubscription({ ...FORM, amountUsd: "25", note: "cash, October" });
    expect(result).toEqual({ ok: true });

    expect(await subscriptionCount()).toBe(rowsBefore + 1);
    const row = await platformDb.subscription.findFirstOrThrow({ where: { plan: "pro" } });
    expect(row.recordedBy).toBe(`admin:${adminId}`);
    expect(row.paidUntil?.toISOString()).toBe("2027-03-15T00:00:00.000Z");
    expect(row.amountUsd?.toFixed(2)).toBe("25.00");
    expect(row.note).toBe("cash, October");

    const written = await audits();
    expect(written).toHaveLength(auditsBefore + 1);
    const audit = written.find((entry) => entry.actor === `admin:${adminId}`)!;
    expect(audit.tenantId).toBe(row.tenantId);
    expect(audit.detail).toMatchObject({ plan: "pro", paidUntil: "2027-03-15T00:00:00.000Z", amountUsd: "25.00", note: "cash, October" });
  });

  it("puts the new row at the top of the history and clears OVERDUE in the detail and in the list", async () => {
    await overdueStadium();
    const now = new Date("2026-10-12T09:00:00Z");
    expect((await getTenantDetail({ slug: "al-nour", now })).overdue).toBe(true);
    expect((await listTenants({ now })).find((row) => row.slug === "al-nour")?.overdue).toBe(true);

    const { submitRecordSubscription } = await actions();
    expect(await submitRecordSubscription(FORM)).toEqual({ ok: true });

    const detail = await getTenantDetail({ slug: "al-nour", now });
    expect(detail.subscriptions.map((row) => row.plan)).toEqual(["pro", "basic"]);
    expect(detail.subscriptions[0]).toMatchObject({ recordedBy: `admin:${adminId}`, amountUsd: null, note: null });
    expect(detail.overdue).toBe(false);
    const listed = (await listTenants({ now })).find((row) => row.slug === "al-nour");
    expect(listed).toMatchObject({ plan: "pro", overdue: false });
  });

  it("keeps earlier rows as they were (append-only)", async () => {
    await overdueStadium();
    const before = await platformDb.subscription.findMany({ orderBy: { createdAt: "asc" } });
    const { submitRecordSubscription } = await actions();
    await submitRecordSubscription(FORM);
    await submitRecordSubscription({ ...FORM, paidUntil: "2027-04-15" });

    const after = await platformDb.subscription.findMany({ orderBy: { createdAt: "asc" } });
    expect(after).toHaveLength(before.length + 2);
    expect(after.slice(0, before.length)).toEqual(before);
  });

  it("accepts a paid-until in the past, as the use case and the CLI do: the stadium stays OVERDUE", async () => {
    await overdueStadium();
    const { submitRecordSubscription } = await actions();
    const rowsBefore = await subscriptionCount();

    expect(await submitRecordSubscription({ ...FORM, paidUntil: "2025-06-30" })).toEqual({ ok: true });

    expect(await subscriptionCount()).toBe(rowsBefore + 1);
    const detail = await getTenantDetail({ slug: "al-nour", now: new Date("2026-10-12T09:00:00Z") });
    expect(detail.subscriptions[0]?.paidUntil?.toISOString()).toBe("2025-06-30T00:00:00.000Z");
    expect(detail.overdue).toBe(true);
  });

  it("refuses bad input with the use case's copy key and writes nothing", async () => {
    await overdueStadium();
    const { submitRecordSubscription } = await actions();
    const rowsBefore = await subscriptionCount();
    const auditsBefore = (await audits()).length;

    expect(await submitRecordSubscription({ ...FORM, plan: "   " })).toEqual({ ok: false, errorKey: "platform.plan_required" });
    expect(await submitRecordSubscription({ ...FORM, plan: "x".repeat(41) })).toEqual({ ok: false, errorKey: "platform.plan_too_long" });
    expect(await submitRecordSubscription({ ...FORM, amountUsd: "12.345" })).toEqual({ ok: false, errorKey: "platform.amount_invalid" });
    expect(await submitRecordSubscription({ ...FORM, amountUsd: "-5" })).toEqual({ ok: false, errorKey: "platform.amount_invalid" });
    expect(await submitRecordSubscription({ ...FORM, note: "n".repeat(201) })).toEqual({ ok: false, errorKey: "platform.note_too_long" });
    expect(await submitRecordSubscription({ ...FORM, paidUntil: "" })).toEqual({ ok: false, errorKey: "platform.paid_until_invalid" });
    expect(await submitRecordSubscription({ ...FORM, paidUntil: "2027-02-31" })).toEqual({ ok: false, errorKey: "platform.paid_until_invalid" });
    expect(await submitRecordSubscription({ ...FORM, slug: "no-such-stadium" })).toEqual({ ok: false, errorKey: "platform.tenant_not_found" });

    expect(await subscriptionCount()).toBe(rowsBefore);
    expect(await audits()).toHaveLength(auditsBefore);
  });

  it("treats an empty amount and note as none", async () => {
    await overdueStadium();
    const { submitRecordSubscription } = await actions();
    expect(await submitRecordSubscription({ ...FORM, amountUsd: "", note: "  " })).toEqual({ ok: true });
    const row = await platformDb.subscription.findFirstOrThrow({ where: { plan: "pro" } });
    expect(row.amountUsd).toBeNull();
    expect(row.note).toBeNull();
  });
});

describe("without a session or off the bare host", () => {
  it("is refused without a session and writes nothing", async () => {
    await overdueStadium();
    const { submitRecordSubscription } = await actions();
    const rowsBefore = await subscriptionCount();
    const auditsBefore = (await audits()).length;

    clearRequestStubs(); // no admin cookie (and a fresh React.cache)
    setRequestHeader("host", BARE_HOST);
    expect(await submitRecordSubscription(FORM)).toEqual({ ok: false, errorKey: "platform.not_signed_in" });

    expect(await subscriptionCount()).toBe(rowsBefore);
    expect(await audits()).toHaveLength(auditsBefore);
  });

  it("answers 404 off the bare host, even with a valid session", async () => {
    await overdueStadium();
    const { submitRecordSubscription } = await actions();
    const rowsBefore = await subscriptionCount();

    setRequestHeader("host", "al-nour.lebstads.test");
    await expect(submitRecordSubscription(FORM)).rejects.toMatchObject({ digest: expect.stringContaining("404") });

    expect(await subscriptionCount()).toBe(rowsBefore);
  });
});

describe("the CLI path", () => {
  it("is unchanged: setSubscription with a cli actor writes the same two rows", async () => {
    await overdueStadium();
    const rowsBefore = await subscriptionCount();

    await setSubscription({ slug: "al-nour", plan: "pro", paidUntil: new Date("2027-03-15T00:00:00Z"), amountUsd: "25", note: "cli", actor: "cli:ops@host" });

    expect(await subscriptionCount()).toBe(rowsBefore + 1);
    const row = await platformDb.subscription.findFirstOrThrow({ where: { note: "cli" } });
    expect(row.recordedBy).toBe("cli:ops@host");
    const audit = (await audits()).find((entry) => entry.actor === "cli:ops@host");
    expect(audit?.detail).toMatchObject({ plan: "pro", amountUsd: "25.00", note: "cli" });
  });
});
