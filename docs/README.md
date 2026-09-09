# Stadium SaaS — docs

Decisions, specs, and guides live here. Code does not.

**Order of work:** decision → spec → code. Never invent a decision in chat; write or update a DR first.

## Layout

```
docs/
  README.md                 ← this index
  decisions/                ← why (settled architecture)
  specs/                    ← what to build (one slice each)
  guides/                   ← how we work (Cursor, folders, rules)
  requirements/             ← product source of truth (BRD, etc.)
```

Agent rules that load automatically stay in `.cursor/rules/` (not under `docs/`). See [guides/cursor-rules.md](./guides/cursor-rules.md).

## Naming conventions (keep these as files grow)

| Folder | Pattern | Example |
|--------|---------|---------|
| `decisions/` | `DR-NNN-kebab-slug.md` | `DR-003-auth-sessions.md` |
| `specs/` | `SPEC-NN-kebab-slug.md` | `SPEC-02-venue-availability.md` |
| `guides/` | `kebab-slug.md` | `cursor-workflow.md` |
| `requirements/` | descriptive kebab or keep product name | `brd.md` |

- Numbers are zero-padded and never reused. New DR = next free `NNN`; new SPEC = next free `NN`.
- One concern per file. Prefer a new DR/SPEC over stuffing an old one.
- Specs depend on DRs; link them at the top of each SPEC (`Depends on: DR-00N`).
- Every SPEC includes a **Tests** subsection listing Jest coverage expected for that slice (see [guides/testing-jest.md](./guides/testing-jest.md)).

## Current contents

### Decisions
- [DR-001 — Tenancy & modules](./decisions/DR-001-tenancy-and-modules.md)
- [DR-002 — Core data model](./decisions/DR-002-core-data-model.md)

### Specs
- [SPEC-01 — Tenancy foundation](./specs/SPEC-01-tenancy-foundation.md) (implemented)
- [SPEC-02 — Venue availability](./specs/SPEC-02-venue-availability.md) (implemented)
- [SPEC-03 — Public booking request](./specs/SPEC-03-booking-public-request.md) (in progress — steps 1–5)

### Guides
- [Progress & learning log](./progress.md) — what we built, in order; agents append after each step
- [Cursor workflow](./guides/cursor-workflow.md) — slices, tokens, staying on rules
- [Folder structure](./guides/folder-structure.md) — modular monolith layout
- [Cursor rules](./guides/cursor-rules.md) — why `.mdc` and how scoping works
- [Testing with Jest](./guides/testing-jest.md) — always-on test practice per slice

### Requirements
- [BRD](./requirements/brd.md) — product source of truth (draft v0.1). Requirements folder notes: [requirements/README.md](./requirements/README.md).

## What's next

- **Implement SPEC-03** (option A: public PENDING request). One numbered step at a time.
- Then auth (email@domain + password) before owner approve UI
- Then payment, public polish, dashboard (MVP order)

## Framework note

This Next.js version differs from training data (`AGENTS.md`). Specs describe **what** and **why**; exact APIs come from `node_modules/next/dist/docs/` and installed Prisma docs at implementation time.
