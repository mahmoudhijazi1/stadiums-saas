/** @jest-environment node */
import { readdirSync, readFileSync } from "node:fs";
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

  it("answers 404 on a tenant host for an encoded spelling of /platform (Next decodes the path when it matches a route)", () => {
    for (const path of ["/%70latform", "/%70latform/login", "/platform%2F", "/platform%2Flogin"]) {
      expect(at("ahmad.lebstads.test", path).status).toBe(404);
      expect(at("www.lebstads.test", path).status).toBe(404);
    }
    // On the bare host the same spellings are treated as /platform (served, with the headers).
    const bare = at("lebstads.test", "/%70latform");
    expect(bare.status).toBe(200);
    expect(bare.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("no file of the platform route group imports tenant resolution or the database client", () => {
    const root = join(process.cwd(), "src", "app", "(platform)");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.(ts|tsx)$/.test(entry.name)) files.push(path);
      }
    };
    walk(root);
    expect(files.length).toBeGreaterThanOrEqual(4); // layout, page, login/page, actions
    for (const file of files) {
      // Only the import statements count: a comment may name what the file does not use.
      const imports = readFileSync(file, "utf8").split(/\r?\n/).filter((line) => /^\s*import\b/.test(line)).join(" ");
      expect([file, /tenant-context|platform-db|@\/lib\/db"/.test(imports)]).toEqual([file, false]);
    }
    const layout = readFileSync(join(root, "platform", "layout.tsx"), "utf8");
    expect(layout).toContain("index: false");
    expect(layout).toContain("requirePlatformHost");
  });

  it("every Server Action of the platform admin runs the host guard first", () => {
    const source = readFileSync(join(process.cwd(), "src", "app", "(platform)", "platform", "actions.ts"), "utf8");
    const actions = source.split(/export async function /).slice(1);
    expect(actions.length).toBeGreaterThanOrEqual(2);
    for (const action of actions) {
      const body = action.slice(action.indexOf("{") + 1);
      expect(body.trimStart().startsWith("await requirePlatformHost();")).toBe(true);
    }
  });
});


/**
 * The landing page of the bare host. The bare host's "/" and "/en" pass through the proxy with the
 * language in x-lebstads-landing (next.config.ts rewrites the path to /landing); the header is deleted
 * from every incoming request; "www." redirects to the bare domain; /landing is never a public URL;
 * tenant hosts, /platform and the host check are unchanged.
 */
