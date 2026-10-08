import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "@jest/globals";

/**
 * Typography guard (docs/ui-rules.md rule 7, "type roles"). Screens under More use the nine
 * role classes (type-title, type-section, type-body, type-strong, type-label,
 * type-secondary, type-caption, type-field, type-button), never a raw font size or weight.
 * A failure lists file:line so the offender is easy to fix.
 */
const ROOT = join(process.cwd(), "src", "app", "owner", "(app)", "more");

const RAW = [
  /\btext-(?:xs|sm|base|lg|xl|[2-9]xl)\b/,
  /\btext-\[\s*-?\d/, // a size in brackets; colour brackets like text-[var(--x)] are fine
  /\bfont-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/,
  /\bfontSize\b/,
  /\bfontWeight\b/,
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(tsx|ts)$/.test(entry) ? [path] : [];
  });
}

describe("More screens use type roles only", () => {
  it("has no raw font-size or font-weight utility", () => {
    const offenders: string[] = [];
    for (const file of files(ROOT)) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (RAW.some((pattern) => pattern.test(line))) {
            offenders.push(`${relative(process.cwd(), file)}:${index + 1}  ${line.trim().slice(0, 100)}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });

  it("scans something (the guard itself is not empty)", () => {
    expect(files(ROOT).length).toBeGreaterThan(8);
  });
});
