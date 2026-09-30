import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { platformDb } from "@/lib/platform-db";
import { pwaShortName } from "@/lib/pwa-short-name";
import { resolveTenantFromHeaders } from "@/lib/tenant-slug";

const FALLBACK_NAME = "lebstads";

/**
 * Local manifest.md: manifest.ts is a route handler. It stays dynamic when it
 * uses a request-time API (headers). The proxy matcher skips this URL, so the
 * tenant name is read from the validated Host here (resolveTenantFromHeaders).
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const resolved = resolveTenantFromHeaders(await headers());
  const slug = resolved.kind === "tenant" ? resolved.slug : null;
  let name = FALLBACK_NAME;
  if (slug) {
    const tenant = await platformDb.tenant.findUnique({
      where: { slug },
      select: { name: true, suspendedAt: true },
    });
    // Suspended: same neutral manifest as an unknown host (decision 7).
    const trimmed = tenant && !tenant.suspendedAt ? tenant.name.trim() : undefined;
    if (trimmed) name = trimmed;
  }

  return {
    name,
    short_name: pwaShortName(name),
    start_url: "/owner/today",
    scope: "/owner/",
    display: "standalone",
    background_color: "#F6F5EF",
    theme_color: "#111412",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
