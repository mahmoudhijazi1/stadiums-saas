/** @jest-environment node */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
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

/**
 * /platform (the platform admin, DR-006 slice 3). Written, not run when authored. Served only on
 * exactly the bare host, and in production only over https; noindex, no-store; the owner session
 * cookie is not renewed there; the existing invariants hold.
 */
describe("proxy /platform", () => {
  const env = process.env as Record<string, string | undefined>;
  const saved = { NODE_ENV: env.NODE_ENV, APP_PROTOCOL: env.APP_PROTOCOL };
  afterEach(() => {
    env.NODE_ENV = saved.NODE_ENV;
    env.APP_PROTOCOL = saved.APP_PROTOCOL;
  });

  function at(host: string, path: string, headers: Record<string, string> = {}) {
    return proxy(new NextRequest(`http://${host}${path}`, { headers: { host, ...headers } }));
  }

  it("serves the bare host with noindex, nofollow and no-store", () => {
    for (const path of ["/platform", "/platform/stadiums"]) {
      const response = at("lebstads.test", path);
      expect(response.status).toBe(200);
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("answers 404 on a tenant host, on www and on an unknown host", () => {
    for (const host of ["ahmad.lebstads.test", "www.lebstads.test", "ahmad.attacker.example", "a.b.lebstads.test"]) {
      expect(at(host, "/platform").status).toBe(404);
      expect(at(host, "/platform/anything").status).toBe(404);
    }
  });

  it("does not treat a lookalike path as /platform", () => {
    const response = at("lebstads.test", "/platformer");
    expect(response.headers.get("x-robots-tag")).toBeNull();
    expect(at("ahmad.lebstads.test", "/platformer").status).toBe(200);
  });

  it("answers 404 on every host in production when APP_PROTOCOL is not https, and serves it over https", () => {
    env.NODE_ENV = "production";
    env.APP_PROTOCOL = "http";
    for (const host of ["lebstads.test", "ahmad.lebstads.test"]) expect(at(host, "/platform").status).toBe(404);
    env.APP_PROTOCOL = "https";
    expect(at("lebstads.test", "/platform").status).toBe(200);
    expect(at("ahmad.lebstads.test", "/platform").status).toBe(404);
  });

  it("is not reachable on a tenant host through X-Forwarded-Host unless that header is trusted", () => {
    expect(at("ahmad.lebstads.test", "/platform", { "x-forwarded-host": "lebstads.test" }).status).toBe(404);
  });

  it("still deletes a client-sent x-tenant-slug on /platform", () => {
    const response = at("lebstads.test", "/platform", { "x-tenant-slug": "sami" });
    expect(response.headers.get("x-middleware-request-x-tenant-slug")).toBeNull();
    expect((response.headers.get("x-middleware-override-headers") ?? "").split(",")).not.toContain("x-tenant-slug");
  });

  it("does not renew the owner session cookie on /platform", () => {
    const response = at("lebstads.test", "/platform", { cookie: "stadium_session=tok_123" });
    expect(response.headers.getSetCookie()).toEqual([]);
    // The same cookie on an ordinary path still renews (the rule is unchanged).
    const owner = at("ahmad.lebstads.test", "/owner/today", { cookie: "stadium_session=tok_123" });
    expect(owner.headers.getSetCookie().some((line) => line.startsWith("stadium_session="))).toBe(true);
  });

  it("changes nothing for the bare host's other paths: no platform headers, and the tenant pages still 404 later (host-tenant integration test)", () => {
    const response = at("lebstads.test", "/owner/login");
    expect(response.status).toBe(200); // the proxy lets it pass; loadTenant answers 404 for a non-tenant host
    expect(response.headers.get("x-robots-tag")).toBeNull();
    expect(response.headers.get("cache-control")).toBeNull();
  });

  it("the placeholder page imports nothing that resolves a tenant", () => {
    const source = readFileSync(join(process.cwd(), "src", "app", "(platform)", "platform", "page.tsx"), "utf8");
    expect(source).not.toMatch(/tenant-context|platform-db|@\/lib\/db|getCurrentTenant/);
    expect(source).toContain("index: false");
  });
});
