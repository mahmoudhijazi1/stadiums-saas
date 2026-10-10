@AGENTS.md

# Stadiums SaaS — agent guide

Multi-tenant back-office for football stadium owners in Lebanon. It replaces the paper schedule: bookings, cash collection in mixed USD/LBP, expenses and a financial summary, plus a public page per stadium where players request slots. Arabic-first (RTL); Next.js 16 + Prisma 7 + Postgres modular monolith on one droplet. Governing rule: every owner action must be faster than paper (RULE-12).

## Where things stand
- `docs/NOW.md` — status + what's next. Read it first.
- SPEC-15 / SPEC-16 carry a status banner at the top of the file.

## Which doc for which task
| Task | Read first |
|---|---|
| Any new feature | `docs/requirements/brd.md` §7 (RULE-1…12), then `docs/decisions/` for constraints. Never invent a decision — if no DR covers it, say so and stop. |
| Tenancy, isolation, `platformDb`, transactions | DR-001, `docs/guides/prisma-transaction-tenant-guard.md` (one-pool / ALS rule) |
| Schema / data model | DR-002 (+ `docs/archive/cursor-rules/200-database-prisma.mdc`) |
| Login, sessions, permissions, `can()` | DR-003, SPEC-04 |
| Errors, logging, `?error=` keys | DR-004, SPEC-12, `docs/guides/error-handling-logging-audit.md` |
| Arabic / RTL / copy (`ui()`) | DR-005, SPEC-13 (+ `docs/archive/cursor-rules/100-rtl-i18n.mdc`) |
| Money: collect, tenders, rate, ledger | DR-002 §2.14–2.21, SPEC-06, SPEC-08 |
| Per-player payments (BR-41–49) | `docs/specs/SPEC-15-per-player-payments.md` |
| Fees, waivers, due adjustments, cancellation policy | `docs/specs/SPEC-16-due-adjustments.md` |
| Booking flow: request / approve / owner-create / cancel / no-show / waitlist | SPEC-03, 05, 09, 10, 14, 11 |
| Expenses | SPEC-07 |
| Slots, pitch hours, pricing | SPEC-02, DR-002 §2.4–2.7 |
| Owner UI structure (tabs, sheets, flows) | `docs/owner-ux.md` (UX-01 — wins on conflict), then `docs/owner-ia.md` (living route map) |
| History: day nav, person page, transactions, timeline | `docs/ux-02-history.md` (UX-02) |
| Visual design / tokens / components | `docs/ui-foundations.md`, `docs/ui-components.md`, `docs/theme.md`, `docs/MIGRATION.md` (source of truth for what shipped, incl. fonts) |
| Where files go | `docs/guides/folder-structure.md`, `docs/guides/module-map-and-request-walkthroughs.md` |
| Tests (Jest, Docker Postgres integration) | `docs/guides/testing-jest.md` |
| Launch gaps / backlog | `docs/guides/mvp-readiness-audit.md` (dated — read the banner) |

SPECs, DRs and audits are **historical**: never rewrite their bodies; at most a one-line banner. **Living** docs (`NOW.md`, `owner-ia.md`, `folder-structure.md`, `testing-jest.md`, READMEs) must match the code — update them in the same change.

## Non-negotiables (details in the DRs)
- URL picks the tenant; the session only authorizes against it. Never pass `tenantId` by hand — the Prisma extension stamps it; raw SQL must stamp it from ALS.
- Module imports point down only (Payment never imports Booking; Venue never imports Booking). `app/` stays thin: validate → authorize → delegate.
- The use case that starts an action owns `$transaction` and passes `tx`. Authorize before the tx; never touch `platformDb` inside it. Notifications after commit.
- Every payment writes its ledger row in the same transaction. Ledger is append-only, USD only. Money is `Decimal`, never float.
- Warn, never block the owner from taking money (RULE-9/10). Logical CSS properties only; LTR-isolate numbers/phones/times; all copy via `ui()`.
- Framework APIs come from `node_modules/next/dist/docs/` and installed Prisma docs, not memory.

## docs/progress.md — append-only build log
- **NEVER read it in full** (4,000+ lines). For recent context only, and only if needed: `tail -n 100 docs/progress.md`.
- **NEVER rewrite, reorganize, reformat, or edit past entries.**
- When a task is completed, **append** a new entry at the end:
  1. First inspect the last few entries with `tail` and match their existing format (`## Title` heading, `**When:**` date, **What**, **Why** with DR/SPEC/BRD link, **Files**, **How it connects** — incl. what it must not import — and **How to verify** with test counts / results).
  2. Append only — never insert mid-file. If an old entry is wrong, append a **Correction** entry.

## Standard workflow (one slice at a time)
1. **Read** the SPEC/UX doc for the slice plus the DRs and living docs it depends on.
2. **Report** gaps, conflicts with code or other docs, and open decisions — then **STOP and wait for approval**. No code before approval.
3. **Build one slice only**, exactly as scoped. Don't scaffold ahead (no `shop/`, `academy/`, empty layers).
4. **Verify after each slice:** `npm test`, `npm run build`, and `npm run test:integration` when the slice touches transactions, money, or isolation. Report results honestly.
5. **Update living docs** if routes, tabs, or structure changed.
6. **Append** to `docs/progress.md` as above.
