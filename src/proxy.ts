import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parseTenantSlug, resolveRequestHost } from "@/lib/tenant-slug";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  SESSION_RENEWED_COOKIE,
  SESSION_RENEWED_MAX_AGE_SECONDS,
  sessionCookieFlags,
} from "@/modules/access/infrastructure/session-cookie-options";

/**
 * Next.js 16 renamed middleware → proxy (same idea: runs before your page).
 * Docs: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
 *
 * What it does:
 *   1. Look at the host (x-forwarded-host when Host collapsed to localhost)
 *   2. Put the slug on a request header: x-tenant-slug
 *   3. The page can read that header later
 *   4. Renew the session cookie (rolling 30 days), at most once a day
 */
export function proxy(request: NextRequest) {
  const host = resolveRequestHost(
    request.headers.get("host"),
    request.headers.get("x-forwarded-host"),
    request.headers.get("origin"),
    request.headers.get("referer"),
  );
  const slug = parseTenantSlug(host);

  // Clone headers and pass them to the rest of the app
  const requestHeaders = new Headers(request.headers);
  if (slug) {
    requestHeaders.set("x-tenant-slug", slug);
  } else {
    requestHeaders.delete("x-tenant-slug");
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  renewSessionCookie(request, response);
  return response;
}

/**
 * Server Components cannot set cookies (cookies.md), so the cookie half of the
 * rolling session lives here. The database expiry is renewed where the session
 * is read (getCurrentMembership). GET only: login and logout are POST Server
 * Actions that write the cookie themselves. The value is re-sent unchanged; an
 * invalid token stays invalid.
 */
function renewSessionCookie(request: NextRequest, response: NextResponse) {
  if (request.method !== "GET") return;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || request.cookies.has(SESSION_RENEWED_COOKIE)) return;
  const flags = sessionCookieFlags();
  response.cookies.set(SESSION_COOKIE, token, { ...flags, maxAge: SESSION_MAX_AGE_SECONDS });
  response.cookies.set(SESSION_RENEWED_COOKIE, "1", {
    ...flags,
    maxAge: SESSION_RENEWED_MAX_AGE_SECONDS,
  });
}

export const config = {
  // Run on normal pages; skip Next.js static files and images
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|apple-touch-icon|manifest\\.webmanifest|sw\\.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
