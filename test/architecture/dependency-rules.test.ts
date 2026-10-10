import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, posix, relative } from "node:path";
import { describe, expect, it } from "@jest/globals";
import { EXCEPTIONS, IMPURE_LIBS, MODULE_EDGES, MODULE_EDGE_EXCEPTIONS, MODULES, type Exception } from "./rules";

/** Import rules for src/ (docs/ARCHITECTURE.md §1); the data is in ./rules.ts. */
const ROOT = process.cwd();

function files(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const rel = relative(ROOT, path).split("\\").join("/");
    if (rel === "src/generated" || rel === "src/prisma") continue;
    if (statSync(path).isDirectory()) out.push(...files(path));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(rel);
  }
  return out;
}

const STATIC = /\b(?:import|export)\s+(?:type\s+)?[\w*{}\s,$]*?\sfrom\s*["']([^"']+)["']/g;
const SIDE_EFFECT = /\bimport\s*["']([^"']+)["']/g;
const DYNAMIC = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

/** Specifiers of every import in a source text (comments removed first). */
function specifiers(text: string): string[] {
  const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const out: string[] = [];
  for (const re of [STATIC, SIDE_EFFECT, DYNAMIC]) for (const m of code.matchAll(re)) out.push(m[1]);
  return out;
}

/** Repo-relative target of an alias or relative specifier; null for packages. */
function resolve(file: string, spec: string): string | null {
  let target: string;
  if (spec.startsWith("@/")) target = "src/" + spec.slice(2);
  else if (spec.startsWith(".")) target = posix.normalize(posix.join(dirname(file), spec));
  else return null;
  return target.replace(/\.(ts|tsx)$/, "");
}

interface Place { area: "module" | "lib" | "app" | "components" | "other"; module?: string; layer?: string }
function place(path: string): Place {
  const m = /^src\/modules\/([^/]+)\/([^/]+)/.exec(path);
  if (m) return { area: "module", module: m[1], layer: m[2] };
  const a = /^src\/(lib|app|components)(\/|$)/.exec(path);
  return { area: (a?.[1] as Place["area"]) ?? "other" };
}

interface Edge { file: string; target: string; from: Place; to: Place }
const edges: Edge[] = files(join(ROOT, "src")).flatMap((file) => {
  const text = readFileSync(join(ROOT, file), "utf8");
  return specifiers(text).flatMap((spec) => {
    const target = resolve(file, spec);
    return target ? [{ file, target, from: place(file), to: place(target) }] : [];
  });
});

const excused = (list: Exception[], e: Edge, rule: number) =>
  list.some((x) => x.file === e.file && x.target === e.target && x.rule === rule);
const isPrisma = (t: string) => t.startsWith("src/generated/");
const impure = (t: string) => isPrisma(t) || IMPURE_LIBS.some((l) => t === l || t.startsWith(l + "/"));

function violations(): string[] {
  const out: string[] = [];
  const fail = (e: Edge, rule: number, allowedText: string) => {
    if (excused(EXCEPTIONS, e, rule) || excused(MODULE_EDGE_EXCEPTIONS, e, rule)) return;
    out.push(`${e.file} imports ${e.target}: rule ${rule} forbids it; allowed: ${allowedText}`);
  };
  for (const e of edges) {
    const { from, to } = e;
    if (from.area === "module") {
      const uiOk = from.layer === "ui" && e.target.startsWith("src/components/ui");
      if ((to.area === "app" && !isPrisma(e.target)) || (to.area === "components" && !uiOk))
        fail(e, 3, "no @/app or @/components (a module ui/ folder may import @/components/ui)");
      if (to.area === "module" && to.module !== from.module) {
        const ok = MODULE_EDGES[from.module!] ?? [];
        if (!ok.includes(to.module!)) fail(e, 1, ok.join(", ") || "none");
        else {
          // application and infrastructure reach other modules' infrastructure/schemas today (payments, rates,
          // pitches); that is not yet expressible as a rule, so only domain and schemas are held to domain.
          const layers = from.layer === "domain" || from.layer === "schemas" ? ["domain"] : null;
          if (layers && !layers.includes(to.layer!)) fail(e, 2, `${to.module}/domain only, from ${from.layer}`);
        }
      }
      const own = to.area === "module" && to.module === from.module ? to.layer : undefined;
      if (from.layer === "domain") {
        if (own && own !== "domain") fail(e, 2, "domain imports only domain");
        if (impure(e.target)) fail(e, 2, "domain imports only domain and pure libs (not db, logger, prisma client)");
      }
      if (from.layer === "infrastructure" && own === "application") fail(e, 2, "infrastructure never imports application");
      if (from.layer === "schemas") {
        if (own && own !== "domain" && own !== "schemas") fail(e, 2, "schemas import only domain, schemas and libs");
        if (impure(e.target)) fail(e, 2, "schemas import only domain and pure libs");
      }
    } else if (from.area === "app" && to.area === "module") {
      if (!["application", "domain", "schemas", "ui"].includes(to.layer!))
        fail(e, 4, "module application, domain, schemas, ui");
    } else if ((from.area === "lib" || from.area === "components") && to.area === "module") {
      fail(e, 5, "nothing (only listed exceptions)");
    }
  }
  return out;
}

describe("dependency rules", () => {
  it("the scan finds the known modules and edges", () => {
    expect(edges.length).toBeGreaterThan(500);
    for (const m of MODULES) expect(edges.some((e) => e.from.module === m)).toBe(true);
    expect(Object.keys(MODULE_EDGES).sort()).toEqual([...MODULES].sort());
  });

  it("the specifier extractor handles static, export-from, multi-line and dynamic imports", () => {
    const text = [
      'import a from "@/x";', 'import type { B } from "./y";', 'export { c } from "../z";',
      'export * from "w";', 'import "side";', 'const m = await import("@/dyn");',
      'import {\n  d,\n  e as f,\n} from "@/multi";', '// import q from "@/commented";',
    ].join("\n");
    expect(specifiers(text).sort()).toEqual(["../z", "./y", "@/dyn", "@/multi", "@/x", "side", "w"].sort());
    expect(resolve("src/modules/a/domain/f.ts", "../application/g")).toBe("src/modules/a/application/g");
    expect(resolve("src/a.ts", "react")).toBeNull();
  });

  it("no import breaks a rule", () => {
    expect(violations()).toEqual([]);
  });

  it("no exception is stale (the file exists and still has the import)", () => {
    const stale = [...EXCEPTIONS, ...MODULE_EDGE_EXCEPTIONS]
      .filter((x) => !edges.some((e) => e.file === x.file && e.target === x.target))
      .map((x) => `${x.file} no longer imports ${x.target}: delete the entry (${x.reason})`);
    expect(stale).toEqual([]);
  });
});
