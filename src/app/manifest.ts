import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { currentBrandIdentity } from "@/app/brand/current-brand";
import { brandIconPath } from "@/modules/stadium/domain/brand-identity";
import { platformDb } from "@/lib/platform-db";
import { pwaShortName } from "@/modules/stadium/domain/pwa-short-name";
import { resolveTenantFromHeaders } from "@/lib/tenant-slug";
import { THEME_COLOR } from "@/lib/theme-color";

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

  const identity = await currentBrandIdentity();

  return {
    name,
    short_name: pwaShortName(name),
    start_url: "/owner/today",
    scope: "/owner/",
    display: "standalone",
    background_color: THEME_COLOR.light,
    // The page background, never the stadium's accent: an installed app paints the phone's system bars
    // (status and navigation) with this until the page loads, and a lime or yellow bar under the app looks
    // broken. Once the page is up, the theme-color tags follow the light or dark theme (src/lib/theme-color.ts).
    theme_color: THEME_COLOR.light,
    // The generated logo of this host's stadium (neutral lebstads for an unknown or suspended one).
    // Versioned, so a changed letter or colour is fetched again.
    icons: [
      { src: brandIconPath("192", identity), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: brandIconPath("512", identity), sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: brandIconPath("512-maskable", identity),
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
