import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { platformServed } from "@/lib/tenant-slug";

/**
 * The server-side guard of the platform admin (DR-006), independent of the proxy: 404 unless this
 * request is for exactly the bare host (and, in production, https). The proxy already answers 404
 * there; this repeats the same rule (`platformServed`) where the page and every Server Action run,
 * so a proxy that is skipped, misconfigured or bypassed by a path trick still cannot serve it.
 * Call it FIRST in the /platform layout, every /platform page and every /platform Server Action.
 * It lives in src/lib: it imports only lib code (no module), and resolves no tenant.
 */
export async function requirePlatformHost(): Promise<void> {
  if (!platformServed(await headers())) notFound();
}
