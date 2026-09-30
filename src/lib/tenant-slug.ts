/**
 * Pure host → tenant resolution (security audit S-9, S-10, S-11).
 * Only the bare APP_BASE_DOMAIN (the apex, no tenant) or a single-label
 * subdomain of it is valid; anything else is `invalid` and gets a 404 before
 * any tenant lookup. The tenant is never read from a client header.
 */

export type TenantHost =
  | { kind: "tenant"; slug: string }
  | { kind: "apex" }
  | { kind: "invalid" };

export type HostHeaders = {
  host?: string | null;
  forwardedHost?: string | null;
  origin?: string | null;
  referer?: string | null;
};

export type HostOptions = {
  /** APP_BASE_DOMAIN, e.g. lebstads.com or localhost:3000 (port ignored). */
  baseDomain: string;
  /** TRUST_PROXY_HEADERS=true: our reverse proxy sets X-Forwarded-Host. */
  trustProxyHeaders: boolean;
  /**
   * Development only: after a Server Action redirect, `next dev` can send the
   * follow-up request with `Host: localhost:3000` while X-Forwarded-Host,
   * Origin or Referer still name the tenant (vercel/next.js#65893-class).
   */
  devFallback: boolean;
};

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const INVALID: TenantHost = { kind: "invalid" };

function hostnameOf(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

/** Classify one Host value against the base domain. Fails closed without a base. */
export function classifyHost(host: string, baseDomain: string): TenantHost {
  const base = hostnameOf(baseDomain);
  const name = hostnameOf(host);
  if (!base || !name) return INVALID;
  if (name === base) return { kind: "apex" };
  if (!name.endsWith(`.${base}`)) return INVALID;
  const label = name.slice(0, -(base.length + 1));
  return LABEL.test(label) ? { kind: "tenant", slug: label } : INVALID;
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

/** The options the running app uses (env), overridable in tests. */
export function hostOptionsFromEnv(): HostOptions {
  return {
    baseDomain: process.env.APP_BASE_DOMAIN ?? "",
    trustProxyHeaders: process.env.TRUST_PROXY_HEADERS === "true",
    devFallback: process.env.NODE_ENV !== "production",
  };
}

export function resolveTenantHost(
  headers: HostHeaders,
  options: HostOptions = hostOptionsFromEnv(),
): TenantHost {
  // The last X-Forwarded-Host entry is the one our own proxy wrote.
  const forwarded = headers.forwardedHost?.split(",").at(-1)?.trim() ?? "";
  const host =
    options.trustProxyHeaders && forwarded ? forwarded : (headers.host ?? "");
  const resolved = classifyHost(host, options.baseDomain);
  if (resolved.kind !== "apex" || !options.devFallback) return resolved;

  for (const candidate of [forwarded, hostFromUrl(headers.origin), hostFromUrl(headers.referer)]) {
    if (!candidate) continue;
    const fallback = classifyHost(candidate, options.baseDomain);
    if (fallback.kind === "tenant") return fallback;
  }
  return resolved;
}

/** Same resolution from a Headers-like object (proxy, tenant context, manifest). */
export function resolveTenantFromHeaders(list: {
  get(name: string): string | null;
}): TenantHost {
  return resolveTenantHost({
    host: list.get("host"),
    forwardedHost: list.get("x-forwarded-host"),
    origin: list.get("origin"),
    referer: list.get("referer"),
  });
}