describe("proxy landing routes", () => {
  const env = process.env as Record<string, string | undefined>;
  const saved = { APP_PROTOCOL: env.APP_PROTOCOL };
  afterEach(() => {
    env.APP_PROTOCOL = saved.APP_PROTOCOL;
  });

  function at(host: string, path: string, headers: Record<string, string> = {}) {
    return proxy(new NextRequest(`http://${host}${path}`, { headers: { host, ...headers } }));
  }
  const target = (response: Response) => {
    const value = response.headers.get("x-middleware-rewrite");
    return value ? new URL(value) : null;
  };
  const forwarded = (response: Response) => response.headers.get("x-middleware-request-x-lebstads-landing");
  const overridden = (response: Response) => (response.headers.get("x-middleware-override-headers") ?? "").split(",");

  it("passes the bare host's / through, not rewritten, with the header ar (next.config.ts rewrites the path)", () => {
    const response = at("lebstads.test", "/");
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(target(response)).toBeNull();
    expect(forwarded(response)).toBe("ar");
  });

  it("passes the bare host's /en and /en/ through with the header en, with or without a query", () => {
    for (const path of ["/en", "/en/", "/en?utm=1"]) {
      const response = at("lebstads.test", path);
      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(target(response)).toBeNull();
      expect(forwarded(response)).toBe("en");
    }
    expect(forwarded(at("lebstads.test", "/?utm=1"))).toBe("ar");
  });

  it("rewrites nothing else on the bare host", () => {
    for (const path of ["/en/more", "/english", "/owner/login", "/robots.txt"]) {
      const response = at("lebstads.test", path);
      expect(target(response)).toBeNull();
      expect(forwarded(response)).toBeNull();
    }
  });

  it("removes a client-sent x-lebstads-landing on a tenant host and on the bare host", () => {
    for (const [host, path] of [["ahmad.lebstads.test", "/"], ["ahmad.lebstads.test", "/owner/today"], ["lebstads.test", "/owner/login"], ["lebstads.test", "/platform"]]) {
      const response = at(host!, path!, { "x-lebstads-landing": "en" });
      expect(forwarded(response)).toBeNull();
      expect(overridden(response)).not.toContain("x-lebstads-landing");
    }
    // On the landing routes the proxy's own value wins over the client's.
    expect(forwarded(at("lebstads.test", "/", { "x-lebstads-landing": "en" }))).toBe("ar");
    expect(forwarded(at("lebstads.test", "/en", { "x-lebstads-landing": "ar" }))).toBe("en");
  });

  it("answers 404 for /landing and everything under it, on the bare host and on a tenant host", () => {
    for (const host of ["lebstads.test", "ahmad.lebstads.test"]) {
      for (const path of ["/landing", "/landing/", "/landing/en", "/Landing", "/%6canding", "/landing%2Fen"]) {
        expect([host, path, at(host, path).status]).toEqual([host, path, 404]);
      }
    }
    expect(at("lebstads.test", "/landingpage").status).toBe(200); // a lookalike is not /landing
  });

  it("leaves a tenant host's / and /en alone: no rewrite, no header", () => {
    for (const path of ["/", "/en"]) {
      const response = at("ahmad.lebstads.test", path);
      expect(response.status).toBe(200);
      expect(target(response)).toBeNull();
      expect(forwarded(response)).toBeNull();
    }
  });

  it("does not rewrite a tenant host that only names the bare host in X-Forwarded-Host, unless that header is trusted", () => {
    const response = at("ahmad.lebstads.test", "/", { "x-forwarded-host": "lebstads.test" });
    expect(target(response)).toBeNull();
  });

  it("does not renew the owner session cookie on a landing page", () => {
    expect(at("lebstads.test", "/", { cookie: "stadium_session=tok_123" }).headers.getSetCookie()).toEqual([]);
  });

  it("redirects www.<base> with 308 to the bare domain, same path and query, for any path", () => {
    env.APP_PROTOCOL = "https";
    const response = at("www.lebstads.test", "/x?y=1");
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://lebstads.test/x?y=1");
    expect(at("www.lebstads.test", "/").headers.get("location")).toBe("https://lebstads.test/");
    expect(at("www.lebstads.test", "/en").headers.get("location")).toBe("https://lebstads.test/en");
    expect(at("www.lebstads.test", "/landing").headers.get("location")).toBe("https://lebstads.test/landing"); // then a 404 on the bare host
    env.APP_PROTOCOL = "http";
    expect(at("www.lebstads.test", "/a").headers.get("location")).toBe("http://lebstads.test/a");
  });

  it("builds the www redirect from the configured base domain, never from the request path", () => {
    env.APP_PROTOCOL = "https";
    expect(at("www.lebstads.test", "//evil.example/x").headers.get("location")).toMatch(/^https:\/\/lebstads\.test\//);
  });

  it("keeps /platform on www a 404 (the platform invariant wins over the www redirect)", () => {
    expect(at("www.lebstads.test", "/platform").status).toBe(404);
  });

  it("keeps /platform on the bare host unchanged: served, noindex, no-store, no landing header", () => {
    const response = at("lebstads.test", "/platform");
    expect(response.status).toBe(200);
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(target(response)).toBeNull();
    expect(forwarded(response)).toBeNull();
  });

  it("still answers 404 for an invalid host on / and /en, with no redirect", () => {
    for (const host of ["ahmad.attacker.example", "www.attacker.example", "a.b.lebstads.test", "127.0.0.1:3000"]) {
      for (const path of ["/", "/en"]) expect([host, path, at(host, path).status]).toEqual([host, path, 404]);
    }
  });
});

/**
 * The proxy never rewrites: behind nginx a proxy rewrite was treated as external (to
 * https://localhost:3000/landing) and failed with EPROTO. next.config.ts (beforeFiles) rewrites the bare
 * host's "/" and "/en"; the proxy only sets the language header. Written, not run when authored.
 */
describe("proxy landing behind nginx", () => {
  function behindNginx(path: string) {
    return proxy(
      new NextRequest(`https://localhost:3000${path}`, {
        headers: { host: "lebstads.test", "x-forwarded-proto": "https" },
      }),
    );
  }

  it("passes / and /en through with the header ar and en, and no rewrite", () => {
    for (const [path, locale] of [["/", "ar"], ["/en", "en"], ["/en/", "en"]] as const) {
      const response = behindNginx(path);
      expect([path, response.status, response.headers.get("x-middleware-next")]).toEqual([path, 200, "1"]);
      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
      expect(response.headers.get("x-middleware-request-x-lebstads-landing")).toBe(locale);
    }
  });

  it("still answers 404 for a direct /landing, and does not set the header on a tenant host", () => {
    expect(behindNginx("/landing").status).toBe(404);
    const tenant = proxy(new NextRequest("https://localhost:3000/", { headers: { host: "ahmad.lebstads.test", "x-forwarded-proto": "https" } }));
    expect(tenant.headers.get("x-middleware-rewrite")).toBeNull();
    expect(tenant.headers.get("x-middleware-request-x-lebstads-landing")).toBeNull();
  });

  it("src/proxy.ts contains no NextResponse.rewrite", () => {
    const source = readFileSync(join(process.cwd(), "src", "proxy.ts"), "utf8");
    // Code only: a comment may say that the proxy never rewrites.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split(/\r?\n/)
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");
    expect(code).not.toMatch(/NextResponse\.rewrite|\.rewrite\(/);
    expect(code).toContain("NextResponse.next({ request: { headers: requestHeaders } })");
  });
});
