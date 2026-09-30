/**
 * Tenant slugs (decision 3). The slug is the subdomain: 3–30 characters,
 * lowercase letters, digits and hyphens, no leading or trailing hyphen.
 * Slugs are immutable (printed QR codes, PWA installs and shared links use them).
 */
export const SLUG_MIN = 3;
export const SLUG_MAX = 30;

/**
 * Explicit DNS records (mail, www, …) override the wildcard, so a tenant with
 * one of these slugs would be unreachable; the rest are kept for the platform.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "www", "mail", "webmail", "ftp", "smtp", "imap", "pop", "ns1", "ns2",
  "admin", "api", "app", "static", "assets", "cdn", "status", "support",
  "help", "dashboard", "login", "panel", "cpanel", "test",
]);

const FORMAT = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export type SlugCheck =
  | { ok: true }
  | { ok: false; reason: "length" | "format" | "reserved" };

export function validateSlug(slug: string): SlugCheck {
  if (slug.length < SLUG_MIN || slug.length > SLUG_MAX) return { ok: false, reason: "length" };
  if (!FORMAT.test(slug)) return { ok: false, reason: "format" };
  if (RESERVED_SLUGS.has(slug)) return { ok: false, reason: "reserved" };
  return { ok: true };
}
