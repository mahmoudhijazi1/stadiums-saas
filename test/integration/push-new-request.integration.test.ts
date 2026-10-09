import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import { alertOwnersOfNewRequest } from "@/app/(public)/alert-owners";
import { submitPublicSlotRequest } from "@/app/(public)/request-slot";
import { createOwnerBooking } from "@/modules/booking/application/create-owner-booking";
import { requestPublicSlot } from "@/modules/booking/application/request-public-slot";
import { setPushSender } from "@/modules/push/application/push-sender";
import { ALERT_SEND_TIMEOUT_MS, notifyNewRequest } from "@/modules/push/application/notify-new-request";
import { subscribePush } from "@/modules/push/application/subscribe-push";
import {
  addCalendarDays,
  civilDateInTimeZone,
  generateSlotsForDay,
} from "@/modules/venue/domain/availability";
import { parseScheduleConfig } from "@/modules/venue/schemas/schedule-config";
import { FakePushSender } from "../modules/push/fake-push-sender";
import type { TestFixture } from "./fixtures";
import { createStaffSession, seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Slice B: the new-request alert. NOT RUN when written (the task forbade running suites): read
 * these as unverified until `npm run test:integration` has been run.
 *
 * The real sender is replaced by a fake. `after()` from next/server only works inside a request,
 * so it is replaced with a list of the callbacks the action mockScheduled; a test runs them by hand.
 */
const mockScheduled: (() => unknown)[] = [];

jest.mock("next/server", () => ({
  ...jest.requireActual("next/server"),
  after: (callback: () => unknown) => {
    mockScheduled.push(callback);
  },
}));

jest.mock("next/navigation", () => ({
  ...jest.requireActual("next/navigation"),
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const TIME_ZONE = "Asia/Beirut";
const KEYS = {
  p256dh: "BHeDxk40V_VmEoDksncIvL-EPPgu9kRGpuh8hZFmBlSzMdAZF_7KRC3qJqTPalJi-Xj7H25lTNxJQFbcsuue5b4",
  auth: "xGdrZRlYJ01Wo07Jn2A6R-",
};
const endpoint = (name: string) => `https://fcm.googleapis.com/fcm/send/${name}`;
const WINDOW_AGO_MS = 121 * 1000;

const fake = new FakePushSender();
let fixture: TestFixture;

function actAs(slug: string, token?: string) {
  clearRequestStubs();
  setTenantSlug(slug);
  if (token) setSessionCookie(token);
}

async function subscribeAs(slug: string, token: string, name: string, locale = "en") {
  actAs(slug, token);
  await subscribePush({ endpoint: endpoint(name), keys: KEYS, locale });
}

async function slot(daysAhead: number, index = 0) {
  const pitch = await platformDb.pitch.findFirstOrThrow({ where: { tenantId: fixture.tenantId } });
  const day = addCalendarDays(civilDateInTimeZone(new Date(), TIME_ZONE), daysAhead);
  const slots = generateSlotsForDay({
    config: parseScheduleConfig(pitch.scheduleConfig),
    localDate: day,
    timeZone: TIME_ZONE,
    occupied: [],
  });
  const found = slots[index];
  if (!found) throw new Error("no slot");
  return { pitchId: pitch.id, start: found.start.toISOString(), end: found.end.toISOString() };
}

/** A public request, as a player: no session. */
async function playerRequests(name: string, phone: string, daysAhead: number) {
  actAs(fixture.tenantSlug);
  const chosen = await slot(daysAhead);
  await requestPublicSlot({ ...chosen, name, phone });
}

function payloadsTo(name: string) {
  return fake.sent
    .filter((entry) => entry.target.endpoint === endpoint(name))
    .map((entry) => JSON.parse(entry.payload) as Record<string, string>);
}

/** Make every throttle window look old, as if 121 seconds had passed. */
async function ageThrottle() {
  await platformDb.rateLimit.updateMany({
    where: { key: { startsWith: "pushalert:" } },
    data: { windowStart: new Date(Date.now() - WINDOW_AGO_MS) },
  });
}

afterAll(async () => {
  setPushSender(null);
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
  mockScheduled.length = 0;
  fake.sent.length = 0;
  fake.results.clear();
  setPushSender(fake);
  fixture = await seedMinimalFixture();
});

describe("who is alerted", () => {
  it("the owner and a staff member with bookings.approve, every device of each; not staff without it", async () => {
    const granted = await createStaffSession(fixture.tenantId, { "bookings.approve": true });
    const plain = await createStaffSession(fixture.tenantId, {});
    await subscribeAs(fixture.tenantSlug, fixture.sessionId, "owner-phone");
    await subscribeAs(fixture.tenantSlug, fixture.sessionId, "owner-tablet");
    await subscribeAs(fixture.tenantSlug, granted, "granted-phone");
    await subscribeAs(fixture.tenantSlug, plain, "plain-phone");

    await playerRequests("ليلى", "03111001", 3);
    await alertOwnersOfNewRequest();

    expect(fake.endpoints().sort()).toEqual(
      [endpoint("granted-phone"), endpoint("owner-phone"), endpoint("owner-tablet")].sort(),
    );
  });

  it("another stadium's members and devices are never alerted", async () => {
    const other = await seedMinimalFixture({
      tenantSlug: "other-stadium",
      tenantName: "Other Stadium",
      ownerIdentifier: "owner@other-stadium",
    });
    await subscribeAs(fixture.tenantSlug, fixture.sessionId, "mine");
    await subscribeAs(other.tenantSlug, other.sessionId, "theirs");

    await playerRequests("ليلى", "03111001", 3);
    await alertOwnersOfNewRequest();

    expect(fake.endpoints()).toEqual([endpoint("mine")]);
  });
});

describe("what is sent", () => {
  it("is generic, localized per device, and carries no name or phone", async () => {
    const granted = await createStaffSession(fixture.tenantId, { "bookings.approve": true });
    await subscribeAs(fixture.tenantSlug, fixture.sessionId, "arabic", "ar");
    await subscribeAs(fixture.tenantSlug, granted, "english", "en");

    await playerRequests("ليلى", "03111001", 3);
    await alertOwnersOfNewRequest();

    const [arabic] = payloadsTo("arabic");
    const [english] = payloadsTo("english");
    expect(arabic).toMatchObject({
      kind: "NEW_REQUEST",
      title: "Test Stadium",
      body: "طلب حجز جديد",
      tag: "new-requests",
      url: "/owner/requests",
      lang: "ar",
      dir: "rtl",
    });
    expect(english).toMatchObject({ body: "New booking request", lang: "en", dir: "ltr" });

    for (const entry of fake.sent) {
      expect(entry.payload).not.toContain("ليلى");
      expect(entry.payload).not.toContain("03111001");
      expect(new TextEncoder().encode(entry.payload).length).toBeLessThan(1024);
      expect(entry.options).toEqual({ ttlSeconds: 21600, urgency: "high", topic: "new-requests" });
    }
  });
});

describe("the throttle", () => {
  it("a second request within 120 s sends nothing; one after the window sends the updated count", async () => {
    await subscribeAs(fixture.tenantSlug, fixture.sessionId, "phone", "en");

    await playerRequests("ليلى", "03111001", 3);
    await alertOwnersOfNewRequest();
    expect(payloadsTo("phone").map((p) => p.body)).toEqual(["New booking request"]);

    await playerRequests("سامي", "03111002", 4);
    await alertOwnersOfNewRequest();
    expect(fake.sent).toHaveLength(1);

    await ageThrottle();
    await alertOwnersOfNewRequest();
    expect(payloadsTo("phone").map((p) => p.body)).toEqual(["New booking request", "2 requests waiting"]);
  });

  it("is per device: one throttled phone does not silence another", async () => {
    await subscribeAs(fixture.tenantSlug, fixture.sessionId, "first");
    await playerRequests("ليلى", "03111001", 3);
    await alertOwnersOfNewRequest();

    await subscribeAs(fixture.tenantSlug, fixture.sessionId, "second");
    await playerRequests("سامي", "03111002", 4);
    await alertOwnersOfNewRequest();

    expect(fake.endpoints()).toEqual([endpoint("first"), endpoint("second")]);
  });
});

describe("what does not alert", () => {
  it("an owner-created booking", async () => {
    await subscribeAs(fixture.tenantSlug, fixture.sessionId, "phone");
    const chosen = await slot(3);
    actAs(fixture.tenantSlug, fixture.sessionId);
    await createOwnerBooking({ ...chosen, name: "هدى", phone: "03111005" });

    expect(mockScheduled).toHaveLength(0);
    expect(fake.sent).toHaveLength(0);
  });

  it("the slot-taken branch: the action schedules no alert", async () => {
    await subscribeAs(fixture.tenantSlug, fixture.sessionId, "phone");
    const chosen = await slot(3);
    actAs(fixture.tenantSlug, fixture.sessionId);
    await createOwnerBooking({ ...chosen, name: "هدى", phone: "03111005" });

    actAs(fixture.tenantSlug);
    await expect(submitPublicSlotRequest(formFor(chosen, "سامي", "03111002"))).rejects.toThrow(
      /REDIRECT:.*error=booking\.slot_taken_noted/,
    );
    expect(mockScheduled).toHaveLength(0);
    expect(fake.sent).toHaveLength(0);
  });

  it("a request with no subscriptions is a no-op", async () => {
    await playerRequests("ليلى", "03111001", 3);
    await alertOwnersOfNewRequest();
    expect(fake.sent).toHaveLength(0);
    expect(await notifyNewRequest({ pendingCount: 1 })).toEqual({
      devices: 0,
      sent: 0,
      skipped: 0,
      removed: 0,
      failed: 0,
    });
  });

  it("nothing waiting sends nothing", async () => {
    await subscribeAs(fixture.tenantSlug, fixture.sessionId, "phone");
    actAs(fixture.tenantSlug);
    await notifyNewRequest({ pendingCount: 0 });
    expect(fake.sent).toHaveLength(0);
  });

  it("a suspended stadium sends nothing and does not error", async () => {
    await subscribeAs(fixture.tenantSlug, fixture.sessionId, "phone");
    await playerRequests("ليلى", "03111001", 3);
    await platformDb.tenant.update({ where: { id: fixture.tenantId }, data: { suspendedAt: new Date() } });
    actAs(fixture.tenantSlug);

    await expect(alertOwnersOfNewRequest()).resolves.toBeUndefined();
    expect(fake.sent).toHaveLength(0);
  });

  it("no VAPID keys (development) sends nothing and does not error", async () => {
    await subscribeAs(fixture.tenantSlug, fixture.sessionId, "phone");
    await playerRequests("ليلى", "03111001", 3);
    const saved = process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    try {
      await expect(alertOwnersOfNewRequest()).resolves.toBeUndefined();
    } finally {
      process.env.VAPID_PRIVATE_KEY = saved;
    }
    expect(fake.sent).toHaveLength(0);
  });
});

describe("the action", () => {
  it("a created request schedules the alert, and running it alerts the owner", async () => {
    await subscribeAs(fixture.tenantSlug, fixture.sessionId, "phone");
    const chosen = await slot(3);
    actAs(fixture.tenantSlug);

    await expect(submitPublicSlotRequest(formFor(chosen, "ليلى", "03111001"))).rejects.toThrow(
      /REDIRECT:.*ok=requested/,
    );
    expect(mockScheduled).toHaveLength(1);
    expect(fake.sent).toHaveLength(0); // nothing is sent until the mockScheduled callback runs

    await mockScheduled[0]!();
    expect(fake.endpoints()).toEqual([endpoint("phone")]);
  });
});

describe("failures never reach the player", () => {
  it("a sender that throws: the request succeeded, the alert resolves, the row stays", async () => {
    await subscribeAs(fixture.tenantSlug, fixture.sessionId, "phone");
    setPushSender({
      send: async () => {
        throw new Error("push service exploded with secret-key-material");
      },
    });
    const chosen = await slot(3);
    actAs(fixture.tenantSlug);

    await expect(submitPublicSlotRequest(formFor(chosen, "ليلى", "03111001"))).rejects.toThrow(/ok=requested/);
    await expect(Promise.resolve(mockScheduled[0]!())).resolves.toBeUndefined();
    expect(await platformDb.pushSubscription.count()).toBe(1);
    expect(await platformDb.booking.count({ where: { status: "PENDING" } })).toBe(1);
  });

  it("a sender that never answers is cut off at the timeout, and the alert resolves", async () => {
    await subscribeAs(fixture.tenantSlug, fixture.sessionId, "hang");
    await subscribeAs(fixture.tenantSlug, fixture.sessionId, "fine");
    setPushSender({
      send: (target) =>
        target.endpoint === endpoint("hang") ? new Promise(() => undefined) : Promise.resolve({ outcome: "ok" }),
    });
    await playerRequests("ليلى", "03111001", 3);

    const started = Date.now();
    await expect(alertOwnersOfNewRequest()).resolves.toBeUndefined();
    expect(Date.now() - started).toBeLessThan(ALERT_SEND_TIMEOUT_MS + 3000);
    expect(await platformDb.pushSubscription.count()).toBe(2);
  });

  it("one failing device does not block the others", async () => {
    await subscribeAs(fixture.tenantSlug, fixture.sessionId, "bad");
    await subscribeAs(fixture.tenantSlug, fixture.sessionId, "good");
    setPushSender({
      send: async (target) => {
        if (target.endpoint === endpoint("bad")) throw new Error("boom");
        return { outcome: "ok" };
      },
    });
    await playerRequests("ليلى", "03111001", 3);
    actAs(fixture.tenantSlug);

    expect(await notifyNewRequest({ pendingCount: 1 })).toMatchObject({ devices: 2, sent: 1, failed: 1 });
  });
});

describe("dead and flaky devices", () => {
  it("404 and 410 delete the row; a 500 keeps it", async () => {
    await subscribeAs(fixture.tenantSlug, fixture.sessionId, "gone-404");
    await subscribeAs(fixture.tenantSlug, fixture.sessionId, "gone-410");
    await subscribeAs(fixture.tenantSlug, fixture.sessionId, "flaky");
    fake.results.set(endpoint("gone-404"), { outcome: "gone", statusCode: 404 });
    fake.results.set(endpoint("gone-410"), { outcome: "gone", statusCode: 410 });
    fake.results.set(endpoint("flaky"), { outcome: "retry", statusCode: 500 });

    await playerRequests("ليلى", "03111001", 3);
    await alertOwnersOfNewRequest();

    const left = await platformDb.pushSubscription.findMany({ select: { endpoint: true } });
    expect(left.map((row) => row.endpoint)).toEqual([endpoint("flaky")]);
  });
});

describe("the throttle claim", () => {
  const claimKey = async () => {
    const row = await platformDb.pushSubscription.findFirstOrThrow({ select: { id: true } });
    return `pushalert:${row.id}`;
  };

  it("a retry result frees the window, so the next request can alert again", async () => {
    await subscribeAs(fixture.tenantSlug, fixture.sessionId, "phone");
    actAs(fixture.tenantSlug);
    fake.results.set(endpoint("phone"), { outcome: "retry", statusCode: 500 });

    expect(await notifyNewRequest({ pendingCount: 1 })).toMatchObject({ sent: 0, failed: 1, skipped: 0 });
    expect(await platformDb.rateLimit.findUnique({ where: { key: await claimKey() } })).toBeNull();

    fake.results.clear();
    expect(await notifyNewRequest({ pendingCount: 1 })).toMatchObject({ sent: 1, failed: 0, skipped: 0 });
  });

  it("a send that throws frees the window too", async () => {
    await subscribeAs(fixture.tenantSlug, fixture.sessionId, "phone");
    actAs(fixture.tenantSlug);
    setPushSender({
      send: async () => {
        throw new Error("boom");
      },
    });
    expect(await notifyNewRequest({ pendingCount: 1 })).toMatchObject({ failed: 1 });
    expect(await platformDb.rateLimit.findUnique({ where: { key: await claimKey() } })).toBeNull();
  });

  it("a successful send keeps the claim, so the next request inside 120 s is skipped", async () => {
    await subscribeAs(fixture.tenantSlug, fixture.sessionId, "phone");
    actAs(fixture.tenantSlug);

    expect(await notifyNewRequest({ pendingCount: 1 })).toMatchObject({ sent: 1 });
    expect(await platformDb.rateLimit.findUnique({ where: { key: await claimKey() } })).not.toBeNull();
    expect(await notifyNewRequest({ pendingCount: 2 })).toMatchObject({ sent: 0, skipped: 1 });
    expect(fake.sent).toHaveLength(1);
  });

  it("two concurrent requests still send once (the claim is taken before the send)", async () => {
    await subscribeAs(fixture.tenantSlug, fixture.sessionId, "phone");
    actAs(fixture.tenantSlug);

    const [first, second] = await Promise.all([
      notifyNewRequest({ pendingCount: 1 }),
      notifyNewRequest({ pendingCount: 1 }),
    ]);
    expect(first.sent + second.sent).toBe(1);
    expect(first.skipped + second.skipped).toBe(1);
    expect(fake.sent).toHaveLength(1);
  });

  it("a gone result deletes the row", async () => {
    await subscribeAs(fixture.tenantSlug, fixture.sessionId, "phone");
    actAs(fixture.tenantSlug);
    fake.results.set(endpoint("phone"), { outcome: "gone", statusCode: 410 });

    expect(await notifyNewRequest({ pendingCount: 1 })).toMatchObject({ removed: 1 });
    expect(await platformDb.pushSubscription.count()).toBe(0);
  });
});

function formFor(chosen: { pitchId: string; start: string; end: string }, name: string, phone: string): FormData {
  const form = new FormData();
  form.set("name", name);
  form.set("phone", phone);
  form.set("pitchId", chosen.pitchId);
  form.set("start", chosen.start);
  form.set("end", chosen.end);
  form.set("date", chosen.start.slice(0, 10));
  return form;
}
