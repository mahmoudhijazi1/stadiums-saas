import { describe, expect, it } from "@jest/globals";
import { classifyHost, resolveTenantHost } from "@/lib/tenant-slug";

/**
 * Hosts (security audit S-9, S-10, S-11): only the bare APP_BASE_DOMAIN or a
 * single-label subdomain of it. Forwarded headers only behind a trusted proxy.
 */
const BASE = "lebstads.com";
const tenant = (slug: string) => ({ kind: "tenant", slug });
const APEX = { kind: "apex" };
const INVALID = { kind: "invalid" };

describe("classifyHost", () => {
  it("accepts a single-label subdomain of the base domain", () => {
    expect(classifyHost("ahmad.lebstads.com", BASE)).toEqual(tenant("ahmad"));
    expect(classifyHost("AHMAD.LebStads.com", BASE)).toEqual(tenant("ahmad"));
    expect(classifyHost("ahmad.lebstads.com:443", BASE)).toEqual(tenant("ahmad"));
    expect(classifyHost("ahmad.lebstads.com.", BASE)).toEqual(tenant("ahmad"));
    expect(classifyHost("sami-2.lebstads.com", BASE)).toEqual(tenant("sami-2"));
  });

  it("accepts the bare base domain as the apex (no tenant)", () => {
    expect(classifyHost("lebstads.com", BASE)).toEqual(APEX);
    expect(classifyHost("LEBSTADS.COM:443", BASE)).toEqual(APEX);
  });

  it("rejects any other domain, deeper subdomains and bad labels", () => {
    for (const host of [
      "ahmad.attacker.example",
      "lebstads.com.attacker.example",
      "ahmad.lebstads.com.attacker.example",
      "evil-lebstads.com",
      "a.ahmad.lebstads.com",
      "bad_slug.lebstads.com",
      "-ahmad.lebstads.com",
      ".lebstads.com",
      "localhost",
      "127.0.0.1",
      "",
    ]) {
      expect(classifyHost(host, BASE)).toEqual(INVALID);
    }
  });

  it("uses the base domain without its port (local dev base localhost:3000)", () => {
    expect(classifyHost("ahmad.localhost:3000", "localhost:3000")).toEqual(tenant("ahmad"));
    expect(classifyHost("localhost:3000", "localhost:3000")).toEqual(APEX);
  });

  it("fails closed when the base domain is not configured", () => {
    expect(classifyHost("ahmad.lebstads.com", "")).toEqual(INVALID);
  });
});

describe("resolveTenantHost", () => {
  const production = { baseDomain: BASE, trustProxyHeaders: false, devFallback: false };

  it("reads Host; ignores X-Forwarded-Host, Origin and Referer by default", () => {
    expect(
      resolveTenantHost(
        {
          host: "sami.lebstads.com",
          forwardedHost: "ahmad.lebstads.com",
          origin: "https://ahmad.lebstads.com",
          referer: "https://ahmad.lebstads.com/x",
        },
        production,
      ),
    ).toEqual(tenant("sami"));
    expect(
      resolveTenantHost({ host: "127.0.0.1:3000", forwardedHost: "ahmad.lebstads.com" }, production),
    ).toEqual(INVALID);
  });

  it("uses X-Forwarded-Host (the last entry, set by our proxy) only when trusted", () => {
    const trusted = { ...production, trustProxyHeaders: true };
    expect(
      resolveTenantHost({ host: "127.0.0.1:3000", forwardedHost: "ahmad.lebstads.com" }, trusted),
    ).toEqual(tenant("ahmad"));
    expect(
      resolveTenantHost(
        { host: "127.0.0.1:3000", forwardedHost: "sami.lebstads.com, ahmad.lebstads.com" },
        trusted,
      ),
    ).toEqual(tenant("ahmad"));
    expect(
      resolveTenantHost({ host: "127.0.0.1:3000", forwardedHost: "ahmad.evil.example" }, trusted),
    ).toEqual(INVALID);
  });

  it("outside production only, a bare-domain Host falls back to forwarded, Origin, then Referer (Next dev redirect)", () => {
    const dev = { baseDomain: "localhost:3000", trustProxyHeaders: false, devFallback: true };
    expect(
      resolveTenantHost({ host: "localhost:3000", forwardedHost: "ahmad.localhost:3000" }, dev),
    ).toEqual(tenant("ahmad"));
    expect(
      resolveTenantHost({ host: "localhost:3000", origin: "http://sami.localhost:3000" }, dev),
    ).toEqual(tenant("sami"));
    expect(
      resolveTenantHost({ host: "localhost:3000", referer: "http://sami.localhost:3000/owner" }, dev),
    ).toEqual(tenant("sami"));
    // Never to a foreign domain, and never when Host already names a tenant.
    expect(
      resolveTenantHost({ host: "localhost:3000", origin: "http://ahmad.evil.example" }, dev),
    ).toEqual(APEX);
    expect(
      resolveTenantHost({ host: "sami.localhost:3000", origin: "http://ahmad.localhost:3000" }, dev),
    ).toEqual(tenant("sami"));
    // Production: no fallback.
    expect(
      resolveTenantHost(
        { host: "localhost:3000", origin: "http://sami.localhost:3000" },
        { ...dev, devFallback: false },
      ),
    ).toEqual(APEX);
  });
});
