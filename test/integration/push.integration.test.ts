import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import { changeOwnPassword } from "@/modules/access/application/change-own-password";
import { logOutOtherDevices } from "@/modules/access/application/log-out-other-devices";
import { logout } from "@/modules/access/application/logout";
import { createSession, findSessionByToken } from "@/modules/access/infrastructure/sessions";
import { setPushSender } from "@/modules/push/application/push-sender";
import { sendTestPush } from "@/modules/push/application/send-test-push";
import { subscribePush, unsubscribePush } from "@/modules/push/application/subscribe-push";
import { MAX_SUBSCRIPTIONS_PER_USER } from "@/modules/push/infrastructure/subscriptions";
import { FakePushSender } from "../modules/push/fake-push-sender";
import type { TestFixture } from "./fixtures";
import { createStaffSession, seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Web push, slice A: subscribe / unsubscribe / test send against a real database, with a fake
 * PushSender (nothing leaves the machine). The cascade tests prove that deleting a session removes
 * its devices without any push code running.
 */
const KEYS = {
  p256dh: "BHeDxk40V_VmEoDksncIvL-EPPgu9kRGpuh8hZFmBlSzMdAZF_7KRC3qJqTPalJi-Xj7H25lTNxJQFbcsuue5b4",
  auth: "xGdrZRlYJ01Wo07Jn2A6R-",
};
const endpoint = (name: string) => `https://fcm.googleapis.com/fcm/send/${name}`;
const subscribe = (name: string, locale = "en") => subscribePush({ endpoint: endpoint(name), keys: KEYS, locale });

const fake = new FakePushSender();
let fixture: TestFixture;

function actAs(slug: string, token: string) {
  clearRequestStubs();
  setTenantSlug(slug);
  setSessionCookie(token);
}

async function endpointsOf(userId: string): Promise<string[]> {
  const rows = await platformDb.pushSubscription.findMany({ where: { userId }, select: { endpoint: true } });
  return rows.map((row) => row.endpoint).sort();
}

/** A second stadium with its own owner, next to the fixture. */
const seedOther = () =>
  seedMinimalFixture({ tenantSlug: "other-stadium", tenantName: "Other Stadium", ownerIdentifier: "owner@other-stadium" });

const pause = () => new Promise((resolve) => setTimeout(resolve, 4));

afterAll(async () => {
  setPushSender(null);
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
  fake.sent.length = 0;
  fake.results.clear();
  setPushSender(fake);
  fixture = await seedMinimalFixture();
  actAs(fixture.tenantSlug, fixture.sessionId);
});

describe("subscribePush", () => {
  it("stores the caller's device: user, session and tenant come from the session", async () => {
    await subscribe("a");
    const session = await findSessionByToken(fixture.sessionId);
    const rows = await platformDb.pushSubscription.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tenantId: fixture.tenantId,
      userId: fixture.ownerUserId,
      sessionId: session?.id,
      endpoint: endpoint("a"),
      locale: "en",
    });
  });

  it("is idempotent: the same endpoint twice is one row, with the latest keys and locale", async () => {
    await subscribe("a", "en");
    await subscribe("a", "ar");
    const rows = await platformDb.pushSubscription.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.locale).toBe("ar");
  });

  it("refuses without a login", async () => {
    clearRequestStubs();
    setTenantSlug(fixture.tenantSlug);
    await expect(subscribe("a")).rejects.toMatchObject({ key: "access.not_allowed" });
    await expect(sendTestPush()).rejects.toMatchObject({ key: "access.not_allowed" });
    await expect(unsubscribePush({ endpoint: endpoint("a") })).rejects.toMatchObject({ key: "access.not_allowed" });
    expect(await platformDb.pushSubscription.count()).toBe(0);
  });

  it("refuses a session that belongs to nobody in this stadium", async () => {
    // The other stadium's owner has no membership here: this URL with that cookie is refused.
    const other = await seedOther();
    actAs(fixture.tenantSlug, other.sessionId);
    await expect(subscribe("a")).rejects.toMatchObject({ key: "access.not_allowed" });
    expect(await platformDb.pushSubscription.count()).toBe(0);
  });

  it("refuses a suspended tenant, for every action", async () => {
    await subscribe("a");
    await platformDb.tenant.update({ where: { id: fixture.tenantId }, data: { suspendedAt: new Date() } });
    actAs(fixture.tenantSlug, fixture.sessionId);
    await expect(subscribe("b")).rejects.toMatchObject({ key: "access.not_allowed" });
    await expect(sendTestPush()).rejects.toMatchObject({ key: "access.not_allowed" });
    await expect(unsubscribePush({ endpoint: endpoint("a") })).rejects.toMatchObject({ key: "access.not_allowed" });
    expect(await platformDb.pushSubscription.count()).toBe(1);
    expect(fake.sent).toHaveLength(0);
  });

  it("refuses an endpoint off the allowlist and bad keys, and stores nothing", async () => {
    const bad = [
      "http://fcm.googleapis.com/fcm/send/a",
      "https://fcm.googleapis.com.evil.com/x",
      "https://169.254.169.254/latest/meta-data",
      "https://localhost/x",
      "https://user@fcm.googleapis.com/x",
      "https://fcm.googleapis.com:8443/x",
    ];
    for (const url of bad) {
      await expect(subscribePush({ endpoint: url, keys: KEYS, locale: "en" })).rejects.toMatchObject({
        key: "push.invalid_subscription",
      });
    }
    await expect(
      subscribePush({ endpoint: endpoint("a"), keys: { p256dh: "short", auth: KEYS.auth }, locale: "en" }),
    ).rejects.toMatchObject({ key: "push.invalid_subscription" });
    expect(await platformDb.pushSubscription.count()).toBe(0);
  });

  it(`keeps at most ${MAX_SUBSCRIPTIONS_PER_USER} per user: the oldest go`, async () => {
    for (let i = 0; i < MAX_SUBSCRIPTIONS_PER_USER + 3; i += 1) {
      await subscribe(`d${i}`);
      await pause();
    }
    const kept = await endpointsOf(fixture.ownerUserId);
    expect(kept).toHaveLength(MAX_SUBSCRIPTIONS_PER_USER);
    expect(kept).not.toContain(endpoint("d0"));
    expect(kept).not.toContain(endpoint("d2"));
    expect(kept).toContain(endpoint("d12"));
  });

  it("a device taken over by another user on the same phone moves to that user and session", async () => {
    await subscribe("phone");
    const staffToken = await createStaffSession(fixture.tenantId, {});
    actAs(fixture.tenantSlug, staffToken);
    await subscribe("phone");

    const staff = await findSessionByToken(staffToken);
    const rows = await platformDb.pushSubscription.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: staff?.userId, sessionId: staff?.id });
    expect(await endpointsOf(fixture.ownerUserId)).toEqual([]);
  });

  it("a device taken over in another stadium moves to that tenant", async () => {
    const a = fixture;
    const b = await seedOther();
    actAs(a.tenantSlug, a.sessionId);
    await subscribe("shared-phone");
    actAs(b.tenantSlug, b.sessionId);
    await subscribe("shared-phone");

    const rows = await platformDb.pushSubscription.findMany({ where: { endpoint: endpoint("shared-phone") } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ tenantId: b.tenantId, userId: b.ownerUserId });
  });
});

