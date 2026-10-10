import { DEFAULT_BRAND_PRESET, type BrandPresetKey } from "@/lib/brand-presets";

/**
 * What the generated logo is made of, and nothing more: ONE symbol (the first grapheme of the
 * stadium's name when it is a letter or a digit, otherwise a fixed symbol) and a preset KEY. The
 * full name and any other text never reach the image route, its URL or its cache key.
 */
export const FIXED_SYMBOL = "•";

/** A letter or digit, with only non-spacing/spacing marks after it (Arabic tashkeel, accents). */
const LETTER_OR_DIGIT = /^[\p{L}\p{N}][\p{Mn}\p{Mc}]*$/u;

/** The first user-perceived character of the name (a grapheme), or "" for an empty name. */
export function firstGrapheme(name: string): string {
  const trimmed = name.trim();
  if (trimmed === "") return "";
  const segmenter = new Intl.Segmenter("und", { granularity: "grapheme" });
  const first = segmenter.segment(trimmed)[Symbol.iterator]().next();
  return first.done ? "" : first.value.segment;
}

/**
 * The one symbol the logo shows. A letter or digit (Latin letters upper-cased) is kept; an emoji,
 * punctuation, a symbol or an empty name becomes the fixed symbol.
 */
export function brandSymbol(name: string): string {
  const grapheme = firstGrapheme(name);
  if (grapheme === "" || !LETTER_OR_DIGIT.test(grapheme)) return FIXED_SYMBOL;
  return grapheme.toUpperCase();
}

export type BrandIdentity = { symbol: string; preset: BrandPresetKey };

/** The cache version of an icon: changes exactly when the symbol or the preset changes. */
export function brandVersion(identity: BrandIdentity | null): string {
  if (!identity) return "n";
  const code = [...identity.symbol].map((char) => char.codePointAt(0)!.toString(16)).join("-");
  return `${code}.${identity.preset}`;
}

export const BRAND_ICON_SIZES = ["32", "180", "192", "512", "512-maskable"] as const;
export type BrandIconSize = (typeof BRAND_ICON_SIZES)[number];

export function isBrandIconSize(value: string): value is BrandIconSize {
  return (BRAND_ICON_SIZES as readonly string[]).includes(value);
}

/** The icon URL a page links to, versioned so a change shows up. `identity` null = neutral lebstads. */
export function brandIconPath(size: BrandIconSize, identity: BrandIdentity | null): string {
  return `/brand/icon/${size}?v=${encodeURIComponent(brandVersion(identity))}`;
}

/** The identity of a tenant that is known and active (name and preset in, symbol and preset out). */
export function brandIdentityOf(tenant: { name: string; brandPreset?: BrandPresetKey }): BrandIdentity {
  return { symbol: brandSymbol(tenant.name), preset: tenant.brandPreset ?? DEFAULT_BRAND_PRESET };
}
