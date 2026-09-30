/**
 * Bidi controls (U+061C, U+200E/F, U+202A–202E, U+2066–2069), zero-width
 * space and BOM. ZWNJ/ZWJ (U+200C/D) are kept: Arabic-script names need them.
 */
const INVISIBLE = /[؜​‎‏‪-‮⁦-⁩﻿]/g;
/** C0/C1 controls that are not whitespace (whitespace is collapsed below). */
const CONTROL = /[\u0000-\u0008\u000E-\u001F\u007F-\u0084\u0086-\u009F]/g;

/**
 * Display name written on every Person create (security audit S-14).
 * Drop invisible and control characters, trim, collapse inner whitespace
 * (tabs and newlines included), and drop combining marks at the start only.
 * Marks inside the name (Arabic tashkeel) stay. Search folding is normalizeName.
 */
export function cleanPersonName(raw: string): string {
  const visible = raw.replace(INVISIBLE, "").replace(CONTROL, "").replace(/\u0085/g, " ");
  const collapsed = visible.trim().replace(/\s+/g, " ");
  return collapsed.replace(/^\p{M}+/u, "").trim();
}
