/**
 * Pure function: turn a request host into a tenant slug.
 * No query params. Use ahmad.localhost / ahmad.lvh.me / ahmad.stadiums.com.
 */
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
