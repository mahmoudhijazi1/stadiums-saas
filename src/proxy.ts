import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parseTenantSlug } from "@/lib/tenant-slug";

/**
 * Next.js 16 renamed middleware → proxy (same idea: runs before your page).
 * Docs: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
 *
 * What it does:
 *   1. Look at the host (or ?tenant=)
 *   2. Put the slug on a request header: x-tenant-slug
 *   3. The page can read that header later
 *
 * What it does NOT do: talk to the database (DR-001).
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const slug = parseTenantSlug(host, request.nextUrl.searchParams);

  // Clone headers and pass them to the rest of the app
  const requestHeaders = new Headers(request.headers);
  if (slug) {
    requestHeaders.set("x-tenant-slug", slug);
  } else {
    requestHeaders.delete("x-tenant-slug");
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  // Run on normal pages; skip Next.js static files and images
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
