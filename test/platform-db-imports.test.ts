import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "@jest/globals";

/**
 * platformDb bypasses the tenant guard. Only these files may import it; a new
 * importer fails here until it is reviewed and added with a reason.
 */
const ALLOWED: Record<string, string> = {
  "src/lib/tenant-context.ts": "the tenant lookup by slug (one query per request)",
  "src/app/manifest.ts": "tenant name lookup by slug (outside the proxy matcher)",
  "src/modules/access/infrastructure/sessions.ts": "Session is global (DR-003)",
  "src/modules/access/infrastructure/users.ts": "User is global (DR-003)",
  "src/modules/access/infrastructure/tenants.ts": "tenant settings by the server-resolved id",
  "src/lib/rate-limit.ts": "RateLimit is a global platform table",
  "scripts/set-password-core.ts": "operator password reset (scripts/set-password.ts)",
};
const ALLOWED_DIRS = ["src/modules/platform/"];

const ROOT = process.cwd();
const IMPORT = /(?:from\s+|import\s*\(\s*)["'](?:@\/lib\/platform-db|(?:\.{1,2}\/)+(?:lib\/)?platform-db)["']/;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (path.includes(join("src", "generated"))) continue;
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.(ts|tsx|mts)$/.test(entry)) out.push(relative(ROOT, path).split("\\").join("/"));
  }
  return out;
}

describe("platformDb import allowlist", () => {
  const importers = ["src", "scripts"]
    .flatMap((dir) => sourceFiles(join(ROOT, dir)))
    .filter((file) => file !== "src/lib/platform-db.ts")
    .filter((file) => IMPORT.test(readFileSync(join(ROOT, file), "utf8")));

  it("only allowlisted files import lib/platform-db", () => {
    const unexpected = importers.filter(
      (file) => !(file in ALLOWED) && !ALLOWED_DIRS.some((dir) => file.startsWith(dir)),
    );
    expect(unexpected).toEqual([]);
  });

  it("finds the known importers (the scan works)", () => {
    expect(importers).toEqual(expect.arrayContaining(["src/lib/tenant-context.ts", "src/modules/platform/infrastructure/platform-store.ts"]));
  });

  it("the regex catches alias, relative and dynamic imports", () => {
    for (const line of [
      'import { platformDb } from "@/lib/platform-db";',
      "import { platformDb } from '../../lib/platform-db';",
      'import { platformDb } from "./platform-db";',
      'const { platformDb } = await import("@/lib/platform-db");',
    ]) {
      expect(IMPORT.test(line)).toBe(true);
    }
    expect(IMPORT.test('import db from "@/lib/db";')).toBe(false);
  });
});
