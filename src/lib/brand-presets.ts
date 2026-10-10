/**
 * The stadium's colour: five presets, one constant. A stadium picks a KEY; nothing else (no hex,
 * no free text) ever reaches the CSS or the logo. Each preset gives, for the light and the dark
 * theme, the four values the app's accent tokens take:
 *   fill   -> --brand        the fill of primary buttons, the active pill (dark), highlights
 *   onFill -> --brand-ink    the text on that fill
 *   ink    -> --action-ink   accent-coloured text and links on the page background
 *   ring   -> --ring         the focus ring
 *
 * Lime is the default and reproduces the colours the app always had. The others are blue
 * families (royal, sky, indigo) and mono (graphite). Orange, gold, green and red are NOT offered:
 * those hues are reserved for owed (amber), paid (green) and destructive (coral), and an accent in
 * them would be mistaken for a status. Teal was tried and dropped: in the light theme no teal with
 * a real chroma stays 0.15 OKLab away from the paid green token (best 0.09 to 0.14 at a usable
 * chroma), so it cannot pass test/lib/brand-presets.test.ts.
 *
 * Every non-lime value is tested against the real status tokens in globals.css (text 4.5:1, ring
 * and fill 3:1, hue at least 40 degrees and OKLab distance at least 0.15 from paid, owed and
 * destructive); mono is neutral by design. Lime is the grandfathered default and is exempt from
 * the fill-visibility and status-distance checks (its light fill is 1.05:1 on paper; its dark fill
 * is 36.7 degrees from the dark owed amber): the numbers are in docs/progress.md.
 */
export type AccentSet = { fill: string; onFill: string; ink: string; ring: string };

export const BRAND_PRESETS = [
  {
    key: "lime",
    light: { fill: "#D7FF3F", onFill: "#111412", ink: "#111412", ring: "#111412" },
    dark: { fill: "#D7FF3F", onFill: "#111412", ink: "#D7FF3F", ring: "#D7FF3F" },
  },
  {
    key: "royal",
    light: { fill: "#2E55D1", onFill: "#FFFFFF", ink: "#2E55D1", ring: "#2E55D1" },
    dark: { fill: "#8AB0FE", onFill: "#0B111F", ink: "#8AB0FE", ring: "#8AB0FE" },
  },
  {
    key: "sky",
    light: { fill: "#0072B7", onFill: "#FFFFFF", ink: "#0072B7", ring: "#0072B7" },
    dark: { fill: "#49BDFF", onFill: "#04131D", ink: "#49BDFF", ring: "#49BDFF" },
  },
  {
    key: "indigo",
    light: { fill: "#6244CB", onFill: "#FFFFFF", ink: "#6244CB", ring: "#6244CB" },
    dark: { fill: "#A7A5FF", onFill: "#10101E", ink: "#A7A5FF", ring: "#A7A5FF" },
  },
  {
    // Graphite: near-black with white text in the light theme, near-white with dark text in the dark.
    key: "mono",
    light: { fill: "#1B1F1D", onFill: "#FFFFFF", ink: "#1B1F1D", ring: "#1B1F1D" },
    dark: { fill: "#F1F0EA", onFill: "#111412", ink: "#F1F0EA", ring: "#F1F0EA" },
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
