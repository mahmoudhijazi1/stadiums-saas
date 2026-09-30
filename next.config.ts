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
