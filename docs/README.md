# Stadium SaaS — docs

**Current status and what’s next:** [NOW.md](./NOW.md) — read that first.

Decisions, specs, and guides live here. Code does not.

**Order of work:** decision → spec → code. Never invent a decision in chat; write or update a DR first.

## Layout

```
docs/
  NOW.md                    ← status + next work + pointers (entry point)
  README.md                 ← this catalog
  progress.md               ← append-only journey log
  owner-ia.md               ← living owner tab/route map
  decisions/                ← why (historical DRs — do not rewrite bodies)
  specs/                    ← what to build (historical SPECs)
  guides/                   ← how we work + audits
  requirements/             ← product source of truth (BRD)
```

Agent rules that load automatically stay in `.cursor/rules/` (not under `docs/`). See [guides/cursor-rules.md](./guides/cursor-rules.md).

## Naming conventions

| Folder | Pattern | Example |
|--------|---------|---------|
| `decisions/` | `DR-NNN-kebab-slug.md` | `DR-003-auth-sessions.md` |
| `specs/` | `SPEC-NN-kebab-slug.md` | `SPEC-02-venue-availability.md` |
| `guides/` | `kebab-slug.md` | `cursor-workflow.md` |
| `requirements/` | descriptive kebab | `brd.md` |

- Numbers are zero-padded and never reused. New DR = next free `NNN`; new SPEC = next free `NN`.
- One concern per file. Prefer a new DR/SPEC over stuffing an old one.
- Specs depend on DRs; link them at the top of each SPEC (`Depends on: DR-00N`).
- Every SPEC includes a **Tests** subsection (see [guides/testing-jest.md](./guides/testing-jest.md)).
- **Historical** SPECs/DRs/audits: do not rewrite bodies to match later renames; at most a one-line banner at the top.
- **Living** docs (`NOW.md`, `owner-ia.md`, folder-structure, testing-jest, READMEs): must match current code.

## Catalog

### Decisions
- [DR-001 — Tenancy & modules](./decisions/DR-001-tenancy-and-modules.md)
- [DR-002 — Core data model](./decisions/DR-002-core-data-model.md)
- [DR-003 — Auth, sessions, memberships](./decisions/DR-003-auth-sessions.md)
- [DR-004 — Error handling (logs vs owner screens)](./decisions/DR-004-error-handling.md)
- [DR-005 — Arabic-first UI (RTL + copy, no locale URL)](./decisions/DR-005-arabic-rtl.md)

### Specs (all SPEC-01…14 implemented — historical build records)
- [SPEC-01 — Tenancy foundation](./specs/SPEC-01-tenancy-foundation.md)
- [SPEC-02 — Venue availability](./specs/SPEC-02-venue-availability.md)
- [SPEC-03 — Public booking request](./specs/SPEC-03-booking-public-request.md)
- [SPEC-04 — Access: login, session, `can(...)`](./specs/SPEC-04-access-login.md)
- [SPEC-05 — Owner approve (exclusion fires)](./specs/SPEC-05-owner-approve.md)
- [SPEC-06 — Collect payment on a booking](./specs/SPEC-06-collect-payment.md)
- [SPEC-07 — Record an expense](./specs/SPEC-07-record-expense.md)
- [SPEC-08 — Financial dashboard (ledger period summary)](./specs/SPEC-08-financial-dashboard.md)
- [SPEC-09 — Owner-created booking](./specs/SPEC-09-owner-create-booking.md)
- [SPEC-10 — Cancel a confirmed booking](./specs/SPEC-10-cancel-booking.md)
- [SPEC-11 — Waitlist on a freed slot](./specs/SPEC-11-waitlist.md)
- [SPEC-12 — Error handling](./specs/SPEC-12-error-handling.md)
- [SPEC-13 — Arabic-first UI](./specs/SPEC-13-arabic-rtl.md)
- [SPEC-14 — Record a no-show](./specs/SPEC-14-no-show.md)

### Living guides & maps
- [Progress & learning log](./progress.md)
- [Owner dashboard IA](./owner-ia.md)
- [Folder structure](./guides/folder-structure.md)
- [Module map + request walkthroughs](./guides/module-map-and-request-walkthroughs.md)
- [Mentor defense — backend](./guides/mentor-defense-backend.md)
- [Cursor workflow](./guides/cursor-workflow.md)
- [Cursor rules](./guides/cursor-rules.md)
- [Testing with Jest](./guides/testing-jest.md)
- [Prisma `$transaction` + tenant guard](./guides/prisma-transaction-tenant-guard.md)

### Dated audits (historical snapshots — read banners)
- [Engineering audit](./guides/engineering-audit.md)
- [Error handling + logging audit](./guides/error-handling-logging-audit.md)
- [MVP readiness audit](./guides/mvp-readiness-audit.md)

### Requirements
- [BRD](./requirements/brd.md) — [requirements/README.md](./requirements/README.md)

## Framework note

This Next.js version differs from training data (`AGENTS.md`). Specs describe **what** and **why**; exact APIs come from `node_modules/next/dist/docs/` and installed Prisma docs at implementation time.
