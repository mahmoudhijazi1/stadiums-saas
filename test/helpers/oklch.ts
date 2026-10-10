/**
 * Colour maths for the accent tests: sRGB hex <-> OKLab/OKLCH (Bjorn Ottosson's matrices) and the
 * WCAG contrast ratio. Test-only; the app does not need it.
 */
function toLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function rgbOf(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
}

export type Lab = { L: number; a: number; b: number };

export function oklabOf(hex: string): Lab {
  const [r, g, b] = rgbOf(hex).map(toLinear) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

/** OKLCH hue in degrees, 0 to 360. */
export function hueOf(hex: string): number {
  const { a, b } = oklabOf(hex);
  return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
}

export function chromaOf(hex: string): number {
  const { a, b } = oklabOf(hex);
  return Math.hypot(a, b);
}

/** The shorter way round the hue circle, 0 to 180 degrees. */
export function hueDistance(first: string, second: string): number {
  const gap = Math.abs(hueOf(first) - hueOf(second)) % 360;
  return gap > 180 ? 360 - gap : gap;
}

/** Euclidean distance in OKLab. */
export function oklabDistance(first: string, second: string): number {
  const p = oklabOf(first);
  const q = oklabOf(second);
  return Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);
}

function luminance(hex: string): number {
  const [r, g, b] = rgbOf(hex).map(toLinear) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(first: string, second: string): number {
  const x = luminance(first);
  const y = luminance(second);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