describe("unsubscribePush", () => {
  it("deletes the caller's own row", async () => {
    await subscribe("a");
    expect(await unsubscribePush({ endpoint: endpoint("a") })).toEqual({ removed: 1 });
    expect(await platformDb.pushSubscription.count()).toBe(0);
  });

  it("never deletes another user's row, even with the right endpoint", async () => {
    await subscribe("owner-phone");
    const staffToken = await createStaffSession(fixture.tenantId, {});
    actAs(fixture.tenantSlug, staffToken);
    expect(await unsubscribePush({ endpoint: endpoint("owner-phone") })).toEqual({ removed: 0 });
    expect(await endpointsOf(fixture.ownerUserId)).toEqual([endpoint("owner-phone")]);
  });

  it("ignores junk input", async () => {
    expect(await unsubscribePush({ endpoint: 42 })).toEqual({ removed: 0 });
    expect(await unsubscribePush({ endpoint: "" })).toEqual({ removed: 0 });
  });
});

describe("the session cascade", () => {
  const second = async () => (await createSession(fixture.ownerUserId, new Date(Date.now() + 86_400_000))).token;

  it("logout removes only that session's devices", async () => {
    await subscribe("here");
    const other = await second();
    actAs(fixture.tenantSlug, other);
    await subscribe("elsewhere");

    await logout();
    expect(await endpointsOf(fixture.ownerUserId)).toEqual([endpoint("here")]);
  });

  it("log out other devices removes theirs and keeps this one's", async () => {
    await subscribe("here");
    const other = await second();
    actAs(fixture.tenantSlug, other);
    await subscribe("elsewhere");

    actAs(fixture.tenantSlug, fixture.sessionId);
    await logOutOtherDevices();
    expect(await endpointsOf(fixture.ownerUserId)).toEqual([endpoint("here")]);
  });

  it("a password change removes the other sessions' devices and keeps this one's", async () => {
    await subscribe("here");
    const other = await second();
    actAs(fixture.tenantSlug, other);
    await subscribe("elsewhere");

    actAs(fixture.tenantSlug, fixture.sessionId);
    await changeOwnPassword({ currentPassword: "test-owner-password", newPassword: "a brand new passphrase" });
    expect(await endpointsOf(fixture.ownerUserId)).toEqual([endpoint("here")]);
  });

  it("an expired session cleanup removes its devices", async () => {
    await subscribe("here");
    await platformDb.session.deleteMany({ where: { userId: fixture.ownerUserId } });
    expect(await platformDb.pushSubscription.count()).toBe(0);
  });
});

