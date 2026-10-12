import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LANDING_HEADER } from "@/lib/locale";
import {
  isBareHostFromHeaders,
  isLandingPath,
  isPlatformPath,
  isWwwHostFromHeaders,
  landingRouteFor,
  platformServed,
  resolveTenantFromHeaders,
} from "@/lib/tenant-slug";
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
 *   3. /platform (the platform admin, DR-006) is served only on the bare APP_BASE_DOMAIN host, and
 *      in production only over https; anywhere else it is the same 404. Its responses are
 *      noindex and no-store, and it never touches the owner session cookie.
 *   4. The landing page of the bare host (no tenant, no database): always delete a client-sent
 *      x-lebstads-landing; `www.` gets a 308 to the bare domain (except /platform, a 404 as in 3);
 *      /landing is a 404 on every host; on the bare host `/` and `/en` pass through with
 *      x-lebstads-landing: ar | en, and next.config.ts (beforeFiles) rewrites them to /landing and
 *      /landing/en. The proxy never rewrites. Tenant hosts are untouched.
 *   5. Renew the session cookie (rolling 30 days), at most once a day
 */
export function proxy(request: NextRequest) {
  if (resolveTenantFromHeaders(request.headers).kind === "invalid") {
    return new NextResponse(null, { status: 404 });
  }

  const pathname = request.nextUrl.pathname;
  const platform = isPlatformPath(pathname);
  if (platform && !platformServed(request.headers)) {
    return new NextResponse(null, { status: 404 });
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-tenant-slug");
  requestHeaders.delete(LANDING_HEADER);

  if (isWwwHostFromHeaders(request.headers)) {
    return redirectToBareDomain(request);
  }
  if (isLandingPath(pathname)) {
    return new NextResponse(null, { status: 404 });
  }
  const landing = isBareHostFromHeaders(request.headers) ? landingRouteFor(pathname) : null;
  if (landing) {
    // Only the language here. The path is rewritten by next.config.ts (beforeFiles, bare host only),
    // which runs after the proxy: a proxy rewrite is treated as external behind nginx (EPROTO).
    requestHeaders.set(LANDING_HEADER, landing.locale);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  if (platform) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
  renewSessionCookie(request, response);
  return response;
}

/**
 * `www.<base>` to the bare domain, same path and query, no tenant lookup. The target is built from
 * APP_PROTOCOL and APP_BASE_DOMAIN only (never from the request host), so a path cannot change the
 * host it points to.
 */
function redirectToBareDomain(request: NextRequest): NextResponse {
  const protocol = process.env.APP_PROTOCOL?.trim() || "https";
  const base = (process.env.APP_BASE_DOMAIN ?? "").trim().toLowerCase();
  return NextResponse.redirect(`${protocol}://${base}${request.nextUrl.pathname}${request.nextUrl.search}`, 308);
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
