import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "@jest/globals";

/**
 * The living docs stay true (docs/README.md "Start here" and "Core"): they carry the three header
 * lines, every path they name exists, CODEMAP lists every module, and relative links resolve.
 * Historical docs (specs, decisions, audits) and docs/archive are not checked.
 */
const ROOT = process.cwd();
const read = (file: string) => readFileSync(join(ROOT, file), "utf8");

function mdIn(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).filter((name) => name.endsWith(".md")).map((name) => `${dir}/${name}`);
}

const CORE = [
  "README.md",
  "docs/README.md",
  "docs/NOW.md",
  "docs/CODEMAP.md",
  "docs/KEY-FILES.md",
  "docs/ARCHITECTURE.md",
  "docs/DATA-MODEL.md",
  "docs/RUNBOOK.md",
  "docs/ROADMAP.md",
  "docs/owner-ia.md",
  ...mdIn("docs/domain"),
];
const CHECKED = [...CORE, "CLAUDE.md"];

describe("core docs", () => {
  it("lists only files that exist", () => {
    expect(CORE.filter((file) => !existsSync(join(ROOT, file)))).toEqual([]);
  });

  it("start with Purpose, Read when and Last verified", () => {
    const missing: string[] = [];
    for (const file of CORE) {
      const head = read(file).split("\n").slice(0, 12).join("\n");
      for (const label of ["**Purpose:**", "**Read when:**", "**Last verified:**"]) {
        if (!head.includes(label)) missing.push(`${file} lacks ${label} in its first lines`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("only name paths that exist (src/, test/, docs/, scripts/, prisma7.config.ts)", () => {
    const missing: string[] = [];
    for (const file of CHECKED) {
      for (const match of read(file).matchAll(/`((?:src|test|docs|scripts|prisma7\.config\.ts)[^`\s]*)`/g)) {
        const path = (match[1] ?? "").replace(/[.,;:]+$/, "");
        if (/[*<>{}…]|\.\.\./.test(path)) continue; // patterns and placeholders
        if (!existsSync(join(ROOT, path))) missing.push(`${file}: \`${path}\` does not exist`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("resolve every relative link between docs", () => {
    const broken: string[] = [];
    for (const file of CHECKED) {
      for (const match of read(file).matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
        const target = (match[1] ?? "").split("#")[0] ?? "";
        if (!target || /^[a-z]+:/i.test(target)) continue;
        if (!existsSync(join(ROOT, dirname(file), target))) broken.push(`${file}: link to ${target} is broken`);
      }
    }
    expect(broken).toEqual([]);
  });
});

describe("CODEMAP", () => {
  const codemap = read("docs/CODEMAP.md");
  const modules = readdirSync(join(ROOT, "src/modules")).filter((name) => statSync(join(ROOT, "src/modules", name)).isDirectory());

  it("names every folder under src/modules", () => {
    expect(modules.filter((name) => !codemap.includes(`| \`${name}\` |`))).toEqual([]);
  });

  it("names no module that does not exist", () => {
    const section = codemap.slice(codemap.indexOf("## `src/modules/<module>/`"));
    const named = [...section.matchAll(/^\| `([a-z]+)` \|/gm)].map((match) => match[1] ?? "");
    expect(named.filter((name) => !modules.includes(name))).toEqual([]);
    expect(named.length).toBeGreaterThanOrEqual(modules.length);
  });
});