describe("sendTestPush", () => {
  it("reaches only the caller's own devices in this stadium", async () => {
    await subscribe("owner-1");
    await subscribe("owner-2");
    const staffToken = await createStaffSession(fixture.tenantId, {});
    actAs(fixture.tenantSlug, staffToken);
    await subscribe("staff-1");

    actAs(fixture.tenantSlug, fixture.sessionId);
    const result = await sendTestPush();
    expect(result).toEqual({ devices: 2, sent: 2, removed: 0, failed: 0 });
    expect(fake.endpoints().sort()).toEqual([endpoint("owner-1"), endpoint("owner-2")]);
  });

  it("sends a small generic payload with TTL 60 s, high urgency and a topic", async () => {
    await subscribe("a", "ar");
    await sendTestPush();
    const [sent] = fake.sent;
    expect(sent?.options).toEqual({ ttlSeconds: 60, urgency: "high", topic: "owner-test" });
    const payload = JSON.parse(sent!.payload);
    expect(payload).toMatchObject({ kind: "TEST", title: "Test Stadium", lang: "ar", dir: "rtl", url: "/owner/more" });
    expect(sent!.payload).not.toContain(fixture.ownerIdentifier);
  });

  it("never reaches another stadium, even for a user who belongs to both", async () => {
    const a = fixture;
    const b = await seedOther();
    // The same person works at both stadiums.
    await platformDb.membership.create({
      data: { tenantId: b.tenantId, userId: a.ownerUserId, role: "STAFF", permissions: {} },
    } as Parameters<typeof platformDb.membership.create>[0]);

    actAs(a.tenantSlug, a.sessionId);
    await subscribe("in-a");
    actAs(b.tenantSlug, a.sessionId);
    await subscribe("in-b");
    actAs(b.tenantSlug, b.sessionId);
    await subscribe("b-owner");

    fake.sent.length = 0;
    actAs(a.tenantSlug, a.sessionId);
    await sendTestPush();
    // "in-b" was last registered from tenant B's URL, so it is B's row; A sends to A's only.
    expect(fake.endpoints()).toEqual([endpoint("in-a")]);

    fake.sent.length = 0;
    actAs(b.tenantSlug, b.sessionId);
    await sendTestPush();
    expect(fake.endpoints()).toEqual([endpoint("b-owner")]);
  });

  it("404 and 410 delete the row; a 500 keeps it", async () => {
    await subscribe("gone-404");
    await subscribe("gone-410");
    await subscribe("flaky");
    await subscribe("fine");
    fake.results.set(endpoint("gone-404"), { outcome: "gone", statusCode: 404 });
    fake.results.set(endpoint("gone-410"), { outcome: "gone", statusCode: 410 });
    fake.results.set(endpoint("flaky"), { outcome: "retry", statusCode: 500 });

    expect(await sendTestPush()).toEqual({ devices: 4, sent: 1, removed: 2, failed: 1 });
    expect(await endpointsOf(fixture.ownerUserId)).toEqual([endpoint("fine"), endpoint("flaky")]);
  });

  it("is limited to 5 per 10 minutes per user, counted before sending", async () => {
    await subscribe("a");
    for (let i = 0; i < 5; i += 1) await sendTestPush();
    await expect(sendTestPush()).rejects.toMatchObject({ key: "push.rate_limited" });
    expect(fake.sent).toHaveLength(5);
    const row = await platformDb.rateLimit.findUnique({ where: { key: `pushtest:${fixture.ownerUserId}` } });
    expect(row?.count).toBe(6);
  });

  it("another user has their own allowance", async () => {
    await subscribe("a");
    for (let i = 0; i < 6; i += 1) await sendTestPush().catch(() => undefined);
    const staffToken = await createStaffSession(fixture.tenantId, {});
    actAs(fixture.tenantSlug, staffToken);
    await subscribe("s");
    await expect(sendTestPush()).resolves.toMatchObject({ sent: 1 });
  });

  it("says so when the server has no VAPID keys, and sends nothing", async () => {
    await subscribe("a");
    const saved = process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    try {
      await expect(sendTestPush()).rejects.toMatchObject({ key: "push.not_configured" });
    } finally {
      process.env.VAPID_PRIVATE_KEY = saved;
    }
    expect(fake.sent).toHaveLength(0);
  });
});
