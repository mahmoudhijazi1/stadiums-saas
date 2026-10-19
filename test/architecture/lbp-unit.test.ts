import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "@jest/globals";

/**
 * DR-007: the LBP money unit lives in one place. Its number is written in `src/lib/format/lbp-unit.ts`
 * and nowhere else in src: code asks `moneyUnit("LBP")` (or `FORGIVE_BELOW_LBP`), and on-screen text
 * states it with the `{unit}` placeholder. This scan fails, with file:line, on a literal 5000 or 5_000
 * in code, or a "5,000" inside a string, in money code only: the booking, payment, shop and venue
 * modules and src/lib/format. Other code (timeouts, sizes) may use 5000 for its own reasons.
 * Comments may still say 5,000 when they explain the rule.
 */
const ROOT = process.cwd();
const DEFINES_THE_UNIT = "src/lib/format/lbp-unit.ts";
const MONEY_CODE = [
  "src/modules/booking",
  "src/modules/payment",
  "src/modules/shop",
  "src/modules/venue",
  "src/lib/format",
];

// 5000 and 5_000 as a whole number; "5,000" as a whole amount (not the tail of 15,000 or 895,000).
const LITERAL = /(?<![\w.])5_?000(?![\w_])|(?<![\d,.])5,000(?![\d])/;

/** The lines of `source` that hold the unit outside a comment, as "line: text". */
export function literalsIn(source: string): Array<{ line: number; text: string }> {
  const found: Array<{ line: number; text: string }> = [];
  let inBlock = false;
  source.split(/\r?\n/).forEach((raw, index) => {
    let line = raw;
    if (inBlock) {
      const end = line.indexOf("*/");
      if (end === -1) return;
      line = line.slice(end + 2);
      inBlock = false;
    }
    // Drop block comments that open (and maybe close) on this line, then a trailing // comment.
    for (;;) {
      const open = line.indexOf("/*");
      if (open === -1) break;
      const close = line.indexOf("*/", open + 2);
      if (close === -1) {
        line = line.slice(0, open);
        inBlock = true;
        break;
      }
      line = line.slice(0, open) + line.slice(close + 2);
    }
    line = line.replace(/(^|[^:"'`\\])\/\/.*$/, "$1");
    if (LITERAL.test(line)) found.push({ line: index + 1, text: raw.trim() });
  });
  return found;
}

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "generated") continue;
      files.push(...sourceFiles(path));
    } else if (/\.(ts|tsx)$/.test(name)) {
      files.push(path);
    }
  }
  return files;
}

describe("the LBP money unit is written in one place", () => {
  it("no other money file has a literal 5000, 5_000 or a quoted 5,000", () => {
    const offenders: string[] = [];
    for (const file of MONEY_CODE.flatMap((dir) => sourceFiles(join(ROOT, dir)))) {
      const rel = relative(ROOT, file).split("\\").join("/");
      if (rel === DEFINES_THE_UNIT) continue;
      for (const hit of literalsIn(readFileSync(file, "utf8"))) {
        offenders.push(`${rel}:${hit.line}  ${hit.text}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the defining file does hold the number", () => {
    const hits = literalsIn(readFileSync(join(ROOT, DEFINES_THE_UNIT), "utf8"));
    expect(hits).toHaveLength(1);
  });

  it("finds a literal in code and in a string, and ignores comments and other numbers", () => {
    expect(literalsIn("const unit = 5000;\n").map((hit) => hit.line)).toEqual([1]);
    expect(literalsIn("const unit = 5_000;\n")).toHaveLength(1);
    expect(literalsIn('const text = "steps of 5,000";\n')).toHaveLength(1);
    expect(literalsIn("a();\nconst n = 5000; // five thousand\n").map((hit) => hit.line)).toEqual([2]);
    expect(literalsIn("// the unit is 5000\n/* 5,000 */\n/**\n * 5000 LBP\n */\nconst ok = 1;\n")).toEqual([]);
    expect(literalsIn("const a = 15000;\nconst b = 50000;\nconst c = 4.5000;\nconst d = x5000;\n")).toEqual([]);
    expect(literalsIn('const s = "895,000 LBP and 15,000 and 25,000";\n')).toEqual([]);
    expect(literalsIn("const url = 'https://x.test/5000';\n")).toHaveLength(1);
  });
});
