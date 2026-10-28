import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "@jest/globals";

/**
 * No screen writes a currency sign or word by hand: amounts go through the money formatters and field
 * labels through `currencyLabel` (src/lib/format/money.ts). Scans every file under src/app/owner and
 * src/modules/<module>/ui, comments dropped, and reports file:line. Code values ("USD" | "LBP" as a
 * type, `currency === "LBP"`, record keys) are not text and pass.
 */
const ROOT = process.cwd();

/** Allowed by exception: `path:line text fragment` -> why it must stay. Empty: nothing needs one today. */
const ALLOW: Record<string, string> = {};

const RULES: Array<[RegExp, string]> = [
  [/\$\$\{/, "a dollar sign before an interpolation"],
  [/>\s*\$/, "a dollar sign in JSX text"],
  [/["'`]\$["'`]/, "a bare dollar string"],
  [/ليرة|ل\.ل|دولار/, "an Arabic currency word"],
  [/>[^<>{}"'`=()&|?:;]*\b(?:USD|LBP)\b/, "a currency code in JSX text"],
  [/`[^`\n]*\s(?:USD|LBP)\b[^`\n]*`|`(?:USD|LBP)\s[^`\n]*`/, "a currency code inside a template"],
  [/"[^"\n,:]*[ (](?:USD|LBP)\b[^"\n,:]*"/, "a currency code inside a sentence"],
];

/** Comments become spaces, so line numbers stay true. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, (line, before: string) => before + " ".repeat(line.length - before.length));
}

/** Every hand-written currency sign or word in one file: "path:line  why  | the line". */
export function findCurrencyText(source: string, file: string): string[] {
  const found: string[] = [];
  stripComments(source)
    .split(/\r?\n/)
    .forEach((line, index) => {
      for (const [rule, why] of RULES) {
        if (!rule.test(line)) continue;
        const where = `${file}:${index + 1}`;
        if (!Object.keys(ALLOW).some((key) => key.startsWith(`${file}:`) && line.includes(key.slice(key.indexOf(" ") + 1)))) {
          found.push(`${where}  ${why}  | ${line.trim()}`);
        }
        break;
      }
    });
  return found;
}

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(join(dir, entry.name)) : /\.tsx?$/.test(entry.name) ? [join(dir, entry.name)] : [],
  );
}

function scannedFiles(): string[] {
  const modules = readdirSync(join(ROOT, "src", "modules"));
  return [join(ROOT, "src", "app", "owner"), ...modules.map((name) => join(ROOT, "src", "modules", name, "ui"))].flatMap(filesUnder);
}

describe("currency text on the owner screens", () => {
  it("no file writes a currency sign or word by hand (use the money formatters and currencyLabel)", () => {
    const found = scannedFiles().flatMap((file) =>
      findCurrencyText(readFileSync(file, "utf8"), relative(ROOT, file).replace(/\\/g, "/")),
    );
    expect(found).toEqual([]);
  });

  it("scans a real set of files", () => {
    expect(scannedFiles().length).toBeGreaterThan(50);
  });
});

describe("the guard itself", () => {
  const hits = (code: string) => findCurrencyText(code, "sample.tsx");

  it("catches each hand-written form, with file:line", () => {
    expect(hits("const a = 1;\nreturn `$${amount}`;")).toEqual([expect.stringMatching(/^sample\.tsx:2 {2}a dollar sign before an interpolation/)]);
    expect(hits("<LtrIsolate>${amount}</LtrIsolate>")).toHaveLength(1);
    expect(hits('{choice === "usd" ? "$" : x}')).toHaveLength(1);
    expect(hits('const unit = "ل.ل";')).toHaveLength(1);
    expect(hits('label: "ليرة"')).toHaveLength(1);
    expect(hits("<Label htmlFor=\"x\">USD</Label>")).toHaveLength(1);
    expect(hits("return `${groupDigits(value)} LBP`;")).toHaveLength(1);
    expect(hits('placeholder="Price (USD)"')).toHaveLength(1);
  });

  it("lets code values, formatter calls and comments through", () => {
    expect(hits('type Currency = "USD" | "LBP";')).toEqual([]);
    expect(hits('if (row.currency === "LBP") return formatLbpAmount(amount, locale);')).toEqual([]);
    expect(hits('const FEE_FIELD: Record<Currency, string> = { USD: "feeUsd", LBP: "feeLbp" };')).toEqual([]);
    expect(hits("const x = (part) => (part.currency === \"USD\" ? formatUsdAmount(a) : b);")).toEqual([]);
    expect(hits("// \"$30\" as before, or \"2,000,000 ل.ل\"\nconst ok = 1;")).toEqual([]);
    expect(hits("/* the pound sign ل.ل */ const ok = `${a}`;")).toEqual([]);
    expect(hits("{currencyLabel(\"USD\", locale)}")).toEqual([]);
  });
});
