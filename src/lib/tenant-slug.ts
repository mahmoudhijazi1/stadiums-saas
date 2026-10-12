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

/** The last X-Forwarded-Host entry is the one our own proxy wrote. */
function forwardedOf(headers: HostHeaders): string {
  return headers.forwardedHost?.split(",").at(-1)?.trim() ?? "";
}

/** The Host the request is served on: X-Forwarded-Host only when it is trusted. */
function requestHost(headers: HostHeaders, options: HostOptions): string {
  const forwarded = forwardedOf(headers);
  return options.trustProxyHeaders && forwarded ? forwarded : (headers.host ?? "");
}

/**
 * True only when the request is for exactly the bare APP_BASE_DOMAIN: not www, not any
 * subdomain, not an invalid host. Strict on purpose: unlike `resolveTenantHost` it never lets
 * Origin or Referer change the answer (the development fallback), so a page that must live only
 * on the bare host (the platform admin, DR-006) cannot be reached by a header trick.
 */
export function isBareHost(headers: HostHeaders, options: HostOptions = hostOptionsFromEnv()): boolean {
  return classifyHost(requestHost(headers, options), options.baseDomain).kind === "apex";
}

export function resolveTenantHost(
  headers: HostHeaders,
  options: HostOptions = hostOptionsFromEnv(),
): TenantHost {
  const forwarded = forwardedOf(headers);
  const host = requestHost(headers, options);
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

/** `isBareHost` from a Headers-like object (the proxy). */
export function isBareHostFromHeaders(list: { get(name: string): string | null }): boolean {
  return isBareHost({ host: list.get("host"), forwardedHost: list.get("x-forwarded-host") });
}

/**
 * The one rule for serving the platform admin (DR-006): exactly the bare host, and in production
 * only when APP_PROTOCOL is https. The proxy and the server-side guard (`requirePlatformHost`) both
 * call it, so they can never disagree. Reads headers and two env values only.
 */
export function platformServed(
  list: { get(name: string): string | null },
  env: { NODE_ENV?: string; APP_PROTOCOL?: string } = process.env,
): boolean {
  const insecureProduction = env.NODE_ENV === "production" && env.APP_PROTOCOL !== "https";
  return isBareHostFromHeaders(list) && !insecureProduction;
}

/**
 * Is this request path the platform admin? The path is percent-decoded first, because Next decodes
 * it when it matches a route: "/%70latform" and "/platform%2F" reach /platform. A malformed
 * escape counts as platform when it spells the word, so it fails closed.
 */
export function isPlatformPath(pathname: string): boolean {
  let path = pathname;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    return /platform/i.test(pathname);
  }
  return path === "/platform" || path.startsWith("/platform/");
}
