/**
 * The stadium's colour: eight presets, one constant. A stadium picks a KEY; nothing else (no hex,
 * no free text) ever reaches the CSS or the logo. Each preset gives, for the light and the dark
 * theme, the four values the app's accent tokens take:
 *   fill   -> --brand        the fill of primary buttons, the active pill (dark), highlights
 *   onFill -> --brand-ink    the text on that fill
 *   ink    -> --action-ink   accent-coloured text and links on the page background
 *   ring   -> --ring         the focus ring
 * Lime is the default and reproduces the colours the app always had. None of the others is near
 * green, amber or red: those hues belong to the money states (paid, owed) and to destructive
 * actions, which never come from a preset.
 *
 * Contrast, measured with `contrastRatio` (WCAG; the test recomputes them). Text needs 4.5:1,
 * the ring 3:1. "bg" is the page (#F6F5EF light, #111412 dark), "surface" the card (#FFFFFF,
 * #1A1F1C); the lower of the two is shown.
 *
 *   preset    theme  onFill/fill  ink (min)  ring (min)
 *   lime      light  16.13        16.97      16.97
 *   lime      dark   16.13        14.53      14.53
 *   blue      light   5.17         6.14       4.73
 *   blue      dark    7.36         6.57       6.57
 *   sky       light   5.93         6.92       5.43
 *   sky       dark    6.48         7.80       7.80
 *   indigo    light   6.29         7.24       5.76
 *   indigo    dark    5.36         5.60       5.60
 *   violet    light   5.70         6.50       5.22
 *   violet    dark    5.60         6.14       6.14
 *   pink      light   4.60         5.53       4.21
 *   pink      dark    5.68         6.31       6.31
 *   fuchsia   light   4.71         5.79       4.31
 *   fuchsia   dark    6.02         6.79       6.79
 *   graphite  light  10.35         9.48       9.48
 *   graphite  dark   12.02        11.26      11.26
 */
export type AccentSet = { fill: string; onFill: string; ink: string; ring: string };

export const BRAND_PRESETS = [
  {
    key: "lime",
    light: { fill: "#D7FF3F", onFill: "#111412", ink: "#111412", ring: "#111412" },
    dark: { fill: "#D7FF3F", onFill: "#111412", ink: "#D7FF3F", ring: "#D7FF3F" },
  },
  {
    key: "blue",
    light: { fill: "#2563EB", onFill: "#FFFFFF", ink: "#1D4ED8", ring: "#2563EB" },
    dark: { fill: "#60A5FA", onFill: "#0B1220", ink: "#60A5FA", ring: "#60A5FA" },
  },
  {
    key: "sky",
    light: { fill: "#0369A1", onFill: "#FFFFFF", ink: "#075985", ring: "#0369A1" },
    dark: { fill: "#38BDF8", onFill: "#082F49", ink: "#38BDF8", ring: "#38BDF8" },
  },
  {
    key: "indigo",
    light: { fill: "#4F46E5", onFill: "#FFFFFF", ink: "#4338CA", ring: "#4F46E5" },
    dark: { fill: "#818CF8", onFill: "#1E1B4B", ink: "#818CF8", ring: "#818CF8" },
  },
  {
    key: "violet",
    light: { fill: "#7C3AED", onFill: "#FFFFFF", ink: "#6D28D9", ring: "#7C3AED" },
    dark: { fill: "#A78BFA", onFill: "#2E1065", ink: "#A78BFA", ring: "#A78BFA" },
  },
  {
    key: "pink",
    light: { fill: "#DB2777", onFill: "#FFFFFF", ink: "#BE185D", ring: "#DB2777" },
    dark: { fill: "#F472B6", onFill: "#500724", ink: "#F472B6", ring: "#F472B6" },
  },
  {
    key: "fuchsia",
    light: { fill: "#C026D3", onFill: "#FFFFFF", ink: "#A21CAF", ring: "#C026D3" },
    dark: { fill: "#E879F9", onFill: "#4A044E", ink: "#E879F9", ring: "#E879F9" },
  },
  {
    key: "graphite",
    light: { fill: "#334155", onFill: "#FFFFFF", ink: "#334155", ring: "#334155" },
    dark: { fill: "#CBD5E1", onFill: "#0F172A", ink: "#CBD5E1", ring: "#CBD5E1" },
  },
] as const satisfies ReadonlyArray<{ key: string; light: AccentSet; dark: AccentSet }>;

export type BrandPresetKey = (typeof BRAND_PRESETS)[number]["key"];

export const BRAND_PRESET_KEYS = BRAND_PRESETS.map((preset) => preset.key) as [
  BrandPresetKey,
  ...BrandPresetKey[],
];

/** What a stadium that never chose gets, and what an unknown key falls back to. */
export const DEFAULT_BRAND_PRESET: BrandPresetKey = "lime";

/** The neutral lebstads icon (unknown or suspended stadium): the app's own dark and paper colours. */
export const NEUTRAL_BRAND = { background: "#111412", text: "#F6F5EF" } as const; // 16.97:1

/** The page and card colours the accent text and ring must read on, per theme. */
export const THEME_SURFACES = {
  light: { bg: "#F6F5EF", surface: "#FFFFFF" },
  dark: { bg: "#111412", surface: "#1A1F1C" },
} as const;

export function isBrandPresetKey(value: unknown): value is BrandPresetKey {
  return BRAND_PRESETS.some((preset) => preset.key === value);
}

/** The preset of a key; an unknown key, null or undefined gives the default. Never throws. */
export function presetOf(key: unknown): (typeof BRAND_PRESETS)[number] {
  return BRAND_PRESETS.find((preset) => preset.key === key) ?? BRAND_PRESETS[0];
}

/** The logo colours of a preset: its light-theme fill with the text on it. */
export function brandColors(key: BrandPresetKey): { background: string; text: string } {
  const preset = presetOf(key);
  return { background: preset.light.fill, text: preset.light.onFill };
}

function channel(hex: string, start: number): number {
  const value = parseInt(hex.slice(start, start + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

/** WCAG contrast ratio of two #RRGGBB colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
