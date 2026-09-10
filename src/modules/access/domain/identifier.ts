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
