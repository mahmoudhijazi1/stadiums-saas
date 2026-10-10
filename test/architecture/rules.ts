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
 * app/components, 4 app imports module application/domain/schemas only,
 * 5 lib and components import modules only through EXCEPTIONS.
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
  { file: "src/components/day-chips.tsx", target: "src/modules/venue/domain/availability", rule: 5,
    reason: "pure availability helper used by a shared component",
    fate: "move the helper to src/lib or a module ui/ folder" },
  { file: "src/components/slot-picker.tsx", target: "src/modules/people/domain/phone", rule: 5,
    reason: "sanitizePhoneInput, a pure function",
    fate: "move to src/lib or a module ui/ folder" },
  { file: "src/lib/request-fields.ts", target: "src/modules/people/domain/phone", rule: 5,
    reason: "documented in docs/ARCHITECTURE.md §1: phone helpers, pure functions",
    fate: "move phone helpers to src/lib" },
  { file: "src/lib/tenant-settings.ts", target: "src/modules/people/domain/phone", rule: 5,
    reason: "toLebanonNumber for the stadium's published phones, a pure function",
    fate: "tenant-settings mixes stadium keys with booking rules and time display; split per key group in a later step" },
  { file: "src/lib/tenant-settings.ts", target: "src/modules/stadium/domain/brand-presets", rule: 5,
    reason: "validates the brand preset key stored in settings",
    fate: "goes with the split of tenant-settings by key group" },
  { file: "src/lib/tenant-settings.ts", target: "src/modules/stadium/domain/map-link", rule: 5,
    reason: "validates the map link stored in settings",
    fate: "goes with the split of tenant-settings by key group" },
  { file: "src/lib/tenant-context.ts", target: "src/modules/stadium/domain/brand-presets", rule: 5,
    reason: "tenant context carries the brand preset key for the accent colour",
    fate: "tenant context reads it from the stadium module application in a later step" },
];

/** Rule 2: libs a domain or schemas file must not import (they stay pure). */
export const IMPURE_LIBS = [
  "src/lib/db", "src/lib/platform-db", "src/lib/logger", "src/lib/tenant-context",
  "src/lib/env", "src/lib/rate-limit",
];
