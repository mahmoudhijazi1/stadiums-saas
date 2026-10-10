/**
 * The colours a stadium can choose for its generated logo (letter on a coloured square). Eight
 * fixed presets, one constant: the only colour input anywhere is a KEY from this list, never a
 * free hex value. Every pair has at least 4.5:1 contrast (WCAG AA for text), checked below by
 * `contrastRatio` and by a test. The app's own accent colour does not change with this.
 */
export const BRAND_PRESETS = [
  { key: "green", background: "#1F6F4A", text: "#FFFFFF" }, // 6.12:1
  { key: "blue", background: "#1D4ED8", text: "#FFFFFF" }, // 6.70:1
  { key: "red", background: "#B91C1C", text: "#FFFFFF" }, // 6.47:1
  { key: "orange", background: "#B45309", text: "#FFFFFF" }, // 5.02:1
  { key: "purple", background: "#6D28D9", text: "#FFFFFF" }, // 7.10:1
  { key: "teal", background: "#0F766E", text: "#FFFFFF" }, // 5.47:1
  { key: "gold", background: "#FACC15", text: "#1A1A1A" }, // 11.36:1
  { key: "slate", background: "#334155", text: "#FFFFFF" }, // 10.35:1
] as const;

export type BrandPresetKey = (typeof BRAND_PRESETS)[number]["key"];

export const BRAND_PRESET_KEYS = BRAND_PRESETS.map((preset) => preset.key) as [
  BrandPresetKey,
  ...BrandPresetKey[],
];

/** What a stadium that never chose gets. */
export const DEFAULT_BRAND_PRESET: BrandPresetKey = "green";

/** The neutral lebstads icon (unknown or suspended stadium): the app's own dark and paper colours. */
export const NEUTRAL_BRAND = { background: "#111412", text: "#F6F5EF" } as const; // 16.97:1

export function isBrandPresetKey(value: unknown): value is BrandPresetKey {
  return BRAND_PRESETS.some((preset) => preset.key === value);
}

export function brandColors(key: BrandPresetKey): { background: string; text: string } {
  const preset = BRAND_PRESETS.find((candidate) => candidate.key === key) ?? BRAND_PRESETS[0];
  return { background: preset.background, text: preset.text };
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
