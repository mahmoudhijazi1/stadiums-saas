/**
 * Pure function: turn a request host (and optional ?tenant=) into a tenant slug.
 * No database. No Next.js. Easy to test with Jest.
 *
 * Examples:
 *   ahmad.stadiums.com  → "ahmad"
 *   sami.lvh.me         → "sami"
 *   localhost?tenant=ahmad → "ahmad"  (local-dev fallback)
 */
export function parseTenantSlug(
  host: string,
  searchParams?: Pick<URLSearchParams, "get"> | null,
): string | null {
  // 1) Local-dev fallback: ?tenant=ahmad (wins so you can test without DNS)
  const fromQuery = searchParams?.get("tenant")?.trim().toLowerCase();
  if (fromQuery && isValidSlug(fromQuery)) {
    return fromQuery;
  }

  // 2) From the hostname (strip port like :3000)
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
