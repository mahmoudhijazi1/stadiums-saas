import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";
import { BRAND_PRESETS } from "@/modules/stadium/domain/brand-presets";
import { HEADER_TINT_PERCENT } from "@/modules/stadium/ui/pitch-arc";
import { NEAREST_PILL_TINT_PERCENT } from "@/modules/booking/ui/time-rows";

/**
 * Text on the public page's top gradient (a tint of each stadium preset over the page background)
 * must reach 4.5:1 in both themes. The mix is done in OKLab like CSS `color-mix(in oklab, ...)`.
 * The tint is at its strongest at the top of the gradient, so that is the worst case.
 */
const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");
const token = (name: string): string => {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!match) throw new Error(`token ${name} not found`);
  return match[1]!;
};

type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as Rgb;
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const unlin = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const luminance = ([r, g, b]: Rgb) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

function toOklab([r, g, b]: Rgb): Rgb {
  const [lr, lg, lb] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function fromOklab([L, a, b]: Rgb): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const out = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return out.map((c) => Math.min(1, Math.max(0, unlin(Math.max(0, c))))) as Rgb;
}
const mix = (a: Rgb, b: Rgb, t: number): Rgb => {
  const [A, B] = [toOklab(a), toOklab(b)];
  return fromOklab([0, 1, 2].map((i) => A[i]! * t + B[i]! * (1 - t)) as Rgb);
};

const THEMES = {
  light: { bg: token("ls-paper-100"), ink: token("ls-carbon-900"), muted: token("ls-carbon-500"), surface: token("ls-paper-50") },
  dark: { bg: token("ls-carbon-900"), ink: token("ls-paper-100"), muted: token("ls-carbon-300"), surface: token("ls-carbon-800") },
} as const;

describe("text on the public header gradient", () => {
  for (const [theme, colours] of Object.entries(THEMES) as [keyof typeof THEMES, (typeof THEMES)[keyof typeof THEMES]][]) {
    it(`reaches 4.5:1 (ink and muted ink) for every preset in the ${theme} theme`, () => {
      const worst = { ink: 99, muted: 99 };
      for (const preset of BRAND_PRESETS) {
        const top = mix(rgb(preset[theme].fill), rgb(colours.bg), HEADER_TINT_PERCENT / 100);
        worst.ink = Math.min(worst.ink, ratio(rgb(colours.ink), top));
        worst.muted = Math.min(worst.muted, ratio(rgb(colours.muted), top));
      }
      expect(worst.ink).toBeGreaterThanOrEqual(4.5);
      expect(worst.muted).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("the Nearest pill (accent text on a light accent tint of the surface) reaches 4.5:1 for every preset", () => {
    for (const theme of ["light", "dark"] as const) {
      const tint = NEAREST_PILL_TINT_PERCENT / 100;
      for (const preset of BRAND_PRESETS) {
        const pill = mix(rgb(preset[theme].fill), rgb(THEMES[theme].surface), tint);
        expect(ratio(rgb(preset[theme].ink), pill)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
