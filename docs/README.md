# Stadium SaaS — docs

**Purpose:** the index of everything under `docs/`, grouped by how much to trust it.
**Read when:** you are looking for a document, or unsure whether one is still true.
**Last verified:** `f01c9bf` (main, after refactor step 6c).

Rule of thumb: **Start here** and **Core** are living and must match the code. **Domain rules** and **Operations** are living too. **History** was true when written and is never rewritten (at most a one-line banner). `docs/archive/` holds superseded files that describe things that no longer exist.

## Start here
- [../README.md](../README.md) — what the product is, run it locally, run the tests.
- [NOW.md](./NOW.md) — what is live, what is in progress, the next three steps.
- [CODEMAP.md](./CODEMAP.md) — where every folder and module lives, and where a new file goes.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — modules, allowed imports, layers, ui and app rules, request flow.
- [KEY-FILES.md](./KEY-FILES.md) — the 17 files where a mistake breaks money, bookings, isolation or login, and the tests that guard them.
- [learning/approve-a-request.md](./learning/approve-a-request.md) — learning guide: one feature (the owner approves a booking request) end to end, for a Laravel and Vue developer new to Next.js, Server Components and Prisma.

## Core
- [DATA-MODEL.md](./DATA-MODEL.md) — tables, columns, constraints, migrations.
- [owner-ia.md](./owner-ia.md) — the owner app's route map (living).
- [ui-foundations.md](./ui-foundations.md), [ui-components.md](./ui-components.md), [ui-rules.md](./ui-rules.md), [theme.md](./theme.md) — design rules, components, tokens.
- [MIGRATION.md](./MIGRATION.md) — what shipped of the design-system migration (fonts included).
- [guides/testing-jest.md](./guides/testing-jest.md) — Jest, Docker Postgres integration tests, the architecture and docs tests.
- [guides/prisma-transaction-tenant-guide](./guides/prisma-transaction-tenant-guard.md) — the one-pool / AsyncLocalStorage rule for transactions and the tenant guard.

## Domain rules
- [domain/money.md](./domain/money.md) — collecting, tenders, rate, ledger.
- [domain/weekly-series.md](./domain/weekly-series.md) — weekly recurring bookings.
- [per-player-payments.md](./per-player-payments.md) — per-player payments as built.
- [push-notifications.md](./push-notifications.md) — web push to the owner's devices.
- [requirements/brd.md](./requirements/brd.md) — business requirements and RULE-1…12 (the product rules; historical in form, binding in content).

## Operations
- [RUNBOOK.md](./RUNBOOK.md) — deploy order, backups, rollback, operator procedures.
- [ROADMAP.md](./ROADMAP.md) — known open work that is not a product slice.

## History (true when written; do not rewrite)
- Decisions: [decisions/DR-001](./decisions/DR-001-tenancy-and-modules.md) tenancy, [DR-002](./decisions/DR-002-core-data-model.md) data model, [DR-003](./decisions/DR-003-auth-sessions.md) auth, [DR-004](./decisions/DR-004-error-handling.md) errors, [DR-005](./decisions/DR-005-arabic-rtl.md) Arabic and RTL, [DR-006](./decisions/DR-006-platform-admin.md) web platform admin, [DR-007](./decisions/DR-007-game-price-currency.md) game prices in LBP or USD.
- Specs: `specs/SPEC-01` … `SPEC-16` (tenancy, venue, booking, access, approve, collect, expense, dashboard, owner booking, cancel, waitlist, errors, RTL, no-show, per-player payments, due adjustments).
- UX records: [owner-ux.md](./owner-ux.md) (UX-01), [ux-02-history.md](./ux-02-history.md) (UX-02).
- Audits: `audits/` (security, security 2, architecture review, booking and payments audit, logic findings, doc-vs-code discrepancies) and `guides/` audits ([engineering](./guides/engineering-audit.md), [error handling and logging](./guides/error-handling-logging-audit.md), [MVP readiness](./guides/mvp-readiness-audit.md)), [mentor defense](./guides/mentor-defense-backend.md).
- [progress.md](./progress.md) — the build log, appended per task; older entries are in [archive/progress-2026.md](./archive/progress-2026.md).

## Archive (superseded; kept, not deleted)
- [archive/cursor-rules/](./archive/cursor-rules/), [archive/cursor-rules.md](./archive/cursor-rules.md), [archive/cursor-workflow.md](./archive/cursor-workflow.md) — the Cursor setup; CLAUDE.md is now the single source of agent rules.
- [archive/folder-structure-2026-10.md](./archive/folder-structure-2026-10.md) — the pre-refactor folder guide; replaced by CODEMAP.md and ARCHITECTURE.md.
- [archive/module-map-and-request-walkthroughs.md](./archive/module-map-and-request-walkthroughs.md) — the pre-refactor file map; replaced by CODEMAP.md.
