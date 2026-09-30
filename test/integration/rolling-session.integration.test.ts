import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";
import { platformDb } from "@/lib/platform-db";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { login } from "@/modules/access/application/login";
import { hashSessionToken } from "@/modules/access/infrastructure/session-token";
import { proxy } from "@/proxy";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug, writtenCookies } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Rolling session end to end: a browser cookie jar, the proxy's cookie renewal
 * and the DB renewal in getCurrentMembership, with only Date faked.
 */
const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date("2026-10-01T10:00:00.000Z").getTime();
const HOST = "test-stadium.lebstads.test";

type Jar = Map<string, { value: string; expiresAt: number }>;

let fixture: TestFixture;
let jar: Jar;

function setDay(day: number) {
  jest.setSystemTime(T0 + day * DAY);
}

/** Keep what the server set, like a browser: Max-Age from now; 0 or past deletes. */
function store(name: string, value: string, maxAgeSeconds: number | undefined) {
  if (maxAgeSeconds === undefined) throw new Error(`${name} has no Max-Age`);
  if (maxAgeSeconds <= 0) jar.delete(name);
  else jar.set(name, { value, expiresAt: Date.now() + maxAgeSeconds * 1000 });
}

/** Cookies the browser still has (expired ones dropped). */
function cookieHeader(): string {
  const now = Date.now();
  return [...jar]
    .filter(([, cookie]) => cookie.expiresAt > now)
    .map(([name, cookie]) => `${name}=${cookie.value}`)
    .join("; ");
}

async function loginInBrowser() {
  clearRequestStubs();
  setTenantSlug(fixture.tenantSlug);
  await login({ identifier: fixture.ownerIdentifier, password: "test-owner-password" });
  for (const cookie of writtenCookies()) {
    store(cookie.name, cookie.value, cookie.maxAge as number | undefined);
  }
}

/** One page view: the proxy runs (may renew the cookie), then the page reads the session. */
async function openPage(): Promise<boolean> {
  const header = cookieHeader();
  const response = proxy(
    new NextRequest(`http://${HOST}/owner/today`, {
      headers: header ? { host: HOST, cookie: header } : { host: HOST },
    }),
  );
  for (const cookie of response.cookies.getAll()) {
    store(cookie.name, cookie.value, cookie.maxAge);
  }
  const session = header.match(/(?:^|; )stadium_session=([^;]+)/)?.[1];
  clearRequestStubs();
  setTenantSlug(fixture.tenantSlug);
  if (session) setSessionCookie(session);
  return (await getCurrentMembership()) !== null;
}

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  jest.useFakeTimers({
    now: T0,
    doNotFake: [
      "hrtime",
      "nextTick",
      "performance",
      "queueMicrotask",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "requestIdleCallback",
      "cancelIdleCallback",
      "setImmediate",
      "clearImmediate",
      "setInterval",
      "clearInterval",
      "setTimeout",
      "clearTimeout",
    ],
  });
  await truncateAll();
  fixture = await seedMinimalFixture();
  jar = new Map();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("rolling session end to end", () => {
  it("a session used on day 25 is still valid on day 50", async () => {
    await loginInBrowser();
    expect(await openPage()).toBe(true);

    setDay(25);
    expect(await openPage()).toBe(true);

    setDay(50);
    expect(cookieHeader()).toContain("stadium_session=");
    expect(await openPage()).toBe(true);
  });

  it("a session unused for 31 days is rejected: the cookie is gone and the row has expired", async () => {
    await loginInBrowser();
    const token = jar.get("stadium_session")!.value;

    setDay(31);
    expect(cookieHeader()).not.toContain("stadium_session=");
    expect(await openPage()).toBe(false);

    // Even a client that kept the cookie is refused by the database expiry.
    clearRequestStubs();
    setTenantSlug(fixture.tenantSlug);
    setSessionCookie(token);
    expect(await getCurrentMembership()).toBeNull();
  });

  it("cookie and database expiry stay within a day of each other through renewals", async () => {
    await loginInBrowser();
    for (const day of [0, 0.5, 1, 2, 10, 25, 25.9, 26, 49]) {
      setDay(day);
      expect(await openPage()).toBe(true);
      const cookie = jar.get("stadium_session")!;
      const row = await platformDb.session.findUniqueOrThrow({
        where: { tokenHash: hashSessionToken(cookie.value) },
      });
      const cookieExpiry = cookie.expiresAt;
      expect(Math.abs(cookieExpiry - row.expiresAt.getTime())).toBeLessThanOrEqual(DAY);
    }
  });
});
