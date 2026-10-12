@AGENTS.md

# Stadiums SaaS — agent guide

Multi-tenant back-office for football stadium owners in Lebanon: bookings, cash in mixed USD/LBP, expenses, a financial summary, and a public page per stadium. Arabic first (RTL); Next.js 16 + Prisma 7 + Postgres, one modular monolith. Governing rule: every owner action must be faster than paper (RULE-12). This file is the single source of rules for every coding agent.

## Read these first
1. [README.md](README.md) — run and test.
2. [docs/NOW.md](docs/NOW.md) — what is live, what is next.
3. [docs/CODEMAP.md](docs/CODEMAP.md) — where files live and where a new one goes.

Then, by task: a feature -> `docs/requirements/brd.md` §7 (RULE-1…12) and `docs/decisions/` (never invent a decision: if no DR covers it, say so and stop); dependencies and layers -> [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); schema -> `docs/DATA-MODEL.md`, DR-002; money -> `docs/domain/money.md`; owner screens -> `docs/owner-ia.md`, `docs/owner-ux.md`, `docs/ui-rules.md`; deploy -> `docs/RUNBOOK.md`; tests -> `docs/guides/testing-jest.md`. The index is `docs/README.md`.

**`test/architecture/rules.ts` is the source of truth for dependencies** (module edges, layers, ui, app-thin). If a change needs a new edge, change it there in one line with a reason, and say why.

SPECs, DRs and audits are **historical**: never rewrite their bodies. **Living** docs (the ones in "Start here" and "Core" of `docs/README.md`) must match the code: update them in the same change. `test/docs/docs.test.ts` checks their headers, paths and links.

## Non-negotiables
- URL picks the tenant; the session only authorizes against it. Never pass `tenantId` by hand: the Prisma extension stamps it; raw SQL stamps it from `getCurrentTenantId()`. `tenantId` is on every tenant-owned table, child tables included.
- The use case that starts an action owns `$transaction` and passes `tx`. Authorize before the tx; never touch `platformDb` inside it. Notifications after commit. Repositories use the client they are given.
- Every payment writes its ledger row in the same transaction. Payment, PaymentTender, LedgerEntry, BookingDueChange and ExchangeRate are append-only: corrections are new rows. Money is `Decimal` (USD `Decimal(12,2)`, LBP `Decimal(18,0)` or `BigInt`), never a float. Times are `timestamptz` in UTC.
- The no-double-booking exclusion constraint lives in a hand-written SQL migration: never remove it, never model it in the schema DSL.
- Warn, never block the owner from taking money (RULE-9/10). Logical CSS properties only; Western digits; LTR-isolate numbers, phones and times; all copy through `ui()`; tenant-written names are never translated; no `next-intl`.
- jsonb (`scheduleConfig`, tenant `settings`) is Zod-validated at the application edge.
- Framework APIs come from `node_modules/next/dist/docs/` and the installed Prisma docs, not memory.

## Where code goes (placement rules)
1. A **business word** -> `src/modules/<module>/` in the right layer (`domain` pure, no await, no db; `application` use cases; `infrastructure` all queries; `schemas` Zod; `ui` components).
2. A **URL** -> `src/app/`, thin: validate, authorize, delegate. Only Next convention files, actions, and a `_components` folder per route.
3. **Generic UI** -> `src/components/ui`. The **app frame** -> `src/components/shell`. **One route only** -> that route's `_components`.
4. **Data and actions reach `ui/` through props.** A module `ui/` file never imports application, infrastructure, db, the Prisma client or `@/app`; the page passes the data and the real Server Action.
5. Imports point down only (Payment never imports Booking; Venue never imports Booking). Types with real invariants (Booking, Payment, Money) get domain types; plain data may use Prisma types.
6. Every query lives in `infrastructure/`; a read across more than two entities goes through a named function.

## Clean-code checklist
- One job per file. A file over about 300 lines that does more than one thing gets split (move code as is, then change it).
- A business word goes to a module, not to `lib/` or `components/`.
- Reuse the existing rule or helper before writing a new one (money and time formatters in `lib/format`, copy in `lib/copy`).
- No `await` and no db in `domain/`.
- Every slice ships its tests. No scaffolding ahead of the task (no empty layers).

## Workflow
1. Branch from `main`; one slice per branch; small commits (one item each).
2. Read the SPEC or UX doc and the DRs first. Report gaps, conflicts and open decisions, then wait for approval before code.
3. Moves are done with `git mv` so history is kept; a move changes no behaviour.
4. Write tests with the slice. Before every commit: `npx tsc --noEmit` and `npx jest test/architecture` (and the tests for what you touched). `npm test`, `npm run build` and `npm run test:integration` (for transactions, money, isolation) run before merging; CI must be green before merging.
5. Update the living docs you made stale in the same change.
6. Append a short entry to `docs/progress.md` (read only `tail -n 100 docs/progress.md`; match the format; never edit old entries).
7. Report results honestly: say what was run and what was not.
8. **Never move, delete or force-push a tag that has been pushed.** A mistake in a release is fixed by a new release with a new number. `v1.3.2` was moved twice by force push on 2026-10-12 and must never be deployed.
