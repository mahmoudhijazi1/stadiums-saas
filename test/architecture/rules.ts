/**
 * Dependency rules for src/ as plain data, enforced by dependency-rules.test.ts.
 * The narrative lives in docs/ARCHITECTURE.md §1; this file is what the build checks.
 *
 * HOW TO CHANGE A RULE
 * - New module -> module edge: add the target to MODULE_EDGES[from]. Only if it
 *   points down (docs/ARCHITECTURE.md §1); an upward edge is fixed in the code.
 * - Documented exception: add an entry to MODULE_EDGE_EXCEPTIONS (rule 1) or
 *   EXCEPTIONS (rules 2 to 5) with `reason` and `fate` (what removes it, and
 *   when). The test fails when an exception is stale (file gone or import
 *   gone), so delete the entry in the same change that fixes the code.
 * - `file` is repo-relative, `target` is the resolved import without extension
 *   ("src/modules/people/domain/phone"), `rule` is the rule number it excuses.
 * - Never widen a rule to silence one file: list that file here with a reason.
 *
 * Rules: 1 module edges, 2 layers inside a module, 3 modules never import
 * app/components, 4 app imports module application/domain/schemas/ui only,
 * 5 lib and components import modules only through EXCEPTIONS (components/shell may import a module's ui/),
 * 6 module ui/ folders get data and actions through props (see UI_LIBS below),
 * 7 src/app stays thin (see APP_CONVENTION_NAMES and APP_THIN_ALLOWLIST below).
 *
 * Route group src/app/(platform) (DR-006): /platform on the bare host only; it imports platform/application
 * through rule 4 like any route, resolves no tenant and imports nothing from lib/tenant-context.
 */

export const MODULES = [
  "access", "booking", "expense", "ledger", "notification",
  "payment", "people", "platform", "push", "shop", "stadium", "venue",
] as const;

/** Rule 1: module -> modules it may import. Anything else fails. */
export const MODULE_EDGES: Record<string, string[]> = {
  access: [],
  notification: ["people"], // Lebanese phone rule is a people domain rule used to build wa.me links (domain to domain)
  ledger: ["access"],
  people: ["access"],
  venue: ["access"],
  push: ["access"],
  payment: ["access", "ledger"],
  expense: ["access", "ledger", "payment"],
  shop: ["access", "ledger", "payment", "people"],
  booking: ["access", "notification", "payment", "people", "shop", "stadium", "venue"], // stadium: public-page-url for WhatsApp links
  platform: ["access"],
  stadium: ["access", "people", "platform"], // people: phone and name rules; platform: the audited rename and the brand source go through platform/application/tenant-profile
};

export interface Exception {
  file: string;
  target: string;
  rule: number;
  reason: string;
  fate: string;
}

/** Rule 1 exceptions: edges outside MODULE_EDGES that exist today. */
export const MODULE_EDGE_EXCEPTIONS: Exception[] = [
];

/** Rules 2 to 5: files that break a rule today. Do not add; fix the code. */
export const EXCEPTIONS: Exception[] = [
  { file: "src/lib/tenant-settings.ts", target: "src/modules/people/domain/phone", rule: 5,
    reason: "toLebanonNumber for the stadium's published phones, a pure function",
    fate: "tenant-settings mixes stadium keys with booking rules and time display; split per key group in a later step" },
  { file: "src/lib/tenant-settings.ts", target: "src/modules/stadium/domain/brand-presets", rule: 5,
    reason: "validates the brand preset key stored in settings",
    fate: "goes with the split of tenant-settings by key group" },
  { file: "src/lib/tenant-settings.ts", target: "src/modules/stadium/domain/map-link", rule: 5,
    reason: "validates the map link stored in settings",
    fate: "goes with the split of tenant-settings by key group" },
];

/** Rule 2: libs a domain or schemas file must not import (they stay pure). */
export const IMPURE_LIBS = [
  "src/lib/db", "src/lib/platform-db", "src/lib/logger", "src/lib/tenant-context",
  "src/lib/env", "src/lib/rate-limit",
];

/**
 * Rule 6: the only src/lib folders and files a module ui/ file may import. ui gets data and
 * actions through props: it never imports application, infrastructure, db, the Prisma client,
 * @/app or server-only code. A Server Action is a prop typed in the ui file; the page passes it.
 */
export const UI_LIBS = [
  "src/lib/format", "src/lib/copy", "src/lib/locale", "src/lib/plural", "src/lib/utils",
  // Browser-only reads through useSyncExternalStore (the page origin), replacing setState in an effect; no server code, no data.
  "src/lib/use-browser-origin",
];

/** Rule 6: packages a module ui/ file must not import. */
export const UI_SERVER_ONLY_PACKAGES = ["server-only", "next/headers", "next/server"];

/**
 * Rule 7: src/app holds Next.js convention files and route-private files in a _components folder,
 * nothing else. A file name (without extension) is a convention name when it is one of these, or
 * ends with "actions" (Server Actions), or is "skeleton"/"skeletons" (loading UI) or "query" (the
 * route's search-param helpers).
 */
export const APP_CONVENTION_NAMES = [
  "page", "layout", "route", "loading", "error", "global-error", "not-found", "template", "manifest",
  "default", "icon", "opengraph-image", "sitemap", "robots", "skeleton", "skeletons", "query",
];

/** Rule 7: files outside the convention today. Do not add; put the file in a _components folder. */
export const APP_THIN_ALLOWLIST: Array<{ file: string; reason: string; fate: string }> = [
  { file: "src/app/(public)/alert-owners.ts", reason: "composes the new-request push alert after the response (docs/ARCHITECTURE.md §6); tests name its path", fate: "stays until the alert moves to a use case" },
  { file: "src/app/(public)/request-slot.ts", reason: "the public Server Action; test/modules/push/imports.test.ts names its path", fate: "rename to actions.ts with those tests" },
  { file: "src/app/brand/current-brand.ts", reason: "resolves the brand from the validated Host for the icon routes, which are outside the proxy matcher", fate: "moves into the brand route's _components" },
  { file: "src/app/dev/mockups/today/data.ts", reason: "dev-only mockup data (test/app/dev/dev-guard.test.ts)", fate: "delete with the mockup" },
  { file: "src/app/dev/mockups/today/today-mockup.tsx", reason: "dev-only mockup (test/app/dev/dev-guard.test.ts)", fate: "delete with the mockup" },
  { file: "src/app/owner/require-owner.ts", reason: "the auth gate every owner page calls (access module + redirect; lib may not import modules)", fate: "stays; it is the owner area's one shared server helper" },
];
