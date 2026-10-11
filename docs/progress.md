# Progress log

Entries are appended at the end, newest last, and kept short (a heading, **When**, **What**, **Why**, **Files**, **How it connects**, **How to verify**). Never edit an old entry; add a **Correction** entry instead. When this file passes about 300 lines, move it to `docs/archive/progress-<year>[-n].md` with `git mv` and start a new one. The earlier log (to `v1.0.0` and the refactor steps 1 to 6c) is [archive/progress-2026.md](./archive/progress-2026.md); read it with `tail`, never in full.

## Docs reset 4: agent instructions and the log

**When:** 2026-10-14

**What:** Rewrote `CLAUDE.md` (read first, non-negotiables, placement rules, clean-code checklist, workflow, `test/architecture/rules.ts` as the source of truth). `AGENTS.md` now starts with "Read CLAUDE.md first". The old `docs/progress.md` (7,000+ lines) moved with `git mv` to `docs/archive/progress-2026.md`; this file starts again.

**Why:** One short instruction file for every coding agent, and a log small enough to read.

**Files:** `CLAUDE.md`, `AGENTS.md`, `docs/progress.md`, `docs/archive/progress-2026.md`.

**How it connects:** Docs only.

**How to verify:** `npx tsc --noEmit`; `npx jest test/architecture`.

## Docs reset 5: a docs check

**When:** 2026-10-14

**What:** `test/docs/docs.test.ts` (6 tests): the core docs and `docs/domain/*` have the three header lines; every backticked path starting with `src/`, `test/`, `docs/`, `scripts/` or `prisma7.config.ts` in the core docs and `CLAUDE.md` exists (patterns with `*`, `<>`, `{}` are skipped); `docs/CODEMAP.md` lists every folder under `src/modules` and names none that does not exist; every relative link resolves. The first run found stale paths (`src/lib/qr.ts` in the RUNBOOK, `src/app/owner/layout.tsx` and a folder-structure link in owner-ia), now fixed. `docs/guides/testing-jest.md` describes the architecture and docs checks.

**Why:** Keep the living docs true after the cleanup.

**Files:** `test/docs/docs.test.ts`, `docs/guides/testing-jest.md`, `docs/RUNBOOK.md`, `docs/owner-ia.md`.

**How it connects:** The test reads files only; it imports nothing from `src/`.

**How to verify:** `npx jest test/docs` (6 passed); `npx tsc --noEmit`; `npx jest test/architecture` (12 passed).

## Key files: docs/KEY-FILES.md

**When:** 2026-10-14

**What:** New `docs/KEY-FILES.md`: the 15 files where a mistake would break money, bookings, tenant isolation or login (proxy, tenant-context, db, platform-db, can, login and session, rate-limit, the exclusion migration, bookings.ts, approve, request-public-slot, create-owner-booking, availability, record-payment, shop pricing). Each has Does, Why, Used by, Never change without (the invariant and the test files, all checked to exist). From your list `booking/domain/series.ts` was left out (feature-level, not isolation or money core; noted in the file) and "the payment collection use case" became `payment/application/record-payment.ts`, which writes payment, tenders and ledger for every collection path. Linked under Start here in `docs/README.md` and added to the core docs checked by `test/docs/docs.test.ts`. Branched from `refactor/08-docs` because `main` does not yet have the docs index or the docs test.

**Why:** A new developer should know which files to treat with care and what proves them safe.

**Files:** `docs/KEY-FILES.md`, `docs/README.md`, `test/docs/docs.test.ts`.

**How it connects:** Docs only; no code under `src/` changed.

**How to verify:** `npx jest test/docs` (6 passed). Claims marked UNVERIFIED in the file were not traced to code.
