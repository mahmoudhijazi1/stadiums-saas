/** @jest-environment node */
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

/**
 * Rolling session cookie: Server Components cannot set cookies
 * (cookies.md), so the proxy re-issues the session cookie on GET, at most once
 * a day (a day-long marker cookie).
 */
const savedBase = process.env.APP_BASE_DOMAIN;
beforeAll(() => {
  process.env.APP_BASE_DOMAIN = "lebstads.test";
});
afterAll(() => {
  process.env.APP_BASE_DOMAIN = savedBase;
});

function get(cookie?: string, method = "GET") {
  const headers = new Headers({ host: "ahmad.lebstads.test" });
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest("http://ahmad.lebstads.test/owner/today", { method, headers });
}

function setCookies(response: Response): string[] {
  return response.headers.getSetCookie();
}

describe("proxy session cookie refresh", () => {
  it("re-issues the session cookie for 30 days with the same value and flags, plus the marker", () => {
    const cookies = setCookies(proxy(get("stadium_session=tok_123")));
    const session = cookies.find((line) => line.startsWith("stadium_session="));
    expect(session).toBeDefined();
    expect(session).toContain("stadium_session=tok_123;");
    expect(session).toMatch(/Max-Age=2592000/i);
    expect(session).toMatch(/HttpOnly/i);
    expect(session).toMatch(/SameSite=lax/i);
    expect(session).toMatch(/Path=\//i);
    expect(session).not.toMatch(/Domain=/i);
    const marker = cookies.find((line) => line.startsWith("stadium_session_renewed="));
    expect(marker).toMatch(/Max-Age=86400/i);
  });

  it("does nothing while the day-long marker is present", () => {
    expect(setCookies(proxy(get("stadium_session=tok_123; stadium_session_renewed=1")))).toEqual([]);
  });

  it("does nothing without a session cookie, or on POST (login and logout write the cookie themselves)", () => {
    expect(setCookies(proxy(get()))).toEqual([]);
    expect(setCookies(proxy(get("stadium_session=tok_123", "POST")))).toEqual([]);
  });
});

describe("proxy host check (security audit S-9, S-10, S-11)", () => {
  function at(host: string, headers: Record<string, string> = {}) {
    return proxy(
      new NextRequest(`http://${host}/owner/today`, { headers: { host, ...headers } }),
    );
  }

  it("answers 404 before any tenant lookup for a host outside the base domain", () => {
    for (const host of ["ahmad.attacker.example", "a.b.lebstads.test", "evil-lebstads.test", "127.0.0.1:3000"]) {
      expect(at(host).status).toBe(404);
    }
  });

  it("lets a tenant subdomain and the bare domain through", () => {
    expect(at("ahmad.lebstads.test").status).toBe(200);
    expect(at("lebstads.test").status).toBe(200);
  });

  it("never forwards a client-supplied x-tenant-slug", () => {
    const response = at("ahmad.lebstads.test", { "x-tenant-slug": "sami" });
    expect(response.headers.get("x-middleware-request-x-tenant-slug")).toBeNull();
    const overridden = response.headers.get("x-middleware-override-headers") ?? "";
    // Either the header is dropped from the forwarded set or it was never there.
    expect(overridden.split(",")).not.toContain("x-tenant-slug");
  });
});
