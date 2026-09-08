# Testing with Jest

Jest is the project test runner. Every build slice ships with tests for the logic that slice
introduces. Manual SPEC acceptance checks still matter; Jest is the repeatable safety net.

## Priority — what to test

1. **`domain/`** — always. Pure functions (no DB, no `await`). Highest value and easiest to learn from.
2. **Pure lib helpers** — e.g. host/slug parsing for tenant resolution. Extract small functions so they are testable without starting Next.
3. **`application/`** — when a use case has branching or multi-step orchestration; mock infrastructure or pass fake repos.
4. **DB / Prisma** — only when the slice’s Definition of Done requires proving isolation or persistence. Prefer a dedicated test DB later; do not block early slices on a heavy integration harness if a unit test already covers the pure part.

## What not to over-test early

- Thin `app/` pages and Server Actions that only validate → authorize → delegate.
- Generated Prisma client code.
- Pixel/UI styling.

## Conventions

- Co-locate: `foo.ts` → `foo.test.ts` (or `__tests__/foo.test.ts` when co-location is awkward).
- Scripts: `npm test` (and `npm test -- --watch` while learning).
- Config: use the official Next.js Jest setup for the **installed** Next version — verify against `node_modules/next/dist/docs/` (or Next’s testing guide) when installing; do not copy stale blog snippets from memory.
- New SPECs include a short **Tests** subsection listing which files must have Jest coverage for that slice’s Definition of Done.

## How this fits the architecture

- Domain tests lock the rules that must stay true when Shop/Academy arrive.
- Testing pure helpers (tenant slug parsing, money helpers, availability) keeps middleware and pages thin.
- Repository / extension tests prove the tenant rail when a SPEC’s acceptance criteria demand it.

See also: [folder-structure.md](./folder-structure.md), [cursor-workflow.md](./cursor-workflow.md).
