import { describe, expect, it } from "@jest/globals";
import {
  FIXED_SYMBOL,
  brandIconPath,
  brandIdentityOf,
  brandSymbol,
  brandVersion,
  firstGrapheme,
  isBrandIconSize,
} from "@/lib/brand-identity";
import { CACHE_IMMUTABLE, CACHE_SHORT, NEUTRAL_SYMBOL, planBrandIcon } from "@/lib/brand-icon-plan";
import { NEUTRAL_BRAND, brandColors } from "@/lib/brand-presets";

/** Written, not run when authored. What the generated logo is made from. */
describe("brandSymbol: the first grapheme", () => {
  it("takes the first Arabic letter", () => {
    expect(brandSymbol("ملعب أحمد")).toBe("م");
  });

  it("keeps Arabic combining marks with their letter", () => {
    expect(firstGrapheme("مَلعب")).toBe("مَ");
    expect(brandSymbol("مَلعب")).toBe("مَ");
  });

  it("upper-cases a Latin letter and skips leading spaces", () => {
    expect(brandSymbol("ahmad stadium")).toBe("A");
    expect(brandSymbol("   Ahmad")).toBe("A");
  });

  it("keeps an accented letter whole", () => {
    expect(brandSymbol("éclair")).toBe("É");
  });

  it("keeps a digit", () => {
    expect(brandSymbol("7 Stars")).toBe("7");
    expect(brandSymbol("٣ نجوم")).toBe("٣");
  });

  it("turns an emoji into the fixed symbol, including ZWJ sequences and flags", () => {
    expect(brandSymbol("⚽ Goal")).toBe(FIXED_SYMBOL);
    expect(brandSymbol("👨‍👩‍👧 Family")).toBe(FIXED_SYMBOL);
    expect(brandSymbol("🇱🇧 Lebanon")).toBe(FIXED_SYMBOL);
    expect(brandSymbol("1️⃣ first")).toBe(FIXED_SYMBOL);
  });

  it("turns punctuation and symbols into the fixed symbol", () => {
    expect(brandSymbol("#1 pitch")).toBe(FIXED_SYMBOL);
    expect(brandSymbol("(Ahmad)")).toBe(FIXED_SYMBOL);
    expect(brandSymbol("$$$")).toBe(FIXED_SYMBOL);
  });

  it("turns an empty or blank name into the fixed symbol", () => {
    expect(brandSymbol("")).toBe(FIXED_SYMBOL);
    expect(brandSymbol("   \n\t")).toBe(FIXED_SYMBOL);
    expect(firstGrapheme("")).toBe("");
  });

  it("is only ever one grapheme, never the rest of the name", () => {
    for (const name of ["Ahmad Stadium", "ملعب أحمد", "7 Stars", "x".repeat(60)]) {
      expect([...new Intl.Segmenter("und", { granularity: "grapheme" }).segment(brandSymbol(name))]).toHaveLength(1);
    }
  });
});

describe("version and paths", () => {
  it("changes with the symbol or the preset, and nothing else", () => {
    const base = brandVersion({ symbol: "A", preset: "lime" });
    expect(brandVersion({ symbol: "A", preset: "lime" })).toBe(base);
    expect(brandVersion({ symbol: "B", preset: "lime" })).not.toBe(base);
    expect(brandVersion({ symbol: "A", preset: "royal" })).not.toBe(base);
    expect(brandVersion(null)).toBe("n");
  });

  it("does not depend on the rest of the name", () => {
    expect(brandVersion(brandIdentityOf({ name: "Ahmad Stadium", brandPreset: "royal" }))).toBe(
      brandVersion(brandIdentityOf({ name: "Ali's Pitch", brandPreset: "royal" })),
    );
  });

  it("builds the versioned path and knows the five sizes", () => {
    expect(brandIconPath("192", { symbol: "A", preset: "lime" })).toBe("/brand/icon/192?v=41.lime");
    expect(brandIconPath("512-maskable", null)).toBe("/brand/icon/512-maskable?v=n");
    for (const size of ["32", "180", "192", "512", "512-maskable"]) expect(isBrandIconSize(size)).toBe(true);
    for (const size of ["16", "1024", "192.png", "../192", ""]) expect(isBrandIconSize(size)).toBe(false);
  });
});

describe("planBrandIcon", () => {
  const green = { symbol: "A", preset: "lime" as const };

  it("is neutral for no identity (unknown or suspended host)", () => {
    const plan = planBrandIcon("192", null, null)!;
    expect(plan).toMatchObject({
      neutral: true,
      symbol: NEUTRAL_SYMBOL,
      background: NEUTRAL_BRAND.background,
      text: NEUTRAL_BRAND.text,
    });
  });

  it("uses only the symbol and the preset colours for a stadium", () => {
    const plan = planBrandIcon("512", green, null)!;
    expect(plan).toMatchObject({ neutral: false, symbol: "A", ...brandColors("lime"), px: 512 });
  });

  it("refuses a size that is not one of the five", () => {
    expect(planBrandIcon("64", green, null)).toBeNull();
    expect(planBrandIcon("512.png", green, null)).toBeNull();
  });

  it("keeps the maskable symbol well inside the central 80%", () => {
    const plan = planBrandIcon("512-maskable", green, null)!;
    expect(plan.borderRadius).toBe(0);
    // The em box is the biggest the symbol can be: it must fit the 80% safe zone with room.
    expect(plan.fontSize).toBeLessThanOrEqual(plan.px * 0.4);
  });

  it("is immutable-cached only when ?v= is the current version", () => {
    const version = brandVersion(green);
    expect(planBrandIcon("192", green, version)!.cacheControl).toBe(CACHE_IMMUTABLE);
    expect(planBrandIcon("192", green, "old.red")!.cacheControl).toBe(CACHE_SHORT);
    expect(planBrandIcon("192", green, null)!.cacheControl).toBe(CACHE_SHORT);
    expect(planBrandIcon("192", null, "n")!.cacheControl).toBe(CACHE_IMMUTABLE);
  });

  it("ignores any other input: two stadiums with the same letter and colour draw the same plan", () => {
    const first = planBrandIcon("192", brandIdentityOf({ name: "Ahmad Stadium", brandPreset: "royal" }), null);
    const second = planBrandIcon("192", brandIdentityOf({ name: "Ali Arena", brandPreset: "royal" }), null);
    expect(first).toEqual(second);
  });
});
