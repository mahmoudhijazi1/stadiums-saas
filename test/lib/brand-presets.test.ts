import { describe, expect, it } from "@jest/globals";
import {
  BRAND_PRESETS,
  BRAND_PRESET_KEYS,
  DEFAULT_BRAND_PRESET,
  NEUTRAL_BRAND,
  brandColors,
  contrastRatio,
  isBrandPresetKey,
} from "@/lib/brand-presets";

/** Written, not run when authored. The eight logo colours. */
describe("brand presets", () => {
  it("has eight presets with distinct keys and a default that exists", () => {
    expect(BRAND_PRESETS).toHaveLength(8);
    expect(new Set(BRAND_PRESET_KEYS).size).toBe(8);
    expect(isBrandPresetKey(DEFAULT_BRAND_PRESET)).toBe(true);
  });

  it("every text colour has at least 4.5:1 contrast on its background", () => {
    for (const preset of BRAND_PRESETS) {
      expect({ key: preset.key, ok: contrastRatio(preset.background, preset.text) >= 4.5 }).toEqual({
        key: preset.key,
        ok: true,
      });
    }
    expect(contrastRatio(NEUTRAL_BRAND.background, NEUTRAL_BRAND.text)).toBeGreaterThanOrEqual(4.5);
  });

  it("computes the WCAG ratio (black on white is 21, a colour on itself is 1)", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#1F6F4A", "#1F6F4A")).toBeCloseTo(1, 5);
  });

  it("maps a key to fixed colours and refuses anything that is not a key", () => {
    expect(brandColors("green")).toEqual({ background: "#1F6F4A", text: "#FFFFFF" });
    expect(isBrandPresetKey("#ff0000")).toBe(false);
    expect(isBrandPresetKey("javascript:1")).toBe(false);
    expect(isBrandPresetKey(undefined)).toBe(false);
  });
});
