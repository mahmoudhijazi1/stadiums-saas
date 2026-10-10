import { describe, expect, it } from "@jest/globals";
import { accentCss, accentPreviewCss, accentThemeColor } from "@/lib/accent-css";
import { BRAND_PRESETS, DEFAULT_BRAND_PRESET, presetOf } from "@/lib/brand-presets";

/** Written, not run when authored. The CSS that sets a stadium's accent. */
const ALL_HEX = new Set<string>(
  BRAND_PRESETS.flatMap((preset) => [preset.light, preset.dark].flatMap((set) => Object.values(set))),
);
const HEX_IN_CSS = /#[0-9A-Fa-f]{3,8}\b/g;

/** The only shape accentCss may produce, for any key. */
const SHAPE =
  /^html:root\{--brand:#[0-9A-F]{6};--brand-ink:#[0-9A-F]{6};--action-ink:#[0-9A-F]{6};--ring:#[0-9A-F]{6};\}html\.dark,html\[data-theme="dark"\]\{--brand:#[0-9A-F]{6};--brand-ink:#[0-9A-F]{6};--action-ink:#[0-9A-F]{6};--ring:#[0-9A-F]{6};\}$/;

describe("accentCss", () => {
  it("sets the four role variables for the light and the dark theme from the preset", () => {
    const css = accentCss("royal");
    const blue = presetOf("royal");
    expect(css).toContain(`html:root{--brand:${blue.light.fill};--brand-ink:${blue.light.onFill};--action-ink:${blue.light.ink};--ring:${blue.light.ring};}`);
    expect(css).toContain(`{--brand:${blue.dark.fill};--brand-ink:${blue.dark.onFill};--action-ink:${blue.dark.ink};--ring:${blue.dark.ring};}`);
    expect(css.indexOf("html:root")).toBeLessThan(css.indexOf("html.dark"));
  });

  it("has exactly the fixed shape for every preset", () => {
    for (const preset of BRAND_PRESETS) {
      expect({ key: preset.key, ok: SHAPE.test(accentCss(preset.key)) }).toEqual({ key: preset.key, ok: true });
    }
  });

  it("an unknown key, no key and junk all give the default (lime)", () => {
    const lime = accentCss(DEFAULT_BRAND_PRESET);
    for (const junk of ["magenta", "#ff0000", "", "LIME", null, undefined, 7, {}, ["royal"]]) {
      expect(accentCss(junk)).toBe(lime);
    }
  });

  it("free text never reaches the CSS: a hostile key is the default and only constant values appear", () => {
    const hostile = '</style><script>alert(1)</script>{--brand:red}';
    const css = accentCss(hostile);
    expect(css).toBe(accentCss("lime"));
    expect(css).not.toContain("<");
    expect(css).not.toContain("red");
    for (const preset of BRAND_PRESETS) {
      for (const hex of css.match(HEX_IN_CSS) ?? []) expect(ALL_HEX.has(hex.toUpperCase())).toBe(true);
      expect(accentCss(preset.key).match(HEX_IN_CSS)!.every((hex) => ALL_HEX.has(hex))).toBe(true);
    }
  });

  it("does not touch the status or destructive colours", () => {
    for (const preset of BRAND_PRESETS) {
      const css = accentCss(preset.key);
      for (const name of ["--paid", "--owed", "--expected", "--alert", "--destructive", "--success"]) {
        expect(css).not.toContain(name);
      }
    }
  });

  it("the default reproduces the colours globals.css already has", () => {
    expect(accentCss("lime")).toContain("--brand:#D7FF3F;--brand-ink:#111412;--action-ink:#111412;--ring:#111412;");
    expect(accentCss("lime")).toContain("--brand:#D7FF3F;--brand-ink:#111412;--action-ink:#D7FF3F;--ring:#D7FF3F;");
  });

  it("two presets never share a value they should not: blue's CSS has none of violet's colours", () => {
    const blue = accentCss("royal");
    const violet = presetOf("indigo");
    for (const hex of [violet.light.fill, violet.light.ink, violet.dark.fill]) expect(blue).not.toContain(hex);
  });
});

describe("accentThemeColor", () => {
  it("is the preset's dark fill, and the default's for an unknown key", () => {
    expect(accentThemeColor("indigo")).toBe(presetOf("indigo").dark.fill);
    expect(accentThemeColor("nope")).toBe(presetOf("lime").dark.fill);
    expect(accentThemeColor(undefined)).toBe("#D7FF3F");
  });
});

describe("accentPreviewCss", () => {
  const css = accentPreviewCss("sky");
  const sky = presetOf("sky");

  it("is scoped under .accent-preview in every rule, so nothing leaks to the page", () => {
    for (const rule of css.split("}").filter(Boolean)) expect(rule).toContain(".accent-preview");
  });

  it("uses only literal #RRGGBB values from the constant", () => {
    for (const hex of css.match(HEX_IN_CSS) ?? []) expect(ALL_HEX.has(hex.toUpperCase())).toBe(true);
    expect(css).not.toMatch(/var\(/);
  });

  it("sets the role variables and the ones the real components read, for light and dark", () => {
    const light = css.split("}")[0]!;
    for (const name of ["--brand", "--brand-ink", "--action-ink", "--ring", "--primary", "--primary-foreground", "--color-primary", "--color-action-ink"]) {
      expect(light).toContain(`${name}:`);
    }
    expect(light).toContain(`--primary:${sky.light.fill}`);
    expect(css).toContain(`html.dark .accent-preview{`);
    expect(css).toContain(`html[data-theme="dark"] .accent-preview{`);
  });

  it("the active pill takes the accent in the dark theme only (the light pill stays the inverse one)", () => {
    const [lightRule, darkRule] = css.split("}");
    expect(lightRule).not.toContain("--selected");
    expect(lightRule).not.toContain("--color-selected");
    expect(darkRule).toContain(`--selected:${sky.dark.fill}`);
    expect(darkRule).toContain(`--color-selected-ink:${sky.dark.onFill}`);
  });

  it("never sets a status or destructive variable, so the pills beside it keep their colours", () => {
    for (const name of ["--paid", "--owed", "--expected", "--alert", "--destructive", "--success"]) {
      expect(css).not.toContain(name);
    }
  });

  it("an unknown or hostile key is the default preview", () => {
    expect(accentPreviewCss("</style><b>")).toBe(accentPreviewCss("lime"));
    expect(accentPreviewCss(undefined)).toBe(accentPreviewCss("lime"));
  });
});
