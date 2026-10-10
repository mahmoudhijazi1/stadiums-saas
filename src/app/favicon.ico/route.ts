import { currentBrandIdentity } from "@/app/brand/current-brand";
import { brandIconPath } from "@/lib/brand-identity";

/**
 * Browsers and crawlers ask for /favicon.ico by default. The icon is generated, so send them to
 * the Host's versioned 32px logo (the neutral lebstads icon for the apex, an unknown or a
 * suspended host). The proxy matcher skips this path, so an invalid host also gets the neutral
 * icon here, never a 404.
 */
export async function GET(): Promise<Response> {
  return new Response(null, {
    status: 307,
    headers: {
      Location: brandIconPath("32", await currentBrandIdentity()),
      "Cache-Control": "public, max-age=300",
    },
  });
}
