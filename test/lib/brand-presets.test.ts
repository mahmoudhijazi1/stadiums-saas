import { describe, expect, it } from "@jest/globals";
import {
  BRAND_PRESETS,
  BRAND_PRESET_KEYS,
  DEFAULT_BRAND_PRESET,
  NEUTRAL_BRAND,
  brandColors,
  contrastRatio,
  isBrandPresetKey,
  presetOf,
} from "@/lib/brand-presets";
import { statusTokens, surfaceTokens, tokenHex } from "../helpers/css-tokens";
import { chromaOf, contrast, hueDistance, oklabDistance } from "../helpers/oklch";

/**
 * Written, not run when authored. The five accent presets, measured against the REAL status and
 * surface tokens read from src/app/globals.css (never copied), in both themes. No threshold is
 * lowered to make a preset pass; a preset that cannot pass is dropped (teal was).
 *
 * Lime is the grandfathered default ("values unchanged"): it is checked for what it always had
 * (text contrast, ink, ring) and is exempt from the two checks it cannot meet: its light fill is
 * about 1.05:1 on paper, and its dark fill sits 36.7 degrees from the dark owed amber.
 */
const THEMES = ["light", "dark"] as const;
const HEX = /^#[0-9A-F]{6}$/;
const CHROMATIC = BRAND_PRESETS.filter((preset) => preset.key !== "lime" && preset.key !== "mono");
const MONO_CHROMA_LIMIT = 0.03;

describe("accent presets: the set", () => {
  it("has exactly these five, lime first and the default", () => {
    expect(BRAND_PRESET_KEYS).toEqual(["lime", "royal", "sky", "indigo", "mono"]);
    expect(DEFAULT_BRAND_PRESET).toBe("lime");
    expect(isBrandPresetKey(DEFAULT_BRAND_PRESET)).toBe(true);
    expect(new Set(BRAND_PRESET_KEYS).size).toBe(BRAND_PRESETS.length);
  });

  it("offers none of the removed or reserved presets", () => {
    for (const gone of ["pink", "fuchsia", "violet", "graphite", "blue", "teal", "green", "red", "orange", "gold", "amber", "purple", "slate"]) {
      expect({ gone, offered: isBrandPresetKey(gone) }).toEqual({ gone, offered: false });
    }
  });

  it("every value is a #RRGGBB hex", () => {
    for (const preset of BRAND_PRESETS) {
      for (const theme of THEMES) {
        for (const [name, value] of Object.entries(preset[theme])) {
          expect({ key: preset.key, theme, name, ok: HEX.test(value) }).toEqual({ key: preset.key, theme, name, ok: true });
        }
      }
    }
  });

  it("lime keeps the values it always had", () => {
    expect(presetOf("lime").light).toEqual({ fill: "#D7FF3F", onFill: "#111412", ink: "#111412", ring: "#111412" });
    expect(presetOf("lime").dark).toEqual({ fill: "#D7FF3F", onFill: "#111412", ink: "#D7FF3F", ring: "#D7FF3F" });
  });

  it("a key that does not exist (a stored removed key, junk) falls back to lime and never throws", () => {
    for (const junk of ["pink", "violet", "teal", "#ff0000", "javascript:1", "", "LIME", null, undefined, 42, {}]) {
      expect(isBrandPresetKey(junk)).toBe(false);
      expect(presetOf(junk).key).toBe("lime");
    }
  });
});

describe("contrast, for every preset and both themes", () => {
  it("text on the fill is at least 4.5:1", () => {
    for (const preset of BRAND_PRESETS) {
      for (const theme of THEMES) {
        const set = preset[theme];
        expect({ key: preset.key, theme, ratio: contrast(set.onFill, set.fill) >= 4.5 }).toEqual({ key: preset.key, theme, ratio: true });
      }
    }
  });

  it("accent text (ink) is at least 4.5:1 on the page background and on the card surface", () => {
    for (const preset of BRAND_PRESETS) {
      for (const theme of THEMES) {
        const { bg, surface } = surfaceTokens(theme);
        const worst = Math.min(contrast(preset[theme].ink, bg), contrast(preset[theme].ink, surface));
        expect({ key: preset.key, theme, ok: worst >= 4.5 }).toEqual({ key: preset.key, theme, ok: true });
      }
    }
  });

  it("the focus ring is at least 3:1 on the page, the card and the neutral tile it can sit on", () => {
    for (const preset of BRAND_PRESETS) {
      for (const theme of THEMES) {
        const { bg, surface, expectedTile } = surfaceTokens(theme);
        const worst = Math.min(
          contrast(preset[theme].ring, bg),
          contrast(preset[theme].ring, surface),
          contrast(preset[theme].ring, expectedTile),
        );
        expect({ key: preset.key, theme, ok: worst >= 3 }).toEqual({ key: preset.key, theme, ok: true });
      }
    }
  });

  it("the fill is at least 3:1 against the page background, so a filled button is visible (lime exempt)", () => {
    for (const preset of BRAND_PRESETS.filter((candidate) => candidate.key !== "lime")) {
      for (const theme of THEMES) {
        const { bg } = surfaceTokens(theme);
        expect({ key: preset.key, theme, ok: contrast(preset[theme].fill, bg) >= 3 }).toEqual({ key: preset.key, theme, ok: true });
      }
    }
  });

  it("lime's fill is visible in the dark theme, and its light fill is the documented exception", () => {
    expect(contrast(presetOf("lime").dark.fill, surfaceTokens("dark").bg)).toBeGreaterThanOrEqual(3);
    expect(contrast(presetOf("lime").light.fill, surfaceTokens("light").bg)).toBeLessThan(3);
  });
});

