/**
 * Display name written on Person create.
 * Trim, collapse inner whitespace, and drop combining marks at the start only.
 * Marks inside the name (Arabic tashkeel) stay. Search folding is normalizeName.
 */
export function cleanPersonName(raw: string): string {
  const collapsed = raw.trim().replace(/\s+/g, " ");
  return collapsed.replace(/^\p{M}+/u, "");
}
