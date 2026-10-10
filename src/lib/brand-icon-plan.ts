import {
  brandVersion,
  isBrandIconSize,
  type BrandIconSize,
  type BrandIdentity,
} from "@/lib/brand-identity";
import { brandColors, NEUTRAL_BRAND } from "@/lib/brand-presets";

/**
 * Everything the icon route draws, decided without any I/O so it can be tested: the size, the
 * colours, the symbol and the cache header. The inputs are the size segment, the identity of the
 * Host's stadium (symbol and preset key, or null) and the request's `?v=`. Nothing else.
 */
const SPECS: Record<BrandIconSize, { px: number; radius: number; scale: number }> = {
  "32": { px: 32, radius: 0.2, scale: 0.62 },
  "180": { px: 180, radius: 0, scale: 0.56 }, // apple-touch: a full square, the OS rounds it
  "192": { px: 192, radius: 0.22, scale: 0.56 },
  "512": { px: 512, radius: 0.22, scale: 0.56 },
  // Maskable: full bleed; the symbol is 36% of the size, well inside the central 80% safe zone.
  "512-maskable": { px: 512, radius: 0, scale: 0.36 },
};

/** The symbol of the neutral lebstads icon. */
export const NEUTRAL_SYMBOL = "L";

/** A year for the versioned URL, a few minutes for any other. A stale ?v= never gets "immutable". */
export const CACHE_IMMUTABLE = "public, max-age=31536000, immutable";
export const CACHE_SHORT = "public, max-age=300, must-revalidate";

export type BrandIconPlan = {
  size: BrandIconSize;
  px: number;
  borderRadius: number;
  fontSize: number;
  symbol: string;
  background: string;
  text: string;
  neutral: boolean;
  cacheControl: string;
};

/** Null when the size segment is not one of the five. */
export function planBrandIcon(
  sizeSegment: string,
  identity: BrandIdentity | null,
  requestedVersion: string | null,
): BrandIconPlan | null {
  if (!isBrandIconSize(sizeSegment)) return null;
  const spec = SPECS[sizeSegment];
  const colours = identity ? brandColors(identity.preset) : NEUTRAL_BRAND;
  return {
    size: sizeSegment,
    px: spec.px,
    borderRadius: Math.round(spec.px * spec.radius),
    fontSize: Math.round(spec.px * spec.scale),
    symbol: identity ? identity.symbol : NEUTRAL_SYMBOL,
    background: colours.background,
    text: colours.text,
    neutral: identity === null,
    cacheControl:
      requestedVersion !== null && requestedVersion === brandVersion(identity) ? CACHE_IMMUTABLE : CACHE_SHORT,
  };
}
