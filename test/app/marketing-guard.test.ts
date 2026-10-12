import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "@jest/globals";

/**
 * The landing page of the bare host resolves no tenant and touches no database (landing slice 1).
 * Written, not run when authored. No file under src/app/(marketing) may import tenant-context, the
 * tenant db client, platform-db, or the application or infrastructure layer of any module.
 */
const ROOT = process.cwd();
const MARKETING = join(ROOT, "src", "app", "(marketing)");

const FORBIDDEN: Array<[string, RegExp]> = [
  ["tenant-context", /(?:^|\/)tenant-context$/],
  ["the tenant db client", /^@\/lib\/db$/],
  ["platform-db", /(?:^|\/)platform-db$/],
  ["a module's application layer", /^@\/modules\/[^/]+\/application(?:\/|$)/],
  ["a module's infrastructure layer", /^@\/modules\/[^/]+\/infrastructure(?:\/|$)/],
];

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function specifiers(source: string): string[] {
  return [...source.matchAll(/\bfrom\s+["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)|\brequire\(\s*["']([^"']+)["']\s*\)/g)].map(
    (match) => (match[1] ?? match[2] ?? match[3])!,
  );
}

function offenders(sources: Record<string, string>): string[] {
  const out: string[] = [];
  for (const [file, source] of Object.entries(sources)) {
    for (const specifier of specifiers(source)) {
      for (const [name, pattern] of FORBIDDEN) if (pattern.test(specifier)) out.push(`${file}: imports ${name} (${specifier})`);
    }
  }
  return out;
}

describe("src/app/(marketing) stays free of tenants and databases", () => {
  const sources = Object.fromEntries(
    files(MARKETING).map((path) => [relative(ROOT, path).split("\\").join("/"), readFileSync(path, "utf8")]),
  );

  it("finds the landing pages (the scan works)", () => {
    expect(Object.keys(sources)).toEqual(
      expect.arrayContaining(["src/app/(marketing)/landing/page.tsx", "src/app/(marketing)/landing/en/page.tsx"]),
    );
  });

  it("imports no tenant-context, db, platform-db, or module application or infrastructure", () => {
    expect(offenders(sources)).toEqual([]);
  });

  it("the patterns catch what they are meant to", () => {
    const bad = {
      "a.ts": 'import { getCurrentTenant } from "@/lib/tenant-context";',
      "b.ts": 'import { db } from "@/lib/db";',
      "c.ts": 'import { platformDb } from "@/lib/platform-db";',
      "d.ts": 'import { x } from "@/modules/stadium/application/brand-identity";',
      "e.ts": 'const y = await import("@/modules/platform/infrastructure/platform-store");',
    };
    expect(offenders(bad)).toHaveLength(5);
    expect(offenders({ "ok.ts": 'import { ui } from "@/lib/copy";\nimport { isBareHostFromHeaders } from "@/lib/tenant-slug";' })).toEqual([]);
  });
});
