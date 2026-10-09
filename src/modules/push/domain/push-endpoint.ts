/**
 * The server POSTs to whatever endpoint a browser registers, so an unchecked endpoint is an SSRF
 * hole (an attacker "subscribes" with http://169.254.169.254/... or an internal host). Only the
 * browser vendors' push services are accepted. ONE list, here.
 *
 * Verification: web-push's own README and source only show fcm.googleapis.com. The other hosts
 * come from the vendors' public documentation and are UNVERIFIED in this repo; if a real browser
 * is refused, its endpoint host is in the "Push subscribe refused" log line (host only).
 */
export const PUSH_ENDPOINT_HOSTS = {
  /** The hostname must equal one of these. */
  exact: [
    "fcm.googleapis.com", // Chrome, Edge, Android (verified: web-push README)
    "updates.push.services.mozilla.com", // Firefox (UNVERIFIED)
    "web.push.apple.com", // Safari, iOS home-screen apps (UNVERIFIED)
  ],
  /** Or end with "." + one of these (a dot boundary: evilnotify.windows.com never matches). */
  suffixes: [
    "push.services.mozilla.com", // Firefox regional hosts (UNVERIFIED)
    "push.apple.com", // Apple regional hosts (UNVERIFIED)
    "notify.windows.com", // Edge on Windows, WNS (UNVERIFIED)
  ],
} as const;

export const PUSH_ENDPOINT_MAX_LENGTH = 2048;

export type PushEndpointCheck = { ok: true; url: string; host: string } | { ok: false };

/** https only, no userinfo, no explicit port, allowlisted host, at most 2048 characters. */
export function validatePushEndpoint(raw: unknown): PushEndpointCheck {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > PUSH_ENDPOINT_MAX_LENGTH) {
    return { ok: false };
  }
  // Printable ASCII only: no spaces, control characters, backslashes (URL parsers treat "\" as "/")
  // or non-ASCII host tricks.
  if (!/^[\x21-\x7e]+$/.test(raw) || raw.includes("\\")) return { ok: false };
  if (!/^https:\/\//i.test(raw)) return { ok: false };

  // Look at the authority in the raw text: URL.port is "" for an explicit ":443", so a parsed URL
  // cannot tell "no port" from "default port".
  const authority = raw.slice("https://".length).split(/[/?#]/, 1)[0];
  if (authority.includes("@") || authority.includes(":") || authority.includes("[")) {
    return { ok: false };
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false };
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return { ok: false };

  const host = url.hostname;
  if (!isAllowedHost(host)) return { ok: false };
  return { ok: true, url: url.toString(), host };
}

function isAllowedHost(host: string): boolean {
  // IP literals and "localhost" cannot match the lists below, but refuse them outright so the
  // intent survives a future edit of the lists.
  if (host === "localhost" || /^[\d.]+$/.test(host) || host.includes(":")) return false;
  if ((PUSH_ENDPOINT_HOSTS.exact as readonly string[]).includes(host)) return true;
  return PUSH_ENDPOINT_HOSTS.suffixes.some((suffix) => host.endsWith(`.${suffix}`));
}
