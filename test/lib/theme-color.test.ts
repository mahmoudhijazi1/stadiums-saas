import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";
import { THEME_COLOR, applyThemeColor, themeColorScript } from "@/lib/theme-color";

const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");
const token = (name: string) => new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css)?.[1]?.toLowerCase();

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

describe("system bar colours", () => {
  it("are the page background of each theme (--bg), so the bar and the page are one colour", () => {
    expect(THEME_COLOR.light.toLowerCase()).toBe(token("ls-paper-100"));
    expect(THEME_COLOR.dark.toLowerCase()).toBe(token("ls-carbon-900"));
    expect(css).toMatch(/--bg:\s*var\(--ls-paper-100\)/);
    expect(css).toMatch(/\.dark,\s*\[data-theme="dark"\]\s*\{\s*--bg:\s*var\(--ls-carbon-900\)/);
  });

  it("are clearly light and clearly dark, so the OS draws dark icons and clock on one and light on the other", () => {
    expect(luminance(THEME_COLOR.light)).toBeGreaterThan(0.8);
    expect(luminance(THEME_COLOR.dark)).toBeLessThan(0.05);
  });
});

describe("applyThemeColor", () => {
  it("sets every theme-color tag to the colour of the theme, whatever its media", () => {
    const tags = [new Map<string, string>(), new Map<string, string>()];
    const root = {
      querySelectorAll: (selector: string) => {
        expect(selector).toBe('meta[name="theme-color"]');
        return tags.map((tag) => ({ setAttribute: (name: string, value: string) => void tag.set(name, value) }));
      },
    };
    applyThemeColor(root, "dark");
    expect(tags.map((tag) => tag.get("content"))).toEqual([THEME_COLOR.dark, THEME_COLOR.dark]);
    applyThemeColor(root, "light");
    expect(tags.map((tag) => tag.get("content"))).toEqual([THEME_COLOR.light, THEME_COLOR.light]);
  });
});

describe("themeColorScript (runs before the first paint)", () => {
  function run(stored: string | null, osDark: boolean, storageThrows = false): string[] {
    const contents: string[] = [];
    const tags = [0, 1].map(() => ({ setAttribute: (_name: string, value: string) => void contents.push(value) }));
    const localStorage = {
      getItem: () => {
        if (storageThrows) throw new Error("blocked");
        return stored;
      },
    };
    const matchMedia = () => ({ matches: osDark });
    const document = { querySelectorAll: () => tags };
    new Function("localStorage", "matchMedia", "document", themeColorScript())(localStorage, matchMedia, document);
    return contents;
  }

  it("follows the phone when no theme was chosen or the choice is system", () => {
    expect(run(null, true)).toEqual([THEME_COLOR.dark, THEME_COLOR.dark]);
    expect(run(null, false)).toEqual([THEME_COLOR.light, THEME_COLOR.light]);
    expect(run("system", true)).toEqual([THEME_COLOR.dark, THEME_COLOR.dark]);
  });

  it("follows a forced theme even when it differs from the phone", () => {
    expect(run("light", true)).toEqual([THEME_COLOR.light, THEME_COLOR.light]);
    expect(run("dark", false)).toEqual([THEME_COLOR.dark, THEME_COLOR.dark]);
  });

  it("never throws when storage is blocked", () => {
    expect(() => run(null, true, true)).not.toThrow();
  });
});
