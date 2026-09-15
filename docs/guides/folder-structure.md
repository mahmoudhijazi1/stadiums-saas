# Folder Structure — the modular monolith, in files

You're new to Next.js and React. This is the single most useful thing to hold in your head:

> **`app/` is routes and nothing else. Your real code lives in `src/modules/`.**

Coming from Laravel: `app/` is like `routes/` + the thinnest possible controllers. Everything a Laravel dev puts in `app/Models`, `app/Services`, etc. goes into `src/modules/` here — but grouped by **feature**, not by type.

---

## The structure as it exists today

Grow this one module at a time. Do NOT scaffold empty folders up front — wrong-shaped empties invite mistakes. Below is the shape of the **current** tree (not a wish-list).

```
src/
  proxy.ts                      ← Next.js 16 proxy (renamed from middleware).
                                  Host / ?tenant= → header x-tenant-slug.
                                  Must not query Postgres.

  app/                          ← Next.js routes ONLY. Thin. No business logic.
    (public)/                   ← Public per-tenant booking page
      page.tsx
      request-slot.ts           ← Server Action → booking use case
    login/
      page.tsx
      actions.ts
    owner/                      ← Owner back-office
      today/                    ← Home (approve, collect, cancel, no-show)
      book/                     ← Owner create booking
      waitlist/
      money/                    ← Ledger summary + expenses
      more/settings/            ← Pitches + rate
      layout.tsx
      tab-bar.tsx
    layout.tsx                  ← html lang/dir from cookie locale
    locale-actions.ts
    error.tsx
    global-error.tsx
    # No [locale] segment. Locale is cookie stadium_locale (DR-005 / SPEC-13).
    # No app/api/ route handlers yet — Server Actions only.

  components/                   ← Shared React UI (not per-module ui/ folders)
    ui/                         ← Primitives (button, dialog, bottom-sheet, …)
    day-chips.tsx
    slot-picker.tsx
    lang-toggle.tsx
    …

  modules/                      ← ALL business logic. One folder per bounded context.
    access/                     ← Login, sessions, membership, can()
      domain/
      application/
      infrastructure/
      schemas/
    people/
    venue/
      domain/
        availability.ts         ← Slot-generation engine (pure)
      application/
      infrastructure/
      schemas/
    booking/
      domain/                   ← decision, exclusion, waitlist, …
      application/
      infrastructure/
      schemas/
    payment/
    ledger/
    expense/
    notification/               ← domain only today (WhatsApp link helpers)
    # No modules/*/ui/ — route UI lives under app/; shared under components/
    # No modules/platform/ — platform tables use lib/platform-db.ts
    # shop/     ← Phase 2, don't create yet
    # academy/  ← Phase 3, don't create yet

  lib/                          ← Shared plumbing used by many modules
    prisma-base.ts              ← One Prisma client, one pool
    db.ts                       ← Tenant-scoped extension
    platform-db.ts              ← Unscoped escape hatch (allowlisted)
    tenant-context.ts           ← Request-scoped tenant (after header → load)
    tenant-slug.ts              ← Parse host / ?tenant=
    money.ts                    ← Decimal helpers, USD/LBP
    logger.ts                   ← Server file logger → /logs
    locale.ts / get-ui-locale.ts / ui-copy.ts
    error-messages.ts / success-messages.ts / errors.ts / use-case-error.ts
    request-fields.ts / format-local-hm.ts / utils.ts
    # No lib/auth.ts — sessions + can() live in modules/access/
    # No lib/i18n.ts — dictionaries are the files above (no next-intl yet)

  prisma/                       ← schema.prisma, migrations/, seed.ts
```

Also at repo root (not under `src/`): `docs/`, `test/` (Jest unit + `test/integration/`), `docker-compose.yml`, `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`.

---

## The three layers inside every module — the one rule that replaces MVC

For any function you write, ask one question:

> **Does it touch the database or the internet, or does it just think?**

- **Just thinks** → `domain/`. Pure function. No `await`. Takes data in, returns data or a boolean. Example: `canCancel`-style rules in `booking/domain/decision.ts`. Testable with no database.
- **Touches the DB / orchestrates steps** → `application/`. This is where `await` and `$transaction` live. Gets data, asks a domain rule, saves, notifies.
- **Talks to Prisma** → `infrastructure/`. Every query hides here. Nothing else in the app writes Prisma queries directly.

Laravel mapping:
- Controller → thin Server Action in `app/`
- Service → `application/`
- Repository → `infrastructure/`
- Model rules / validation → `domain/` (as functions, not fat models)

`schemas/` (Zod) sits at the module edge when a use case needs validated input. Not every module has every subfolder — create a layer when it has something in it (e.g. `notification/` is domain-only today).

---

## Why by-feature and not by-type

Laravel groups by type: all controllers together, all models together. Here you group by feature: everything about booking in `modules/booking/`.

The payoff is your Phase 3 test: **adding the academy = adding `modules/academy/`, touching nothing else.** If code were grouped by type, the academy would smear across `controllers/`, `models/`, `services/` — touching everything. By feature, it's one new folder.

Shared chrome that is not a bounded context (`Button`, day chips) stays in `src/components/`. Feature-specific page composition stays next to the route under `src/app/`.

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

**One simplification worth allowing:** for a truly trivial module (say `notification/` today),
you don't need all four sub-layers. If there's no real rule beyond helpers, there's no
`application/`. Don't create empty layers to be symmetric — create a layer when it has something in
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
