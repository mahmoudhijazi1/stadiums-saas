import { describe, expect, it } from "@jest/globals";
import {
  BRAND_PRESETS,
  BRAND_PRESET_KEYS,
  DEFAULT_BRAND_PRESET,
  NEUTRAL_BRAND,
  THEME_SURFACES,
  brandColors,
  contrastRatio,
  isBrandPresetKey,
  presetOf,
} from "@/lib/brand-presets";

/** Written, not run when authored. The eight accent presets. */
const THEMES = ["light", "dark"] as const;
const HEX = /^#[0-9A-F]{6}$/;

describe("accent presets", () => {
  it("has eight presets with distinct keys, lime is the default and exists", () => {
    expect(BRAND_PRESETS).toHaveLength(8);
    expect(new Set(BRAND_PRESET_KEYS).size).toBe(8);
    expect(DEFAULT_BRAND_PRESET).toBe("lime");
    expect(isBrandPresetKey(DEFAULT_BRAND_PRESET)).toBe(true);
    expect(BRAND_PRESET_KEYS).toEqual(["lime", "blue", "sky", "indigo", "violet", "pink", "fuchsia", "graphite"]);
  });

  it("every value is a #RRGGBB hex, for fill, onFill, ink and ring in both themes", () => {
    for (const preset of BRAND_PRESETS) {
      for (const theme of THEMES) {
        for (const [name, value] of Object.entries(preset[theme])) {
          expect({ key: preset.key, theme, name, ok: HEX.test(value) }).toEqual({ key: preset.key, theme, name, ok: true });
        }
      }
    }
  });

  it("text on the fill has at least 4.5:1 in both themes", () => {
    for (const preset of BRAND_PRESETS) {
      for (const theme of THEMES) {
        const set = preset[theme];
        const ratio = contrastRatio(set.fill, set.onFill);
        expect({ key: preset.key, theme, ok: ratio >= 4.5 }).toEqual({ key: preset.key, theme, ok: true });
      }
    }
  });

  it("accent text has at least 4.5:1 on the page and on the card, in both themes", () => {
    for (const preset of BRAND_PRESETS) {
      for (const theme of THEMES) {
        const { bg, surface } = THEME_SURFACES[theme];
        const worst = Math.min(contrastRatio(preset[theme].ink, bg), contrastRatio(preset[theme].ink, surface));
        expect({ key: preset.key, theme, ok: worst >= 4.5 }).toEqual({ key: preset.key, theme, ok: true });
      }
    }
  });

  it("the focus ring has at least 3:1 on the page and on the card, in both themes", () => {
    for (const preset of BRAND_PRESETS) {
      for (const theme of THEMES) {
        const { bg, surface } = THEME_SURFACES[theme];
        const worst = Math.min(contrastRatio(preset[theme].ring, bg), contrastRatio(preset[theme].ring, surface));
        expect({ key: preset.key, theme, ok: worst >= 3 }).toEqual({ key: preset.key, theme, ok: true });
      }
    }
  });

  it("the default reproduces the colours the app always had", () => {
    expect(presetOf("lime").light).toEqual({ fill: "#D7FF3F", onFill: "#111412", ink: "#111412", ring: "#111412" });
    expect(presetOf("lime").dark).toEqual({ fill: "#D7FF3F", onFill: "#111412", ink: "#D7FF3F", ring: "#D7FF3F" });
  });

  it("no preset other than lime is lime, and none is near green, amber or red", () => {
    for (const preset of BRAND_PRESETS) {
      if (preset.key === "lime") continue;
      for (const theme of THEMES) {
        const hex = preset[theme].fill;
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
        // Not green-dominant (the paid colour) ...
        expect({ key: preset.key, theme, greenDominant: g > r && g > b && g - Math.max(r, b) > 30 }).toEqual({
          key: preset.key,
          theme,
          greenDominant: false,
        });
        // ... and nothing with a red or amber hue: red clearly above blue and green both would be
        // the owed/destructive colours (pink and fuchsia keep blue well above green).
        expect({ key: preset.key, theme, amberOrRed: r > b + 60 && g > b + 60 || r > g + 100 && g >= b }).toEqual({
          key: preset.key,
          theme,
          amberOrRed: false,
        });
      }
    }
  });

  it("the logo and the neutral icon keep 4.5:1", () => {
    for (const preset of BRAND_PRESETS) {
      const logo = brandColors(preset.key);
      expect(contrastRatio(logo.background, logo.text)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(NEUTRAL_BRAND.background, NEUTRAL_BRAND.text)).toBeGreaterThanOrEqual(4.5);
  });

  it("computes the WCAG ratio (black on white is 21, a colour on itself is 1)", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#1F6F4A", "#1F6F4A")).toBeCloseTo(1, 5);
  });

  it("a key maps to fixed values; anything that is not a key is the default and never throws", () => {
    expect(brandColors("blue")).toEqual({ background: "#2563EB", text: "#FFFFFF" });
    for (const junk of ["#ff0000", "javascript:1", "", "LIME", "green", null, undefined, 42, {}]) {
      expect(isBrandPresetKey(junk)).toBe(false);
      expect(presetOf(junk).key).toBe("lime");
    }
  });
});
