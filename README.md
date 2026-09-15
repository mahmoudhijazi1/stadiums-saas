# Stadium SaaS

Multi-tenant stadium booking platform (Next.js 16, Prisma 7, Postgres).

**Start here for project status and where docs live:** [`docs/NOW.md`](./docs/NOW.md).

## Docs

| Path | What |
|------|------|
| [`docs/NOW.md`](./docs/NOW.md) | **Current status + next work + pointers** (read first) |
| [`docs/README.md`](./docs/README.md) | Catalog of DRs, SPECs, guides |
| [`docs/requirements/brd.md`](./docs/requirements/brd.md) | Product source of truth |
| [`docs/progress.md`](./docs/progress.md) | Append-only journey log |

**Work order:** decision → spec → code. Agent rules: [`.cursor/rules/`](./.cursor/rules/). Framework warning: [`AGENTS.md`](./AGENTS.md).

## Local setup

```bash
docker compose up -d          # Postgres 16 on localhost:5433 (dev + test DBs)
cp .env.example .env          # if needed
npx prisma migrate deploy --config prisma7.config.ts
npm run db:seed
npm run dev
```

Seed logins (password `dev-owner`): `owner@ahmad`, `owner@sami`, `staff@ahmad`. Use `?tenant=ahmad` (or host slug) locally.

## Scripts

```bash
npm run dev                 # Next.js
npm run build
npm run lint
npm test                    # unit (Jest, offline)
npm run test:integration    # migrate stadiums_test + integration Jest
npm run db:seed
```

Details: [`docs/guides/testing-jest.md`](./docs/guides/testing-jest.md).
