import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "@jest/globals";
import DevLayout from "@/app/dev/layout";
import { assertDevOnly } from "@/lib/dev-only";

/** Written, not run when authored. Hardening 2 item 6. */
const env = process.env as Record<string, string | undefined>;
const original = env.NODE_ENV;

afterEach(() => {
  env.NODE_ENV = original;
});

function pagesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return pagesUnder(full);
    return /^(page|route)\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("the shared /dev guard", () => {
  it("404s under NODE_ENV=production, and is quiet in development and test", () => {
    env.NODE_ENV = "production";
    expect(() => assertDevOnly()).toThrow(expect.objectContaining({ digest: expect.stringContaining("404") }));
    env.NODE_ENV = "development";
    expect(() => assertDevOnly()).not.toThrow();
    env.NODE_ENV = "test";
    expect(() => assertDevOnly()).not.toThrow();
  });

  it("the /dev layout applies it, so a page added later is covered too", () => {
    env.NODE_ENV = "production";
    expect(() => DevLayout({ children: null })).toThrow(expect.objectContaining({ digest: expect.stringContaining("404") }));
    env.NODE_ENV = "test";
    expect(DevLayout({ children: "x" })).toBe("x");
  });

  it("every page and route under src/app/dev calls assertDevOnly", () => {
    const root = path.join(process.cwd(), "src", "app", "dev");
    const files = pagesUnder(root);
    expect(files.length).toBeGreaterThanOrEqual(2);
    for (const file of files) {
      expect({ file: path.relative(root, file), guarded: readFileSync(file, "utf8").includes("assertDevOnly()") }).toEqual({
        file: path.relative(root, file),
        guarded: true,
      });
    }
  });
});
