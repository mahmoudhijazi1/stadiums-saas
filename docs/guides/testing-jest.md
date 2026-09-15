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

- **Location:** all tests live under root `test/`, mirroring `src/`.
  Example: `src/lib/tenant-slug.ts` → `test/lib/tenant-slug.test.ts`
  Example: `src/modules/venue/domain/availability.ts` → `test/modules/venue/domain/availability.test.ts`
- Import app code with the `@/` alias (same as production code).
- Scripts: `npm test` (and `npm test -- --watch` while learning).
- Config: use the official Next.js Jest setup for the **installed** Next version — verify against local Next docs when installing.
- Import Jest helpers from `@jest/globals` (`describe`, `it`, `expect`) so TypeScript is happy.
- New SPECs include a short **Tests** subsection listing which files must have Jest coverage for that slice’s Definition of Done.

## How this fits the architecture

- Domain tests lock the rules that must stay true when Shop/Academy arrive.
- Testing pure helpers (tenant slug parsing, money helpers, availability) keeps middleware and pages thin.
- Repository / extension tests prove the tenant rail when a SPEC’s acceptance criteria demand it.

## Integration tests (real Postgres)

Priority-1 architectural claims (exclusion constraint, transactional
`approveBooking`, no nested `platformDb` inside `$transaction`) need a
**dedicated** database — never the local demo/seed database.

### Docker Postgres (dev + test)

One container, two databases (real name isolation):

| Role | Database | Env |
|------|----------|-----|
| App + seed | `stadiums_dev` | `DATABASE_URL` |
| Integration tests | `stadiums_test` | `DATABASE_URL_TEST` |

```bash
docker compose up -d
# .env from .env.example — user stadiums_local / stadiums_local_dev @ localhost:5433
npx prisma migrate deploy --config prisma7.config.ts   # stadiums_dev
npm run db:seed
npm run test:integration   # migrate stadiums_test, then Jest
```

- Prepare + run: `npm run test:integration`
  1. `test/integration/migrate-test-db.ts` — `prisma migrate deploy` on `DATABASE_URL_TEST`
  2. Jest with `jest.integration.config.ts` (`*.integration.test.ts`, `maxWorkers: 1`)
- `setup-env.ts` rewrites `process.env.DATABASE_URL` to the test URL **before**
  any `@/lib/db` import and sets `STADIUMS_INTEGRATION=1`.
- Truncate: requires `STADIUMS_INTEGRATION=1` and a URL containing `/stadiums_test`.

Inspect data with DBeaver (or similar) at `localhost:5433` — no pgAdmin container.

Unit tests (`npm test`) stay offline and do not require Postgres.

Deadlock regression for `approveBooking`: **A** elapsed &lt; 5s and **B**
`platformDb.tenant.findUnique` call count stays 0 after tenant cache warm-up.

