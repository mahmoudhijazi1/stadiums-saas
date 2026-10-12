import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { bareUrl } from "@/lib/bare-url";
import { hostAudience } from "@/lib/tenant-slug";

/**
 * robots.txt reads the host itself (the proxy may not run on this path). The bare host: everything
 * allowed and the sitemap. /platform is NOT listed in any line: a Disallow would advertise it, and it
 * already answers noindex, nofollow and no-store. A stadium's host: the owner area is off limits, no
 * sitemap. www and any other host: nothing allowed. No database query.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const audience = hostAudience(await headers());
  if (audience === "bare") return { rules: { userAgent: "*", allow: "/" }, sitemap: bareUrl("/sitemap.xml") };
  if (audience === "tenant") return { rules: { userAgent: "*", allow: "/", disallow: "/owner/" } };
  return { rules: { userAgent: "*", disallow: "/" } };
}
