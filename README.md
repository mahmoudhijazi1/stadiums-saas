# Stadium SaaS

**Purpose:** the one-page start: what this is, how to run it, how to test it.
**Read when:** you open the repo for the first time.
**Last verified:** `f01c9bf` (main, after refactor step 6c).

A multi-tenant back-office for football stadium owners in Lebanon: bookings, cash collection in USD and LBP, expenses and a financial summary, replacing the paper schedule. Each stadium also gets a public page where players request slots. Arabic first (RTL); Next.js 16, Prisma 7 and Postgres as one modular monolith.

## Run it locally
```bash
docker compose up -d          # Postgres 16 on localhost:5433 (dev and test databases)
cp .env.example .env          # then adjust if needed
npm ci
npx prisma generate --config prisma7.config.ts    # the client is not in git (src/generated)
npx prisma migrate deploy --config prisma7.config.ts
npm run db:seed
npm run dev
```
Seed logins (password `dev-owner`): `owner@ahmad`, `owner@sami`, `staff@ahmad`. Open a tenant by host: `http://ahmad.localhost:3000` (`APP_BASE_DOMAIN="localhost:3000"`). Only the bare `APP_BASE_DOMAIN` or a single-label subdomain of it is served; other hosts get 404. The seed wipes every table and refuses to run unless `DATABASE_URL` names `stadiums_dev` or `stadiums_test` (`src/prisma/seed-guard.ts`).

## Run the tests
```bash
npx tsc --noEmit              # types
npm test                      # unit tests (Jest, offline), including the architecture and docs checks
npm run test:integration      # needs the Docker Postgres above; migrates stadiums_test first
npm run lint
npm run build
```

## Read next
1. [docs/NOW.md](./docs/NOW.md) — what is live and what is next.
2. [docs/CODEMAP.md](./docs/CODEMAP.md) — where everything lives and where a new file goes.
3. [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — modules, allowed imports, layers.

The full index is [docs/README.md](./docs/README.md). Rules for coding agents are in [CLAUDE.md](./CLAUDE.md).
