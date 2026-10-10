import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, posix, relative } from "node:path";
import { describe, expect, it } from "@jest/globals";
import { EXCEPTIONS, IMPURE_LIBS, MODULE_EDGES, MODULE_EDGE_EXCEPTIONS, MODULES, UI_LIBS, UI_SERVER_ONLY_PACKAGES, type Exception } from "./rules";

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

const packageImports: Array<{ file: string; spec: string }> = [];
interface Edge { file: string; target: string; from: Place; to: Place }
const edges: Edge[] = files(join(ROOT, "src")).flatMap((file) => {
  const text = readFileSync(join(ROOT, file), "utf8");
  return specifiers(text).flatMap((spec) => {
    const target = resolve(file, spec);
    if (!target) packageImports.push({ file, spec });
    return target ? [{ file, target, from: place(file), to: place(target) }] : [];
  });
});

const excused = (list: Exception[], e: Edge, rule: number) =>
  list.some((x) => x.file === e.file && x.target === e.target && x.rule === rule);
const isPrisma = (t: string) => t.startsWith("src/generated/");
const impure = (t: string) => isPrisma(t) || IMPURE_LIBS.some((l) => t === l || t.startsWith(l + "/"));

const inUi = (t: string, l: string) => t === l || t.startsWith(l + "/");

/** Rule 6: a module ui/ file gets data and actions through props: no application, infrastructure, db, client, app or server-only code. */
function uiViolations(e: Edge, fail: (e: Edge, rule: number, allowed: string) => void): void {
  const { from, to } = e;
  const allowedText = "components/ui, " + UI_LIBS.join(", ") + ", own domain/schemas/ui, other modules' domain/ui along the edge table";
  if (to.area === "module" && (to.layer === "application" || to.layer === "infrastructure"))
    fail(e, 6, allowedText + " (never application or infrastructure; receive data and actions as props)");
  else if (to.area === "module" && to.module === from.module && !["domain", "schemas", "ui"].includes(to.layer!))
    fail(e, 6, allowedText);
  else if (to.area === "module" && to.module !== from.module && !["domain", "ui"].includes(to.layer!))
    fail(e, 6, allowedText);
  else if (isPrisma(e.target) || e.target.startsWith("src/app/") || e.target === "src/app")
    fail(e, 6, allowedText + " (not @/app or the Prisma client)");
  else if (to.area === "lib" && !UI_LIBS.some((l) => inUi(e.target, l)))
    fail(e, 6, allowedText);
}

/** Rule 6, packages: a ui file imports nothing server-only. */
function uiPackageViolations(list: Array<{ file: string; spec: string }>): string[] {
  return list
    .filter((x) => place(x.file).layer === "ui" && place(x.file).area === "module")
    .filter((x) => UI_SERVER_ONLY_PACKAGES.some((p) => x.spec === p || x.spec.startsWith(p + "/")))
    .map((x) => `${x.file} imports ${x.spec}: rule 6 forbids it; allowed: nothing server-only in a module ui/ folder`);
}

function violations(list: Edge[] = edges): string[] {
  const out: string[] = [];
  const fail = (e: Edge, rule: number, allowedText: string) => {
    if (excused(EXCEPTIONS, e, rule) || excused(MODULE_EDGE_EXCEPTIONS, e, rule)) return;
    out.push(`${e.file} imports ${e.target}: rule ${rule} forbids it; allowed: ${allowedText}`);
  };
  for (const e of list) {
    const { from, to } = e;
    if (from.area === "module") {
      if (from.layer === "ui") uiViolations(e, fail);
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
    expect([...violations(), ...uiPackageViolations(packageImports)]).toEqual([]);
  });

  describe("rule 6: module ui/ folders", () => {
    const edge = (file: string, target: string): Edge => ({ file, target, from: place(file), to: place(target) });
    const ui = "src/modules/people/ui/person-card.tsx";

    it("fails a ui file that imports application, infrastructure, @/app or the Prisma client", () => {
      for (const target of [
        "src/modules/people/application/find-or-create-person",
        "src/modules/people/infrastructure/persons",
        "src/modules/access/application/get-current-membership",
        "src/app/owner/shared",
        "src/generated/prisma/client",
        "src/lib/db",
      ]) {
        const found = violations([edge(ui, target)]);
        expect(found.some((message) => message.includes("rule 6 forbids it"))).toBe(true);
      }
    });

    it("fails server-only packages in a ui file", () => {
      for (const spec of ["server-only", "next/headers", "next/server"])
        expect(uiPackageViolations([{ file: ui, spec }])).toHaveLength(1);
      expect(uiPackageViolations([{ file: ui, spec: "react" }])).toEqual([]);
      expect(uiPackageViolations([{ file: "src/modules/people/domain/x.ts", spec: "server-only" }])).toEqual([]);
    });

    it("allows components/ui, lib format and copy, own domain and ui, and other modules' domain along the edge table", () => {
      for (const target of [
        "src/components/ui/button",
        "src/lib/format/money",
        "src/lib/copy/index",
        "src/lib/locale",
        "src/modules/people/domain/phone",
        "src/modules/people/ui/other",
        "src/modules/access/domain/can",
      ]) expect(violations([edge(ui, target)])).toEqual([]);
    });

    it("fails another module's domain when the module edge is not in the table", () => {
      expect(violations([edge(ui, "src/modules/booking/domain/series")])).toHaveLength(1);
    });
  });

  it("no exception is stale (the file exists and still has the import)", () => {
    const stale = [...EXCEPTIONS, ...MODULE_EDGE_EXCEPTIONS]
      .filter((x) => !edges.some((e) => e.file === x.file && e.target === x.target))
      .map((x) => `${x.file} no longer imports ${x.target}: delete the entry (${x.reason})`);
    expect(stale).toEqual([]);
  });
});