describe("no confusion with the status colours (read from globals.css)", () => {
  it("the status tokens are the ones the app uses: paid green, owed amber, destructive coral", () => {
    expect(tokenHex("light", "--paid")).toBe("#047857");
    expect(tokenHex("dark", "--paid")).toBe("#34D399");
    expect(tokenHex("light", "--owed")).toBe("#92400E");
    expect(tokenHex("dark", "--owed")).toBe("#FBBF24");
    expect(tokenHex("light", "--alert")).toBe("#FF6B3D");
  });

  it("each chromatic fill is at least 40 degrees of OKLCH hue away from paid, owed and destructive", () => {
    for (const preset of CHROMATIC) {
      for (const theme of THEMES) {
        for (const [status, value] of Object.entries(statusTokens(theme))) {
          const gap = hueDistance(preset[theme].fill, value);
          expect({ key: preset.key, theme, status, ok: gap >= 40 }).toEqual({ key: preset.key, theme, status, ok: true });
        }
      }
    }
  });

  it("each chromatic fill is at least 0.15 away in OKLab from paid, owed and destructive", () => {
    for (const preset of CHROMATIC) {
      for (const theme of THEMES) {
        for (const [status, value] of Object.entries(statusTokens(theme))) {
          const distance = oklabDistance(preset[theme].fill, value);
          expect({ key: preset.key, theme, status, ok: distance >= 0.15 }).toEqual({ key: preset.key, theme, status, ok: true });
        }
      }
    }
  });

  it("the chromatic presets are blue families (nothing near green, amber or red)", () => {
    for (const preset of CHROMATIC) {
      for (const theme of THEMES) {
        const hue = (value: string) => hueDistance(value, "#0000FF"); // OKLCH hue of pure blue is about 264
        expect({ key: preset.key, theme, ok: hue(preset[theme].fill) <= 40 }).toEqual({ key: preset.key, theme, ok: true });
      }
    }
  });

  it("mono stays neutral (chroma under the limit) and differs from the expected tile by at least 3:1", () => {
    const mono = presetOf("mono");
    for (const theme of THEMES) {
      expect({ theme, ok: chromaOf(mono[theme].fill) < MONO_CHROMA_LIMIT }).toEqual({ theme, ok: true });
      expect({ theme, ok: contrast(mono[theme].fill, surfaceTokens(theme).expectedTile) >= 3 }).toEqual({ theme, ok: true });
    }
  });

  it("mono is a near-black fill with white text in light and a near-white fill with dark text in dark", () => {
    const mono = presetOf("mono");
    expect(contrast(mono.light.fill, "#000000")).toBeLessThan(2);
    expect(mono.light.onFill).toBe("#FFFFFF");
    expect(contrast(mono.dark.fill, "#FFFFFF")).toBeLessThan(1.3);
    expect(contrast(mono.dark.onFill, "#000000")).toBeLessThan(2);
  });
});

describe("the logo and helpers", () => {
  it("the logo keeps 4.5:1 for every preset and for the neutral icon", () => {
    for (const preset of BRAND_PRESETS) {
      const logo = brandColors(preset.key);
      expect(contrastRatio(logo.background, logo.text)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(NEUTRAL_BRAND.background, NEUTRAL_BRAND.text)).toBeGreaterThanOrEqual(4.5);
  });

  it("the app's own WCAG helper agrees with the test helper", () => {
    for (const preset of BRAND_PRESETS) {
      expect(contrastRatio(preset.light.fill, preset.light.onFill)).toBeCloseTo(contrast(preset.light.fill, preset.light.onFill), 6);
    }
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  });

  it("maps a key to its light fill and text for the logo", () => {
    expect(brandColors("royal")).toEqual({ background: "#2E55D1", text: "#FFFFFF" });
    expect(brandColors("mono")).toEqual({ background: "#1B1F1D", text: "#FFFFFF" });
  });
});
