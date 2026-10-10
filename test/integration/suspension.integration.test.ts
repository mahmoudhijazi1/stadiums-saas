import { afterAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import { getCurrentTenant, getCurrentTenantId } from "@/lib/tenant-context";
import { GET as liveGet } from "@/app/owner/(app)/requests/live/route";
import SuspendedPage from "@/app/owner/suspended/page";
import LoginPage from "@/app/owner/login/page";
import { requireOwnerMembership } from "@/app/owner/shared";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { login } from "@/modules/access/application/login";
import { listPendingRequests } from "@/modules/booking/application/list-pending-requests";
import { requestPublicSlot } from "@/modules/booking/application/request-public-slot";
import { parsePublicSlotRequest } from "@/modules/booking/schemas/public-slot-request";
import {
  addCalendarDays,
  civilDateInTimeZone,
  generateSlotsForDay,
} from "@/modules/venue/domain/availability";
import { parseScheduleConfig } from "@/modules/venue/domain/schedule-config";
import type { TestFixture } from "./fixtures";
import { seedTwoTenants } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Decision 7: a suspended tenant is refused at the tenant-resolution choke
 * point. Owners land on /owner/suspended, the poll answers 403, public writes
 * are refused, and resume restores everything (nothing deleted).
 */
let a: TestFixture;
let b: TestFixture;

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
  ({ a, b } = await seedTwoTenants());
});

function as(fixture: TestFixture, withSession = true) {
  clearRequestStubs();
  setTenantSlug(fixture.tenantSlug);
  if (withSession) setSessionCookie(fixture.sessionId);
}

async function setSuspended(fixture: TestFixture, suspended: boolean) {
  await platformDb.tenant.update({
    where: { id: fixture.tenantId },
    data: suspended
      ? { suspendedAt: new Date(), suspendedReason: "unpaid" }
      : { suspendedAt: null, suspendedReason: null },
  });
}

async function digestOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "no redirect";
  } catch (error) {
    return String((error as { digest?: string }).digest ?? error);
  }
}

async function slotFor(fixture: TestFixture) {
  const pitch = await platformDb.pitch.findUniqueOrThrow({ where: { id: fixture.pitchId } });
  const [slot] = generateSlotsForDay({
    config: parseScheduleConfig(pitch.scheduleConfig),
    localDate: addCalendarDays(civilDateInTimeZone(new Date(), "Asia/Beirut"), 2),
    timeZone: "Asia/Beirut",
    occupied: [],
  });
  return { start: slot!.start.toISOString(), end: slot!.end.toISOString() };
}

async function publicRequest(fixture: TestFixture) {
  as(fixture, false);
  return requestPublicSlot(
    parsePublicSlotRequest({ name: "Ali", phone: "03111001", pitchId: fixture.pitchId, ...(await slotFor(fixture)) }),
  );
}

async function rowCounts() {
  return {
    bookings: await platformDb.booking.count(),
    persons: await platformDb.person.count(),
    sessions: await platformDb.session.count(),
    rateLimits: await platformDb.rateLimit.count(),
    memberships: await platformDb.membership.count(),
  };
}

describe("owner side under suspension", () => {
  it("membership is null and owner use cases are refused as access.not_allowed", async () => {
    await setSuspended(a, true);
    as(a);
    expect(await getCurrentMembership()).toBeNull();
    await expect(listPendingRequests()).rejects.toMatchObject({ key: "access.not_allowed" });
  });

  it("any tenant data access fails at the choke point", async () => {
    await setSuspended(a, true);
    as(a);
    await expect(getCurrentTenantId()).rejects.toMatchObject({ key: "tenant.suspended" });
  });

  it("owner pages redirect to /owner/suspended, never to /owner/login", async () => {
    await setSuspended(a, true);
    as(a);
    expect(await digestOf(requireOwnerMembership())).toContain("/owner/suspended");
    as(a, false);
    expect(await digestOf(requireOwnerMembership())).toContain("/owner/suspended");
  });

  it("the login page and the login use case go to the suspended state without counting a failure", async () => {
    await setSuspended(a, true);
    as(a, false);
    expect(
      await digestOf(LoginPage({ searchParams: Promise.resolve({}) } as Parameters<typeof LoginPage>[0])),
    ).toContain("/owner/suspended");
    as(a, false);
    await expect(login({ identifier: a.ownerIdentifier, password: "wrong-password" })).rejects.toMatchObject({
      key: "tenant.suspended",
    });
    expect(await platformDb.rateLimit.count()).toBe(0);
  });

  it("the suspended page renders when suspended and sends active tenants to /owner/today (no loop)", async () => {
    await setSuspended(a, true);
    as(a);
    expect(await digestOf(SuspendedPage())).toBe("no redirect");
    await setSuspended(a, false);
    as(a);
    expect(await digestOf(SuspendedPage())).toContain("/owner/today");
  });

  it("the live poll answers 403 with the tenant_suspended code", async () => {
    await setSuspended(a, true);
    as(a);
    const response = await liveGet();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "tenant_suspended" });
  });
});

describe("public side under suspension", () => {
  it("requestPublicSlot refuses and writes nothing (no booking, person or rate counter)", async () => {
    await setSuspended(a, true);
    const before = await rowCounts();
    await expect(publicRequest(a)).rejects.toMatchObject({ key: "tenant.suspended" });
    expect(await rowCounts()).toEqual(before);
  });
});

describe("isolation and resume", () => {
  it("another tenant is unaffected", async () => {
    await setSuspended(a, true);
    as(b);
    expect(await getCurrentMembership()).not.toBeNull();
    await expect(publicRequest(b)).resolves.toMatchObject({ bookingId: expect.any(String) });
  });

  it("resume restores everything: same session valid, no rows deleted", async () => {
    await publicRequest(a);
    const before = await rowCounts();
    await setSuspended(a, true);
    as(a);
    expect(await getCurrentMembership()).toBeNull();
    await setSuspended(a, false);
    as(a);
    expect((await getCurrentMembership())?.userId).toBe(a.ownerUserId);
    expect((await listPendingRequests()).length).toBe(1);
    expect(await rowCounts()).toEqual(before);
  });

  it("adds no query: one tenant lookup serves the whole request", async () => {
    await setSuspended(a, true);
    as(a);
    const spy = jest.spyOn(platformDb.tenant, "findUnique");
    expect((await getCurrentTenant()).suspended).toBe(true);
    await getCurrentMembership();
    await digestOf(requireOwnerMembership());
    await getCurrentTenantId().catch(() => undefined);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
