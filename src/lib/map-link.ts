/**
 * The only map links a stadium may publish: https, a Google Maps host and (where the host is a
 * general Google host) a /maps path. One constant; anything else is refused, and the same check
 * runs again when settings are read, so a stored value that is not one of these is never rendered
 * as a link. Lookalikes (google.com.evil.com, evil.com/google.com/maps) fail: the host is matched
 * exactly, never by "contains".
 */
export const MAP_LINK_HOSTS: ReadonlyArray<{ host: string; pathPrefix: string | null }> = [
  { host: "google.com", pathPrefix: "/maps" },
  { host: "www.google.com", pathPrefix: "/maps" },
  { host: "maps.google.com", pathPrefix: null },
  { host: "maps.app.goo.gl", pathPrefix: null },
  { host: "goo.gl", pathPrefix: "/maps" },
];

export const MAP_LINK_MAX = 300;

export function isAllowedMapLink(raw: string): boolean {
  if (raw.length === 0 || raw.length > MAP_LINK_MAX) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username !== "" || url.password !== "" || url.port !== "") return false;
  const rule = MAP_LINK_HOSTS.find((candidate) => candidate.host === url.hostname);
  if (!rule) return false;
  if (rule.pathPrefix === null) return true;
  return url.pathname === rule.pathPrefix || url.pathname.startsWith(`${rule.pathPrefix}/`);
}
