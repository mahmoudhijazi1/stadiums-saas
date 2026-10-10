import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveTenantFromHeaders } from "@/lib/tenant-slug";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  SESSION_RENEWED_COOKIE,
  SESSION_RENEWED_MAX_AGE_SECONDS,
  sessionCookieFlags,
} from "@/modules/access/infrastructure/session-cookie-options";

/**
 * Next.js 16 renamed middleware → proxy (same idea: runs before your page).
 * Docs: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
 *
 * What it does:
 *   1. Check the host (security audit S-9..S-11): the bare APP_BASE_DOMAIN or a
 *      single-label subdomain of it, else 404 before any tenant lookup.
 *      X-Forwarded-Host only with TRUST_PROXY_HEADERS=true.
 *   2. Drop any client-sent x-tenant-slug. Nothing reads it: the tenant is
 *      resolved from the same host check in tenant-context.
 *   3. Renew the session cookie (rolling 30 days), at most once a day
 */
export function proxy(request: NextRequest) {
  if (resolveTenantFromHeaders(request.headers).kind === "invalid") {
    return new NextResponse(null, { status: 404 });
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-tenant-slug");

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
    "/((?!_next/static|_next/image|favicon.ico|apple-touch-icon|manifest\\.webmanifest|sw\\.js|icons/|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
