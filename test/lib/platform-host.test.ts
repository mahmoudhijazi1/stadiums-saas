import { afterEach, beforeAll, describe, expect, it, jest } from "@jest/globals";
import { isPlatformPath, platformServed } from "@/lib/tenant-slug";

/**
 * Written, not run. The one rule that serves the platform admin (DR-006): exactly the bare host,
 * and in production only over https. `platformServed` is the proxy's rule; `requirePlatformHost`
 * is the same rule as a server-side guard (notFound) for the layout, the pages and every action.
 */
let mockHeaders = new Headers();
jest.mock("next/headers", () => ({ headers: async () => mockHeaders }));

const BASE = "lebstads.test";
const env = process.env as Record<string, string | undefined>;
const saved = { APP_BASE_DOMAIN: env.APP_BASE_DOMAIN, NODE_ENV: env.NODE_ENV, APP_PROTOCOL: env.APP_PROTOCOL, TRUST: env.TRUST_PROXY_HEADERS };

beforeAll(() => {
  env.APP_BASE_DOMAIN = BASE;
  env.TRUST_PROXY_HEADERS = "";
});
afterEach(() => {
  env.NODE_ENV = saved.NODE_ENV;
  env.APP_PROTOCOL = saved.APP_PROTOCOL;
});

const at = (host: string) => new Headers({ host });

describe("platformServed", () => {
  it("serves exactly the bare host", () => {
    expect(platformServed(at(BASE))).toBe(true);
  });

  it("refuses a tenant subdomain, www, a deeper name, a lookalike and an unknown host", () => {
    for (const host of [`ahmad.${BASE}`, `www.${BASE}`, `a.b.${BASE}`, `evil-${BASE}`, `${BASE}.evil.example`, "127.0.0.1:3000"]) {
      expect(platformServed(at(host))).toBe(false);
    }
  });

  it("in production serves only over https", () => {
    env.NODE_ENV = "production";
    env.APP_PROTOCOL = "http";
    expect(platformServed(at(BASE))).toBe(false);
    env.APP_PROTOCOL = undefined;
    expect(platformServed(at(BASE))).toBe(false);
    env.APP_PROTOCOL = "https";
    expect(platformServed(at(BASE))).toBe(true);
    expect(platformServed(at(`ahmad.${BASE}`))).toBe(false);
  });
});

describe("isPlatformPath", () => {
  it("matches /platform, its subpaths and their percent-encoded spellings", () => {
    for (const path of ["/platform", "/platform/", "/platform/login", "/%70latform", "/%70latform/login", "/platform%2F", "/platform%2Flogin"]) {
      expect(isPlatformPath(path)).toBe(true);
    }
  });

  it("does not match other paths, and fails closed on a malformed escape that spells platform", () => {
    for (const path of ["/", "/owner/today", "/platformer", "/x/platform"]) expect(isPlatformPath(path)).toBe(false);
    expect(isPlatformPath("/%E0%A4%A/platform")).toBe(true);
  });
});

describe("requirePlatformHost", () => {
  async function guard(host: string) {
    mockHeaders = at(host);
    const { requirePlatformHost } = await import("@/lib/require-platform-host");
    return requirePlatformHost();
  }

  it("passes on the bare host", async () => {
    await expect(guard(BASE)).resolves.toBeUndefined();
  });

  it("calls notFound on a tenant host, www and an unknown host", async () => {
    for (const host of [`ahmad.${BASE}`, `www.${BASE}`, "ahmad.attacker.example"]) {
      await expect(guard(host)).rejects.toMatchObject({ digest: expect.stringContaining("404") });
    }
  });

  it("calls notFound in production over http, even on the bare host", async () => {
    env.NODE_ENV = "production";
    env.APP_PROTOCOL = "http";
    await expect(guard(BASE)).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });
});
