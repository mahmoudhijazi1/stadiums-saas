/**
 * Login identifier is local@tenant-slug (e.g. owner@ahmad), not a mailbox (DR-003 §2).
 * Normalize first; Zod will reject a value that still fails the shape.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeIdentifier(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * After normalize: one @, local-part non-empty with no spaces, slug same as tenant-slug.
 */
export function parseLoginIdentifier(
  raw: string,
): { local: string; slug: string } | null {
  const value = normalizeIdentifier(raw);
  const at = value.indexOf("@");
  if (at <= 0 || at !== value.lastIndexOf("@") || at === value.length - 1) {
    return null;
  }
  const local = value.slice(0, at);
  const slug = value.slice(at + 1);
  if (local.includes(" ") || !SLUG.test(slug)) {
    return null;
  }
  return { local, slug };
}

/**
 * The part before the @ that an owner may choose for their own login: lowercase letters
 * and digits, with a single "." "_" or "-" between parts (so no "a--b" and no leading or
 * trailing separator), 1 to 32 characters.
 */
const LOCAL_PART = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
export const LOCAL_PART_MAX = 32;

/**
 * Local part from what the user typed. Anything from the first "@" on is dropped (the
 * suffix is always the tenant slug, built by the server). Null when it is not allowed.
 */
export function parseLocalPart(raw: string): string | null {
  const typed = raw.split("@")[0] ?? "";
  const local = normalizeIdentifier(typed);
  if (local.length === 0 || local.length > LOCAL_PART_MAX || !LOCAL_PART.test(local)) return null;
  return local;
}

/** `local@slug`, or null when the local part is not allowed. The slug is the tenant's, never typed. */
export function buildIdentifier(rawLocalPart: string, slug: string): string | null {
  const local = parseLocalPart(rawLocalPart);
  if (!local) return null;
  const full = `${local}@${slug}`;
  const parsed = parseLoginIdentifier(full);
  return parsed && parsed.slug === slug ? full : null;
}
