import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "@jest/globals";
import { BRAND_PRESETS } from "@/lib/brand-presets";

/**
 * Accent guard. The accent colour is per tenant: the app reads it only through the role tokens
 * (--brand and --brand-ink for the fill and the text on it, --action-ink for accent text,
 * --ring for the focus ring), whose values live in globals.css and in the preset constant. A raw
 * accent hex, an rgb() of it, a fixed lime/yellow utility class, or the volt primitive named
 * anywhere else would ignore a stadium's chosen colour. A failure lists file:line.
 *
 * Status colours (paid, owed, expected) and the destructive red are not accent colours and are not
 * checked here; they never come from the preset.
 */
const ROOT = process.cwd();
const SCAN = ["src", "public"];
const ALLOWED = new Set(["src/app/globals.css", "src/lib/brand-presets.ts"]);

/**
 * Every accent colour of every preset, except the page colours the app uses anyway (carbon and
 * white). Naming one outside the constant would bypass the tenant's choice.
 */
const NEUTRAL = new Set(["#111412", "#FFFFFF"]);
const PRESET_HEXES = [
  ...new Set(
    BRAND_PRESETS.flatMap((preset) => [preset.light, preset.dark].flatMap((set) => Object.values(set))).filter(
      (hex) => !NEUTRAL.has(hex.toUpperCase()),
    ),
  ),
];

const RAW = [
  new RegExp(`(?:${PRESET_HEXES.join("|")})\\b`, "i"),
  /#d7ff3f\b/i, // the default (lime) fill
  /\brgba?\(\s*215\s*,\s*255\s*,\s*63\b/i,
  /\b(?:bg|text|border|ring|ring-offset|fill|stroke|from|to|via|outline|decoration|accent|caret|shadow)-(?:lime|yellow)-\d/,
  /--ls-volt/, // the lime primitive: only globals.css may name it
  /\bvar\(--ls-volt/,
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (path.includes(join("src", "app", "generated"))) return [];
    if (statSync(path).isDirectory()) return files(path);
    return /\.(tsx?|css|html|js|mjs)$/.test(entry) ? [path] : [];
  });
}

describe("accent colour only through the tokens", () => {
  const scanned = SCAN.flatMap((dir) => files(join(ROOT, dir))).map((path) => relative(ROOT, path).split("\\").join("/"));

  it("has no raw accent value or fixed lime class outside globals.css and the preset constant", () => {
    const offenders: string[] = [];
    for (const file of scanned) {
      if (ALLOWED.has(file)) continue;
      readFileSync(join(ROOT, file), "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (RAW.some((pattern) => pattern.test(line))) {
            offenders.push(`${file}:${index + 1}  ${line.trim().slice(0, 100)}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });

  it("scans something (the guard itself is not empty)", () => {
    expect(scanned.length).toBeGreaterThan(100);
    expect(scanned).toEqual(expect.arrayContaining(["src/app/globals.css", "src/app/layout.tsx"]));
  });

  it("the patterns catch what they are meant to", () => {
    for (const line of [
      'className="bg-[#D7FF3F]"',
      "color: rgb(215, 255, 63)",
      'className="text-lime-400"',
      "border-yellow-300",
      "fill: var(--ls-volt-500)",
      'style={{ background: "#2563EB" }}',
      "color: #a78bfa",
    ]) {
      expect({ line, caught: RAW.some((pattern) => pattern.test(line)) }).toEqual({ line, caught: true });
    }
    for (const line of ['className="bg-primary text-primary-foreground"', "ring-ring", "bg-selected text-selected-ink"]) {
      expect({ line, caught: RAW.some((pattern) => pattern.test(line)) }).toEqual({ line, caught: false });
    }
  });
});
