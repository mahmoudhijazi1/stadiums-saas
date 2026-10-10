import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Reads the real colour tokens out of src/app/globals.css so the accent tests compare against what
 * the app ships, not a copy. `:root` blocks give the light theme; `.dark, [data-theme="dark"]`
 * blocks overlay the dark one. `var(--x)` chains are followed; only plain #RRGGBB values are
 * returned (a token that is a color-mix() or otherwise not a hex throws, so a test never compares
 * against a guess).
 */
type Theme = "light" | "dark";

function declarations(css: string, selector: RegExp): Map<string, string> {
  const map = new Map<string, string>();
  for (const block of css.matchAll(selector)) {
    for (const declaration of block[1]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      map.set(declaration[1]!, declaration[2]!.trim());
    }
  }
  return map;
}

function load(): Record<Theme, Map<string, string>> {
  const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const light = declarations(css, /(?:^|\n):root\s*\{([^{}]*)\}/g);
  const dark = new Map(light);
  for (const [name, value] of declarations(css, /(?:^|\n)\.dark,\s*\[data-theme="dark"\]\s*\{([^{}]*)\}/g)) {
    dark.set(name, value);
  }
  return { light, dark };
}

const TOKENS = load();

/** The hex value of a token in a theme, e.g. tokenHex("dark", "--paid"). */
export function tokenHex(theme: Theme, name: string): string {
  let value = TOKENS[theme].get(name);
  for (let hops = 0; value !== undefined && hops < 10; hops += 1) {
    const reference = /^var\((--[\w-]+)\)$/.exec(value);
    if (!reference) break;
    value = TOKENS[theme].get(reference[1]!);
  }
  if (value === undefined || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error(`${name} (${theme}) is not a plain hex in globals.css: ${value ?? "missing"}`);
  }
  return value.toUpperCase();
}

/** The tokens the accent must stay apart from, and the surfaces it sits on, per theme. */
export function statusTokens(theme: Theme) {
  return {
    paid: tokenHex(theme, "--paid"),
    owed: tokenHex(theme, "--owed"),
    destructive: tokenHex(theme, "--alert"),
  };
}

export function surfaceTokens(theme: Theme) {
  return {
    bg: tokenHex(theme, "--bg"),
    surface: tokenHex(theme, "--surface"),
    expectedTile: tokenHex(theme, "--expected-subtle"),
  };
}
