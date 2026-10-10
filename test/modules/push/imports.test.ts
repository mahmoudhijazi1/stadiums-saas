import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "@jest/globals";

/** Import rules for the push module (docs/ARCHITECTURE.md §1). */
const ROOT = process.cwd();

function files(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (path.includes(join("src", "generated"))) continue;
    if (statSync(path).isDirectory()) out.push(...files(path));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(relative(ROOT, path).split("\\").join("/"));
  }
  return out;
}

const source = (file: string) => readFileSync(join(ROOT, file), "utf8");
const all = files(join(ROOT, "src"));

describe("push module imports", () => {
  it('only the web-push sender imports "web-push" (server only)', () => {
    const importers = all.filter((file) => /from\s+["']web-push["']/.test(source(file)));
    expect(importers).toEqual(["src/modules/push/infrastructure/web-push-sender.ts"]);
  });

  it("no Client Component imports the push infrastructure", () => {
    const clients = all.filter((file) => /^["']use client["']/.test(source(file).trimStart()));
    const offenders = clients.filter((file) => /modules\/push\/(infrastructure|application)/.test(source(file)));
    expect(offenders).toEqual([]);
  });

  it("push imports only access (and lib); booking never imports push", () => {
    const own = all.filter((file) => file.startsWith("src/modules/push/"));
    const forbidden = /@\/modules\/(booking|payment|people|venue|ledger|expense|shop|platform|notification)\//;
    expect(own.filter((file) => forbidden.test(source(file)))).toEqual([]);

    const others = all.filter((file) => file.startsWith("src/modules/") && !file.startsWith("src/modules/push/"));
    expect(others.filter((file) => /@\/modules\/push\//.test(source(file)))).toEqual([]);
  });

  it("the VAPID private key is read only by push-config", () => {
    const readers = all.filter((file) => /VAPID_PRIVATE_KEY/.test(source(file)));
    expect(readers.sort()).toEqual(["src/lib/env.ts", "src/modules/push/infrastructure/push-config.ts"]);
  });

  it("the new-request alert is composed in one place and scheduled after the response", () => {
    const composers = all.filter((file) => /alert-owners/.test(source(file)) && !file.endsWith("alert-owners.ts"));
    expect(composers).toEqual(["src/app/(public)/request-slot.ts"]);
    const action = source("src/app/(public)/request-slot.ts");
    expect(action).toMatch(/after\(alertOwnersOfNewRequest\)/);
    expect(action).not.toMatch(/await\s+alertOwnersOfNewRequest/);
  });

  it("only the public request action reaches the alert (no owner-create path calls it)", () => {
    const callers = all.filter((file) => /notifyNewRequest|alertOwnersOfNewRequest/.test(source(file)));
    expect(callers.sort()).toEqual([
      "src/app/(public)/alert-owners.ts",
      "src/app/(public)/request-slot.ts",
      "src/modules/push/application/notify-new-request.ts",
    ]);
  });
});
