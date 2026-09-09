# Folder Structure — the modular monolith, in files

You're new to Next.js and React. This is the single most useful thing to hold in your head:

> **`app/` is routes and nothing else. Your real code lives in `src/modules/`.**

Coming from Laravel: `app/` is like `routes/` + the thinnest possible controllers. Everything a Laravel dev puts in `app/Models`, `app/Services`, etc. goes into `src/modules/` here — but grouped by **feature**, not by type.

---

## The target structure

Grow this one module at a time. Do NOT scaffold it all up front — empty wrong-shaped folders invite mistakes. This is the shape it grows *into*.

```
src/
  app/                          ← Next.js routes ONLY. Thin. No business logic.
    [locale]/                   ← next-intl locale segment (ar / en)
      (owner)/                  ← owner back-office route group
        dashboard/page.tsx
        schedule/page.tsx
      (public)/                 ← public per-tenant page route group
        page.tsx
    api/                        ← only if you need route handlers
    layout.tsx
    middleware.ts               ← tenant resolution (subdomain → header)

  modules/                      ← ALL business logic. One folder per bounded context.
    people/
      domain/                   ← pure functions, no DB, no await. The rules.
      application/              ← use cases. orchestration. await + transactions live here.
      infrastructure/          ← all Prisma queries hidden here.
      schemas/                 ← Zod input validation.
      ui/                      ← React components for this feature.
    venue/
      domain/
        availability.ts        ← the slot-generation engine (pure functions)
      application/
      infrastructure/
      schemas/
      ui/
    booking/
      domain/
        booking.rules.ts       ← canCancel(booking, policy, now), etc.
      application/
      infrastructure/
      schemas/
      ui/
    payment/
    ledger/
    expense/
    access/
    notification/
    platform/
    # shop/     ← Phase 2, don't create yet
    # academy/  ← Phase 3, don't create yet

  lib/                          ← shared plumbing used by many modules
    db.ts                       ← Prisma client + tenant extension
    platform-db.ts              ← the unscoped escape-hatch client (allowlisted)
    tenant-context.ts           ← request-scoped tenant context
    auth.ts                     ← sessions + can(user, 'permission')
    money.ts                    ← Decimal helpers, USD/LBP
    logger.ts                  ← server file logger → /logs (info/error)
    i18n.ts

  prisma/
    schema.prisma
    migrations/
```

---

## The three layers inside every module — the one rule that replaces MVC

For any function you write, ask one question:

> **Does it touch the database or the internet, or does it just think?**

- **Just thinks** → `domain/`. Pure function. No `await`. Takes data in, returns data or a boolean. Example: `canCancel(booking, policy, now)`. Testable with no database.
- **Touches the DB / orchestrates steps** → `application/`. This is where `await` and `$transaction` live. Gets data, asks a domain rule, saves, notifies.
- **Talks to Prisma** → `infrastructure/`. Every query hides here. Nothing else in the app writes Prisma queries directly.

Laravel mapping:
- Controller → thin Server Action in `app/`
- Service → `application/`
- Repository → `infrastructure/`
- Model rules / validation → `domain/` (as functions, not fat models)

---

## Why by-feature and not by-type

Laravel groups by type: all controllers together, all models together. Here you group by feature: everything about booking in `modules/booking/`.

The payoff is your Phase 3 test: **adding the academy = adding `modules/academy/`, touching nothing else.** If code were grouped by type, the academy would smear across `controllers/`, `models/`, `services/` — touching everything. By feature, it's one new folder.

---

## The dependency rule (from DR-001)

Modules import **downward** only:

```
booking, expense, shop, academy
        │
        ▼
    payment ──▶ ledger
        ▲
people, venue ◀── used by booking, academy
access, notification ◀── used by anyone
```

`payment/` must never `import` from `booking/`. If you catch yourself doing it, the boundary is wrong. This is what keeps the system scalable — new features plug in at the bottom without disturbing the top.

---

## What "scalable but simple" means in this structure

- **Simple now:** you only create the modules MVP needs. `shop/` and `academy/` don't exist yet — they're commented out above.
- **Scalable later:** when they arrive, they're new folders at the bottom of the dependency graph. Nothing above them changes. The interfaces domain functions take (`BookingLike`, not concrete Prisma types — see DR-002) mean rules keep working as the system grows.

Grow one module per working slice. Never scaffold ahead.

---

## Is this the *best* structure? An honest answer.

There is no single "best" — there's best-for-your-constraints. Yours are: one developer, one
droplet, new to Next.js, must stay scalable, phases 2 and 3 must plug in without disturbing
phase 1. For those, feature-sliced modules are the right call, and here's the honest trade-off
so you can defend it rather than just trust it.

**The common alternative you'll see in Next.js tutorials:** group by type — a top-level
`components/`, `lib/`, `actions/`, `types/`, and let `app/` hold most logic. It's simpler for a
tiny app and it's what most examples show.

**Why it's wrong for you specifically:** it's the same shape as Laravel's group-by-type, and it
fails your one hard test — adding the academy (Phase 3) would smear across every top-level
folder instead of being one new `modules/academy/`. For a genuinely small app that never grows,
group-by-type is fine. Yours is explicitly planned to grow in phases, so the module structure
earns its slightly higher up-front effort.

**Where the module structure costs you:** more folders up front, and a moment of "which layer
does this go in?" while it's unfamiliar. That cost fades after the first two or three modules.
The `domain`/`application`/`infrastructure` question becomes automatic once you've asked "does
it touch the DB, or just think?" a dozen times.

**One simplification worth allowing:** for a truly trivial module (say `expense/` if it ends up
being almost nothing), you don't need all four sub-layers. If there's no real rule, there's no
`domain/`. Don't create empty layers to be symmetric — create a layer when it has something in
it. Scalable-but-simple means the structure follows the content, not a template.

---

## The two root-level files (`AGENTS.md`, `CLAUDE.md`) — what they're for

- **`AGENTS.md`** — cross-tool agent instructions. Yours already contains the critical
  Next.js-version warning (auto-written by `next dev`). Leave it; it's doing real work.
- **`CLAUDE.md`** — the equivalent that Claude Code / Claude-based tools read (`@AGENTS.md`).

**How they relate to `.cursor/rules/*.mdc`:** the `.mdc` files are Cursor-specific and support
scoping (globs) and conditional loading, which the root files don't. So the clean division is:

- Keep **short, tool-agnostic, always-true** notes in `AGENTS.md` / `CLAUDE.md` (e.g. the
  framework-version warning). These are for any agent, and the Next.js one is auto-maintained —
  don't fight it.
- Keep the **detailed, scoped architecture rules** in `.cursor/rules/*.mdc` where globs can load
  them only when relevant (the token win).
- Keep **reasoning and build plans** in `docs/` (`decisions/`, `specs/`, `guides/`).

Don't duplicate the same content across both — that's paying twice and risking drift. The single
source of truth for architecture is `docs/decisions/`; root agent files and `.mdc` rules are
short pointers and reminders, not re-statements.
