import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "@jest/globals";
import { APP_CONVENTION_NAMES, APP_THIN_ALLOWLIST } from "./rules";

/** Rule 7: src/app stays thin (docs/ARCHITECTURE.md). The data is in ./rules.ts. */
const ROOT = process.cwd();

function appFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...appFiles(path));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(relative(ROOT, path).split("\\").join("/"));
  }
  return out;
}

function isConvention(file: string): boolean {
  if (file.split("/").includes("_components")) return true;
  const name = (file.split("/").pop() ?? "").replace(/\.(ts|tsx)$/, "");
  return APP_CONVENTION_NAMES.includes(name) || name.endsWith("actions");
}

const allowed = new Set(APP_THIN_ALLOWLIST.map((entry) => entry.file));

function offenders(files: string[]): string[] {
  return files
    .filter((file) => !isConvention(file) && !allowed.has(file))
    .map((file) => `${file}:1 is not a Next.js convention file and is not in a _components folder (rule 7); move it to the route's _components or, for a Next convention, add its name to APP_CONVENTION_NAMES`);
}

describe("src/app stays thin", () => {
  const files = appFiles(join(ROOT, "src", "app"));

  it("every file is a convention file, in a _components folder, or allowlisted", () => {
    expect(offenders(files)).toEqual([]);
  });

  it("finds the known convention files and _components (the scan works)", () => {
    expect(files).toEqual(expect.arrayContaining(["src/app/layout.tsx", "src/app/owner/(app)/today/actions.ts"]));
    expect(files.some((file) => file.includes("/_components/"))).toBe(true);
  });

  it("a stray file is reported with file:line", () => {
    const found = offenders(["src/app/owner/(app)/today/helpers.ts", "src/app/owner/(app)/today/_components/x.tsx", "src/app/owner/(app)/today/page.tsx"]);
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("src/app/owner/(app)/today/helpers.ts:1");
  });

  it("no allowlist entry is stale", () => {
    expect(APP_THIN_ALLOWLIST.filter((entry) => !existsSync(join(ROOT, entry.file))).map((entry) => entry.file)).toEqual([]);
    expect(APP_THIN_ALLOWLIST.filter((entry) => isConvention(entry.file)).map((entry) => entry.file)).toEqual([]);
  });
});
