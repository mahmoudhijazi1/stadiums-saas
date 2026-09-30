import { describe, expect, it } from "@jest/globals";
import nextConfig from "../next.config";

/**
 * Security audit S-7 / S-13: headers set by next.config on every route.
 * HSTS is nginx's job (not set here). CSP is Report-Only for now.
 */
async function headersFor(source: string): Promise<Record<string, string>> {
  const rules = (await nextConfig.headers?.()) ?? [];
  const rule = rules.find((entry) => entry.source === source);
  return Object.fromEntries((rule?.headers ?? []).map((header) => [header.key, header.value]));
}

describe("next.config security headers", () => {
  it("sends the fixed security headers on every route", async () => {
    const headers = await headersFor("/:path*");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=()");
    expect(headers["X-Frame-Options"]).toBe("DENY");
  });

  it("does not set HSTS (nginx does) and turns off X-Powered-By", async () => {
    const headers = await headersFor("/:path*");
    expect(headers["Strict-Transport-Security"]).toBeUndefined();
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("ships the CSP as Report-Only, never enforcing", async () => {
    const headers = await headersFor("/:path*");
    expect(headers["Content-Security-Policy"]).toBeUndefined();
    const csp = headers["Content-Security-Policy-Report-Only"];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("worker-src 'self'");
    expect(csp).toContain("manifest-src 'self'");
  });

  it("keeps the service worker uncached", async () => {
    expect((await headersFor("/sw.js"))["Cache-Control"]).toBe("no-cache");
  });
});
