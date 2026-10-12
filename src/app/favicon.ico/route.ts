import { headers } from "next/headers";
import { currentBrandIdentity } from "@/app/brand/current-brand";
import { LEBSTADS_ICONS } from "@/lib/lebstads-brand";
import { isBareHostFromHeaders } from "@/lib/tenant-slug";
import { brandIconPath } from "@/modules/stadium/domain/brand-identity";

/**
 * Browsers and crawlers ask for /favicon.ico by default. On the bare host it is the LebStads icon (a
 * static file). On a stadium's host the icon is generated, so send them to the Host's versioned 32px
 * logo (the neutral lebstads icon for an unknown or a suspended host). The proxy matcher skips this
 * path, so an invalid host also gets the neutral icon here, never a 404.
 */
export async function GET(): Promise<Response> {
  const bare = isBareHostFromHeaders(await headers());
  return new Response(null, {
    status: 307,
    headers: {
      Location: bare ? LEBSTADS_ICONS["32"] : brandIconPath("32", await currentBrandIdentity()),
      "Cache-Control": "public, max-age=300",
    },
  });
}
