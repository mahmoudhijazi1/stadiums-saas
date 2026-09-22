/**
 * Pure function: turn a request host into a tenant slug.
 * No query params. Use ahmad.localhost / ahmad.lvh.me / ahmad.stadiums.com.
 */

/**
 * Host used for tenant slug. After a Server Action `redirect()`, Next can send
 * `Host: localhost:3000` on the follow-up RSC request while forwarded / Origin /
 * Referer still carry `ahmad.localhost:3000` — bare localhost then 404s until
 * hard refresh (vercel/next.js#65893-class). Prefer those when Host has no subdomain.
 */
export function resolveRequestHost(
  hostHeader: string | null | undefined,
  forwardedHostHeader: string | null | undefined,
  originHeader?: string | null | undefined,
  refererHeader?: string | null | undefined,
): string {
  const host = hostHeader?.trim() ?? "";
  const forwarded =
    forwardedHostHeader?.split(",")[0]?.trim() ?? "";
  const fromOrigin = hostFromUrl(originHeader);
  const fromReferer = hostFromUrl(refererHeader);
  const hostName = host.split(":")[0]?.toLowerCase() ?? "";

  if (hostName === "" || hostName === "localhost" || hostName === "127.0.0.1") {
    return forwarded || fromOrigin || fromReferer || host;
  }
  return host;
}

function hostFromUrl(value: string | null | undefined): string {
  const raw = value?.trim();
  if (!raw) return "";
  try {
    return new URL(raw).host;
  } catch {
    return "";
  }
}

export function parseTenantSlug(host: string): string | null {
  // Hostname from host (strip port like :3000)
  const hostname = host.split(":")[0]?.trim().toLowerCase() ?? "";
  if (!hostname || hostname === "localhost" || hostname === "127.0.0.1") {
    return null;
  }

  const parts = hostname.split(".").filter(Boolean);

  // ahmad.localhost
  if (parts.length === 2 && parts[1] === "localhost") {
    return parts[0] === "www" ? null : parts[0];
  }

  // ahmad.lvh.me or ahmad.stadiums.com → need at least 3 parts
  if (parts.length < 3) {
    return null;
  }

  const sub = parts[0];
  if (sub === "www") {
    return null;
  }

  return isValidSlug(sub) ? sub : null;
}

function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
