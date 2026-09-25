import type { NextConfig } from "next";

// Local next.config headers.md: headers() runs before /public.
// Local redirects.md: permanent true is 308 and keeps the query string.
const nextConfig: NextConfig = {
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
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
};

export default nextConfig;
