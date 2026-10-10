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
  "payment", "people", "platform", "push", "shop", "venue",
] as const;

/** Rule 1: module -> modules it may import. Anything else fails. */
export const MODULE_EDGES: Record<string, string[]> = {
  access: [],
  notification: ["people"], // whatsapp-link uses toLebanonNumber (people/domain/phone)
  ledger: ["access"],
  people: ["access"],
  venue: ["access"],
  push: ["access"],
  payment: ["access", "ledger"],
  expense: ["access", "ledger", "payment"],
  shop: ["access", "ledger", "payment", "people"],
  booking: ["access", "notification", "payment", "people", "shop", "venue"],
  platform: ["access"],
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
  { file: "src/modules/platform/domain/stadium-info.ts", target: "src/modules/people/domain/clean-person-name", rule: 1,
    reason: "platform reuses people's pure name/phone cleaning for the stadium info form",
    fate: "moves to the new stadium module in a later refactor step; delete this entry then" },
  { file: "src/modules/platform/domain/stadium-info.ts", target: "src/modules/people/domain/phone", rule: 1,
    reason: "platform reuses people's pure name/phone cleaning for the stadium info form",
    fate: "moves to the new stadium module in a later refactor step; delete this entry then" },
];

/** Rules 2 to 5: files that break a rule today. Do not add; fix the code. */
export const EXCEPTIONS: Exception[] = [
  { file: "src/modules/venue/domain/availability.ts", target: "src/modules/venue/schemas/schedule-config", rule: 2,
    reason: "ScheduleConfig type and WEEKDAYS live in a schemas file but are domain concepts",
    fate: "move schedule-config to venue/domain; then delete these entries" },
  { file: "src/modules/venue/domain/daily-schedule.ts", target: "src/modules/venue/schemas/schedule-config", rule: 2,
    reason: "ScheduleConfig type and WEEKDAYS live in a schemas file but are domain concepts",
    fate: "move schedule-config to venue/domain; then delete these entries" },
  { file: "src/modules/venue/domain/hours-cover.ts", target: "src/modules/venue/schemas/schedule-config", rule: 2,
    reason: "ScheduleConfig type and WEEKDAYS live in a schemas file but are domain concepts",
    fate: "move schedule-config to venue/domain; then delete these entries" },
  { file: "src/modules/venue/domain/pitch-form-model.ts", target: "src/modules/venue/schemas/schedule-config", rule: 2,
    reason: "ScheduleConfig type and WEEKDAYS live in a schemas file but are domain concepts",
    fate: "move schedule-config to venue/domain; then delete these entries" },
  { file: "src/modules/booking/domain/extension-plan.ts", target: "src/modules/venue/schemas/schedule-config", rule: 2,
    reason: "ScheduleConfig type and WEEKDAYS live in a schemas file but are domain concepts",
    fate: "move schedule-config to venue/domain; then delete these entries" },
  { file: "src/modules/booking/domain/offered-slot.ts", target: "src/modules/venue/schemas/schedule-config", rule: 2,
    reason: "ScheduleConfig type and WEEKDAYS live in a schemas file but are domain concepts",
    fate: "move schedule-config to venue/domain; then delete these entries" },
  { file: "src/modules/booking/domain/series.ts", target: "src/modules/venue/schemas/schedule-config", rule: 2,
    reason: "ScheduleConfig type and WEEKDAYS live in a schemas file but are domain concepts",
    fate: "move schedule-config to venue/domain; then delete these entries" },
  { file: "src/modules/push/infrastructure/web-push-sender.ts", target: "src/modules/push/application/push-sender", rule: 2,
    reason: "implements the PushSender port declared in application",
    fate: "move the port to push/domain" },
  { file: "src/app/owner/(app)/money/activity-map.ts", target: "src/modules/ledger/infrastructure/entries", rule: 4,
    reason: "type-only (LedgerEntryRow)",
    fate: "export the row type from ledger/application or domain" },
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
    fate: "move phone helpers to src/lib" },
];

/** Rule 2: libs a domain or schemas file must not import (they stay pure). */
export const IMPURE_LIBS = [
  "src/lib/db", "src/lib/platform-db", "src/lib/logger", "src/lib/tenant-context",
  "src/lib/env", "src/lib/rate-limit",
];
