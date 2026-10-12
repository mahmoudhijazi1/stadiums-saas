import type { NextConfig } from "next";

// Local next.config headers.md: headers() runs before /public.
// Local redirects.md: permanent true is 308 and keeps the query string.

/**
 * Security audit S-7. CSP follows the local guide's "Without Nonces" policy
 * (02-guides/content-security-policy.md) but is Report-Only: it cannot block
 * the app or the PWA (service worker, manifest), and violations show in the
 * browser console. Enforcing it needs nonces (deferred). HSTS is set by nginx.
 */
const cspReportOnly = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
];

/**
 * The landing page of the bare host: `/` to `/landing` (Arabic) and `/en` to `/landing/en`. A config
 * rewrite, not a proxy one: behind nginx a proxy rewrite is treated as external (proxy.md "Execution
 * order": the proxy runs first, then these `beforeFiles` rewrites). Matched on the request's Host, which
 * Next reads without its port and lower-cased, as a regex Next anchors itself (`^value$`), so the dots
 * are escaped. Built at build time: no APP_BASE_DOMAIN, no entry; changing it needs a rebuild.
 */
export function landingRewrites(baseDomain: string | undefined) {
  const host = (baseDomain ?? "").trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  if (!host) return [];
  const has = [{ type: "host" as const, value: host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") }];
  return [
    { source: "/", destination: "/landing", has },
    { source: "/en", destination: "/landing/en", has },
  ];
}

const nextConfig: NextConfig = {
  // Security audit S-13: no X-Powered-By (local poweredByHeader.md).
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: "/login",
        destination: "/owner/login",
        permanent: true,
      },
      {
        source: "/owner/waitlist",
        destination: "/owner/requests",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return { beforeFiles: landingRewrites(process.env.APP_BASE_DOMAIN), afterFiles: [], fallback: [] };
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
};

export default nextConfig;
