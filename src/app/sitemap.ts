import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { bareUrl } from "@/lib/bare-url";
import { hostAudience } from "@/lib/tenant-slug";

/**
 * sitemap.xml: on the bare host the two landing pages, each with the ar and en alternates; on any
 * other host an empty sitemap. No database query.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (hostAudience(await headers()) !== "bare") return [];
  const alternates = { languages: { ar: bareUrl("/"), en: bareUrl("/en") } };
  return [
    { url: bareUrl("/"), alternates },
    { url: bareUrl("/en"), alternates },
  ];
}
