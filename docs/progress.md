# Stadium SaaS Ã¢ÂÂ progress & learning log

This is the **story of what we actually built**, in order, in plain language.

It is for you: to stay current, to explain a file to yourself a month from now, and to **defend a decision** in an interview or a review (Ã¢ÂÂwe did X because DR-002 said Y, not because the tutorial didÃ¢ÂÂ).

It is **not** the source of truth for product or architecture. Those stay in:

| Document | Job | Example |
|---|---|---|
| [BRD](./requirements/brd.md) | What the business needs | Ã¢ÂÂTwo confirmed bookings never overlapÃ¢ÂÂ |
| [DR-001](./decisions/DR-001-tenancy-and-modules.md), [DR-002](./decisions/DR-002-core-data-model.md) | Why the technical shape is this way | jsonb schedule, no slots table, Prisma guard not RLS yet |
| [SPEC-01](./specs/SPEC-01-tenancy-foundation.md), [SPEC-02](./specs/SPEC-02-venue-availability.md) | What to build in one slice | numbered steps + definition of done |
| **This file** | What we did, when, which files, how they connect | Ã¢ÂÂproxy sets a header because Next middleware cannot share memory with the pageÃ¢ÂÂ |

Agents **append** here after each finished SPEC step or notable decision. They do not rewrite old chapters. See `.cursor/rules/050-progress-log.mdc`.

---

## How to read this (if you are learning)

1. Skim **Where we are** (next section).
2. When a file confuses you, search this page for its name.
3. For Ã¢ÂÂwhy not the other design?Ã¢ÂÂ, jump to the linked DR Ã¢ÂÂ this log only *points* there.
4. Code changes. If this log and the repo disagree, **the repo wins**; then we append a correction.

---

## Where we are (2026-09-15)

**On `main`.** SPEC-01Ã¢ÂÂ14 shipped. UI is Arabic + RTL by default. Public `/` and owner chrome have an EN/ÃÂ¹ toggle (cookie `stadium_locale`) that flips `html` `lang`/`dir`. Latin times/phones/money/day numbers use `<bdi dir="ltr">` / `LtrIsolate`. Domain failures stay on the page (`?error=<key>`). Unexpected goes to `error.tsx` / `logs/`. RULE-7 isolation is proven by `test/integration/isolation.integration.test.ts` (plus a tenant-guard fix for findUnique select / update pre-check).

**What a visitor can do:** public PENDING request. Owner approves, Books a caller's hour, Collects, Cancels, marks No-show, sees waitlist + Notify, confirms via WhatsApp after approve, records expenses, and sees This period.

**What they cannot do yet:** refunds, per-player split, pitch blocks, subscriptions/suspend, other WhatsApp templates (reject/cancel/reminder), public location/contact/QR, games-played / pitch-busy (BR-57). Ops: no written backup cadence; prod env checklist still thin Ã¢ÂÂ see [NOW.md](./NOW.md).

**Local logins (seed only):** password `dev-owner`. Identifiers `owner@ahmad`, `owner@sami`, `staff@ahmad` (STAFF, cannot approve, collect, record expenses, view reports, Book, or cancel).

**Next:** MVP P0 remaining Ã¢ÂÂ backup cadence, then deploy/prod env truth ([NOW.md](./NOW.md)).

---

## The product in one paragraph

Lebanese stadium owners run bookings and cash on paper. This SaaS is a **subscription per stadium** (a *tenant*). Each owner gets his own site (subdomain). Players usually have **no account**. Phase 1 is bookings + mixed USD/LBP money + expenses + a public page. Phase 2 is shop. Phase 3 (the real business) is academy. **G-1:** every owner action must be faster than paper.

That paragraph lives in the BRD. Code so far only proves: *the right stadiumÃ¢ÂÂs data, and a day of slots from a rule, not a slots table.*

---

## Stack Ã¢ÂÂ what we chose and why it shows up in files

| Piece | Why it is here | Where you see it |
|---|---|---|
| **Next.js 16** (App Router) | UI + server in one repo. **This version is not Ã¢ÂÂthe Next.js you memorized.Ã¢ÂÂ** `AGENTS.md` + `.cursor/rules`: read `node_modules/next/dist/docs/` before APIs. | `src/app/`, `src/proxy.ts` (not `middleware.ts`) |
| **Prisma 7 + Postgres** | Typed queries; Postgres for later **exclusion constraint** (no double-booking). Prisma 7 uses a config file for the DB URL. | `src/prisma/schema.prisma`, `prisma7.config.ts` |
| **Shared DB, `tenantId` on tenant tables** | One cheap droplet, many stadiums. Schema-per-tenant rejected (DR-001). | `Pitch.tenantId` |
| **Prisma extension, not RLS yet** | Laravel-style global scope. RLS is a second line of defense, deferred until a real paying stranger. | `src/lib/db.ts` |
| **Jest** | Lock **pure** rules (slug parse, Zod, slot engine) without starting the browser. | `test/` mirrors `src/` |
| **Zod + decimal.js** | Json is `unknown`; money must not be a float. | `src/modules/venue/schemas/`, `src/lib/money.ts` |

**Module idea (DR-001):** `src/app/` is only routes (thin). Real work is `src/modules/<feature>/{domain, application, infrastructure}`. Domain = thinks (no DB). Application = orchestrates (`await`). Infrastructure = Prisma. Arrows point **down** (Booking may ask Venue; Venue must not import Booking).

We **do not** create empty folders for Shop/Academy/Booking until that SPEC.

---

## Chapter 0 Ã¢ÂÂ create-next-app and Prisma (before SPEC-01)

**Commits:** `ceb9d55` Create Next App Ã¢ÂÂ `413d3bc` move to `src/` and Prisma.

**What:** A stock Next app, then the project was moved so source lives under `src/` (including Prisma schema at `src/prisma/`). Postgres is reached via `DATABASE_URL` in `.env`, wired in `prisma7.config.ts` (Prisma 7 style Ã¢ÂÂ the URL is **not** in `schema.prisma`).

**Why `src/`:** keeps `app/` from mixing with `modules/` later; matches `docs/guides/folder-structure.md`.

**Relation:** Everything later hangs off this. Demo `User` table from the init migration was later dropped in SPEC-01.

**Gotcha you will hit:** local `DATABASE_URL` has pointed at Postgres database `template1`. Putting app tables in `template1` breaks Prisma `migrate dev`Ã¢ÂÂs **shadow database** (it clones template1, already has `Tenant`, migration says Ã¢ÂÂalready existsÃ¢ÂÂ). SPEC-02 step 1 used `migrate deploy` with a handwritten SQL file instead. That is an environment quirk, not a product decision.

---

## Chapter 1 Ã¢ÂÂ planning docs and the Cursor leash

**Commit:** `9fce834` (this was `origin/main` before the feature branch).

**What we added (not product code):**

- `docs/decisions/DR-001` Ã¢ÂÂ tenancy, modules, transactions, notifications after commit, RLS deferred.
- `docs/decisions/DR-002` Ã¢ÂÂ core tables for MVP (people, venue, booking, payment, ledger, expense) and rejected alternatives.
- Guides: folder structure, Cursor workflow, Jest, how `.mdc` rules work.
- `.cursor/rules/000-core-architecture.mdc` (always on), `100-rtl-i18n.mdc` (UI), `200-database-prisma.mdc` (schema/infra).
- `SPEC-01` written as the first **build** slice.

**Why this before more code:** decision Ã¢ÂÂ spec Ã¢ÂÂ code. If the agent invents a table in chat, you cannot defend it. The BRD was still a placeholder here (`docs/requirements/` said Ã¢ÂÂadd when readyÃ¢ÂÂ).

**How you work with Cursor (from the workflow guide):** one SPEC step at a time; you verify; then the next step. New chat per slice keeps token cost down.

---

## Chapter 2 Ã¢ÂÂ SPEC-01 Tenancy foundation (implemented)

**Goal of the slice:** prove isolation with the smallest real read: *list this tenantÃ¢ÂÂs pitches*. If scoping is wrong, show **zero rows**, never SamiÃ¢ÂÂs pitches on AhmadÃ¢ÂÂs site.

**Depends on:** DR-001 (URL = tenant; session later only authorizes), DR-002 (Pitch has `tenantId`).

**Branch at the time:** `feature/spec-01-tenancy-foundation` (later merged into `main` and deleted).

### Step 1 Ã¢ÂÂ Schema: Tenant + Pitch

**Files:** `src/prisma/schema.prisma`, migration `src/prisma/migrations/20260909010000_tenancy_foundation/migration.sql`

**What:** `Tenant` (`id`, `slug` unique, `name`, `createdAt`). `Pitch` (`id`, `tenantId`, `name`, `createdAt`) + relation + index on `tenantId`. Dropped leftover `User`.

**Why not more columns:** `schedule_config`, blocks, bookings wait for later SPECs. `tenantId` on Pitch is mandatory even for this tiny table (RLS later needs it on every tenant table).

**Relation:** every later Pitch query rides this table. Seed creates Ahmad/Sami here.

### Step 2 Ã¢ÂÂ Resolve tenant without touching the DB

**Files:** `src/lib/tenant-slug.ts`, `src/proxy.ts`, `test/lib/tenant-slug.test.ts`

**What:** `parseTenantSlug(host, searchParams)` Ã¢ÂÂ `ahmad.stadiums.com` Ã¢ÂÂ `"ahmad"`. Local: `ahmad.localhost`, `ahmad.lvh.me`, or `?tenant=ahmad` (query **wins** so you can test without DNS). Invalid slugs Ã¢ÂÂ `null`.

**`src/proxy.ts`:** Next.js 16 **proxy** (same job as old Ã¢ÂÂmiddlewareÃ¢ÂÂ). Runs **before** the page, in a **different runtime**. It **cannot** put tenant id in AsyncLocalStorage for the page to read (DR-001 corrected that). It only sets header `x-tenant-slug`. It **must not** query Postgres.

**Why a pure function:** Jest can test it without Next. If you ever change URL scheme, you change one function.

**Relation:** proxy Ã¢ÂÂ header Ã¢ÂÂ `tenant-context` (next step).

### Step 3 Ã¢ÂÂ Tenant exists? 404 if not

**File:** `src/lib/tenant-context.ts`

**What:** Page/server code reads `x-tenant-slug` via `headers()` (Next Ã¢ÂÂ request-time API, must `await`). Looks up `Tenant` with **`platformDb`** (unscoped Ã¢ÂÂ you are looking up the tenant row itself). Missing slug or unknown slug Ã¢ÂÂ `notFound()`. `cache()` so one lookup per request.

**Rule to defend:** *The URL chooses the tenant. A future login only asks Ã¢ÂÂis this person allowed **here**?Ã¢ÂÂ* Invert that and a stolen cookie could show the wrong stadium.

**Relation:** `getCurrentTenantId()` is what the Prisma extension uses.

### Step 4 Ã¢ÂÂ The isolation guard (`db` vs `platformDb`)

**Files:** `src/lib/prisma-base.ts` (one Prisma client + `pg` pool), `src/lib/platform-db.ts` (unscoped, awkward name on purpose), `src/lib/db.ts` (extended client).

**What `db` does:** for model `Pitch`, inject `tenantId` on reads and creates. Callers **must not** write `where: { tenantId }` themselves Ã¢ÂÂ that is the proof the guard works. Unique finds that return another tenantÃ¢ÂÂs row are rejected.

**Why two clients:** seed and Ã¢ÂÂfind tenant by slugÃ¢ÂÂ **cross** tenants. If they used `db`, they would be filtered to one tenant and lie. `platformDb` is the exception hatch (DR-001).

**Why not RLS yet:** extra Postgres role and wrapping every request. Trigger: first real paying tenant who isnÃ¢ÂÂt a friend.

**Relation:** `listPitches()` uses `db` and never mentions `tenantId`.

### Step 5 Ã¢ÂÂ Thin page + venue infrastructure

**Files:** `src/modules/venue/infrastructure/pitches.ts` (`listPitches`), `src/app/page.tsx` (then: names only).

**What:** First real **module** folder. Query lives in Venue infrastructure, not in the page. Page: resolve tenant, list names.

**Why even for a list:** if we put Prisma in `app/`, dropping Next for Express would smear the whole app. Self-test: *only `app/` should change if we left Next.*

### Step 6 Ã¢ÂÂ Seed two businesses

**File:** `src/prisma/seed.ts` (`npm run db:seed`). Uses an unscoped client like `platformDb`.

**What:** Wipe pitches/tenants, create `ahmad` (A1Ã¢ÂÂA3) and `sami` (S1Ã¢ÂÂS2). Later SPEC-02 filled `scheduleConfig` on those pitches.

**Acceptance you already ran:** two hosts (or `?tenant=`), different lists; unknown tenant 404; break the extension Ã¢ÂÂ empty list, not a leak.

**Jest for this slice:** only `test/lib/tenant-slug.test.ts`. Domain tests wait until there is domain logic.

---

## Chapter 3 Ã¢ÂÂ BRD in the repo

**File:** `docs/requirements/brd.md` (draft v0.1). Docs index and `docs/requirements/README.md` updated to point at it.

**What:** Full product vision: goals G-1Ã¢ÂÂ¦G-6, roles, phases, BR-1Ã¢ÂÂ¦BR-105, RULE-1Ã¢ÂÂ¦12, risks. DR-002 already cited these numbers before the file was in git.

**Relation:** SPEC-02 was written **from** BR-3/4/5/7/10/12 + DR-002 ÃÂ§2.4Ã¢ÂÂ2.5, not invented in chat.

---

## Chapter 4 Ã¢ÂÂ SPEC-02 written, then built one step at a time

**File:** `docs/specs/SPEC-02-venue-availability.md`

**What the spec pinned** (DR-002 had jsonb, not the keys): weekly `hours` (all seven days required; `[]` = closed), `slotDurationMinutes`, `gapMinutes`, `defaultPriceUsd` as **string** `"30.00"`, `priceRules` last-match-wins. No slots table. Engine takes `occupied[]` so **blocks and bookings plug in later** without Venue importing Booking. `pitch_blocks` and `tenant.settings` **deferred**. Timezone is an **argument** (`Asia/Beirut`), not a column yet.

**Workflow:** you approved each numbered step before the next.

### Step 1 Ã¢ÂÂ `scheduleConfig` on Pitch

**Files:** `schema.prisma` (`Json` Ã¢ÂÂ Postgres **jsonb**), migration `20260909030600_pitch_schedule_config`.

**What:** Required jsonb with a **closed-week default** so old rows stayed valid. Prisma v7: `@default` for Json is an escaped JSON string.

**Why default closed:** generate-slots then returns `[]` until seed overwrites Ã¢ÂÂ safer than `{}` which Zod would reject.

### Step 2 Ã¢ÂÂ Zod at the edge + money helper

**Files:** `zod`, `decimal.js`; `src/lib/money.ts`; `src/modules/venue/schemas/schedule-config.ts`; tests under `test/lib/money.test.ts` and `test/modules/venue/schemas/schedule-config.test.ts`.

**What:** `parseScheduleConfig(unknown)` throws on bad jsonb (`z.strictObject` Ã¢ÂÂ extra keys fail). Prices: strings only, two cents, `parseUsd` uses Decimal **not** `parseFloat`. Times: `HH:mm` via Zod `z.iso.time({ precision: -1 })`.

**Why:** Prisma types Json as `unknown`. Invalid owner data must not become a silent new feature. BR-40 / DR-002 ÃÂ§2.18.

**Relation:** seed and the use case both parse **before** trust. Domain receives `ScheduleConfig`, never raw Json.

### Step 3 Ã¢ÂÂ Pure engine

**File:** `src/modules/venue/domain/availability.ts` Ã¢ÂÂ `generateSlotsForDay`.

**What:** Civil date + timezone + config + occupied ranges Ã¢ÂÂ UTC `Date`s + Decimal prices + `available`. No `await`, no Prisma. Windows that end before they start **cross midnight** (BR-7). Full games only; leftover minutes discarded. Occupied overlap is half-open `[start, end)`.

**Why Intl for timezone:** `Date#getHours()` is the **serverÃ¢ÂÂs** local time, not Beirut. We convert wall clock Ã¢ÂÂ UTC with `Intl` offsets.

**Relation:** Booking (later) will pass approved ranges into `occupied`. Same function. No upward import.

**Spec slip we documented:** Ã¢ÂÂ16:00Ã¢ÂÂ22:00 Ã¢ÂÂ four slotsÃ¢ÂÂ is six hours Ã¢ÂÂ **six** 60-minute slots. Tests follow the **rule**, not the count typo.

### Step 4 Ã¢ÂÂ Jest for the engine

**File:** `test/modules/venue/domain/availability.test.ts`

**What:** closed day, 6 slots, 90-min leftover, 15-min gap, weekend price, after-20:00 price, midnight window (last slot ends **next local morning**), occupied vs adjacent.

**Why here not in the page:** the engine is the product risk for wrong schedules (R-5). Pages stay thin and untested.

### Step 5 Ã¢ÂÂ Application glues DB + parse + engine

**Files:** `listPitches` also selects `scheduleConfig`; `src/modules/venue/application/get-day-availability.ts`.

**What:** `await` load pitches Ã¢ÂÂ parse each config (fail the request if invalid) Ã¢ÂÂ `occupied: []` Ã¢ÂÂ DTO with `16:00` local strings and `"30.00"`.

**Relation:** page must not call `generateSlotsForDay` on raw Json. Infrastructure still has **no** `tenantId` in the query.

**Gotcha:** a long-running `next dev` kept an **old Prisma client** in `globalThis` (see `prisma-base.ts` singleton) and said `Unknown field scheduleConfig`. Restart `npm run dev` after `prisma generate`.

### Step 6 Ã¢ÂÂ Thin page + `?date=`

**File:** `src/app/page.tsx`

**What:** Next 16: `searchParams` is a **Promise** (`PageProps<'/'>`). `?date=` or **today in Asia/Beirut** (not UTC Ã¢ÂÂtodayÃ¢ÂÂ Ã¢ÂÂ midnight would show the wrong Lebanese day). Renders `18:00Ã¢ÂÂ19:00 ÃÂ· $30.00` or Ã¢ÂÂClosed / No slots.Ã¢ÂÂ

**Relation:** still no Prisma / no `tenantId` in the page. `?tenant=` still handled in **proxy**, not in this date parser.

### Step 7 Ã¢ÂÂ Seed real hours

**File:** `src/prisma/seed.ts` Ã¢ÂÂ `parseScheduleConfig` before write.

| Pitch | Rule (so you can demo) |
|---|---|
| A1 | MonÃ¢ÂÂThu 16:00Ã¢ÂÂ22:00 60 min $30; Fri/Sat to 23:00 **$40** |
| A2 | MonÃ¢ÂÂThu 16:00Ã¢ÂÂ22:00 **90 min $35** |
| A3 | **Monday only** 10:00Ã¢ÂÂ14:00 $20 |
| S1 | 18:00Ã¢ÂÂ22:00 $25 (not Sunday) |
| S2 | Saturday morning 09:00Ã¢ÂÂ12:00 $15 |

Useful URLs: `/?tenant=ahmad&date=2026-09-09` (Wed), `date=2026-09-12` (Sat $40), `date=2026-09-07` (Mon A3 open), `/?tenant=sami&date=2026-09-09`.

---

## Chapter 5 Ã¢ÂÂ Git: finish the branch

**What:** Committed SPEC-02 implementation (`e9352fb`). Fast-forward **merged** `feature/spec-01-tenancy-foundation` into **`main`**. Deleted the feature branch. Working tree was clean.

**Why not keep the old branch name:** SPEC-01 and SPEC-02 both lived on it; after merge, `main` *is* the product so far.

**Not done unless you did it:** `git push` (local was ahead of `origin/main` by several commits).

---

## Chapter 6 Ã¢ÂÂ Phone on the same WiÃ¢ÂÂFi

**File:** `next.config.ts` Ã¢ÂÂ `allowedDevOrigins: ["192.168.10.194"]`

**What:** Next 16 blocks `/_next/hmr` from LAN IPs unless the **hostname** (no `http://`) is listed. `allowedDevOrigins: true` is invalid and crashed the config (`all is not defined`).

**How to open:** `http://192.168.10.194:3000/?tenant=ahmad` Ã¢ÂÂ query `?tenant=`, not path `/tenant=ahmad`. If DHCP changes the PC IP, update the array and restart `npm run dev`.

**Relation:** this is **dev ergonomics**, not a product decision. Do not confuse with tenant subdomains in production.

---

## File map (what exists now)

```
src/
  proxy.ts                         # host / ?tenant= Ã¢ÂÂ x-tenant-slug
  app/page.tsx                     # thin: tenant + getDayAvailability
  app/layout.tsx                   # root HTML
  lib/
    tenant-slug.ts                 # pure parser
    tenant-context.ts              # header Ã¢ÂÂ Tenant row or 404
    prisma-base.ts                 # one Prisma + pool
    platform-db.ts                # unscoped
    db.ts                          # tenant extension (Pitch)
    money.ts                       # USD Decimal strings
  modules/venue/
    schemas/schedule-config.ts     # Zod
    domain/availability.ts          # pure slots
    application/get-day-availability.ts
    infrastructure/pitches.ts
  prisma/schema.prisma
  prisma/seed.ts
  prisma/migrations/Ã¢ÂÂ¦

test/  mirrors the pure pieces above
docs/  BRD, DRs, SPECs, guides, this log
.cursor/rules/  000 core, 050 this log, 100 RTL, 200 Prisma
```

**Not created yet (correct):** `modules/booking`, `people`, `payment`, `access`, `pitch_blocks`, auth, next-intl.

---

## How we defend a decision (cheat sheet)

| If they askÃ¢ÂÂ¦ | You sayÃ¢ÂÂ¦ |
|---|---|
| Why not a `slots` table? | Empty future rows forever; rule changes would desync. DR-002 ÃÂ§2.5. Engine is a function. |
| Why jsonb for hours? | Shape of rules will change; columns = a migration per tweak. Zod on every read/write. |
| Why no `booking_id` on payments? | Payment must stay closed when Academy/Shop arrive. Polymorphic `source_type + source_id`. |
| Why subdomain not `/ahmad`? | Feels like *his* site (A-12). One parser function either way. |
| Why not RLS now? | Extension is the guard; RLS is cost for a bug in that guard. |
| Why Decimal strings in JSON? | JSON numbers are floats in JS. BR-40. |
| Why proxy not Ã¢ÂÂset tenant in memoryÃ¢ÂÂ? | Separate runtime from the page. Header only. |

---

## WhatÃ¢ÂÂs next (do not invent)

1. Auth (email@domain + password) **before** owner UI.
2. Then owner approve (exclusion actually fires), payment, dashboard.

One SPEC step at a time. Append here when a step is done.

---

## Appendix Ã¢ÂÂ how to append (humans and agents)

Add a new `##` or `###` under a dated chapter. Include:

- **When** (date)
- **What** (one sentence)
- **Why** (link DR/SPEC/BR if it exists)
- **Files** (paths)
- **Relation** (what it talks to; what it must not import)
- **How to verify** (command or URL)

Do **not** delete old chapters to Ã¢ÂÂclean up.Ã¢ÂÂ If we reversed a decision, write a short **Correction** note.

Keep entries boring and specific. This file is your memory, not a brochure.

---

## Chapter 7 Ã¢ÂÂ 2026-09-09 Ã¢ÂÂ simple file logger

**When:** 2026-09-09

**What:** Server-side `logger.info` / `logger.error` that appends a timestamped line (plus optional error stack) to `logs/YYYY-MM-DD.log`.

**Why:** No shared place to record failures (invalid jsonb, seed crashes). Ops plumbing, not a DR. Node `fs` only Ã¢ÂÂ no Winston/Pino yet.

**Files:** `src/lib/logger.ts`; `logs/.gitkeep`; `.gitignore` ignores `logs/*` except `.gitkeep`. First callers: `get-day-availability.ts` (bad `schedule_config`), `src/prisma/seed.ts`.

**Relation:** Shared `lib/` like `money.ts`. **Must not** import from Client Components or `src/proxy.ts` (no Node filesystem). Domain stays pure Ã¢ÂÂ no logger in `availability.ts`. Do not log secrets.

**How to verify:** trigger `logger.info` (e.g. `npm run db:seed`) then open `logs/<UTC-date>.log`.

---

## Chapter 8 Ã¢ÂÂ 2026-09-09 Ã¢ÂÂ SPEC-03 written (not built)

**When:** 2026-09-09

**What:** Branch `feature/spec-03-booking-public-request`. Spec for **option A**: public name+phone request Ã¢ÂÂ PENDING booking + person + requester participant. Exclusion SQL ships now; approve UI does not.

**Why:** `docs/README.md` next slice is Booking; auth must exist before owner screens. BR-15/16, RULE-2. People module appears because Booking asks People find-or-create by phone (DR-002).

**Files:** `docs/specs/SPEC-03-booking-public-request.md`; index links in `docs/README.md`, root `README.md`.

**Relation:** Booking Ã¢ÂÂ Venue (offered slots + price) and People. Venue must not import Booking. `user_person_links` waits for User/auth.

**How to verify:** read the spec; no product code until you OK a numbered step.

---

## Chapter 9 Ã¢ÂÂ 2026-09-09 Ã¢ÂÂ SPEC-03 step 1: Person + Booking + BookingParticipant

**When:** 2026-09-09

**What:** Three tenant-owned tables for a public PENDING request. No modules, no UI, no exclusion yet.

**Why:** DR-002 ÃÂ§2.1Ã¢ÂÂ2.3 (person = name+phone, unique per tenant phone), ÃÂ§2.9Ã¢ÂÂ2.10 (booking has no person; requester is a participant), ÃÂ§2.18 (`Decimal(12,2)`). SPEC-03 step 1. `tenant_id` on all three including the child table (DR-001 / DR-002 ÃÂ§3).

**Prisma 7 docs (then the code):**
- `enum` blocks map to Postgres enums ([Models Ã¢ÂÂ Defining enums](https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/models)).
- Money: `Decimal` + `@db.Decimal(12, 2)` so we do not get the default `decimal(65,30)`.
- `tstzrange` has no Prisma scalar. [Unsupported field types](https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/unsupported-database-features): `Unsupported("tstzrange")` creates the column; the field is **not** in Prisma Client. A required Unsupported field also drops typed `create` / `upsert` on that model (schema reference). Step 7 will insert `during` with raw SQL. We did **not** add `startAt`/`endAt` Ã¢ÂÂ DR-002Ã¢ÂÂs column is `during`.
- `team` omitted this slice (SPEC: omit or nullable; unused).

**Files:** `src/prisma/schema.prisma`; migration `src/prisma/migrations/20260909080100_person_booking/migration.sql`.

**Relation:** Tenant and Pitch gain reverse lists. Booking FK Ã¢ÂÂ Pitch. BookingParticipant FKs Ã¢ÂÂ Tenant, Booking, Person. Venue module must not import Booking (still true Ã¢ÂÂ we added no app code). `db.ts` still only scopes `Pitch` (step 3).

**Gotcha:** `migrate dev` needs a shadow DB; this local URL is `template1` (Chapter 0). Same as SPEC-02: handwritten SQL from `migrate diff --from-config-datasource --to-schema`, then `migrate deploy`. `npx prisma migrate status` is clean.

**How to verify:** Prisma Studio Ã¢ÂÂ three empty tables; Person unique on `(tenantId, phone)`; Booking has `during` tstzrange and `priceUsd` DECIMAL(12,2); no `personId` on Booking.

```
npx prisma studio --config prisma7.config.ts
```

---

## Chapter 10 Ã¢ÂÂ 2026-09-09 Ã¢ÂÂ SPEC-03 step 2: APPROVED exclusion

**When:** 2026-09-09

**What:** GiST exclusion on `Booking`: same `"pitchId"` + overlapping `"during"` is refused **only** when `status = APPROVED`. PENDING may overlap (RULE-2 / BR-19).

**Why:** DR-002 ÃÂ§2.8 Ã¢ÂÂ the database is the double-booking guard, not app code. Prisma cannot express `EXCLUDE`; it is handwritten SQL (`.cursor/rules/200-database-prisma.mdc`). Ships now so we do not Ã¢ÂÂforgetÃ¢ÂÂ why we picked Postgres, even though this slice only inserts PENDING.

**Files:** `src/prisma/migrations/20260909080800_booking_approved_exclusion/migration.sql`. Schema DSL unchanged.

**Relation:** Constraint lives on `Booking` only. No app code. Step 7 still writes PENDING, so this will not fire until an approve slice.

**Gotcha:** `btree_gist` is required because GiST has no built-in `=` for `TEXT` (`pitchId` is a cuid string). Range overlap (`&&`) is native. Same `template1` path: `migrate deploy`, not `migrate dev`. `npx prisma migrate status` is clean.

**How to verify:** Studio will not show the constraint as a Prisma field. In Studio SQL, or any client:

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'Booking_approved_during_excl';
```

You should see `EXCLUDE USING gist ("pitchId" WITH =, "during" WITH &&) WHERE ("status" = 'APPROVED')`. You cannot collide two APPROVED rows until later; do not invent a proof approve.

---

## Chapter 11 Ã¢ÂÂ 2026-09-09 Ã¢ÂÂ SPEC-03 step 3: tenant extension

**When:** 2026-09-09

**What:** `Person`, `Booking`, and `BookingParticipant` are now in `TENANT_SCOPED_MODELS`. App queries must not pass `tenantId`.

**Why:** DR-001 ÃÂ§3 Ã¢ÂÂ the Prisma extension is the isolation guard. SPEC-03 step 3. Child tables are scoped too, not Ã¢ÂÂbecause they hang off Booking.Ã¢ÂÂ Prisma 7 query extensions: `$extends` + `query.$allModels.$allOperations` ([v7 query component](https://www.prisma.io/docs/orm/v7/prisma-client/client-extensions/query)).

**Files:** `src/lib/db.ts` only.

**Relation:** Same client `listPitches` already uses. Seed / tenant lookup still use `platformDb` (unscoped). No people/booking modules yet (step 4).

**Gotcha:** required `Unsupported("tstzrange")` means Prisma Client has no `booking.create`. Prisma 7 then types `$allOperations` as the **intersection** of operations, so `create` disappeared from the type even though Person still creates. We compare `operation` as a string so Person/participant inserts still get `tenantId`. Step 7Ã¢ÂÂs raw SQL for `during` will **not** be stamped by this extension Ã¢ÂÂ that write must include `tenantId` in the SQL.

**How to verify:** read `TENANT_SCOPED_MODELS` in `src/lib/db.ts`. No Studio change. There is still no app query against Person/Booking; proof comes when step 4/7 repositories omit `tenantId` from `where`.

---

## Chapter 12 Ã¢ÂÂ 2026-09-09 Ã¢ÂÂ SPEC-03 step 4: People find-or-create

**When:** 2026-09-09

**What:** First `people/` module. Normalize phone to digits; find-or-create by phone inside the caller's `tx`; never overwrite an existing name.

**Why:** DR-002 ÃÂ§2.2 / RULE-8 Ã¢ÂÂ phone unique per stadium. SPEC-03: Booking asks People, does not own Ã¢ÂÂcreate person.Ã¢ÂÂ DR-001: the starting use case opens `$transaction` and passes `tx`; repositories never import `db`. Prisma 7 interactive transactions: `tx` is `Prisma.TransactionClient` ([Client `$transaction`](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions)).

**Files:**
- `src/modules/people/domain/phone.ts` Ã¢ÂÂ `normalizePhone` (pure)
- `src/modules/people/infrastructure/persons.ts` Ã¢ÂÂ `findPersonByPhone`, `createPerson` (no `tenantId` in `where`/`data`)
- `src/modules/people/application/find-or-create-person.ts`
- `test/modules/people/domain/phone.test.ts`

No `ui/` or empty folders.

**Relation:** Booking (step 7) will call `findOrCreatePerson(tx, Ã¢ÂÂ¦)` inside its transaction. People must not import Booking. Venue unchanged.

**How to verify:** `npm test` Ã¢ÂÂ new suite plus SPEC-01/02. Same digits after stripping spaces/`-`/`+` Ã¢ÂÂ same string. Isolation (two tenants, two people) waits until a request can write rows (step 7/8).

---

## Chapter 13 Ã¢ÂÂ 2026-09-09 Ã¢ÂÂ SPEC-03 step 5: Booking domain

**When:** 2026-09-09

**What:** Pure `resolveOfferedSlot`: the UTC window must be one of VenueÃ¢ÂÂs generated slots for that civil date, and `end` must be after injected `now`. Price is copied from that slot. `overlaps` is half-open, for tests.

**Why:** SPEC-03 step 5. Booking **asks** Venue (`generateSlotsForDay`); it does not invent times or trust a posted price (DR-002 ÃÂ§2.18). `occupied` stays `[]` Ã¢ÂÂ PENDING must not hide the slot (RULE-2). `now` is an argument so Jest can freeze time.

**Files:** `src/modules/booking/domain/offered-slot.ts`; `test/modules/booking/domain/offered-slot.test.ts`. No application/infra/UI yet.

**Relation:** Booking domain imports Venue domain. Venue must not import Booking.

**How to verify:** `npx jest test/modules/booking/domain/offered-slot.test.ts` Ã¢ÂÂ closed day and unknown window fail; a real 16:00 Wednesday slot passes with `$30.00`; `now === slot.end` fails.

### In plain language (what this step is for)

This is a **gatekeeper**. It answers one question **before** we ever touch the database:

> Ã¢ÂÂIs this the kind of game AhmadÃ¢ÂÂs stadium actually sells, and has that game already finished?Ã¢ÂÂ

Nothing is saved yet. No person row, no booking row. Just yes/no, plus the **real** price.

**The situation:** a visitor will later click a slot on the public page, e.g. Wednesday 16:00Ã¢ÂÂ17:00. The form sends two times (start and end). We cannot trust that blindly. Someone can change the form and send 03:00Ã¢ÂÂ04:00, or a price of $1. The page is not the source of truth. The opening-hours **rule** is Ã¢ÂÂ the same function that draws the list: `generateSlotsForDay`.

**What `resolveOfferedSlot` does:**

1. Ask Venue: for this pitch, this calendar day, in Beirut, which games exist?
2. Is the requested start/end **exactly** one of those games? If not Ã¢ÂÂ reject. Closed day, wrong time, 90 minutes when games are 60 Ã¢ÂÂ all fail the same way (`Slot is not offered`).
3. Has that game **already ended**? If `end` is before or equal to `now` Ã¢ÂÂ reject (`Slot has already ended`). We pass `now` in so tests can pretend it is 5pm without waiting.
4. If both pass: return that slot **and its price from the engine**. We copy `$30.00` from Venue. We never take a price from the browser (DR-002 ÃÂ§2.18).

**What we skip on purpose:** we do **not** ask Ã¢ÂÂis this already booked?Ã¢ÂÂ Two PENDING requests for the same hour are allowed (RULE-2). Occupied time comes later, when something is APPROVED. So this function always asks Venue with an empty occupied list.

**`overlaps`:** a small helper Ã¢ÂÂ do two time ranges crash into each other? 16:00Ã¢ÂÂ17:00 and 17:00Ã¢ÂÂ18:00 do **not** (the first ends when the second starts). 16:00Ã¢ÂÂ17:00 and 16:30Ã¢ÂÂ17:30 **do**. Same half-open rule as Venue. The public request does not use it yet; it is here for tests and later approve.

**Why a Booking file, not inside Venue:** VenueÃ¢ÂÂs job is to **list** possible games. BookingÃ¢ÂÂs job is to **allow or refuse a request**. If we mixed them, Ã¢ÂÂwhat hours do we sell?Ã¢ÂÂ and Ã¢ÂÂmay this visitor request this hour?Ã¢ÂÂ would live in one place and get messy when approve and payments arrive.

**One sentence:** you may only request a real, still-open game, at the stadiumÃ¢ÂÂs price Ã¢ÂÂ as a pure function, so we can test it without the database or the webpage.

---

## Chapter 14 Ã¢ÂÂ 2026-09-09 Ã¢ÂÂ SPEC-03 step 6: Zod for the public form

**When:** 2026-09-09

**What:** `parsePublicSlotRequest` Ã¢ÂÂ name, phone (8Ã¢ÂÂ15 digits after normalize), pitchId, start/end as UTC ISO strings. Extra keys fail.

**Why:** SPEC-03 step 6. The form is untrusted. Zod checks *shape* before the use case. Step 5 still decides Ã¢ÂÂis this a real unfinished game?Ã¢ÂÂ Phone length lives here, not in `normalizePhone`. Zod 4: `z.strictObject`, `z.iso.datetime()` ([Zod API](https://zod.dev/api) Ã¢ÂÂ UTC with `Z`, no `+02:00` unless we opt in; we did not).

**Files:** `src/modules/booking/schemas/public-slot-request.ts`; `test/modules/booking/schemas/public-slot-request.test.ts`.

**Relation:** Schema uses People `normalizePhone`. Does not import domain `resolveOfferedSlot` (different question). Use case (step 7) will parse first, then domain.

**How to verify:** `npx jest test/modules/booking/schemas/public-slot-request.test.ts` Ã¢ÂÂ missing name, `"12"` / `"abc"` phone, extra `priceUsd` all throw; `"03 123 456"` becomes `"03123456"`.

### In plain language

Two gates, different jobs:

| Gate | Question | Example fail |
|---|---|---|
| **Zod (this step)** | Did they fill the form like we expect? | No name, phone `12`, extra `priceUsd` |
| **Domain (step 5)** | Is that window a real game that has not ended? | Tuesday closed, 03:00, already finished |

Zod never opens the database. A valid form can still be a fake slot Ã¢ÂÂ step 7 will run both.

---

## Chapter 15 Ã¢ÂÂ 2026-09-09 Ã¢ÂÂ SPEC-03 step 7: `requestPublicSlot`

**When:** 2026-09-09

**What:** One use case opens `db.$transaction` and writes Person (find-or-create) + PENDING/PUBLIC Booking + requester participant. Price from Venue. No notifications.

**Why:** SPEC-03 step 7 / DR-001 (the starting use case owns the transaction and passes `tx`). DR-002 ÃÂ§2.10 requester is a participant. Prisma 7: `$transaction` callback + tagged `$executeRaw` for `during` ([raw SQL](https://www.prisma.io/docs/orm/v7/prisma-client/using-raw-sql); Client has no `booking.create`).

**Files:**
- `src/modules/booking/application/request-public-slot.ts`
- `src/modules/booking/infrastructure/bookings.ts`
- `src/modules/venue/infrastructure/pitches.ts` (`findPitchById(tx, id)`)
- `src/modules/venue/domain/availability.ts` (`civilDateInTimeZone`)
- `src/lib/db.ts` (`TenantTx` = the extended interactive `tx`)

**Relation:** Booking asks Venue (pitch + schedule + civil date) and People (`findOrCreatePerson`). Venue must not import Booking. Page still has no form (step 8).

**How to verify:** `npm test` (33 passed). No page yet Ã¢ÂÂ proof write waits for step 8 + Studio. Two overlapping PENDINGs are allowed (exclusion ignores them).

### In plain language

This is the **do-it** function. Zod already checked the form. Domain already knows the rule. Now we save:

1. Load this stadiumÃ¢ÂÂs pitch (wrong id / SamiÃ¢ÂÂs pitch on AhmadÃ¢ÂÂs site Ã¢ÂÂ not found).
2. Parse opening hours. Ask: is this start/end a real game that has not ended? Copy the **engine** price.
3. Find or create the person by phone (keep the old name if they exist).
4. Insert a booking: PENDING, PUBLIC, time range in Postgres `during`.
5. Insert one participant flagged Ã¢ÂÂthis is who asked,Ã¢ÂÂ owed the full game price.

All of that is **one transaction**: if the participant insert fails, the booking and person-create roll back together.

We log the booking id on success, not the phone (PII). Nothing is sent to WhatsApp.

The page still cannot call this until step 8 (a small form + Server Action).

---

## Chapter 16 Ã¢ÂÂ 2026-09-09 Ã¢ÂÂ SPEC-03 step 8: thin public form

**When:** 2026-09-09

**What:** Each slot on the existing page has a name + phone form. Submit runs a Server Action: Zod Ã¢ÂÂ `requestPublicSlot` Ã¢ÂÂ redirect with `?received=1`. Slot stays listed. Plain Ã¢ÂÂRequest receivedÃ¢ÂÂ. No styling system.

**Why:** SPEC-03 step 8. `app/` stays thin (no Prisma, no `tenantId`). Next 16 local docs: [`forms.md`](../../node_modules/next/dist/docs/01-app/02-guides/forms.md) Ã¢ÂÂ `<form action={serverFn}>` still receives `FormData`. [`redirect`](../../node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md) after success, **outside** try/catch. `searchParams` stays a Promise.

**Files:** `src/app/request-slot.ts`; `src/app/page.tsx`. Hidden `tenant` is the **slug** (already on the page), not `tenantId` Ã¢ÂÂ so local `?tenant=` survives the redirect.

**Relation:** Page calls the Action only. Action calls Zod + use case. Isolation still comes from the proxy header, not from the hidden slug.

**How to verify:**
1. `http://localhost:3000/?tenant=ahmad&date=2026-09-09` Ã¢ÂÂ Pitch A1 16:00 form. Submit Ali / `03 123 456`.
2. URL keeps `date=` and shows **Request received**. Slots still there.
3. Prisma Studio: Person + Booking (PENDING, PUBLIC) + BookingParticipant (`isRequester`).
4. Same slot, different phone Ã¢ÂÂ second PENDING. Same phone again Ã¢ÂÂ same Person, new Booking.
5. `?tenant=sami` Ã¢ÂÂ SamiÃ¢ÂÂs pitches only; AhmadÃ¢ÂÂs people/bookings stay AhmadÃ¢ÂÂs.
6. `npm test` (33).

Could not click-submit from this session (no browser automation). Page HTML was fetched: Ahmad/Sami forms render; `?received=1` shows the message.

### In plain language

The page is still just a **thin waiter**. It does not decide prices or create rows. It collects name + phone, plus hidden pitch/start/end, and hands that to the Action. The Action is the bouncer (Zod) then the kitchen (`requestPublicSlot`). After a successful save we send you back to the same dayÃ¢ÂÂs list with a sticky note: Ã¢ÂÂRequest received.Ã¢ÂÂ We do not hide the slot Ã¢ÂÂ PENDING is not occupancy.

---

## Chapter 17 Ã¢ÂÂ 2026-09-09 Ã¢ÂÂ Gotcha: expired interactive transaction on public request

**When:** 2026-09-09

**What:** Submitting the public form failed with Prisma Ã¢ÂÂquery cannot be executed on an expired transactionÃ¢ÂÂ (timeout 5000 ms, ~5029 ms elapsed) on `pitch.findUnique` Ã¢ÂÂ the **first** query inside `$transaction`, not a slow insert.

**Why:** `platformDb` is an alias of the same Prisma client/pool as `db` (`src/lib/prisma-base.ts`). Interactive `$transaction` holds one connection (`BEGIN`). The tenant query extension then calls `getCurrentTenantId()` Ã¢ÂÂ `platformDb.tenant.findUnique` on that **same** client. The Server Action is a new request, so React `cache()` is cold. Tenant lookup waits for the connection the transaction is holding; the transaction waits for the tenant lookup. After 5s Prisma kills the transaction. Prisma 7 interactive options: `timeout` / `maxWait` ([transactions](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions)); we did **not** raise the timeout Ã¢ÂÂ that would only make the form hang longer.

**Files:** `src/modules/booking/application/request-public-slot.ts` (await `getCurrentTenantId()` before `$transaction`); `src/lib/db.ts` (comment on the extension).

**Relation:** Same rule as SPEC-01: one tenant lookup per request via `cache()`. The use case must fill that cache **before** `BEGIN`. Repositories still do not pass `tenantId`.

**How to verify:** Submit name + phone on `/?tenant=ahmad&date=2026-09-09` again. Should redirect with **Request received** in well under 5s. Prisma Studio: new PENDING row.

### In plain language

Postgres will not let two things use the same Ã¢ÂÂphone lineÃ¢ÂÂ at once. The booking save picks up the line and says Ã¢ÂÂwait, IÃ¢ÂÂm in a transaction.Ã¢ÂÂ The security guard then tries to look up which stadium this is Ã¢ÂÂ on that **same** line Ã¢ÂÂ and both wait until the timer rings. We look up the stadium **first** (short call, then remembered for this click), and only then start the transaction. The guardÃ¢ÂÂs later checks are free memory hits, not a second database call.

---

## Chapter 18 Ã¢ÂÂ 2026-09-09 Ã¢ÂÂ Correction: `platformDb` must be a second pool

**When:** 2026-09-09

**What:** Chapter 17Ã¢ÂÂs warm-`cache()` fix did **not** work. Submit still 500Ã¢ÂÂd at ~5.1s on `tx.pitch.findUnique` (`run(args)` in `db.ts`). Warming tenant before `BEGIN` does not help: React `cache()` does not apply inside PrismaÃ¢ÂÂs `$allOperations` callback, so the guard still queried `platformDb` **during** the transaction.

**Why:** `platformDb` was `export const platformDb = prismaBase` Ã¢ÂÂ one client, one pool. Prisma will not run a second query on that client while an interactive transaction is open. DR-001 already named a **separate** `platformDb`; the implementation had aliased it. Prisma 7: one `PrismaClient` per adapter/pool ([constructor](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/instantiate-prisma-client)).

**Files:** `src/lib/platform-db.ts` (own `pg.Pool` + `PrismaClient`); `src/lib/prisma-base.ts` (comment); `src/lib/db.ts` (comment); `src/modules/booking/application/request-public-slot.ts` (removed the useless pre-warm).

**Relation:** `db` = tenant-scoped, transactional. `platformDb` = unscoped Tenant lookup on a **different** connection. Repositories still do not pass `tenantId`.

**How to verify:** Submit the public form again. Should finish well under 5s with **Request received**. Dev log: `POST` not 500.

### In plain language

Remembering the stadium in ReactÃ¢ÂÂs notebook does not help the Prisma guard Ã¢ÂÂ that guard runs in a back room and never reads the notebook. Two clerks also cannot share one phone line: while the booking clerk says Ã¢ÂÂIÃ¢ÂÂm in a meeting,Ã¢ÂÂ the stadium-lookup clerk must use a **second** line. `platformDb` is that second line.

---

## Chapter 19 Ã¢ÂÂ 2026-09-09 Ã¢ÂÂ Correction: one pool, two Prisma clients

**When:** 2026-09-09

**What:** After Chapter 18, the homepage 500Ã¢ÂÂd: `Connection terminated unexpectedly` on `listPitches`. Not a Venue bug Ã¢ÂÂ Postgres (local proxy, `connection_limit=10` on `DATABASE_URL`) dropped sockets.

**Why:** Chapter 18 gave `platformDb` its **own** `pg.Pool` (default max 10). Two pools tried to open ~20 connections against a cap of 10. HMR also left old pools alive. Prisma 7 still wants two **PrismaClient** instances so tenant lookup is not serialized onto `db.$transaction` Ã¢ÂÂ they must **share one Pool**.

**Files:** `src/lib/prisma-base.ts` (one `pg.Pool` `max: 10`, two clients); `src/lib/platform-db.ts` (re-export); `src/lib/db.ts` (comment).

**Relation:** Same as Chapter 18Ã¢ÂÂs intent. `platformDb` is a second clerk, not a second phone company.

**How to verify:** Restart `npm run dev` (old leaked pools die with the process). `/?tenant=ahmad` renders pitches. Submit name+phone Ã¢ÂÂ **Request received** under 5s.

### In plain language

We gave the stadium-lookup clerk a second phone **company**, and the switchboard only has ten lines Ã¢ÂÂ it hung up on everyone, including the page that only lists pitches. Both clerks now share one switchboard (ten lines). They are still two different clerks, so the booking meeting does not block the stadium lookup.

---

## Chapter 20 Ã¢ÂÂ 2026-09-09 Ã¢ÂÂ Correction: one client; tenant in ALS before BEGIN

**When:** 2026-09-09

**What:** GET pitches worked (200). POST still 500 in ~52ms: `Connection terminated unexpectedly` inside `submitPublicSlotRequest` / `$transaction`. Not the 5s deadlock.

**Why:** Two `PrismaClient`s on one `pg.Pool` is unsafe with Prisma 7 `adapter-pg`. The adapter treats the pool as exclusive. Interactive `$transaction` on client A plus Tenant lookup on client B (same sockets) kills the connection. React `cache()` still does not apply inside `$allOperations`.

**Fix (matches DR-001):** one client, one pool. App code loads the tenant **before** `BEGIN` and stores it on the request (`AsyncLocalStorage` Ã¢ÂÂ this is the request-scoped context DR-001 already described; middleware still only sets the header). The Prisma guard reads that store. No nested Prisma query during the transaction. Prisma 7 interactive `$transaction` ([transactions](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions)).

**Files:** `src/lib/prisma-base.ts` (single client; ends the Chapter 19 dual pool on HMR); `src/lib/platform-db.ts` (alias again); `src/lib/tenant-context.ts` (`withCurrentTenant`); `src/lib/db.ts` (`$transaction` wrapped).

**Relation:** Repositories still do not pass `tenantId`. `platformDb` stays the unscoped *name* for Tenant lookup, not a second engine.

**How to verify:** Reload `/?tenant=ahmad`. Submit name+phone. **Request received** in well under 5s. If HMR still looks sick, restart `npm run dev` once.

### In plain language

Two clerks sharing one switchboard still grabbed the same handset and yanked the cord out. So we went back to **one** database client. Before the booking meeting starts, we write the stadiumÃ¢ÂÂs name on a sticky note on the desk. During the meeting the guard only reads the sticky note Ã¢ÂÂ they do not call the database again. That is allowed: DR-001 said application code (not middleware) sets request-scoped tenant context.

---

## Chapter 21 Ã¢ÂÂ 2026-09-09 Ã¢ÂÂ Guide: Prisma transaction + tenant guard

**When:** 2026-09-09

**What:** Standalone write-up of Chapters 17Ã¢ÂÂ20 so we can return to it without rereading the chat.

**Why:** Same gotcha will hit owner approve (next `$transaction` after auth) if we forget.

**Files:** [docs/guides/prisma-transaction-tenant-guard.md](./guides/prisma-transaction-tenant-guard.md); linked from [docs/README.md](./README.md).

**How to verify:** Open that file. ÃÂ§5 is the rule; ÃÂ§4 is what not to retry.

---

## Chapter 22 Ã¢ÂÂ 2026-09-10 Ã¢ÂÂ DR-003 written (auth)

**When:** 2026-09-10

**What:** Settled Access decisions before SPEC-04. No auth code yet.

**Why:** [DR-003](./decisions/DR-003-auth-sessions.md). URL still chooses tenant; login is `local@tenant-slug` + hashed password (BR-99 vs the old Ã¢ÂÂemail@domainÃ¢ÂÂ note). Users have no `tenant_id`; memberships do.

**Files:** `docs/decisions/DR-003-auth-sessions.md`; `docs/README.md`.

**How to verify:** Read DR-003. Confirm or correct by section. Then SPEC-04, then code.

---

## Chapter 23 Ã¢ÂÂ 2026-09-10 Ã¢ÂÂ SPEC-04 written (not started in code)

**When:** 2026-09-10

**What:** Numbered Access slice: schema Ã¢ÂÂ guard Ã¢ÂÂ `can`/identifier Ã¢ÂÂ Zod Ã¢ÂÂ login/logout Ã¢ÂÂ `/login` + `/owner` Ã¢ÂÂ seed `owner@ahmad` / `owner@sami`. No approve UI.

**Why:** [SPEC-04](./specs/SPEC-04-access-login.md) implements [DR-003](./decisions/DR-003-auth-sessions.md).

**Files:** `docs/specs/SPEC-04-access-login.md`; `docs/README.md`.

**How to verify:** Read the spec. OK step 1 before any Prisma models.

---

## Chapter 24 Ã¢ÂÂ 2026-09-10 Ã¢ÂÂ SPEC-04 step 1: Access schema

**When:** 2026-09-10

**What:** `User` (identifier + passwordHash, no `tenantId`), `Membership` (`tenantId` + role + permissions jsonb), `Session` (no `tenantId`), `UserPersonLink` (empty; `tenantId` required). Enums `OWNER|STAFF`, `SELF|GUARDIAN`.

**Why:** SPEC-04 step 1 / DR-003 ÃÂ§3. Login accounts are not stadium rows; the **membership** is. Link table exists so we never retrofit PersonÃ¢ÂÂUser (DR-002 ÃÂ§2.1). Prisma 7 schema + handwritten SQL + `migrate deploy` (local DB is `template1`; no `migrate dev` shadow).

**Files:** `src/prisma/schema.prisma`; `src/prisma/migrations/20260910032700_access_user_membership/migration.sql`.

**Relation:** No Access module yet. Guard not updated (step 2). Seed does not create owners yet (step 7).

**How to verify:** Prisma Studio: four new tables, `UserPersonLink` empty. `npx prisma migrate status --config prisma7.config.ts` Ã¢ÂÂ up to date.

### In plain language

A **User** is a login (who knows the password). A **Membership** is Ã¢ÂÂthis login may work at AhmadÃ¢ÂÂs stadium as OWNER.Ã¢ÂÂ The cookie will remember the login, not the stadium Ã¢ÂÂ the URL still picks the stadium. The person-link table is a spare drawer; we do not put anything in it yet.

---

## Chapter 25 Ã¢ÂÂ 2026-09-10 Ã¢ÂÂ SPEC-04 step 2: guard vs platformDb

**When:** 2026-09-10

**What:** `Membership` and `UserPersonLink` added to `TENANT_SCOPED_MODELS`. User and Session stay off that list (no `tenantId`). Still one Prisma client / one pool. No Access folders yet (step 3).

**Why:** SPEC-04 step 2 / DR-003 ÃÂ§3. A membership list must be Ahmad-only without the caller writing `tenantId`. Looking up `owner@ahmad` must not be filtered to a tenant (User has no `tenantId`). Nested `platformDb` inside `db.$transaction` is still forbidden ([guide](./guides/prisma-transaction-tenant-guard.md)).

**Files:** `src/lib/db.ts`; `src/lib/platform-db.ts`; `src/lib/prisma-base.ts` (comments).

**Relation:** Login (step 5) will `platformDb.user.findUnique({ where: { identifier } })` then `db.membership.findFirst` (guard injects tenant).

**How to verify:** Read the Set in `db.ts`. Studio still empty. Public page still works.

### In plain language

The security guard now also watches **memberships** (and the empty person-link drawer). Logins and cookies are not stamped with a stadium Ã¢ÂÂ the guard would have nothing to stamp. We still have one database client. Access code is not written yet.

---

## Chapter 26 Ã¢ÂÂ 2026-09-10 Ã¢ÂÂ SPEC-04 step 3: Access domain

**When:** 2026-09-10

**What:** Pure rules: login id is `local@slug` after trim/lower-case; `can(membership, "bookings.approve")` is always yes for OWNER, and for STAFF only if the jsonb flag is strictly `true`. No Prisma, no password hash (that needs `node:crypto` later).

**Why:** SPEC-04 step 3 / DR-003 ÃÂ§2 and ÃÂ§5. Domain takes `MembershipLike`, not a Prisma type.

**Files:** `src/modules/access/domain/identifier.ts`, `can.ts`; `test/modules/access/domain/`.

**Relation:** Access must not import Booking. Booking will later ask `can`, not the other way around.

**How to verify:** `npm test` Ã¢ÂÂ 9 suites, 39 passed.

### In plain language

Two small rules with no database. First: the username looks like `owner@ahmad`, not an email we send mail to. Second: the owner of a stadium can approve; a staff member cannot unless we later flip a switch on their membership. The login page is still not built.

---

## Chapter 27 Ã¢ÂÂ 2026-09-10 Ã¢ÂÂ SPEC-04 step 4: Zod login body

**When:** 2026-09-10

**What:** `parseLogin` Ã¢ÂÂ `identifier` + `password`, `strictObject`, identifier run through domain normalize + shape. Password not hashed here.

**Why:** SPEC-04 step 4. Same two-gate idea as public booking: Zod = form shape; login use case (step 5) = user exists + membership on this URL.

**Files:** `src/modules/access/schemas/login.ts`; `test/modules/access/schemas/login.test.ts`.

**How to verify:** `npm test` Ã¢ÂÂ 10 suites, 42 passed.

### In plain language

The bouncer for the login form: you must send exactly a username and a password, nothing extra. `Owner@Ahmad` becomes `owner@ahmad`. We do not talk to the database yet.

---

## Chapter 28 Ã¢ÂÂ 2026-09-10 Ã¢ÂÂ SPEC-04 step 5: login / logout / membership

**When:** 2026-09-10

**What:** `login` (URL tenant Ã¢ÂÂ user on `platformDb` Ã¢ÂÂ hash verify Ã¢ÂÂ membership on `db` Ã¢ÂÂ session + HTTP-only cookie), `logout`, `getCurrentMembership`. Same `"Invalid login"` for unknown user, bad password, or no membership *here*. Cookie: no `domain` (host-only), `httpOnly`, 7 days. Next 16: `await cookies()`; `.set`/`.delete` only from a Server Action ([cookies.md](../../node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md)). Password hash is `scrypt` via `node:crypto`. No `$transaction` wrapping User+membership (tenant-guard guide).

**Files:** `src/modules/access/application/{login,logout,get-current-membership}.ts`; `infrastructure/{password,users,sessions,memberships,session-cookie}.ts`.

**Relation:** Access does not import Booking. Pages not built (step 6). No seeded owners yet (step 7) Ã¢ÂÂ click-test waits.

**How to verify:** `npm test` (42). Click-proof after steps 6Ã¢ÂÂ7.

### In plain language

The kitchen for login: first we know which stadium this URL is. Then we look up the username (not filtered by stadium). We check the password. Then we ask: does this person have a pass for **this** stadium? If not, we say Ã¢ÂÂInvalid loginÃ¢ÂÂ Ã¢ÂÂ we do not say Ã¢ÂÂwrong stadium.Ã¢ÂÂ The cookie remembers the login, not Ahmad vs Sami. You cannot try this in the browser until we add the form and seed a password.

---

## Chapter 29 Ã¢ÂÂ 2026-09-10 Ã¢ÂÂ SPEC-04 step 6: thin login / owner pages

**When:** 2026-09-10

**What:** `/login` form (identifier + password) and `/owner` (name, identifier, role, logout). Hidden `tenant` slug for local `?tenant=`. No Prisma / no `tenantId` on pages. Invalid login Ã¢ÂÂ same page with Ã¢ÂÂInvalid loginÃ¢ÂÂ. Unauthenticated `/owner` Ã¢ÂÂ `/login`. Public `/` unchanged.

**Why:** SPEC-04 step 6. Next 16: `searchParams` Promise; `<form action>`; `redirect` outside try/catch ([redirect.md](../../node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md)). Cookie `.set` only from the Server Action.

**Files:** `src/app/login/page.tsx`, `src/app/login/actions.ts`, `src/app/owner/page.tsx`.

**Relation:** Pages call Access only. Seed (step 7) still required to click-test.

**How to verify:** `http://localhost:3000/login?tenant=ahmad` renders the form. `/owner?tenant=ahmad` redirects to login. Real sign-in after seed.

### In plain language

The waiter for login: a small form and a locked Ã¢ÂÂyou are inÃ¢ÂÂ page. They do not talk to Prisma. Until we plant a password in the database (next step), every login will fail on purpose.

---

## Chapter 30 Ã¢ÂÂ 2026-09-10 Ã¢ÂÂ SPEC-04 step 7: seed owners + staff

**When:** 2026-09-10

**What:** Seed now plants hashed logins on the unscoped client: `owner@ahmad` OWNER on Ahmad, `owner@sami` OWNER on Sami, `staff@ahmad` STAFF with `permissions: {}`. Password is `LOCAL_DEV_PASSWORD` (`dev-owner`) in `seed.ts` only Ã¢ÂÂ not imported from `app/`. Delete order now covers Session / Membership / UserPersonLink / User before Tenant. `npm run db:seed` ran successfully.

**Why:** SPEC-04 step 7 / DR-003 ÃÂ§2Ã¢ÂÂ3. Owners must exist so login can be click-tested. Staff is optional in the spec; seeded so `can(..., "bookings.approve")` stays false until a later flag.

**Files:** `src/prisma/seed.ts`; `src/app/login/actions.ts` (log unexpected login errors only Ã¢ÂÂ `"Invalid login"` stays silent); `docs/README.md`.

**Relation:** Seed uses its own PrismaClient (not `@/lib/db`). Access still does not import Booking. Public `/` is unchanged.

**Gotcha:** After adding User/Session models, a long-running `npm run dev` can keep an old `prismaBase` on `globalThis` (`src/lib/prisma-base.ts`). Then `platformDb.user` is undefined and login looks like Ã¢ÂÂInvalid loginÃ¢ÂÂ. Restart the Next process after `prisma generate` / new models. Seed in a separate process was fine; the app process was stale.

**How to verify:** `http://localhost:3000/login?tenant=ahmad` Ã¢ÂÂ `owner@ahmad` / `dev-owner` Ã¢ÂÂ `/owner` shows Ahmad Stadium. Same cookie on `?tenant=sami` Ã¢ÂÂ `/login`. `owner@ahmad` on Sami Ã¢ÂÂ Invalid login. Logout Ã¢ÂÂ `/owner` redirects to login. Public form still loads without a cookie. `npm test` Ã¢ÂÂ 10 suites, 42 passed.

### In plain language

We planted three keys in the test lockbox. AhmadÃ¢ÂÂs owner key opens AhmadÃ¢ÂÂs door. It does not open SamiÃ¢ÂÂs. A staff key exists for Ahmad but cannot approve bookings yet (there is still no approve button). The password is only for local development Ã¢ÂÂ it is not a mailbox and must not live in the browser.

---

## Chapter 31 Ã¢ÂÂ 2026-09-10 Ã¢ÂÂ SPEC-05 written (not started in code)

**When:** 2026-09-10

**What:** Numbered owner-approve slice: `slot_interests` Ã¢ÂÂ guard Ã¢ÂÂ domain (overlap + occupied on `resolveOfferedSlot`) Ã¢ÂÂ Zod Ã¢ÂÂ infra Ã¢ÂÂ `approveBooking` / `rejectBooking` (auth **before** `$transaction`) Ã¢ÂÂ public occupied Ã¢ÂÂ `/owner` pending inbox. No payment, no owner-created bookings, no waitlist UI.

**Why:** [SPEC-05](./specs/SPEC-05-owner-approve.md) implements [DR-002](./decisions/DR-002-core-data-model.md) ÃÂ§2.8 / ÃÂ§2.13 and BR-17Ã¢ÂÂ21 / BR-23Ã¢ÂÂ25. Pins: auto-reject = overlapping PENDING on the same pitch; interest `during` = the **approved** window; manual reject writes no interest; same `bookings.approve` flag for reject; Venue still does not import Booking.

**Files:** `docs/specs/SPEC-05-owner-approve.md`; `docs/README.md`.

**How to verify:** Read the spec. Confirm or correct the pins. Then OK step 1.

### In plain language

The next chapter of the product: the owner looks at a list of Ã¢ÂÂplease can I have this hour?Ã¢ÂÂ and taps yes or no. Yes makes it a real game (the database will not allow two games on one pitch at once). Everyone else who asked for that hour is automatically told no, and we remember they were interested. The public page stops offering a Request button for that hour. We have not built that yet Ã¢ÂÂ only the instruction sheet.

---

## Chapter 32 Ã¢ÂÂ 2026-09-10 Ã¢ÂÂ SPEC-05 step 1: SlotInterest schema

**When:** 2026-09-10

**What:** `SlotInterest` table: `tenantId` required, `pitchId`, `during` tstzrange (Prisma `Unsupported`, same as Booking), `personId`, `createdAt`. Empty this step. No unique on (pitch, during, person) Ã¢ÂÂ DR-002 does not require one.

**Why:** SPEC-05 step 1 / DR-002 ÃÂ§2.13. Approval later writes Ã¢ÂÂwho wanted this filled hourÃ¢ÂÂ as a window, not a rejected booking id. Guard is step 2.

**Files:** `src/prisma/schema.prisma`; `src/prisma/migrations/20260910041000_slot_interest/migration.sql`.

**Relation:** Booking module not touched. `TENANT_SCOPED_MODELS` not updated yet.

**How to verify:** Prisma Studio Ã¢ÂÂ `SlotInterest` (empty). Columns include `tenantId` and `during`. `npx prisma migrate status --config prisma7.config.ts` up to date after generate/deploy.

### In plain language

A spare drawer for Ã¢ÂÂthis person wanted that hour.Ã¢ÂÂ We built the drawer. We do not put names in it until the owner taps Approve.

---

## Chapter 33 Ã¢ÂÂ 2026-09-10 Ã¢ÂÂ SPEC-05 step 2: SlotInterest on the tenant guard

**When:** 2026-09-10

**What:** `SlotInterest` added to `TENANT_SCOPED_MODELS`. Prisma `findMany`/`create` on that model get `tenantId` injected. Raw `$executeRaw` for `during` still stamps `tenantId` from ALS (same as Booking insert) Ã¢ÂÂ the extension does not wrap raw SQL.

**Why:** SPEC-05 step 2 / DR-001 ÃÂ§1. Interests are AhmadÃ¢ÂÂs or SamiÃ¢ÂÂs, never mixed.

**Files:** `src/lib/db.ts`.

**Relation:** No Booking use case yet. Callers still must not pass `tenantId`.

**How to verify:** Read the set in `src/lib/db.ts`. No Studio change (table already empty).

### In plain language

The bouncer now knows the waitlist drawer. When we later list interests, we only get this stadiumÃ¢ÂÂs names, without writing `tenantId` in the kitchen.

---

## Chapter 34 Ã¢ÂÂ 2026-09-10 Ã¢ÂÂ SPEC-05 step 3: approve domain rules

**When:** 2026-09-10

**What:** `resolveOfferedSlot` takes `occupied` (default `[]`); covering APPROVED range Ã¢ÂÂ `"Slot is taken"`. `overlappingPendingIds` = same pitch + half-open overlap. `assertPendingForDecision`: only PENDING may be approved/rejected. No Prisma in domain.

**Why:** SPEC-05 step 3 / BR-18, BR-20 pin, BR-23 via occupied. Public request still compiles: occupied omitted Ã¢ÂÂ empty.

**Files:** `src/modules/booking/domain/offered-slot.ts`, `decision.ts`; `test/modules/booking/domain/`.

**Relation:** Venue still does not import Booking. Application/UI not this step.

**How to verify:** `npm test` Ã¢ÂÂ new cases: adjacent 16:00Ã¢ÂÂ17:00 / 17:00Ã¢ÂÂ18:00 not overlapping; loser id returned; occupied slot throws; APPROVED status throws.

### In plain language

Three paper rules, no database. You can only say yes/no to a *pending* request. If two people asked for the same hour on the same pitch, approving one names the other as a loser. If that hour is already a real game, a new public request must fail.

---

## Chapter 35 Ã¢ÂÂ 2026-09-10 Ã¢ÂÂ SPEC-05 step 4: Zod booking decision

**When:** 2026-09-10

**What:** `parseBookingDecision` Ã¢ÂÂ `bookingId` only, `strictObject`, trim + min 1. No `tenant` / `tenantId` in the schema.

**Why:** SPEC-05 step 4. Same two-gate idea: Zod = form shape; the use case (step 6) = membership + PENDING + exclusion.

**Files:** `src/modules/booking/schemas/booking-decision.ts`; `test/modules/booking/schemas/booking-decision.test.ts`.

**How to verify:** `npm test` Ã¢ÂÂ missing id, extra field, happy `bk_1`.

### In plain language

The bouncer for the Approve/Reject button: you must send exactly one booking id, nothing extra. The hidden stadium slug on the form is only so local `?tenant=` survives a redirect. It is not how we pick the stadium.

---

## Chapter 36 Ã¢ÂÂ 2026-09-10 Ã¢ÂÂ SPEC-05 step 5: Booking infrastructure

**When:** 2026-09-10

**What:** Raw SQL for `during` (`listPendingBookings`, `findBookingForDecision`, `listApprovedRanges`, `insertSlotInterest`). Prisma `updateMany` for PENDING Ã¢ÂÂ APPROVED/REJECTED (Client has update, not create, because Unsupported). Requester `personId` via participant find. Seed deletes `SlotInterest` before Person/Pitch.

**Why:** SPEC-05 step 5. Prisma 7 generated Booking/SlotInterest have no `create` (no `during` on the Client model). `$executeRaw` is not stamped by the extension Ã¢ÂÂ ALS `tenantId` in SQL, same as SPEC-03 insert.

**Files:** `src/modules/booking/infrastructure/bookings.ts`; `src/prisma/seed.ts`.

**Relation:** No use case yet. Pages unchanged.

**How to verify:** Code review. Click-proof waits for step 6Ã¢ÂÂ8 + a running `prisma dev`.

### In plain language

The warehouse for approve: list who asked, load one requestÃ¢ÂÂs hour, mark it approved or rejected, and drop a waitlist row. We still do not have the kitchen (use case) or the waiter (buttons).

---

## Chapter 37 Ã¢ÂÂ 2026-09-10 Ã¢ÂÂ SPEC-05 step 6: approve / reject use cases

**When:** 2026-09-10

**What:** `listPendingRequests` (membership required, no `can`). `approveBooking` / `rejectBooking`: `getCurrentMembership` + `can(..., bookings.approve)` **outside** `$transaction`; then load Ã¢ÂÂ PENDING gate Ã¢ÂÂ status write. Approve auto-rejects overlapping PENDING on that pitch and inserts `slot_interests` for the **approved** window. Exclusion `23P01` / `Booking_approved_during_excl` Ã¢ÂÂ `"Slot no longer available"` and the whole tx rolls back.

**Why:** SPEC-05 step 6 / BR-17Ã¢ÂÂ21, BR-24, DR-003 (Booking asks Access; Access does not import Booking). Authorize before `$transaction` so session/User (`platformDb`) never run inside `tx` ([guides/prisma-transaction-tenant-guard.md](./guides/prisma-transaction-tenant-guard.md)).

**Files:** `src/modules/booking/application/list-pending-requests.ts`, `approve-booking.ts`, `reject-booking.ts`.

**Relation:** No Server Action / `/owner` buttons yet (step 8). Public occupied is step 7. Venue still does not import Booking.

**How to verify:** Code review now. Click-proof: step 8 + two PENDING on the same Ahmad hour Ã¢ÂÂ owner approve Ã¢ÂÂ one APPROVED, loser REJECTED + one interest; `staff@ahmad` gets `"Not allowed"`.

### In plain language

The kitchen: a logged-in person can see the request list. Only the owner (or staff with the flag) can say yes or no. Yes locks the hour, turns overlapping asks into no, and writes a waitlist note. If two owners hit Approve at the same second, Postgres refuses the second and nothing half-saves.

---

## Chapter 38 Ã¢ÂÂ 2026-09-10 Ã¢ÂÂ SPEC-05 step 7: occupied on the public day

**When:** 2026-09-10

**What:** `getDayAvailability` takes `occupied?: { pitchId, start, end }[]` and passes per-pitch ranges into `generateSlotsForDay`. `page.tsx` loads APPROVED via Booking `listApprovedOccupied` (no Prisma on the page) and **omits** the Request form when `available === false` (time still shown). `requestPublicSlot` loads APPROVED for that pitch **inside** the existing `$transaction` and passes them as `occupied` to `resolveOfferedSlot`.

**Why:** SPEC-05 step 7 / BR-23. Occupied = APPROVED only. Venue still does not import Booking Ã¢ÂÂ the page (and BookingÃ¢ÂÂs own request use case) assemble the ranges.

**Files:** `src/modules/venue/application/get-day-availability.ts`, `src/modules/booking/application/list-approved-occupied.ts`, `request-public-slot.ts`, `src/app/page.tsx`.

**Relation:** No `/owner` buttons (step 8). PENDING does not occupy.

**How to verify:** After step 8, approve 16:00 on Ahmad Ã¢ÂÂ `/?tenant=ahmad` that day lists 16:00 with no Request; posting the old hidden start/end fails. Until then: empty APPROVED Ã¢ÂÂ every offered hour still has Request (same as before).

### In plain language

The public clock still shows every hour. If that hour is already a confirmed game, there is no Request button, and sneaking the old form values into a POST also fails. The slot engine still does not know what a booking is Ã¢ÂÂ it only receives Ã¢ÂÂthis pitch is busy from A to B.Ã¢ÂÂ

---

## Chapter 39 Ã¢ÂÂ 2026-09-10 Ã¢ÂÂ Prisma 7 create types vs tenant stamp

**When:** 2026-09-10

**What:** `insertRequesterParticipant` still omits `tenantId` (guard stamps it). Prisma 7 `create` `data` is an Exact XOR: scalar FKs Ã¢ÂÂ UncheckedCreateInput (requires `tenantId`); nested `connect` Ã¢ÂÂ CreateInput (requires `tenant`). `$extends` does not rewrite those types. Assert the payload as the create `data` type.

**Why:** DR-001 Ã¢ÂÂ callers must not pass `tenantId`. Passing it would silence the error but hide whether the guard is doing its job.

**Files:** `src/modules/booking/infrastructure/bookings.ts`

**How to verify:** lints on `bookings.ts` Ã¢ÂÂ no `tenantId` missing error.

### In plain language

TypeScript wants us to write the stadium id on the participant row. The bouncer is supposed to write it for us. We keep omitting it and tell TypeScript Ã¢ÂÂthe bouncer will fill this in.Ã¢ÂÂ

---

## Chapter 40 Ã¢ÂÂ 2026-09-10 Ã¢ÂÂ SPEC-05 step 8: /owner pending inbox

**When:** 2026-09-10

**What:** `/owner` lists PENDING oldest first (pitch, Asia/Beirut time, requester name + phone, requested at). Approve / Reject are `<form action={Server Action}>`. `can(..., bookings.approve)` false Ã¢ÂÂ list, no buttons. Actions: Zod `bookingId` Ã¢ÂÂ `approveBooking` / `rejectBooking`; `redirect` outside try/catch to `/owner?tenant=`. Failure Ã¢ÂÂ `?error=1`.

**Why:** SPEC-05 step 8 / BR-17, BR-97. Next 16 local docs: [`forms.md`](../../node_modules/next/dist/docs/01-app/02-guides/forms.md) Ã¢ÂÂ FormData on `action`. [`redirect`](../../node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md) outside try/catch.

**Files:** `src/app/owner/page.tsx`, `src/app/owner/actions.ts`.

**Relation:** No Prisma / no `tenantId` on the page. Access still does not import Booking. Hidden `tenant` is only for `?tenant=` after POST.

**How to verify:** One `next dev` only (do not start a second Ã¢ÂÂ Next already on PID shown in the lock). `prisma dev` must be listening on `DATABASE_URL` (51214). `http://localhost:3000/login?tenant=ahmad` Ã¢ÂÂ `owner@ahmad` / `dev-owner` Ã¢ÂÂ Approve. `staff@ahmad` sees the row, no buttons. `?tenant=sami` `/owner` does not list AhmadÃ¢ÂÂs PENDING.

**Gotcha:** `npm run dev --port 3001` is parsed by npm as a project folder. Extra port is `npm run dev -- -p 3001`. `Server has closed the connection` on `tenant.findUnique` is the local Prisma Postgres proxy, not Next Ã¢ÂÂ restart `npx prisma dev`, then kill the stale Next PID and start a single `npm run dev`.

### In plain language

The ownerÃ¢ÂÂs inbox is on the same locked page as logout. Each ask is a line with Approve and Reject. Staff can look but get no buttons. The kitchen we already wrote does the real yes/no.

---

## Chapter 41 Ã¢ÂÂ 2026-09-10 Ã¢ÂÂ SPEC-05 click-proof

**When:** 2026-09-10

**What:** On the running app: two public PENDINGs, then `submitApproveBooking` for `19848641-4b37-43d5-909d-de1881cdc03d` (`Booking approved` in next-dev). Public day reload 200. Second session login after logout.

**Why:** SPEC-05 whole-slice acceptance, step 8 definition of done.

**Files:** none (no code change).

**Relation:** Closes the approve UI slice. Payment is next (SPEC not started).

**How to verify:** Studio: that id APPROVED; overlapping leftover PENDING REJECTED + one `slot_interests` if they shared the hour.

### In plain language

AhmadÃ¢ÂÂs owner tapped Approve in the browser and the kitchen ran. The slice is done.

---

## Chapter 42 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ Cursor/VS Code debugger

**When:** 2026-09-11

**What:** Replaced the dummy `.vscode/launch.json` (it launched `src/proxy.ts` as a Node script, so breakpoints never bound) with Next.js 16 debug configs: server-side (`next dev --inspect`), Chrome/Edge client, full stack, attach on 9229, and Jest. Workspace settings let breakpoints bind even when Turbopack source maps are messy. `npm run dev:debug` is the same inspect flag from a terminal.

**Why:** Next 16 local docs: `next/dist/docs` plus [Debugging](https://nextjs.org/docs/app/guides/debugging) Ã¢ÂÂ `npm run dev -- --inspect` is the supported way to inspect only the process that runs app code (not every child). Not a SPEC slice.

**Files:** `.vscode/launch.json`, `.vscode/settings.json`, `package.json` (`dev:debug`).

**Relation:** Tooling only. Does not import any module. Stop the existing `npm run dev` before F5 or port 3000 / the inspect port will collide.

**How to verify:** Stop the current `npm run dev`. Debug view Ã¢ÂÂ **Next.js: debug server-side** Ã¢ÂÂ F5. Click a gutter breakpoint in a Server Action or `src/modules/**/domain/*.ts`, hit that path in the browser (`/?tenant=ahmad`). Debugger must pause on that line. Jest: open a `test/**/*.test.ts` file Ã¢ÂÂ **Jest: current file** Ã¢ÂÂ F5.

### In plain language

Click in the left margin, press F5, use the app as usual. When that line runs, Cursor stops so you can see variables. The old debug button was starting the wrong file, which is why it never stopped.

---

## Chapter 43 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-06 written (not started in code)

**When:** 2026-09-11

**What:** Merged `feature/spec-05-owner-approve` into `main` (fast-forward). Branched `feature/spec-06-collect-payment`. Wrote numbered collect-on-booking slice: Payment + tenders + append-only rate + ledger IN in the same `$transaction`. No per-player split, no expenses, no dashboard UI.

**Why:** [SPEC-06](./specs/SPEC-06-collect-payment.md) implements [DR-002](./decisions/DR-002-core-data-model.md) ÃÂ§2.14Ã¢ÂÂ2.21. Booking asks Payment; Payment writes Ledger; Payment never imports Booking. Q-2 pinned: `"payments.collect"` default deny for staff.

**Files:** `docs/specs/SPEC-06-collect-payment.md`; `docs/README.md`.

**Relation:** No Payment/Ledger folders yet (step 1 is schema). Access still only has `"bookings.approve"` until step 3.

**How to verify:** Read the spec. Confirm or correct the pins (partial, overpay, OWNER-only rate, no `booking_id`). Then OK step 1.

### In plain language

The owner can already lock an hour. Next we let him take cash for that hour: dollars, pounds, or both, at a rate he types. The notebook of Ã¢ÂÂwhat the business tookÃ¢ÂÂ is written in the same moment as the payment, so the two can never disagree. We have not built that yet Ã¢ÂÂ only the instruction sheet.

---

## Chapter 44 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-06 step 1: Payment + ledger schema

**When:** 2026-09-11

**What:** Four tenant-owned tables: `ExchangeRate`, `Payment`, `PaymentTender`, `LedgerEntry`. Enums `PaymentSourceType` (`BOOKING` only), `Currency`, `LedgerDirection` (`IN | OUT`). No `booking_id` on Payment. Tender `amount` is `DECIMAL(18,2)` (domain will enforce USD cents vs integer LBP). Guard not updated (step 2). No Payment/Ledger modules.

**Why:** SPEC-06 step 1 / DR-002 ÃÂ§2.14Ã¢ÂÂ2.21. Polymorphic `sourceType + sourceId` keeps Payment closed when Expense/Shop arrive. `tenant_id` on the child tender table (DR-001). Prisma 7: `Decimal` + `@db.Decimal(p, s)` ([same as booking `priceUsd`](https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/models)). No `Unsupported` Ã¢ÂÂ Client `create` should exist for these models.

**Files:** `src/prisma/schema.prisma`; `src/prisma/migrations/20260911040000_collect_payment/migration.sql`.

**Relation:** Tenant gains reverse lists. Payment has tenders. Ledger has **no** FK to Payment or Booking. Booking model unchanged (no payment relation). `TENANT_SCOPED_MODELS` still omits these (step 2).

**How to verify:** Prisma Studio Ã¢ÂÂ four empty tables; Payment has `sourceId` text, no booking FK; `npx prisma migrate status --config prisma7.config.ts` Ã¢ÂÂ up to date.

```
npx prisma studio --config prisma7.config.ts
```

### In plain language

We added empty cash drawers: one for the exchange rate, one for Ã¢ÂÂa payment happened,Ã¢ÂÂ one for the dollar/pound bits of that payment, and one for the notebook of money in/out. Nothing is collected yet. The payment row does not point at a booking column Ã¢ÂÂ it stores Ã¢ÂÂthis is for a bookingÃ¢ÂÂ plus that bookingÃ¢ÂÂs id, so later a shop sale can use the same drawer without changing it.

---

## Chapter 45 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-06 step 2: payment tables on the tenant guard

**When:** 2026-09-11

**What:** `ExchangeRate`, `Payment`, `PaymentTender`, `LedgerEntry` added to `TENANT_SCOPED_MODELS`. Prisma `findMany`/`create` on those models get `tenantId` injected. Callers still omit `tenantId`. No Payment/Ledger folders yet (step 3 is domain).

**Why:** SPEC-06 step 2 / DR-001 ÃÂ§1. Cash rows are AhmadÃ¢ÂÂs or SamiÃ¢ÂÂs, never mixed. These models have normal `create` (no `Unsupported`), so the extension can stamp `data.tenantId` on Client create Ã¢ÂÂ unlike Booking inserts.

**Files:** `src/lib/db.ts`.

**Relation:** No app query against Payment yet. Proof that callers omit `tenantId` waits for step 5/6 repositories.

**How to verify:** Read the set in `src/lib/db.ts`. No Studio change (tables already empty).

### In plain language

The bouncer now knows the cash drawers. When we later list payments, we only get this stadiumÃ¢ÂÂs money, without writing `tenantId` in the kitchen.

---

## Chapter 46 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-06 step 3: collect permission + money domain

**When:** 2026-09-11

**What:** `"payments.collect"` on Access `can`. LBP parse in `lib/money` (integer pounds). Payment `domain/collect.ts`: freeze tenders to USD (ROUND_HALF_UP), remaining, APPROVED-only, nothing-due. No Prisma, no `await`. Payment does not import Booking.

**Why:** SPEC-06 step 3 / DR-003 ÃÂ§5 (jsonb flags, BR-98), DR-002 ÃÂ§2.18, RULE-4/5. Q-2 default deny for staff.

**Files:** `src/modules/access/domain/can.ts`, `src/lib/money.ts`, `src/modules/payment/domain/collect.ts`, tests under `test/modules/access/domain/`, `test/lib/`, `test/modules/payment/domain/`.

**Relation:** No infrastructure yet (step 5). Zod is step 4. Access still does not import Payment.

**How to verify:** `npm test` Ã¢ÂÂ 69 passed (Access collect flags, 900000 LBP at 90000 Ã¢ÂÂ $10, 1 LBP Ã¢ÂÂ $0.00, PENDING cannot collect).

### In plain language

The owner is always allowed to take cash. Staff are not, unless we later tick a box. The kitchen can now turn Ã¢ÂÂ900,000 pounds at 90,000Ã¢ÂÂ into ten dollars without using a JavaScript number, and it refuses to collect on a request that is still waiting for yes.

---

## Chapter 47 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-06 step 4: Zod collect + rate

**When:** 2026-09-11

**What:** Collect form: `bookingId` + optional USD (`30.00`) + optional LBP (integer). Empty fields omitted. At least one positive amount. Rate form: positive integer `lbpPerUsd`. Extra keys rejected. Hidden `tenant` is not in either schema.

**Why:** SPEC-06 step 4. Same two-gate idea as public request / login: Zod = form shape; domain (step 3) still decides remaining / rate / APPROVED.

**Files:** `src/modules/payment/schemas/collect-payment.ts`, `exchange-rate.ts`, `test/modules/payment/schemas/collect-payment.test.ts`.

**Relation:** Does not import domain `freezeTenders` (different question). Use cases (step 6) will parse first, then domain.

**How to verify:** `npm test` Ã¢ÂÂ 78 passed. `30` USD fails; `30.00` + `900000` passes; extra `tenant` fails.

### In plain language

The form is untrusted. We check the shape before the kitchen: a booking id, dollars that look like money, pounds as a whole number, or a rate the owner typed. A fake extra field is thrown away.

---

## Chapter 48 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-06 step 5: Payment / Ledger infrastructure

**When:** 2026-09-11

**What:** Repositories: latest/insert exchange rate; insert payment + tenders; sum collected USD by source; insert ledger IN/OUT. Booking lists APPROVED (soonest first) and loads one bookingÃ¢ÂÂs status + price Ã¢ÂÂ no payment join. Callers omit `tenantId`; Prisma 7 create XOR asserted like participants (Chapter 39).

**Why:** SPEC-06 step 5 / DR-002 ÃÂ§2.14 (no booking_id), ÃÂ§2.21 (ledger in the same tx Ã¢ÂÂ use case will call both, step 6). Payment never lists bookings.

**Files:** `src/modules/payment/infrastructure/rates.ts`, `payments.ts`; `src/modules/ledger/infrastructure/entries.ts`; `src/modules/booking/infrastructure/bookings.ts`.

**Relation:** No `recordPayment` use case yet (step 6). Payment infra does not import Ledger or Booking. Access unchanged.

**How to verify:** Code review now. Click-proof waits for step 6Ã¢ÂÂ8. Studio: tables still empty until collect.

### In plain language

The cash drawers have clerks now: they can put a rate on the shelf, write a payment and its dollar/pound bits, add up what was already taken for a game, and write a notebook line. They still wait for the ownerÃ¢ÂÂs Collect tap before any of that runs.

---

## Chapter 49 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-06 step 6: collect / rate use cases

**When:** 2026-09-11

**What:** `recordPayment` writes payment + tenders + ledger IN in the **given** `tx` (does not open its own). `collectBookingPayment` authorizes `payments.collect` **before** `$transaction`, then status/remaining/freeze, then `recordPayment`. `listDueBookings` attaches remaining via Payment sums (omit paid-off). `getCurrentRate` / `setExchangeRate` (OWNER only). No Server Actions yet (step 7).

**Why:** SPEC-06 step 6 / DR-001 ÃÂ§5 (starting use case owns tx) / DR-002 ÃÂ§2.21 (ledger same tx) / [guard guide](./guides/prisma-transaction-tenant-guard.md) (no `platformDb` inside tx).

**Files:** `src/modules/payment/application/record-payment.ts`, `get-current-rate.ts`, `set-exchange-rate.ts`; `src/modules/booking/application/collect-booking-payment.ts`, `list-due-bookings.ts`.

**Relation:** Booking asks Payment; Payment asks Ledger. Payment still does not import Booking. Pages unchanged.

**How to verify:** Code review now. Click-proof: step 7Ã¢ÂÂ8. `npm test` Ã¢ÂÂ 78 passed (no new unit tests this step).

### In plain language

The kitchen can now take cash: check the owner is allowed, lock the hour as approved, freeze pounds to dollars, write the payment and the notebook in one meeting so they cannot disagree. There is still no Collect button on the page.

---

## Chapter 50 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-06 step 7: /owner collect + rate

**When:** 2026-09-11

**What:** `/owner` shows current rate (OWNER can set a new one). APPROVED-with-remaining list: two-tap Collect remaining USD, plus mixed USD/LBP fields. Staff see the list, no Collect, no Set rate. Actions: Zod Ã¢ÂÂ use case; `redirect` outside try/catch; `?error=1` on failure. Pending inbox unchanged.

**Why:** SPEC-06 step 7 / BR-36, BR-38/39. Next 16: FormData on `action`; `redirect` outside try/catch (same as SPEC-05).

**Files:** `src/app/owner/page.tsx`, `src/app/owner/actions.ts`.

**Relation:** No Prisma / no `tenantId` on the page. Payment still does not import Booking. Seed rate is step 8 Ã¢ÂÂ until then Ã¢ÂÂNo rate setÃ¢ÂÂ; USD collect still works.

**How to verify:** After step 8 (or Set rate 90000): approve a game Ã¢ÂÂ Collect remaining USD Ã¢ÂÂ Studio payment + tender + ledger IN. `staff@ahmad` sees due row, no buttons. `?tenant=sami` does not list AhmadÃ¢ÂÂs due booking.

### In plain language

The ownerÃ¢ÂÂs page now has a rate and a cash list. One button takes the rest in dollars. The mixed line is for $20 plus pounds. Staff can look; they cannot tap Collect.

---

## Chapter 51 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-06 step 8: seed exchange rate

**When:** 2026-09-11

**What:** Seed Ahmad and Sami with `lbpPerUsd = 90000`. No seeded payments. Re-seed now also deletes ledger/tender/payment/rate rows before tenants.

**Why:** SPEC-06 step 8. LBP click-test needs a rate without a prior Set rate tap.

**Files:** `src/prisma/seed.ts`.

**Relation:** Does not import Payment module (seed uses unscoped `platformDb`, same as owners).

**How to verify:** `/owner?tenant=ahmad` after login shows 90000. Seed wipes bookings Ã¢ÂÂ request + approve again before Collect.

```
npm run db:seed
```

### In plain language

Both demo stadiums start with Ã¢ÂÂ90,000 pounds to the dollarÃ¢ÂÂ on the shelf, so the owner can take mixed cash on the first evening without typing a rate first.

---

## Correction Ã¢ÂÂ collect form threw on `"30"` (2026-09-11)

**When:** After SPEC-06 step 8, first click-proof Collect.

**What:** Mixed USD `30` redirected to `/owner?error=1`. Log: `Invalid USD amount "30"`. Kitchen never ran.

**Why:** `parseUsd` / `parseLbp` throw `Error`, not `ZodError`. The object `.refine` called `parseUsd("30")` before checking `isUsdString`. That crash became `?error=1`. SPEC-06 G-1 already said `"30"` is `"30.00"`.

**Files:** `src/lib/money.ts` (`normalizeUsdForm`), `src/modules/payment/schemas/collect-payment.ts` (normalize then `isUsdString` before parse), `src/app/owner/page.tsx` (placeholder), tests.

**How it connects:** Form still stores cents as strings. Domain still freezes tenders. Payment still does not import Booking.

**How to verify:** Collect `30` or `30.00` or two-tap remaining USD on an APPROVED booking. `"30.0"` still invalid.

```
npm test
```

---

## Chapter 52 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-06 click-proof

**When:** 2026-09-11

**What:** After the `"30"` form correction, Collect on `/owner` succeeded. The due row turned Collected (remaining Ã¢ÂÂ¤ 0, omitted from the unpaid list). Kitchen ran: payment + tender(s) + ledger IN in one `$transaction`.

**Why:** SPEC-06 whole-slice acceptance.

**Files:** none this chapter (code was the Correction above).

**Relation:** Closes collect. Payment still does not import Booking. Expenses next (ledger OUT).

**How to verify:** Studio: that bookingÃ¢ÂÂs payments, tenders with frozen `rateAtTime`, ledger IN matching USD equivalent. Second Collect on the same hour Ã¢ÂÂ `"Nothing due"`.

### In plain language

The owner took cash in the browser. The hour is paid. This slice is done.

---

## Note Ã¢ÂÂ overpay parked (2026-09-11)

**When:** After SPEC-06 click-proof, a second Collect with more than remaining.

**What:** Overpay is allowed (SPEC-06 / RULE-9 / RULE-10). Owner confirmed: skip warn / credit / cap for now.

**Why:** Do not invent a new money rule in chat. Park it; a later SPEC (or BRD change) if we ever cap or warn.

**Files:** `docs/specs/SPEC-06-collect-payment.md` (out of scope + pin). No code.

**How it connects:** Ledger still records cash in. Remaining may be negative. Second collect after `<= 0` still `"Nothing due"`.

**How to verify:** Read the SPEC pin. Do not build a warning until a numbered SPEC says so.

---

## Chapter 53 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-07 written (not started in code)

**When:** 2026-09-11

**What:** Branched `feature/spec-07-expenses` from SPEC-06 HEAD. Wrote numbered record-expense slice: Expense row (no amount) + reuse `recordPayment` with `EXPENSE` + ledger OUT in the same `$transaction`. One submit = create and pay. No dashboard totals.

**Why:** [SPEC-07](./specs/SPEC-07-record-expense.md) implements [DR-002](./decisions/DR-002-core-data-model.md) ÃÂ§2.22Ã¢ÂÂ2.23. Expense asks Payment; Payment writes Ledger; Payment never imports Expense.

**Files:** `docs/specs/SPEC-07-record-expense.md`; `docs/README.md`.

**Relation:** Collect stays on `/owner`. Overpay warning stays parked.

**How to verify:** Read the spec. Confirm or correct the pins (no amount on expense, one submit pays it, `"expenses.record"` default deny, ledger `occurredAt` = expense date). Then OK step 1.

### In plain language

The next instruction sheet: the owner writes Ã¢ÂÂelectricity, this much cash, todayÃ¢ÂÂ and the notebook records money going *out* the same way it recorded money coming *in*. We have not built that yet Ã¢ÂÂ only the sheet.

---

## Chapter 54 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-07 step 1: Expense schema

**When:** 2026-09-11

**What:** `Expense` table: `tenantId`, `category` enum (ELECTRICITY / WATER / MAINTENANCE / SALARY / EQUIPMENT / OTHER), `description`, `occurredAt`, `createdAt`. **No amount columns.** `PaymentSourceType` gained `EXPENSE`. No FK from Payment to Expense. Guard not updated (step 2). No `expense/` module yet.

**Why:** SPEC-07 step 1 / DR-002 ÃÂ§2.22Ã¢ÂÂ2.23 / DR-001 (`tenant_id` on the table). Prisma 7: `DateTime` Ã¢ÂÂ `TIMESTAMP(3)`, `String` Ã¢ÂÂ `TEXT`, enums via `CREATE TYPE` / `ALTER TYPE ... ADD VALUE` (CLI `migrate diff --from-config-datasource --to-schema`). No `Unsupported` Ã¢ÂÂ Client `create` should exist (unlike Booking). Local DB is `template1` Ã¢ÂÂ handwritten SQL + `migrate deploy`.

**Files:** `src/prisma/schema.prisma`; `src/prisma/migrations/20260911050000_record_expense/migration.sql`.

**Relation:** Tenant gains `expenses`. Payment still has no expense relation. `TENANT_SCOPED_MODELS` still omits Expense (step 2). Collect code unchanged (`recordPayment` still types `sourceType: "BOOKING"` until later steps).

**How to verify:** Prisma Studio Ã¢ÂÂ `Expense` empty; Payment has `sourceId` text, no expense FK; `npx prisma migrate status --config prisma7.config.ts` Ã¢ÂÂ up to date.

```
npx prisma studio --config prisma7.config.ts
```

### In plain language

We added a drawer labelled Ã¢ÂÂwhat I spentÃ¢ÂÂ (electricity, water, Ã¢ÂÂ¦) with a date and a note. There is no money column on that drawer Ã¢ÂÂ cash still goes through the payment drawer, with a new stamp that says Ã¢ÂÂthis was an expense.Ã¢ÂÂ The app cannot write expenses yet; the bouncer does not know this drawer.

---

## Chapter 55 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-07 step 2: Expense on the tenant guard

**When:** 2026-09-11

**What:** `Expense` added to `TENANT_SCOPED_MODELS`. Prisma `findMany`/`create` on Expense get `tenantId` injected. Callers still omit `tenantId`. No `expense/` folders yet (step 3 is domain).

**Why:** SPEC-07 step 2 / DR-001 ÃÂ§1. Expense rows are AhmadÃ¢ÂÂs or SamiÃ¢ÂÂs, never mixed. Expense has a normal Prisma `create` (no `Unsupported`), so the extension can stamp `data.tenantId` Ã¢ÂÂ same as Payment, unlike Booking inserts.

**Files:** `src/lib/db.ts`.

**Relation:** No app query against Expense yet. Proof that callers omit `tenantId` waits for step 5/6 repositories. Payment still does not import Expense.

**How to verify:** Read the set in `src/lib/db.ts`. No Studio change (table already empty). Prisma 7 extension is still `$allModels` + `$allOperations` (same comment in `db.ts`).

### In plain language

The bouncer now knows the Ã¢ÂÂwhat I spentÃ¢ÂÂ drawer. When we later list expenses, we only get this stadiumÃ¢ÂÂs rows, without writing `tenantId` in the kitchen.

---

## Chapter 56 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-07 step 3: record flag + expense date

**When:** 2026-09-11

**What:** `"expenses.record"` on Access `can` (`EXPENSES_RECORD`). Expense `domain/`: category const (no Prisma import), `occurredAtFromCivilDate` Ã¢ÂÂ 12:00 in the given zone via Intl offsets (not `Date#getHours`). No tender math here Ã¢ÂÂ Payment still owns freeze. No Zod yet (step 4).

**Why:** SPEC-07 step 3 / DR-003 ÃÂ§5 (jsonb flags, BR-98), DR-002 ÃÂ§2.22Ã¢ÂÂ2.23, SPEC-02 timezone idea without Expense importing Venue.

**Files:** `src/modules/access/domain/can.ts`; `src/modules/expense/domain/categories.ts`, `occurred-at.ts`; `test/modules/access/domain/can.test.ts`; `test/modules/expense/domain/occurred-at.test.ts`.

**Relation:** Access does not import Expense. Expense does not import Payment, Booking, or Venue. Pages unchanged.

**How to verify:** `npm test` Ã¢ÂÂ 15 suites / 84 passed. OWNER can record with `{}`; STAFF default cannot; Beirut July and January both noon on that civil day.

```
npm test
```

### In plain language

Staff cannot write an expense unless the owner later ticks a flag. The kitchen now knows how to turn Ã¢ÂÂ15 JulyÃ¢ÂÂ into a real clock time in Beirut (noon, including summer time) without asking the venue module.

---

## Chapter 57 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-07 step 4: Zod record expense

**When:** 2026-09-11

**What:** `parseRecordExpense`: category enum, description 1Ã¢ÂÂ200, `occurredOn` `YYYY-MM-DD`, optional USD/LBP like collect (`"30"` Ã¢ÂÂ `"30.00"`). Hidden `tenant` rejected. Refine checks `isUsdString` / `isLbpString` before `parseUsd` / `parseLbp`. No use case yet (step 6).

**Why:** SPEC-07 step 4. Same two-gate idea as collect: Zod = form shape; domain still decides date instant / tenders / rate.

**Files:** `src/modules/expense/schemas/record-expense.ts`; `test/modules/expense/schemas/record-expense.test.ts`.

**Relation:** Schema lives in Expense, not Payment. Reuses `src/lib/money.ts`. Payment still does not import Expense. Pages unchanged.

**How to verify:** `npm test` Ã¢ÂÂ 16 suites / 90 passed.

```
npm test
```

### In plain language

The waiter for expenses now knows the ticket: what kind, a short note, a date, and at least some dollars or pounds. The kitchen still has not cooked it.

---

## Chapter 58 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-07 step 5: Expense / Payment / Ledger infrastructure

**When:** 2026-09-11

**What:** Expense repositories: insert (no amount) + last 20 by `occurredAt` then `createdAt`. `recordPayment` accepts `sourceType` BOOKING | EXPENSE and optional `occurredAt`. `insertLedgerEntry` writes `occurredAt` when given; collect still omits it (DB `now()`). Reuse `sumCollectedUsdBySourceIds` for expense ids. No Server Actions yet (step 6).

**Why:** SPEC-07 step 5 / DR-002 ÃÂ§2.14, ÃÂ§2.22 / Chapter 39 (Prisma 7 create XOR Ã¢ÂÂ omit `tenantId`, assert as create `data`). Local Prisma 7 Client: `create` / `findMany` + `orderBy` / `take` ([model queries](https://www.prisma.io/docs/orm/v7/prisma-client/queries/crud)).

**Files:** `src/modules/expense/infrastructure/expenses.ts`; `src/modules/payment/application/record-payment.ts`; `src/modules/payment/infrastructure/payments.ts`; `src/modules/ledger/infrastructure/entries.ts`.

**Relation:** Expense infra does not import Payment. Payment / Ledger do not import Expense. Pages unchanged.

**How to verify:** Code review now. Studio can still insert Expense by hand. Click-proof: step 7Ã¢ÂÂ8. `npm test` Ã¢ÂÂ 90 passed (no new unit tests this step).

### In plain language

The drawers can store an expense note and list the last twenty. Cash-out can now be stamped Ã¢ÂÂthis was an expenseÃ¢ÂÂ and dated the day the owner typed, not only Ã¢ÂÂright now.Ã¢ÂÂ There is still no Record button on the page.

---

## Chapter 59 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-07 step 6: record / list expense use cases

**When:** 2026-09-11

**What:** `recordExpense` authorizes `"expenses.record"` **before** `$transaction`, then date Ã¢ÂÂ insert Expense Ã¢ÂÂ freeze tenders Ã¢ÂÂ `recordPayment(OUT, EXPENSE, occurredAt)` in the **same** `tx`. `listRecentExpenses` requires membership only; attaches USD via Payment sums (no payment join). No Server Actions yet (step 7).

**Why:** SPEC-07 step 6 / DR-001 ÃÂ§5 (starting use case owns tx) / DR-002 ÃÂ§2.21Ã¢ÂÂ2.22 / [guard guide](./guides/prisma-transaction-tenant-guard.md) (no `platformDb` inside tx). Prisma 7 interactive `$transaction` ([Client `$transaction`](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions)).

**Files:** `src/modules/expense/application/record-expense.ts`, `list-recent-expenses.ts`.

**Relation:** Expense asks Payment; Payment asks Ledger. Payment still does not import Expense. Pages unchanged.

**How to verify:** Code review now. Click-proof: step 7Ã¢ÂÂ8. `npm test` Ã¢ÂÂ 90 passed (no new unit tests this step).

### In plain language

The kitchen can now write Ã¢ÂÂelectricity, this cash, that dayÃ¢ÂÂ: check the owner is allowed, freeze pounds to dollars, write the note and the notebook out-row in one meeting. There is still no Record button on the page.

---

## Chapter 60 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-07 step 7: /owner expense form

**When:** 2026-09-11

**What:** `/owner` Expenses: OWNER (and staff with the flag) get category, description, date (default today Beirut), USD + LBP, Record. Recent 20 listed for any logged-in member. Staff seed: list, no form. Pending / rate / collect unchanged. Action: Zod Ã¢ÂÂ use case; `redirect` outside try/catch; `?error=1` on failure.

**Why:** SPEC-07 step 7 / BR-50Ã¢ÂÂ52. Next 16 local docs: [`forms.md`](../../node_modules/next/dist/docs/01-app/02-guides/forms.md) Ã¢ÂÂ FormData on `action`. [`redirect`](../../node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md) outside try/catch (same as SPEC-05/06).

**Files:** `src/app/owner/page.tsx`, `src/app/owner/actions.ts`.

**Relation:** No Prisma / no `tenantId` on the page. Payment still does not import Expense. Seed wipe of Expense is step 8.

**How to verify:** `owner@ahmad` / `dev-owner` Ã¢ÂÂ Record electricity + `1800000` LBP Ã¢ÂÂ list shows ~$20.00. Studio: expense + payment EXPENSE + LBP tender + ledger OUT. `staff@ahmad` sees list, no Record. No browser tools in this session Ã¢ÂÂ click-proof is yours.

```
npm test
```

### In plain language

The ownerÃ¢ÂÂs page now has a spend form. Electricity + pounds today, tap Record, it should show on the list. Staff can look; they cannot tap Record.

---

## Chapter 61 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-07 step 8: seed wipe Expense

**When:** 2026-09-11

**What:** Re-seed deletes Expense rows (after payments, before rates). Does **not** insert sample expenses. Rate 90000 unchanged.

**Why:** SPEC-07 step 8. Click-proof records a real expense; seed must not leave orphan money rows when tenants are wiped.

**Files:** `src/prisma/seed.ts`.

**Relation:** Seed still uses unscoped `platformDb`. Does not import Expense module.

**How to verify:** `/owner?tenant=ahmad` after login shows 90000 and Ã¢ÂÂNo expenses yet.Ã¢ÂÂ Seed wipes bookings Ã¢ÂÂ request + approve again before Collect.

```
npm run db:seed
```

### In plain language

A fresh seed still puts 90,000 on the shelf and leaves the spend list empty, so you can type the first electricity bill yourself.

---

## Correction Ã¢ÂÂ `/owner` `tx.expense` undefined (2026-09-11)

**When:** Click-proof SPEC-07, load `/owner`.

**What:** `listRecentExpenses` threw `Cannot read properties of undefined (reading 'findMany')` on `tx.expense`. The findMany call was fine.

**Why:** Same gotcha as Chapter 2 / 867. `prisma-base.ts` keeps one PrismaClient on `globalThis`. `next dev` started before `prisma generate` for Expense, so the cached client had no `expense` delegate. TypeScript used the new types; runtime was the old instance.

**Files:** `src/lib/prisma-base.ts` Ã¢ÂÂ if the cached client has no `expense.findMany`, disconnect and create a new one.

**How it connects:** Expense infra is unchanged. Restart `npm run dev` if HMR still holds an old `$extends` wrapper.

**How to verify:** Reload `/owner?tenant=ahmad` Ã¢ÂÂ Ã¢ÂÂNo expenses yet.Ã¢ÂÂ, not a TypeError.

---

## Chapter 62 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-07 click-proof

**When:** 2026-09-11

**What:** After restarting `next dev`, Record on `/owner` succeeded (`Expense recorded cmtwa1lml000014l2y0jzpenh`, then `cmtwa2a30000414l2q36bgadm`). Kitchen ran: expense + payment `EXPENSE` + tender(s) + ledger OUT in one `$transaction`.

**Why:** SPEC-07 whole-slice acceptance.

**Files:** none this chapter (code was the Correction above).

**Relation:** Closes record-expense. Payment still does not import Expense. Dashboard next (SUM ledger).

**How to verify:** Studio: those expense ids, matching payments, tenders with frozen `rateAtTime`, ledger OUT equal to USD equivalent.

### In plain language

The owner typed a spend in the browser. Money left the notebook. This slice is done.

---

## Chapter 63 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-08 written (not started in code)

**When:** 2026-09-11

**What:** Fast-forward merged `feature/spec-07-expenses` into local `main` (`6b59c8c` Ã¢ÂÂ `7af1854`). Branched `feature/spec-08-financial-dashboard`. Wrote numbered ledger-summary slice: IN / OUT / net for a civil-date period from `ledger_entries` only. Optional LBP display is a view transform. No Payment/Expense/Booking joins. No `/dashboard` route.

**Why:** [SPEC-08](./specs/SPEC-08-financial-dashboard.md) implements [DR-002](./decisions/DR-002-core-data-model.md) ÃÂ§2.20Ã¢ÂÂ2.21 / BR-54Ã¢ÂÂ56, BR-59. BR-57 (games/pitch) and BR-58 (outstanding as a fourth number) stay out Ã¢ÂÂ due list already exists.

**Files:** `docs/specs/SPEC-08-financial-dashboard.md`; `docs/README.md`.

**Relation:** Collect and expenses stay on `/owner`. Overpay warning stays parked. Did not push.

**How to verify:** Read the spec. Confirm or correct the pins (`"reports.view"` default deny, GET period, LBP never stored, hide the block for staff). Then OK step 1.

### In plain language

The next instruction sheet: three numbers at the top of the owner page Ã¢ÂÂ cash in, money out, whatÃ¢ÂÂs left Ã¢ÂÂ for this month or any dates he picks. The notebook is already being written; this sheet is only how to add those numbers up. We had not built that yet when this chapter was written.

---

## Chapter 64 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-08 step 1: ledger period index

**When:** 2026-09-11

**What:** Additive `@@index([tenantId, occurredAt])` on `LedgerEntry`. No new columns, FKs, or tables. Existing `tenantId` index kept. Handwritten SQL + `migrate deploy` (`template1`).

**Why:** SPEC-08 step 1 / BR-59 / DR-002 ÃÂ§2.20. Period SUM filters `occurredAt`; a composite index keeps that query cheap on the droplet. Prisma 7 `migrate diff --from-config-datasource --to-schema` produced `CREATE INDEX "LedgerEntry_tenantId_occurredAt_idx"`.

**Files:** `src/prisma/schema.prisma`; `src/prisma/migrations/20260911060000_ledger_period_index/migration.sql`.

**Relation:** Guard still has `LedgerEntry` (SPEC-06). No `ledger/domain` yet (step 2). No SUM UI.

**How to verify:** `npx prisma migrate status --config prisma7.config.ts` Ã¢ÂÂ up to date. Prisma Studio Ã¢ÂÂ `LedgerEntry` columns unchanged.

```
npx prisma migrate status --config prisma7.config.ts
```

### In plain language

We told the database: when you add up money for a date range at one stadium, look at tenant plus when it happened. Nothing new is stored. The owner still cannot see the three numbers on the page.

---

## Chapter 65 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-08 step 2: reports.view + period domain

**When:** 2026-09-11

**What:** `"reports.view"` (`REPORTS_VIEW`) on `can()`. Ledger domain: civil From/To Ã¢ÂÂ `[start, end)` at Beirut midnight; current calendar month; `netUsd`; LBP display multiply ROUND_HALF_UP to integer pounds. No Prisma. No Expense/Venue/Payment imports.

**Why:** SPEC-08 step 2 / DR-003 (OWNER always; STAFF default deny) / DR-002 ÃÂ§2.20Ã¢ÂÂ2.21 (period on `occurredAt`; LBP never stored). Inclusive start / exclusive next-day midnight so a July month does not pick up 1 Aug 00:00 Beirut.

**Files:** `src/modules/access/domain/can.ts`; `src/modules/ledger/domain/period.ts`; `src/modules/ledger/domain/totals.ts`; `test/modules/access/domain/can.test.ts`; `test/modules/ledger/domain/period.test.ts`; `test/modules/ledger/domain/totals.test.ts`.

**Relation:** Index exists (step 1). No Zod query yet (step 3). `/owner` still has no summary block.

**How to verify:** `npm test` Ã¢ÂÂ 18 suites / 103 tests. Summer July 2026 midnight Beirut; winter one-day range; `20.00 ÃÂ 90000` Ã¢ÂÂ `1800000`; STAFF without the flag cannot view reports.

### In plain language

Staff still cannot see the money page unless we later tick a box. The rules for Ã¢ÂÂthis month in BeirutÃ¢ÂÂ and Ã¢ÂÂin minus outÃ¢ÂÂ now exist as plain functions. The screen still does not add anything up.

---

## Chapter 66 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-08 step 3: Zod period query

**When:** 2026-09-11

**What:** GET query schema: optional `from`/`to` (`YYYY-MM-DD`, real calendar days, `from <= to`, both together or both omitted), `view` `usd`|`lbp` (default usd), `displayRate` emptyÃ¢ÂÂomit else positive LBP integer. `strictObject` Ã¢ÂÂ `tenant` is not in this schema. `parseLbp` only after `isLbpString`.

**Why:** SPEC-08 step 3. Page will fall back to the default month on Zod failure (`?error=1` stays a write-failure flag).

**Files:** `src/modules/ledger/schemas/period-query.ts`; `test/modules/ledger/schemas/period-query.test.ts`.

**Relation:** Domain already owns midnight bounds. Infra SUM is step 4. Page still does not read these params.

**How to verify:** `npm test` Ã¢ÂÂ 19 suites / 110 tests. Happy July 2026; `from` after `to` throws; `2026-02-31` throws; `view=lbp` + `displayRate=90000`; empty rate omitted; extra `tenant` rejected.

### In plain language

The date form on the owner page now has a checklist for Ã¢ÂÂthis is a real from/to, and LBP view has a whole-pound rate.Ã¢ÂÂ Nothing is summed yet.

---

## Chapter 67 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-08 step 4: SUM ledger by direction

**When:** 2026-09-11

**What:** `sumAmountUsdByDirection(tx, start, end)` Ã¢ÂÂ Prisma 7 `groupBy` `by: ["direction"]`, `_sum.amountUsd`, `occurredAt` in `[start, end)`. Missing direction Ã¢ÂÂ `0.00`. Convert Prisma Decimal via `.toString()` into decimal.js. No `tenantId` argument. No `sourceType` filter.

**Why:** SPEC-08 step 4 / DR-002 ÃÂ§2.20. Guard already injects `tenantId` on `groupBy` (`src/lib/db.ts`). Local generated client: `LedgerEntry.groupBy` + `_sum` (`src/app/generated/prisma/models/LedgerEntry.ts`).

**Files:** `src/modules/ledger/infrastructure/entries.ts`.

**Relation:** Insert path unchanged. Use case (step 5) will call this. Page still has no summary.

**How to verify:** Prisma Studio Ã¢ÂÂ pick two `LedgerEntry` rows (IN and OUT) in a known range; the function should return those sums for that tenant only. `npm test` still 19 / 110.

### In plain language

The notebook can now be asked: Ã¢ÂÂhow much came in and how much went out between these two instants?Ã¢ÂÂ The owner page still does not ask that question.

---

## Chapter 68 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-08 step 5: summarizeLedgerPeriod

**When:** 2026-09-11

**What:** `summarizeLedgerPeriod({ from?, to? })` Ã¢ÂÂ membership + `"reports.view"` before any query; missing dates Ã¢ÂÂ current Beirut month; domain bounds; infra SUM; `netUsd`. Returns `{ inUsd, outUsd, netUsd, from, to }`. No `$transaction`. No Payment import (rate stays on the page).

**Why:** SPEC-08 step 5 / DR-003 (`can` before work) / DR-002 ÃÂ§2.20 (ledger is the read). Staff seed cannot (flag omitted).

**Files:** `src/modules/ledger/application/summarize-ledger-period.ts`.

**Relation:** `/owner` still has no summary block (step 6). Collect/expense unchanged.

**How to verify:** `npm test` Ã¢ÂÂ 19 / 110. Owner path is click-proof in step 6; staff without the flag get `"Not allowed"` if the use case is called.

### In plain language

The kitchen can now add up the notebook for a month. The owner page still does not show those three numbers.

---

## Chapter 69 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-08 step 6: /owner This period

**When:** 2026-09-11

**What:** `/owner` shows In / Out / Difference for the resolved period (default current Beirut month). GET form: From, To, View USD/LBP, optional display rate, hidden `tenant`. Zod failure Ã¢ÂÂ default month + USD (not `?error=1`). LBP is `usdToDisplayLbp` using typed rate else current stored rate. Staff without `"reports.view"`: block omitted. No Prisma / no `tenantId` on the page. No Server Action.

**Why:** SPEC-08 step 6 / BR-54Ã¢ÂÂ56. Next 16 `searchParams` is a Promise (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`). Native `<form method="get" action="/owner">`.

**Files:** `src/app/owner/page.tsx`.

**Relation:** Collect / expenses / pending unchanged. Ledger still does not import Payment (page already loads rate).

**How to verify:** Log in `owner@ahmad` Ã¢ÂÂ `/owner?tenant=ahmad`. Top of page: This period with In/Out/Difference. Change dates; empty day Ã¢ÂÂ `$0.00`. View LBP at 90000. `staff@ahmad`: no This period. `npm test` Ã¢ÂÂ 19 / 110.

### In plain language

The owner page now shows three numbers: money in, money out, and the difference, for this month or any dates he picks. Staff do not see that block.

---

## Chapter 70 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-08 click-proof

**When:** 2026-09-11

**What:** Owner confirmed This period on `/owner`: IN after collect (`Payment collected cmtwar7f2000f14l2gmks690g`), OUT after expense (`Expense recorded cmtwaqfcp000814l2afdyd4ej`), empty range zeros, LBP view, staff hide the block, collect/record still work.

**Why:** SPEC-08 whole-slice acceptance / DR-002 ÃÂ§2.20 (dashboard reads ledger only).

**Files:** none this chapter (code was step 6). SPEC acceptance checkmarks in [SPEC-08](./specs/SPEC-08-financial-dashboard.md).

**Relation:** Closes the financial summary. Ledger still does not import Payment/Expense/Booking. Next is owner-created bookings / cancel. Overpay warning stays parked. BR-57 games/pitch and BR-58 outstanding-as-a-fourth-number stay out.

**How to verify:** `/owner?tenant=ahmad` as owner Ã¢ÂÂ three numbers; `staff@ahmad` Ã¢ÂÂ no This period.

### In plain language

The owner can see this monthÃ¢ÂÂs cash in, money out, and the difference without opening Studio. This slice is done.

---

## Chapter 71 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-09 written (not started in code)

**When:** 2026-09-11

**What:** Fast-forward `main` already had SPEC-08 (`40e3ece`). Branched `feature/spec-09-owner-create-booking`. Wrote numbered phone-call slice: owner picks a free computed slot, name + phone, insert **APPROVED** `source = OWNER` immediately. Overlapping public PENDING rejected + interests (same as Approve). No cancel this slice.

**Why:** [SPEC-09](./specs/SPEC-09-owner-create-booking.md) implements BR-13 / BR-14 / RULE-3. Collect stays a second tap (due list). `"bookings.create"` default deny, not reused from `"bookings.approve"`.

**Files:** `docs/specs/SPEC-09-owner-create-booking.md`; `docs/README.md`.

**Relation:** Dashboard stays on `/owner`. Cancel / no-show / BR-11 edit stay out. Overpay warning parked.

**How to verify:** Read the spec. Confirm or correct the pins (name+phone required, APPROVED immediately, separate create flag, no collect in the same submit, cancel next). Then OK step 1.

### In plain language

The next instruction sheet: the owner is on the phone, taps a free hour, types who called, and the hour is taken Ã¢ÂÂ he does not approve himself. We have not built that yet Ã¢ÂÂ only the sheet.

---

## Chapter 72 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-09 step 1: bookings.create flag

**When:** 2026-09-11

**What:** `"bookings.create"` (`BOOKINGS_CREATE`) on `can()`. OWNER always yes. STAFF default deny. `"bookings.approve": true` does **not** imply create.

**Why:** SPEC-09 step 1 / DR-003. Taking a phone-call booking is not the same permission as deciding a public request.

**Files:** `src/modules/access/domain/can.ts`; `test/modules/access/domain/can.test.ts`.

**Relation:** No Booking schema/UI yet (step 2 is Zod). Approve / collect / expense / reports flags unchanged.

**How to verify:** `npm test` Ã¢ÂÂ 19 suites / 114 tests.

### In plain language

Staff still cannot book a callerÃ¢ÂÂs hour unless we later tick a box. The owner page still has no Book button.

---

## Chapter 73 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-09 step 2: Zod owner Book form

**When:** 2026-09-11

**What:** `parseOwnerCreateBooking`: name, phone (8Ã¢ÂÂ15 digits after normalize), pitchId, UTC `start`/`end`. `strictObject` Ã¢ÂÂ no price, no `tenant`. Same phone helper as public request.

**Why:** SPEC-09 step 2. Price stays a Venue snapshot at insert time (DR-002 ÃÂ§2.18). Hidden tenant is not isolation.

**Files:** `src/modules/booking/schemas/owner-create-booking.ts`; `test/modules/booking/schemas/owner-create-booking.test.ts`.

**Relation:** Access flag exists (step 1). No APPROVED OWNER insert yet (step 3).

**How to verify:** `npm test` Ã¢ÂÂ 20 suites / 118 tests. Happy `03 123 456` Ã¢ÂÂ `03123456`; `priceUsd` extra key throws.

### In plain language

The Book form now has a checklist for Ã¢ÂÂwho called and which hour.Ã¢ÂÂ Nothing is written to the database yet.

---

## Chapter 74 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-09 step 3: insert APPROVED OWNER

**When:** 2026-09-11

**What:** `insertApprovedOwnerBooking` Ã¢ÂÂ `$executeRaw` `tstzrange` `[)`, `status = APPROVED`, `source = OWNER`. `tenantId` from ALS (extension does not stamp raw SQL). Reuse `insertRequesterParticipant` (no new participant helper). No Payment import.

**Why:** SPEC-09 step 3 / DR-002 ÃÂ§2.8. Client has no `booking.create` (Unsupported `during`). Exclusion applies immediately because the row is APPROVED.

**Files:** `src/modules/booking/infrastructure/bookings.ts`.

**Relation:** Public PENDING insert unchanged. Use case (step 4) will call this inside `$transaction`. `/owner` still has no Book form.

**How to verify:** `npm test` still 20 / 118. Click-proof in step 5: Studio OWNER + APPROVED; second overlapping APPROVED Ã¢ÂÂ exclusion.

### In plain language

We can now write Ã¢ÂÂthis hour is taken, the owner booked itÃ¢ÂÂ into the database the same way we write a public request Ã¢ÂÂ except it is already confirmed. The owner page still cannot do that.

---

## Chapter 75 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-09 step 4: createOwnerBooking

**When:** 2026-09-11

**What:** `createOwnerBooking` Ã¢ÂÂ `"bookings.create"` before `$transaction`; `resolveOfferedSlot` + find-or-create person; insert APPROVED OWNER + requester; reject overlapping PENDING + interests. Exclusion Ã¢ÂÂ `"Slot no longer available"`. No Payment. Extracted `rejectOverlappingPending` and `isExclusionViolation` so Approve uses the same kitchen.

**Why:** SPEC-09 step 4 / BR-14 / DR-002 ÃÂ§2.8 / SPEC-03 transaction guide (auth before tx).

**Files:** `src/modules/booking/application/create-owner-booking.ts`; `src/modules/booking/application/reject-overlapping-pending.ts`; `src/modules/booking/domain/exclusion.ts`; `src/modules/booking/application/approve-booking.ts`.

**Relation:** `/owner` still has no Book form (step 5). Collect stays a separate use case.

**How to verify:** `npm test` Ã¢ÂÂ 20 / 118. Staff seed cannot create (`"Not allowed"`). Click-proof in step 5.

### In plain language

The kitchen can now take a name, a phone, and a free hour and lock it as a confirmed game. The owner page still has no button that calls that kitchen.

---

## Chapter 76 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-09 step 5: /owner Book a slot

**When:** 2026-09-11

**What:** `/owner` Book a slot if `"bookings.create"`: GET `bookOn` (default today Beirut) lists computed slots via `getDayAvailability` + `listApprovedOccupied`. Available hours: name + phone Ã¢ÂÂ `submitCreateOwnerBooking`. Taken hours: time only. Staff: no section. No Prisma / no `tenantId`. No cancel buttons.

**Why:** SPEC-09 step 5 / BR-13Ã¢ÂÂ14. Next 16: `searchParams` Promise (`page.js`); `<form action={Server Action}>` + `redirect` outside try/catch. Occupied is an argument Ã¢ÂÂ Venue does not import Booking.

**Files:** `src/app/owner/page.tsx`; `src/app/owner/actions.ts`.

**Relation:** Collect stays a second tap on Due bookings. This period / pending / expenses unchanged.

**How to verify:** `npm test` Ã¢ÂÂ 20 / 118. Log in `owner@ahmad` Ã¢ÂÂ Book a free hour; Studio APPROVED OWNER; public that hour occupied; `staff@ahmad` no Book form.

### In plain language

The owner can now tap a free hour, type who called, and the hour is taken. Staff do not see that form. Please try it in the browser.

---

## Chapter 77 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-09 click-proof

**When:** 2026-09-11

**What:** Owner confirmed Book on `/owner` (`Owner booking created 6f408d92-77f1-4a76-9edb-5790b42d9eb6`, then `705347a0-4282-43ea-a19e-6a6a789c978b`). Collect on the second (`Payment collected cmtwz2de5000l14l268dj876t`). Hour occupied; staff have no Book form.

**Why:** SPEC-09 whole-slice acceptance / BR-13Ã¢ÂÂ14.

**Files:** none this chapter (code was step 5). SPEC acceptance checkmarks in [SPEC-09](./specs/SPEC-09-owner-create-booking.md).

**Relation:** Closes owner-create. Cancel next (BR-26). Overpay warning parked.

**How to verify:** Studio those booking ids: `APPROVED`, `OWNER`, requester participant.

### In plain language

The owner booked a caller from the phone in the browser. The hour is taken. This slice is done.

---

## Chapter 78 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-10 written (not started in code)

**When:** 2026-09-11

**What:** Fast-forward `main` `40e3ece` Ã¢ÂÂ `5d5c77b` (SPEC-09). Branched `feature/spec-10-cancel-booking`. Wrote numbered cancel slice: owner (or `"bookings.cancel"`) flips **APPROVED Ã¢ÂÂ CANCELLED**. No refund / ledger write. No hours-before-kickoff check (BR-26). Waitlist UI / WhatsApp / player cancel / no-show / `tenant.settings` out. Confirmed list shows **all** APPROVED (including paid) so Cancel is reachable after Collect.

**Why:** [SPEC-10](./specs/SPEC-10-cancel-booking.md) implements BR-26 / RULE-1. Exclusion already ignores non-APPROVED (DR-002 ÃÂ§2.8). Ledger stays append-only Ã¢ÂÂ cash IN is not reversed this slice (DR-002 ÃÂ§2.21). `"bookings.cancel"` default deny, not reused from create/approve.

**Files:** `docs/specs/SPEC-10-cancel-booking.md`; `docs/README.md`.

**Relation:** Book / collect / This period stay as they are. Refunds and waitlist are later SPECs.

**How to verify:** Read the spec. Confirm or correct the pins (APPROVED only, no refund, paid games still listed so they can be cancelled, no player cancel). Then OK step 1.

### In plain language

The next instruction sheet: the owner taps Cancel on a confirmed game and the hour is free again. Money already collected is left as-is until a later refund slice. We have not built that yet Ã¢ÂÂ only the sheet.

---

## Chapter 79 Ã¢ÂÂ 2026-09-11 Ã¢ÂÂ SPEC-10 step 1: bookings.cancel flag

**When:** 2026-09-11

**What:** `"bookings.cancel"` (`BOOKINGS_CANCEL`) on `can()`. OWNER always yes. STAFF default deny. `"bookings.approve": true` does **not** imply cancel.

**Why:** SPEC-10 step 1 / DR-003. Cancelling a confirmed game is not the same permission as approving a public request or booking a caller.

**Files:** `src/modules/access/domain/can.ts`; `test/modules/access/domain/can.test.ts`.

**Relation:** No cancel domain/use case/UI yet (step 2 is `assertApprovedForCancel`). Create / approve / collect / expense / reports flags unchanged.

**How to verify:** `npm test` Ã¢ÂÂ 20 suites / 122 tests.

### In plain language

Staff still cannot cancel a confirmed game unless we later tick a box. The owner page still has no Cancel button.

---

## Chapter 80 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ SPEC-10 step 2: assertApprovedForCancel

**When:** 2026-09-12

**What:** `assertApprovedForCancel` Ã¢ÂÂ only `APPROVED` may be cancelled. PENDING / REJECTED / CANCELLED / NO_SHOW Ã¢ÂÂ `"Only a confirmed booking can be cancelled"`. Pure domain, no Prisma.

**Why:** SPEC-10 step 2 / BR-26. Same kitchen as `assertPendingForDecision`: status gate lives in `domain/`, not the query.

**Files:** `src/modules/booking/domain/decision.ts`; `test/modules/booking/domain/decision.test.ts`.

**Relation:** No DB update yet (step 3 is `setApprovedCancelled`). Access flag exists (step 1). `/owner` still has no Cancel.

**How to verify:** `npm test` Ã¢ÂÂ 20 suites / 127 tests.

### In plain language

The kitchen now knows Ã¢ÂÂyou can only cancel a confirmed game.Ã¢ÂÂ Nothing is written to the database yet.

---

## Chapter 81 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ SPEC-10 step 3: setApprovedCancelled

**When:** 2026-09-12

**What:** `setApprovedCancelled` Ã¢ÂÂ `booking.updateMany` where `id` + `status = APPROVED` Ã¢ÂÂ `CANCELLED`. `count !== 1` Ã¢ÂÂ `"Booking not found"`. No `tenantId` argument (guard). Not raw SQL: generated Client still has `updateMany` on Booking; `during` is Unsupported, status is not (same as `setPendingStatus`).

**Why:** SPEC-10 step 3 / DR-002 ÃÂ§2.8. CANCELLED drops out of exclusion without touching Payment or Ledger.

**Files:** `src/modules/booking/infrastructure/bookings.ts`.

**Relation:** Use case (step 4) will call this inside `$transaction`. `/owner` still has no Cancel.

**How to verify:** `npm test` Ã¢ÂÂ 20 / 127. Click-proof in step 5: Studio CANCELLED; a PENDING id fails.

### In plain language

We can now flip a confirmed row to cancelled in the database. The owner page still has no button that does that.

---

## Chapter 82 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ SPEC-10 step 4: cancelBooking

**When:** 2026-09-12

**What:** `cancelBooking` Ã¢ÂÂ `"bookings.cancel"` **before** `$transaction`; load via `findBookingForDecision`; `assertApprovedForCancel`; `setApprovedCancelled`. Log after commit. No Payment / Ledger / WhatsApp.

**Why:** SPEC-10 step 4 / BR-26 / SPEC-03 transaction guide (auth before tx; session is `platformDb`).

**Files:** `src/modules/booking/application/cancel-booking.ts`.

**Relation:** `/owner` still has no Cancel (step 5). Collect stays a separate use case.

**How to verify:** `npm test` Ã¢ÂÂ 20 / 127. Staff seed cannot cancel (`"Not allowed"`). Click-proof in step 5.

### In plain language

The kitchen can now cancel a confirmed game. The owner page still has no button that calls that kitchen.

---

## Chapter 83 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ SPEC-10 step 5: /owner Cancel

**When:** 2026-09-12

**What:** `/owner` **Confirmed bookings** = all APPROVED (paid included). Collect only if remaining > 0 and `payments.collect`. Cancel if `bookings.cancel`. Server Action: reuse `parseBookingDecision` Ã¢ÂÂ `cancelBooking` Ã¢ÂÂ `redirect` outside try/catch (Next redirect.md). Preserve `tenant` + `bookOn`. No Prisma / no `tenantId`. No waitlist / refund fields.

Local Next docs: `forms.md` Ã¢ÂÂ `<form action>` receives FormData; `redirect.md` Ã¢ÂÂ `redirect` outside try/catch.

**Why:** SPEC-10 step 5 / BR-26. Paid games must stay on the list so Cancel is reachable after Collect.

**Files:** `src/app/owner/page.tsx`; `src/app/owner/actions.ts`; `src/modules/booking/application/list-due-bookings.ts`.

**Relation:** Book / pending / expenses / This period unchanged. No cancel on PENDING.

**How to verify:** `npm test` Ã¢ÂÂ 20 / 127. Log in `owner@ahmad` Ã¢ÂÂ Cancel a confirmed hour; Studio CANCELLED; public that hour requestable; `staff@ahmad` no Cancel. Could not click in a browser from this session (no browser tools); GET `/owner?tenant=ahmad` compiled (307 to login).

### In plain language

The owner page now lists confirmed games, including paid ones, with a Cancel button. Staff do not see that button. Please try it in the browser.

---

## Chapter 84 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ SPEC-10 click-proof

**When:** 2026-09-12

**What:** Owner cancelled the paid phone-call booking (`Booking cancelled 705347a0-4282-43ea-a19e-6a6a789c978b`, previously collected `cmtwz2de5000l14l268dj876t`) then the unpaid one (`Booking cancelled 6f408d92-77f1-4a76-9edb-5790b42d9eb6`). No Payment/Ledger write on cancel. Staff have no Cancel button.

**Why:** SPEC-10 whole-slice acceptance / BR-26.

**Files:** none this chapter (code was step 5). SPEC acceptance checkmarks in [SPEC-10](./specs/SPEC-10-cancel-booking.md).

**Relation:** Closes cancel. Waitlist UI next (BR-29). Refunds / no-show / overpay warning parked.

**How to verify:** Studio those booking ids: `CANCELLED`. Collect payment `cmtwz2de5000l14l268dj876t` still IN.

### In plain language

The owner cancelled a confirmed game in the browser. The hour is free again. Cash already collected was left as-is. This slice is done.

---

## Chapter 85 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ SPEC-11 written (not started in code)

**When:** 2026-09-12

**What:** Wrote numbered waitlist slice: `/owner` lists people with `slot_interests` on a **free, not-ended** window; **Notify** is `wa.me` + prefilled English Ã¢ÂÂslot availableÃ¢ÂÂ (BR-30 / BR-69). No Cloud API, no interest delete, no other BR-71 templates. Stayed on `feature/spec-10-cancel-booking` because SPEC-10 is still uncommitted (cannot FF-merge `main`).

**Why:** [SPEC-11](./specs/SPEC-11-waitlist.md) implements BR-29 / BR-30 / DR-002 ÃÂ§2.13. Interests already written on auto-reject (SPEC-05). Notification module owns `wa.me` (DR-001); Booking never formats WhatsApp. No new `can()` flag Ã¢ÂÂ listing is not a mutation.

**Files:** `docs/specs/SPEC-11-waitlist.md`; `docs/README.md`.

**Relation:** Cancel stays as SPEC-10. Public page has no waitlist. Refunds / no-show / Arabic parked.

**How to verify:** Read the spec. Confirm or correct the pins (show only free windows, `wa.me` not an API, staff may see the list, do not delete interests). Then OK step 1.

### In plain language

The next instruction sheet: after a game is cancelled, the owner sees who wanted that hour and can open WhatsApp with a ready-made message. We have not built that yet Ã¢ÂÂ only the sheet.

---

## Chapter 86 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ SPEC-11 step 1: WhatsApp link + message

**When:** 2026-09-12

**What:** `whatsAppHref` Ã¢ÂÂ Lebanon digits to `https://wa.me/<e164>?text=` (`03Ã¢ÂÂ¦` Ã¢ÂÂ `961Ã¢ÂÂ¦`; already-`961` unchanged). Empty/spaces/too-short Ã¢ÂÂ `"Phone cannot be used for WhatsApp"`. `slotAvailableMessage` English: stadium, pitch, local startÃ¢ÂÂend. No send. Notification does not import Booking.

**Why:** SPEC-11 step 1 / BR-30 / BR-69 / DR-001 (Notification owns WhatsApp links).

**Files:** `src/modules/notification/domain/whatsapp-link.ts`; `test/modules/notification/domain/whatsapp-link.test.ts`.

**Relation:** No waitlist query/UI yet (step 2 is the open-window helper). `/owner` unchanged.

**How to verify:** `npm test` Ã¢ÂÂ 21 suites / 136 tests.

### In plain language

We can now turn a Lebanese phone and a sentence into a WhatsApp link. The owner page still has no Waitlist.

---

## Chapter 87 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ SPEC-11 step 2: isWaitlistWindowOpen

**When:** 2026-09-12

**What:** `isWaitlistWindowOpen` Ã¢ÂÂ window is open if `end > now` and no occupied range on that pitch overlaps (reuse `overlaps()`). Caller passes APPROVED only; CANCELLED is omitted so the hour is open.

**Why:** SPEC-11 step 2 / BR-29 / DR-002 ÃÂ§2.13. Occupied is an argument Ã¢ÂÂ domain does not read Prisma.

**Files:** `src/modules/booking/domain/waitlist.ts`; `test/modules/booking/domain/waitlist.test.ts`.

**Relation:** No DB list yet (step 3). WhatsApp helpers exist (step 1). `/owner` still has no Waitlist.

**How to verify:** `npm test` Ã¢ÂÂ 22 suites / 140 tests.

### In plain language

The kitchen now knows Ã¢ÂÂthis hour is free again and not in the past.Ã¢ÂÂ Nothing is loaded from the database yet.

---

## Chapter 88 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ SPEC-11 step 3: listSlotInterestsWithPeople

**When:** 2026-09-12

**What:** `listSlotInterestsWithPeople` Ã¢ÂÂ `$queryRaw` join Pitch + Person, `lower`/`upper(during)`, `tenantId` from ALS (extension does not stamp raw SQL). No `tenantId` argument. No `SlotInterest.create` (`during` still Unsupported). Open vs occupied stays domain.

**Why:** SPEC-11 step 3 / DR-002 ÃÂ§2.13. Same raw pattern as Booking lists.

**Files:** `src/modules/booking/infrastructure/bookings.ts`.

**Relation:** Use case (step 4) will filter open windows and attach `wa.me`. `/owner` still has no Waitlist.

**How to verify:** `npm test` Ã¢ÂÂ 22 / 140. Click-proof in step 5: Ahmad rows only when ALS is Ahmad.

### In plain language

We can now load Ã¢ÂÂwho wanted which hourÃ¢ÂÂ for this stadium. The owner page still has no Waitlist.

---

## Chapter 89 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ SPEC-11 step 4: listOpenWaitlist

**When:** 2026-09-12

**What:** `listOpenWaitlist` Ã¢ÂÂ membership else `"Not allowed"` (no extra `can()`); interests + `listApprovedRanges`; `isWaitlistWindowOpen`; dedupe person per window; group soonest first. `wa.me` from Notification + tenant name (`getCurrentTenant`). Bad phone Ã¢ÂÂ no href, still listed. No `$transaction`. No Payment. Does not log phones.

**Why:** SPEC-11 step 4 / BR-29 / BR-30 / DR-001 (Notification owns WhatsApp links).

**Files:** `src/modules/booking/application/list-open-waitlist.ts`.

**Relation:** `/owner` still has no Waitlist (step 5). Cancel unchanged.

**How to verify:** `npm test` Ã¢ÂÂ 22 / 140. Click-proof in step 5: after cancel of an hour with a loser, groups appear; still-APPROVED hours do not.

### In plain language

The kitchen can now assemble Ã¢ÂÂthese people wanted this free hour, here is the WhatsApp link.Ã¢ÂÂ The owner page still has no Waitlist.

---

## Chapter 90 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ SPEC-11 step 5: /owner Waitlist

**When:** 2026-09-12

**What:** `/owner` **Waitlist** from `listOpenWaitlist`. Group: pitch + local range; people name + phone; **Notify** is `<a href={wa.me}>` (`target="_blank"` `rel="noopener noreferrer"`), not a Server Action. Empty: Ã¢ÂÂNo waitlist.Ã¢ÂÂ No Prisma / no `tenantId`. Public page unchanged.

Local Next docs: `page.md` Ã¢ÂÂ Server Component, `searchParams` Promise. GET render; no `redirect` for Notify.

**Why:** SPEC-11 step 5 / BR-29 / BR-30 / BR-69.

**Files:** `src/app/owner/page.tsx`.

**Relation:** Book / cancel / collect / expenses / This period unchanged.

**How to verify:** `npm test` Ã¢ÂÂ 22 / 140. Two public requests same hour Ã¢ÂÂ approve one Ã¢ÂÂ cancel Ã¢ÂÂ Waitlist shows the loser; Notify is `wa.me`. Could not click from this session (no browser tools); GET `/owner?tenant=ahmad` compiled (307 to login).

### In plain language

The owner page now lists who wanted a freed hour, with a Notify link to WhatsApp. Please try it in the browser.

---

## Chapter 91 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ SPEC-11 click-proof

**When:** 2026-09-12

**What:** Three public requests same hour (`feda75a4-Ã¢ÂÂ¦`, `66c81d4a-Ã¢ÂÂ¦`, `7a491948-Ã¢ÂÂ¦`). Approve the first; the other two became REJECTED + SlotInterest (`p2` / `71234234`, `p3` / `71345345`). Waitlist empty while APPROVED. Cancel `feda75a4-07ed-46fc-a1c0-893dc05beb8e` Ã¢ÂÂ Waitlist showed those people. Notify is `wa.me` (no new DB row).

**Why:** SPEC-11 whole-slice acceptance / BR-29 / BR-30 / BR-69.

**Files:** none this chapter (code was step 5). SPEC acceptance checkmarks in [SPEC-11](./specs/SPEC-11-waitlist.md).

**Relation:** Closes waitlist UI. Arabic / no-show / other BR-71 templates next as product asks. Refunds / overpay warning parked.

**How to verify:** Studio those interest ids on pitch `cmtw9vxs80001cwl2ufvexnjy`, window 13:00Ã¢ÂÂ14:00Z; booking `feda75a4-Ã¢ÂÂ¦` is `CANCELLED`.

### In plain language

After a confirmed game was cancelled, the owner saw who had wanted that hour and could open WhatsApp with a ready-made message. This slice is done.

---

## Chapter 92 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ SPEC-12 written (not started in code)

**When:** 2026-09-12

**What:** Branched `feature/spec-12-error-handling` from `main`. Wrote DR-004 + numbered error-handling slice: `DomainError` / `UnexpectedError`, English dictionary by key, logger context, actions never throw uncaught (except `redirect`), `?error=<key>` banners, Next `error.tsx` (`retry`, not `reset`). Public request currently has no try/catch Ã¢ÂÂ that is the crash. No next-intl, no `useActionState` rewrite, no wrap-every-Prisma.

**Why:** [DR-004](./decisions/DR-004-error-handling.md), [SPEC-12](./specs/SPEC-12-error-handling.md), RULE-9 / RULE-10. Dev sees stacks in `logs/`; owner sees a short line or a retry screen.

**Files:** `docs/decisions/DR-004-error-handling.md`; `docs/specs/SPEC-12-error-handling.md`; `docs/README.md`.

**Relation:** Does not change cancel/waitlist/collect rules. Arabic later consumes the same keys.

**How to verify:** Read the spec. Confirm or correct the pins (keys not UI strings at throw sites; redirect + key instead of client forms this slice; `retry` from local Next docs). Then OK step 1.

### In plain language

The next instruction sheet: you still get everything in the log file; the owner gets Ã¢ÂÂthat hour has already ended,Ã¢ÂÂ not a broken screen. We have not built that yet Ã¢ÂÂ only the sheet.

---

## Chapter 93 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ SPEC-12 step 1: DomainError + dictionary

**When:** 2026-09-12

**What:** `DomainError` carries a message key. `UnexpectedError` wraps `unknown` as `cause`. English catalog + `errorMessage(key)` (unknown / legacy `1` Ã¢ÂÂ generic). No UI, no action changes.

**Why:** SPEC-12 step 1 / DR-004. Copy is not at the throw site so Arabic can reuse keys later.

**Files:** `src/lib/errors.ts`; `src/lib/error-messages.ts`; `test/lib/errors.test.ts`.

**Relation:** Existing `throw new Error("Ã¢ÂÂ¦")` still in place (step 4). Logger unchanged (step 2).

**How to verify:** `npm test` Ã¢ÂÂ 23 suites / 144 tests.

### In plain language

We now have two kinds of error in code: Ã¢ÂÂthis can happenÃ¢ÂÂ (a key) and Ã¢ÂÂthis is a bugÃ¢ÂÂ (keep the original). Nothing on the ownerÃ¢ÂÂs screen has changed yet.

---

## Chapter 94 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ SPEC-12 step 2: logger context

**When:** 2026-09-12

**What:** `logger.error` / `info` accept optional `{ useCase, tenantId }` appended on the line (`formatLogContext`). Existing two-argument calls unchanged. No secrets on the type.

**Why:** SPEC-12 step 2 / DR-004. A stack in `logs/` should name the use case and stadium.

**Files:** `src/lib/logger.ts`; `test/lib/logger.test.ts`.

**Relation:** Call sites still omit context (step 5). No error.tsx yet (step 3).

**How to verify:** `npm test` Ã¢ÂÂ 24 suites / 146 tests.

### In plain language

The log line can now say which kitchen and which stadium, next to the stack. Screens are still unchanged.

---

## Chapter 95 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ SPEC-12 step 3: error.tsx + global-error.tsx

**When:** 2026-09-12

**What:** `error.tsx` and `global-error.tsx` Ã¢ÂÂ Client Components. Local Next error.md: **`retry`**, not `reset`. `global-error` includes `<html>` + `<body>`. English + Arabic retry. Digest in `<code>` if present. No `error.message`, no logger, no Prisma.

**Why:** SPEC-12 step 3 / DR-004. Unexpected render must not be a blank Next crash page.

**Files:** `src/app/error.tsx`; `src/app/global-error.tsx`.

**Relation:** Domain still throws English strings (step 4). Public Request still has no try/catch (step 6).

**How to verify:** `npm test` Ã¢ÂÂ 24 / 146. JSX has no `error.message`.

### In plain language

If the page blows up, the owner now sees Ã¢ÂÂtry againÃ¢ÂÂ in English and Arabic, not a stack. Forms can still crash until later steps.

---

## Chapter 96 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ SPEC-12 step 4: DomainError at throw sites

**When:** 2026-09-12

**What:** Domain + known infra product throws now use `DomainError("Ã¢ÂÂ¦key")`. `.message` is the key, not English. `lib/money.ts` and `lib/db.ts` tenant-scope throws left as-is. Application use cases still match English `EXPECTED` sets (step 5).

**Why:** SPEC-12 step 4 / DR-004. Copy lives in `error-messages.ts` so throw sites stay keys.

**Files:** `src/modules/booking/domain/decision.ts`; `src/modules/booking/domain/offered-slot.ts`; `src/modules/payment/domain/collect.ts`; `src/modules/notification/domain/whatsapp-link.ts`; `src/modules/expense/domain/occurred-at.ts`; `src/modules/ledger/domain/period.ts`; `src/modules/booking/infrastructure/bookings.ts`; matching Jest under `test/modules/`.

**Relation:** Use cases still treat keys as unexpected until step 5. Public Request still has no try/catch (step 6). Payment still does not import Booking.

**How to verify:** `npm test` Ã¢ÂÂ 24 suites / 146 tests. Grep `src/modules/**/domain` and `infrastructure` for `throw new Error` Ã¢ÂÂ none.

### In plain language

The kitchen now throws a code like Ã¢ÂÂthat hour ended,Ã¢ÂÂ not a sentence. The owner still sees the old banners until we teach the front desk (use cases and forms) those codes.

---

## Chapter 97 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ SPEC-12 step 5: use cases wrap unexpected

**When:** 2026-09-12

**What:** Mutating use cases rethrow `DomainError` (no error log). Exclusion Ã¢ÂÂ `booking.slot_unavailable` (error-level collision log). Else `logger.error` with `useCase` + `safeTenantId()` (outside `$transaction`) and `UnexpectedError`. List/read `Not allowed` Ã¢ÂÂ `access.not_allowed`. Login invalid Ã¢ÂÂ `access.invalid_login`. Actions still match English (step 6).

**Why:** SPEC-12 step 5 / DR-004. Use-case catch-all is the boundary; do not wrap every Prisma call. Domain is not a bug.

**Files:** `src/lib/use-case-error.ts`; `src/lib/tenant-context.ts` (`safeTenantId`); approve/reject/create/cancel/collect/public-request/expense/login/set-rate; list/read `Not allowed`; `reject-overlapping-pending`; `get-day-availability`.

**Relation:** Does not import Booking from Payment. `error.tsx` still unused for form domain failures until step 6 wraps public Request. Actions still `?error=1`.

**How to verify:** `npm test` Ã¢ÂÂ 24 / 146. Grep `src/modules/**/application` for `throw error` / `throw new Error` Ã¢ÂÂ none. Catch-alls call `rethrowUnexpected`.

### In plain language

The kitchen now says Ã¢ÂÂthis is a normal noÃ¢ÂÂ vs Ã¢ÂÂthis is a bug Ã¢ÂÂ write it in the log with the stadium name.Ã¢ÂÂ The forms still show a generic Ã¢ÂÂerror=1Ã¢ÂÂ until the next step.

---

## Chapter 98 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ SPEC-12 step 6: action banners (`?error=<key>`)

**When:** 2026-09-12

**What:** Owner, login, and public Server Actions catch (except `redirect` Ã¢ÂÂ local redirect.md: redirect throws) Ã¢ÂÂ `?error=<key>`. `DomainError` Ã¢ÂÂ its key; Zod Ã¢ÂÂ `form.invalid`; unexpected Ã¢ÂÂ `error.generic` (already logged in the use case). Pages print `errorMessage(key)`. Public Request now has try/catch. Legacy `error=1` still maps to generic.

**Why:** SPEC-12 step 6 / DR-004 / RULE-9. Stay on the page with a dictionary line, not a Next crash. Keys stay for later Arabic / `useActionState`.

**Files:** `src/lib/use-case-error.ts` (`actionErrorKey`); `src/app/owner/actions.ts`; `src/app/login/actions.ts`; `src/app/request-slot.ts`; `src/app/owner/page.tsx`; `src/app/login/page.tsx`; `src/app/page.tsx`; `test/lib/use-case-error.test.ts`.

**Relation:** Pages still have no Prisma / no `tenantId`. Payment still does not import Booking. `error.tsx` is only for unexpected render.

**How to verify:** `npm test` Ã¢ÂÂ 25 / 149. Public Request on 2026-09-11 16:00 Ahmad Pitch A1 Ã¢ÂÂ 303 `/?tenant=ahmad&date=2026-09-11&error=booking.slot_ended` and the page shows Ã¢ÂÂThat hour has already ended.Ã¢ÂÂ Bad login Ã¢ÂÂ `error=access.invalid_login`. No crash overlay.

### In plain language

If the hour already ended, the public page stays up and says so in English. The log file is quiet for that. A real bug still goes to the retry screen and the log.

---

## Chapter 99 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ shadcn/ui + Tailwind v4 tooling layer

**When:** 2026-09-12

**What:** Added shadcn/ui on top of the existing Next.js 16 + Tailwind v4 app. Did **not** run `tailwindcss init -p` Ã¢ÂÂ v4 is already wired via `@tailwindcss/postcss` and `postcss.config.mjs` (no `tailwind.config.ts`). `npx shadcn@latest init` with New York / Neutral / CSS variables / TypeScript. `rtl: true` so later components use logical properties. Smoke-tested with `npx shadcn@latest add button`.

**Why:** UI tooling layer only. No SPEC. Do not mix this with booking/payment/Prisma.

**Files:** `components.json`; `src/app/globals.css`; `src/lib/utils.ts`; `src/components/ui/button.tsx`; `package.json` / `package-lock.json`. Layout, routes, and Prisma untouched.

**Relation:** `src/components/ui` must not import `src/modules/*`. Pages still do not import Prisma. Payment still does not import Booking.

**How to verify:** `components.json` has `"rsc": true` and `"cssVariables": true`. `src/components/ui/button.tsx` exists. `npm run build` compiles; typecheck still fails on pre-existing `create-owner-booking.ts` / `request-public-slot.ts` / `persons.ts` (not this slice).

### In plain language

The design kit is on the shelf. The kitchen (bookings, money, database) did not change. We can now drop in buttons and forms without rewriting Tailwind from scratch.

---

## Chapter 100 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ visual system tokens + owner Login

**When:** 2026-09-12

**What:** One shared shadcn token set: Carbon `#1a1d20`, Off-White `#f8f9fa`, Volt `#10b981` (primary + focus ring, sparse), Athletic Slate `#495057`. Modest radius `0.5rem`. No OS auto-dark content flip; `--sidebar` stays Carbon for later owner chrome. Fonts: Noto Kufi Arabic (headings), IBM Plex Sans Arabic (body), IBM Plex Mono (money/times). Button/Input default height `h-11` (44px). Added Card, Badge, Input, Label. Owner Login restyled with those pieces; Volt only on submit. `submitLogin` unchanged.

**Why:** Visual system plan (calm / utilitarian). Not a SPEC. RTL logical-property rules untouched.

**Files:** `src/app/globals.css`; `src/app/layout.tsx`; `src/components/ui/button.tsx`; `src/components/ui/input.tsx`; `src/components/ui/card.tsx`; `src/components/ui/badge.tsx`; `src/components/ui/label.tsx`; `src/app/login/page.tsx`.

**Relation:** `src/components/ui` must not import `src/modules/*`. Login still has no Prisma / no `tenantId`. Payment still does not import Booking.

**How to verify:** `http://localhost:3000/login?tenant=ahmad` Ã¢ÂÂ Card, Volt Log in button, Plex/Kufi/Mono on `<html>`. `?error=access.invalid_login` shows Ã¢ÂÂInvalid login.Ã¢ÂÂ CSS `--primary: #10b981`. Owner schedule and public booking pages not restyled.

### In plain language

The paint is mixed once in the CSS file: dark carbon text, off-white paper, a little pitch-green for the main button. Login now looks like that. The rest of the stadium screens still wear the old clothes until we dress them the same way.

---

## Chapter 101 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ Login card actually centered

**When:** 2026-09-12

**What:** Login was a full-width strip stuck to the top (`min-h-full` never filled the viewport). Main is now `min-h-svh` + column + center. Card `max-w-sm`. Title is Ã¢ÂÂLog inÃ¢ÂÂ; stadium name stays tenant-authored. Same tokens, same `submitLogin`.

**Why:** Follow-up to ch.100. Colors were right; layout was not.

**Files:** `src/app/login/page.tsx`; `src/app/layout.tsx` (`min-h-svh` on body).

**Relation:** No Prisma. No owner/public restyle.

**How to verify:** `/login?tenant=ahmad` Ã¢ÂÂ narrow card in the middle of the screen, not a banner at the top.

### In plain language

The login box now sits in the middle of the page like a form, not a stripe glued to the ceiling.

---

## Chapter 102 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ owner Today + restyle `/owner`

**When:** 2026-09-12

**What:** Owner page uses the Carbon/Volt tokens. **Today** (pending + confirmed) is first and glanceable: cards, `font-mono` for times/money/phones, 44px Approve/Collect. Other sections (book, waitlist, period, rate, expenses) same kit, stacked fields. Actions and hidden query fields unchanged.

**Why:** Visual system, owner outdoor density. Not a SPEC.

**Files:** `src/app/owner/page.tsx`

**Relation:** Page still has no Prisma / no `tenantId`. Payment still does not import Booking.

**How to verify:** `/owner?tenant=ahmad` after login. Today is at the top. Approve is Volt; Reject/Cancel outline. Public booking page still unstyled.

### In plain language

The owner phone screen now starts with Ã¢ÂÂwho is waitingÃ¢ÂÂ and Ã¢ÂÂwho is on the pitch,Ã¢ÂÂ in the same colors as login. The kitchen still does the same jobs; it just stopped looking like a notepad.

---

## Chapter 103 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ custom Select and Calendar on owner

**When:** 2026-09-12

**What:** Owner native `<select>` and `type="date"` are gone. shadcn Select, Popover, and Calendar are in `src/components/ui/`. Thin client **DateField** and **SelectField** keep a hidden `<input name>` so GET (`bookOn`, `from`, `to`) and Server Actions (`occurredOn`, `category`, `view`) still submit the same strings. Select trigger is `h-11`. Calendar uses `en-GB` + Latin numerals so the grid is Western digits. `button.tsx` stays `h-11` (do not re-run shadcn add with `--overwrite` on it). Public booking is unchanged this slice.

**Why:** Visual system Ã¢ÂÂ OS date pickers and dropdowns broke the Carbon/Volt look. Not a SPEC. Actions and Prisma stay put.

**Files:** `src/components/ui/select.tsx`; `src/components/ui/popover.tsx`; `src/components/ui/calendar.tsx`; `src/components/ui/date-field.tsx`; `src/components/ui/select-field.tsx`; `src/app/owner/page.tsx`; `package.json` / lockfile (`date-fns`, `react-day-picker`). `src/app/owner/actions.ts` untouched.

**Relation:** `src/components/ui` must not import `src/modules/*`. Owner page still has no Prisma / no `tenantId`. Payment still does not import Booking.

**How to verify:** `/owner?tenant=ahmad` after login. Day / From / To / When open a calendar popover (mono `yyyy-mm-dd`). View and Category are the custom dropdown. Show slots / Show / Record expense still post or GET the same field names. Public `?date=` is still the native control until the next public restyle.

### In plain language

The owner forms no longer pop up the phoneÃ¢ÂÂs own calendar and menu. They use our green-ring picker and list instead, but they still send the same dates and category codes to the kitchen.

---

## Chapter 104 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ public booking restyle

**When:** 2026-09-12

**What:** Public `/` uses the same Carbon/Volt kit as login/owner. Day is **DateField** (GET `name="date"`, `yyyy-mm-dd`), not a native date control. Slot cards are the same tokens, slightly tighter padding than owner. Name/tel stay Input; Request is Volt. Hidden fields for the Server Action are unchanged (`pitchId`, `start`, `end`, `date`, `tenant`).

**Why:** Visual system Ã¢ÂÂ public was still `system-ui`. Calendar plan said reuse DateField for `?date=`. Not a SPEC.

**Files:** `src/app/page.tsx`. `src/app/request-slot.ts` untouched.

**Relation:** Page still has no Prisma / no `tenantId`. Payment still does not import Booking. `src/components/ui` still does not import `src/modules/*`.

**How to verify:** `/?tenant=ahmad` Ã¢ÂÂ heading, calendar Day, Show slots, Request on a free hour. `?date=2026-09-13` still lists that civil day. Success still Ã¢ÂÂRequest receivedÃ¢ÂÂ; `?error=` still the dictionary line.

### In plain language

Walk-up booking now wears the same clothes as the owner phone: a green-ring day picker and stacked hour cards. Asking for an hour still sends the same name, phone, and times to the kitchen.

---

## Chapter 105 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ UX craft (states, hierarchy, toast)

**When:** 2026-09-12

**What:** One feedback pattern: Server Actions still redirect; success adds `ok=` (public `requested` replaces `received=1`); owner/public **FlashToast** + sonner, then strips `ok`/`error` from the URL. Login errors stay in-card. Empty lists use a titled **EmptyState** (text only, no new action icons). Submit buttons use `useFormStatus` (Next forms.md). Skeleton `loading.tsx` on `/` and `/owner` (login has its own so it does not inherit the hours skeleton). Today has counts and Due/Paid; later owner headings are quieter; period **Difference** reads first. Public date is a filter; hours + Request are the job. `error.tsx` / `global-error` use tokens. Document title is Ã¢ÂÂStadiumsÃ¢ÂÂ.

**Why:** Craft pass after tokens/restyle (ch.99Ã¢ÂÂ104). Not a SPEC. Use cases and Prisma unchanged; thin actions only add `ok=` on the existing success redirect.

**Files:** `src/components/ui/sonner.tsx`, `skeleton.tsx`, `empty-state.tsx`, `submit-button.tsx`, `flash-toast.tsx`; `src/lib/success-messages.ts`; `test/lib/success-messages.test.ts`; `src/app/layout.tsx`; `src/app/loading.tsx`; `src/app/owner/loading.tsx`; `src/app/login/loading.tsx`; `src/app/login/page.tsx`; `src/app/owner/page.tsx`; `src/app/owner/actions.ts`; `src/app/page.tsx`; `src/app/request-slot.ts`; `src/app/error.tsx`; `src/app/global-error.tsx`; `package.json` (sonner).

**Relation:** `src/components/ui` must not import `src/modules/*`. Pages still have no Prisma / no `tenantId`. Payment still does not import Booking.

**How to verify:** `/?tenant=ahmad` Ã¢ÂÂ Hours, not a duplicate Ã¢ÂÂSchedule forÃ¢ÂÂ line; Request then a toast Ã¢ÂÂRequest received.Ã¢ÂÂ `/login?tenant=ahmad` Ã¢ÂÂ in-card error, Log in pending. `/owner` after login Ã¢ÂÂ Pending ÃÂ· n, empty blocks, Approve toast, Collect still Volt, mixed secondary. Title Ã¢ÂÂStadiumsÃ¢ÂÂ.

### In plain language

The screens now tell you when something worked (a small toast), when a list is empty on purpose, and which button matters. The kitchen still does the same jobs; the waiter just stopped going silent after you tap.

---

## Chapter 106 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ Scoped Suspense (keep GET, no full-page skeleton)

**When:** 2026-09-12

**What:** Route `loading.tsx` files on `/`, `/owner`, and `/login` are gone. Next `loading.md`: that file wraps the whole `page.js`, so header + date picker unmounted on every GET and Server Action. Pages now await only tenant / searchParams / membership, then return the shell (title, GET date form). Hours, Today, Book slots, and later owner lists are child RSCs inside `<Suspense>` with list skeletons. GET forms still submit `date` / `bookOn` as `yyyy-mm-dd`. Actions unchanged (`ok=` / `error=` only). No `router.push`, no client list state.

**Why:** Show hours / Show slots / Approve felt like a full reload. Keep Server Components and query params; stream lists. Local Next 16 `loading.md`: nested `<Suspense>` is the supported alternative to `loading.js`.

**Files:** deleted `src/app/loading.tsx`, `src/app/owner/loading.tsx`, `src/app/login/loading.tsx`; `src/app/page.tsx`; `src/app/public-hours.tsx`; `src/app/list-skeletons.tsx`; `src/app/owner/page.tsx`; `src/app/owner/today.tsx`; `src/app/owner/book-slots.tsx`; `src/app/owner/rest.tsx`; `src/app/owner/shared.tsx`.

**Relation:** Children live under `src/app/`. `src/components/ui` still must not import `src/modules/*`. No Prisma / use-case / module-boundary changes.

**How to verify:** `/?tenant=ahmad` Ã¢ÂÂ Day + Show hours stay; Hours list skeletons then slots. `/login?tenant=ahmad` Ã¢ÂÂ login card only (no hours skeleton). `/owner` after login Ã¢ÂÂ header + Book day stay; Today / slots skeleton then fill; Approve keeps the header.

### In plain language

Picking a day used to blank the whole screen because the waiter was waiting in the lobby. Now the date field stays on the counter while only the hours list walks to the kitchen.

---

## Chapter 107 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ SPEC-13 written (not started in code)

**When:** 2026-09-12

**What:** Product chose Arabic/RTL next. Wrote DR-005 + numbered SPEC-13: `dir="rtl"` `lang="ar"`, Arabic dictionaries for the existing error/success keys plus chrome `ui()`, WhatsApp Ã¢ÂÂslot availableÃ¢ÂÂ body in Arabic. No next-intl, no `/ar` URL, no language switch, no `tenant.settings`. Calendar stays `en-GB` (Western digits). Tenant-authored names stay as written.

**Why:** [DR-005](./decisions/DR-005-arabic-rtl.md), [SPEC-13](./specs/SPEC-13-arabic-rtl.md), BRD A-1 / A-2 / R-4 / RULE-11. Keys from DR-004 stay the seam.

**Files:** `docs/decisions/DR-005-arabic-rtl.md`; `docs/specs/SPEC-13-arabic-rtl.md`; `docs/README.md`.

**Relation:** Does not change booking/money/waitlist rules. English secondary / next-intl later.

**How to verify:** Read the spec. Confirm or correct the pins (Arabic-only, no locale URL, `en-GB` calendar, WhatsApp template). Then OK step 1.

### In plain language

The kitchen still speaks the same language. This slice is the waiter switching the menu to Arabic and serving from the right, without moving the restaurant to a new street address.

---

## Chapter 108 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ SPEC-13 step 1: Arabic dictionaries

**When:** 2026-09-12

**What:** Error and success dictionaries now return the SPEC-13 Arabic catalog (same keys). New `ui(key)` chrome map plus helpers for counts / Collect / due line / LBP-per-USD. Unknown `ui` key returns the key. Pages and `dir` unchanged. WhatsApp body still English until step 5.

**Why:** SPEC-13 step 1 / DR-005. Copy is not in JSX yet so step 3Ã¢ÂÂ4 only swap callers.

**Files:** `src/lib/error-messages.ts`; `src/lib/success-messages.ts`; `src/lib/ui-copy.ts`; `test/lib/errors.test.ts`; `test/lib/success-messages.test.ts`; `test/lib/ui-copy.test.ts`.

**Relation:** `src/lib` must not import `src/modules/*`. Pages still have no Prisma / no `tenantId`. next-intl still out.

**How to verify:** `npm test` Ã¢ÂÂ 27 suites, 154 passed. UI still English until later steps; toasts would already be Arabic if you trigger `ok=` / `error=`.

### In plain language

The menu cards are printed in Arabic, but they are still in the drawer. The waiter has not put them on the tables yet.

---

## Chapter 109 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ SPEC-13 step 2: dir + crash screens

**When:** 2026-09-12

**What:** Root `<html lang="ar" dir="rtl">`. Title `ÃÂÃÂÃÂ§ÃÂ¹ÃÂ¨` via `ui("doc.title")`. `error.tsx` / `global-error` are Arabic-first with English as a second `dir="ltr"` line; retry button `ÃÂ­ÃÂ§ÃÂÃÂ ÃÂÃÂ±ÃÂ© ÃÂ£ÃÂ®ÃÂ±ÃÂ / Try again`. `global-error` does not import `ui-copy`. Grep of `src/` found no `pl-`/`pr-`/`ml-`/`mr-`/`text-left`/`text-right`/`left-0`/`right-0` (Radix `data-[side=left]` animations left as-is).

**Why:** SPEC-13 step 2 / DR-005. Local layout.md: root layout owns `<html>` / `<body>`. error.md: `retry`, Client Component.

**Files:** `src/app/layout.tsx`; `src/app/error.tsx`; `src/app/global-error.tsx`.

**Relation:** Chrome on pages still English until step 3. No Prisma / no `tenantId`. next-intl still out.

**How to verify:** View source of `/?tenant=ahmad` Ã¢ÂÂ `lang="ar"` `dir="rtl"` `<title>ÃÂÃÂÃÂ§ÃÂ¹ÃÂ¨</title>`. Login labels still English.

### In plain language

The restaurant flipped the tables so people sit on the right. The printed menu on the tables is still English until the next trip to the kitchen.

---

## Chapter 110 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ SPEC-13 step 3: public + login chrome

**When:** 2026-09-12

**What:** Public `/` and `/login` labels, empty states, Taken badge, and submit buttons use `ui(...)`. GET still posts `name="date"`. Request action and hidden fields unchanged. Stadium name and pitch names stay as stored. `errorMessage` on login was already Arabic from step 1.

**Why:** SPEC-13 step 3 / DR-005 / RULE-11.

**Files:** `src/app/page.tsx`; `src/app/public-hours.tsx`; `src/app/login/page.tsx`.

**Relation:** Owner chrome still English until step 4. Pages still have no Prisma / no `tenantId`.

**How to verify:** `/?tenant=ahmad` Ã¢ÂÂ ÃÂ§ÃÂÃÂÃÂÃÂ / ÃÂ¹ÃÂ±ÃÂ¶ ÃÂ§ÃÂÃÂ³ÃÂ§ÃÂ¹ÃÂ§ÃÂª / ÃÂ§ÃÂÃÂ³ÃÂ§ÃÂ¹ÃÂ§ÃÂª / ÃÂ§ÃÂ·ÃÂÃÂ¨; pitch names unchanged. `/login?tenant=ahmad` Ã¢ÂÂ ÃÂªÃÂ³ÃÂ¬ÃÂÃÂ ÃÂ§ÃÂÃÂ¯ÃÂ®ÃÂÃÂ / ÃÂ¯ÃÂ®ÃÂÃÂ. Bad password still in-card via `access.invalid_login`.

### In plain language

The visitor and the lock on the door now speak Arabic. The ownerÃ¢ÂÂs kitchen list is still English until the next step.

---

## Chapter 111 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ SPEC-13 step 4: owner chrome

**When:** 2026-09-12

**What:** Owner header, Today, Book, Waitlist, period, rate, and expenses use `ui(...)` / count and money helpers. `categoryLabel` reads `cat.*`. Role is `role.OWNER` / `role.STAFF`. GET names (`bookOn`, `from`, `to`, `view`) unchanged. Added chrome key `owner.requested` (`ÃÂ·ÃÂÃÂÃÂ¨`) Ã¢ÂÂ the catalog missed the Ã¢ÂÂRequested {time}Ã¢ÂÂ line.

**Why:** SPEC-13 step 4 / DR-005 / RULE-11.

**Files:** `src/app/owner/page.tsx`; `today.tsx`; `book-slots.tsx`; `rest.tsx`; `shared.tsx`; `src/lib/ui-copy.ts`.

**Relation:** WhatsApp body still English until step 5. Pages still have no Prisma / no `tenantId`.

**How to verify:** `/owner` after login Ã¢ÂÂ ÃÂ§ÃÂÃÂÃÂÃÂ / ÃÂ®ÃÂ±ÃÂÃÂ¬ / ÃÂ§ÃÂ­ÃÂ¬ÃÂ² ÃÂ³ÃÂ§ÃÂ¹ÃÂ© / ÃÂÃÂ§ÃÂÃÂ; pitch and requester names as stored; Approve/Collect/Book still submit.

### In plain language

The ownerÃ¢ÂÂs list on the wall is Arabic now. The WhatsApp note he sends is still English until the last step.

---

## Chapter 112 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ SPEC-13 step 5: WhatsApp Arabic body

**When:** 2026-09-12

**What:** `slotAvailableMessage` uses the pinned Arabic sentence. Stadium/pitch stay as stored; times stay Latin `18:00Ã¢ÂÂ19:00`. Jest updated. No other BR-71 templates. SPEC-13 is done in code.

**Why:** SPEC-13 step 5 / DR-005 / A-8 / RULE-11.

**Files:** `src/modules/notification/domain/whatsapp-link.ts`; `test/modules/notification/domain/whatsapp-link.test.ts`; `docs/README.md`; `docs/decisions/DR-005-arabic-rtl.md`.

**Relation:** Notification still does not import Booking. Other WhatsApp templates stay out.

**How to verify:** `npm test`. Notify `wa.me` text: `Ahmad Stadium: Pitch 1 18:00Ã¢ÂÂ19:00 ÃÂ£ÃÂµÃÂ¨ÃÂ­ÃÂª ÃÂÃÂªÃÂ§ÃÂ­ÃÂ© ÃÂÃÂ¬ÃÂ¯ÃÂ¯ÃÂ§ÃÂ ÃÂ¥ÃÂ°ÃÂ§ ÃÂÃÂ§ ÃÂ²ÃÂÃÂª ÃÂªÃÂ±ÃÂÃÂ¯ÃÂÃÂ§.`

### In plain language

The note the owner pastes into WhatsApp is Arabic now, with the same stadium name and Latin times. This Arabic slice is finished.

---

## Chapter 113 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ Public slot picker + RTL bidi isolate

**When:** 2026-09-12

**What:** Two UX fixes, same Server Action. (1) Latin runs inside `dir="rtl"` were painting backwards (`17:00Ã¢ÂÂ16:00`). Display of times, phones, money, and `yyyy-mm-dd` now goes through `LtrIsolate` (`<bdi dir="ltr">` + `font-mono`). (2) Public hours no longer stack a name+phone form on every free slot. `PublicHours` still fetches; `PublicSlotPicker` (one Client Component) is a 2-col grid of time+price blocks. Taken hours stay visible, muted, not tappable. Tapping an open slot expands **one** form under that pitchÃ¢ÂÂs chips (same hidden fields + `submitPublicSlotRequest`). Tap again to collapse; picking another slot (including another pitch) closes the previous form.

**Why:** RTL bidi bug (RULE-11 / DR-005). Public request UX Ã¢ÂÂ no new SPEC; action contract unchanged.

**Files:** `src/components/ui/ltr-isolate.tsx` (new); `src/app/public-slot-picker.tsx` (new); `src/app/public-hours.tsx`; `src/components/ui/date-field.tsx`; `src/app/owner/today.tsx`; `src/app/owner/book-slots.tsx`; `src/app/owner/rest.tsx`; `src/app/owner/page.tsx`; `src/app/login/page.tsx`.

**Relation:** `app/` still has no Prisma / no `tenantId`. Picker holds selection only Ã¢ÂÂ it must not import domain or Prisma. `submitPublicSlotRequest` and hidden fields (`pitchId`, `start`, `end`, `date`, `tenant`) unchanged. Owner Book still has one form per available slot (bidi wrap only). Do not wrap Arabic chrome. Do not change `slotAvailableMessage` (WhatsApp URL, not RTL HTML).

**How to verify:** `npm test` (154). `/?tenant=ahmad` Ã¢ÂÂ HTML has `<bdi dir="ltr">16:00Ã¢ÂÂ17:00</bdi>` (start before end), 2-col grid, `ÃÂÃÂ­ÃÂ¬ÃÂÃÂ²` on muted taken cells, **no** name/phone form until a chip is selected; Request still lands `ok=requested`. `/owner` Today/Book/waitlist ranges and phones no longer reverse. `/login?tenant=ahmad` slug is isolated.

### In plain language

Times stopped flipping backwards in Arabic layout. Visitors now tap an hour to open one request form instead of scrolling past a stack of identical forms.

---

## Chapter 114 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ Public day chips (Link, not a date form)

**When:** 2026-09-12

**What:** Public `/` no longer uses DateField + **ÃÂ¹ÃÂ±ÃÂ¶ ÃÂ§ÃÂÃÂ³ÃÂ§ÃÂ¹ÃÂ§ÃÂª**. Same-week dates are a horizontal row of seven chips: ÃÂ§ÃÂÃÂÃÂÃÂ, ÃÂºÃÂ¯ÃÂ§ÃÂ, the next four weekdays with a Western day number, then a calendar icon. The six day chips are Next.js `<Link href={{ pathname: "/", query: { tenant, date } }}>` (App Router client transition Ã¢ÂÂ not `<form method="get">`, not a raw `<a>`). The existing `<Suspense key={dateValue}>` around `PublicHours` is what should skeleton **only** the slot list. Window is always venue-todayÃ¢ÂÂ¦today+5. A date outside that window rings the calendar chip (Popover + same `en-GB` Calendar); `router.push` with `tenant` + `date` only. `?date=` / `parseCivilDate` / `todayInTimeZone` unchanged.

**Why:** Same-day/this-week is the common path; a calendar-first field was two actions. No SPEC Ã¢ÂÂ UX, query contract unchanged.

**Files:** `src/app/public-day-chips.tsx` (new RSC); `src/app/public-date-calendar-chip.tsx` (new client, calendar overflow only); `src/app/page.tsx`; `src/lib/ui-copy.ts`; `test/lib/ui-copy.test.ts`.

**Relation:** `PublicHours` / slot picker / request action untouched. Owner DateField (`bookOn`, `from`, `to`, `occurredOn`) unchanged. Day numbers in `LtrIsolate`; do not wrap the Arabic weekday. No `loading.tsx` on `/` (that would white-flash the whole page).

**How to verify:** `npm test`. `/?tenant=ahmad` Ã¢ÂÂ six `/ ?tenant=ahmad&date=yyyy-mm-dd` Links, no DateField, no **ÃÂ¹ÃÂ±ÃÂ¶ ÃÂ§ÃÂÃÂ³ÃÂ§ÃÂ¹ÃÂ§ÃÂª**; Today ringed; times still `16:00Ã¢ÂÂ17:00`. Tap ÃÂºÃÂ¯ÃÂ§ÃÂ Ã¢ÂÂ `?date=` tomorrow, that chip rings; stadium name + chips stay, **only** the hours area shows the skeleton. `/?tenant=ahmad&date=2026-10-01` Ã¢ÂÂ calendar chip `aria-pressed="true"`. `/owner` DateField still there.

### In plain language

Picking a day this week is one tap on a chip. The hours list refreshes underneath; the rest of the page does not go white.

---

## Correction Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ Day-chip selected ring was clipped

**When:** 2026-09-12

**What:** `overflow-x-auto` on the chip row clipped the Volt ring (CSS treats the other axis as `auto` too). Padding on the row is now `p-2.5` so the ring+offset has room, including on ÃÂ§ÃÂÃÂÃÂÃÂ at the RTL start edge.

**Why:** Same selected treatment as the slot picker; the scroll row has to leave space for it.

**Files:** `src/app/public-day-chips.tsx`

**How to verify:** Select ÃÂ§ÃÂÃÂÃÂÃÂ / ÃÂºÃÂ¯ÃÂ§ÃÂ Ã¢ÂÂ the full green ring is visible on all four sides, not cut by the row.

---

## Correction Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ Day chips: no horizontal scrollbar

**When:** 2026-09-12

**What:** Dropped `overflow-x-auto`. The seven chips share the row (`flex-1`, compact `text-xs`). Selected uses an **inset** Volt ring so it does not need extra padding and does not clip.

**Why:** A scrollbar under the chips is worse than slightly tighter labels.

**Files:** `src/app/public-day-chips.tsx`; `src/app/public-date-calendar-chip.tsx`

**How to verify:** `/?tenant=ahmad` Ã¢ÂÂ all seven chips visible, no scrollbar under the row; selected ÃÂ§ÃÂÃÂÃÂÃÂ still has a full green outline.

---

## Correction Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ Page scrollbar no longer shifts the layout

**When:** 2026-09-12

**What:** `html { scrollbar-gutter: stable; }` so the vertical gutter is always reserved. Switching days (or any page whose height crosses the viewport) no longer shows/hides the browser scrollbar and nudges `max-w-lg` content.

**Why:** Classic Windows scrollbars take width. Overlay/auto hide was shifting the whole site.

**Files:** `src/app/globals.css`

**How to verify:** Toggle a long day vs a short one (or resize until the page scrollbar appears). Chips and hours stay horizontally still.

---

## Chapter 115 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ Public hours skeleton matches the slot grid

**When:** 2026-09-12

**What:** Replaced the two tall gray blocks. Hours Suspense now falls back to `PublicHoursSkeleton`: pitch heading bars at **inline-start** + a 2-col grid of time/price chip shapes (same `min-h-16` / `rounded-xl` as live slots). Pieces are exported separately (`StartLine`, `SlotChipSkeleton`, `SlotGridSkeleton`, `PitchHoursSkeleton`, `DayChipsSkeleton`) so later public UI can compose them. No `pl`/`pr`/`ml`/`mr` Ã¢ÂÂ `self-start` / `items-start` follow `dir`.

**Why:** The old blocks did not look like the slot picker and would not survive a later English/LTR pass.

**Files:** `src/app/public-skeletons.tsx` (new); `src/app/page.tsx`; `src/app/list-skeletons.tsx` (dropped `HoursListSkeleton`).

**Relation:** Day chips stay mounted; only hours suspend. Owner skeletons unchanged.

**How to verify:** Tap ÃÂºÃÂ¯ÃÂ§ÃÂ Ã¢ÂÂ stadium name and chips stay; hours area shows two pitch headings (start-aligned) and a 2-col chip grid, then real slots. Flip `dir` on `<html>` Ã¢ÂÂ heading bars and chip text stubs stay at inline-start.

---

## Chapter 116 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ Public EN/ÃÂ¹ lang+dir toggle

**When:** 2026-09-12

**What:** Public header has a small outline button. Arabic Ã¢ÂÂ shows **EN**; English Ã¢ÂÂ shows **ÃÂ¹**. Click sets cookie `stadium_locale`, flips `<html lang>` / `dir` (`ar`+`rtl` / `en`+`ltr`), and `router.refresh()` so public chrome (Today/Hours/Taken/form) follows. Stadium and pitch names stay as stored. No next-intl, no `/en` routes. Owner/login still Arabic copy (fallback).

**Why:** Product asked for a public direction switch to exercise LTR. DR-005 still parks next-intl; this is a cookie + dictionary, not `[locale]`.

**Files:** `src/lib/locale.ts`; `src/lib/get-ui-locale.ts`; `src/app/locale-actions.ts`; `src/app/public-lang-toggle.tsx`; `src/app/layout.tsx`; `src/app/page.tsx`; `src/lib/ui-copy.ts`; public hours/chips/picker; `test/lib/locale.test.ts`.

**Relation:** `ui(key, locale?)` defaults `ar`. Cookie write is a Server Function (cookies.md). `app/` still has no Prisma / no `tenantId`.

**How to verify:** `/?tenant=ahmad` Ã¢ÂÂ EN at inline-end of the header. Tap Ã¢ÂÂ page goes LTR, Today/Hours/Request in English, chips at the left. Tap ÃÂ¹ Ã¢ÂÂ back to RTL Arabic. `npm test` (157).

---

## Chapter 117 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ Colocate route UI; public form field errors

**When:** 2026-09-12

**What:** Public UI lives under `src/app/(public)/` (URL still `/`). Owner skeletons moved next to `/owner`. Shared primitives stay in `src/components/ui` (`LtrIsolate`, `FlashToast`). Public name/phone no longer use HTML `required` (browser bubble). `noValidate` + inline `role="alert"` under the field; same 8Ã¢ÂÂ15 digit phone rule as Zod. Server Action still parses with Zod.

**Why:** Scattered `public-*.tsx` at `app/` root were not routes. Native validation is ugly and ignores our Arabic/English copy.

**Files:** `src/app/(public)/*`; `src/app/owner/skeletons.tsx`; `src/lib/ui-copy.ts`; `test/app/public/request-fields.test.ts`.

**Relation:** `app/` still has no Prisma / no `tenantId`. `request-fields.ts` imports `normalizePhone` only (people domain).

**How to verify:** `npm test` (158). Open a slot, tap ÃÂ§ÃÂ·ÃÂÃÂ¨ empty Ã¢ÂÂ red line under name and phone, no OS tooltip. Valid name + `03 123 456` still `ok=requested`.

---

## Chapter 118 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ Hide ended hours; three empty states

**When:** 2026-09-12

**What:** Public hours and Owner Book drop slots whose end is not after injected `now` (same cutoff as `booking.slot_ended`). `generateSlotsForDay` is unchanged. Empty list is `closed` (no windows), `past` (civil date before today), or `hoursEnded` (today, all games over). Public chip row stays todayÃ¢ÂÂtoday+4; a past `?date=` selects nothing (not Today, not the calendar). Calendar disables days before today. Owner Today lists are unchanged. A typed past Owner `bookOn` shows `past` Ã¢ÂÂ Book creates, it does not review history.

**Why:** Requesting or booking a game that already ended is noise. `now` is injected at the page/use-case so venue domain/application never call `Date.now()`.

**Files:** `src/modules/venue/domain/availability.ts`; `src/modules/venue/application/get-day-availability.ts`; `src/app/(public)/page.tsx`; `hours.tsx`; `slot-picker.tsx`; `day-chips.tsx`; `date-calendar-chip.tsx`; `src/app/owner/page.tsx`; `book-slots.tsx`; `src/lib/ui-copy.ts`; `test/modules/venue/domain/availability.test.ts`; `test/lib/ui-copy.test.ts`.

**Relation:** Pages construct `now` and `civilDateInTimeZone`. Venue still takes occupied UTC ranges from Booking. `components/ui` does not import `src/modules/*`. Owner Today / waitlist / `resolveOfferedSlot` unchanged.

**How to verify:** `npm test` (170). Public `/?tenant=ahmad&date=` yesterday Ã¢ÂÂ ÃÂ«ÃÂÃÂ°ÃÂ§ ÃÂ§ÃÂÃÂªÃÂ§ÃÂ±ÃÂÃÂ® ÃÂÃÂ¶ÃÂÃÂ», no chip ringed. Open calendar Ã¢ÂÂ days before today disabled. After last slot tonight Ã¢ÂÂ ÃÂ«ÃÂÃÂ ÃÂªÃÂ¨ÃÂ ÃÂ³ÃÂ§ÃÂ¹ÃÂ§ÃÂª ÃÂ§ÃÂÃÂÃÂÃÂÃÂ». Closed weekday still ÃÂ«ÃÂÃÂºÃÂÃÂ ÃÂÃÂ°ÃÂ§ ÃÂ§ÃÂÃÂÃÂÃÂ.ÃÂ». Owner Book past `bookOn` Ã¢ÂÂ same past empty state; Owner Today still lists today's pending/confirmed.

---

## Chapter 119 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ Owner tabs: real routes + shared layout

**When:** 2026-09-12

**What:** `/owner` is no longer one scrolling page. Nested `layout.tsx` holds header + bottom tab bar; `/owner` redirects to `/owner/today`. Tabs are `/owner/today`, `/owner/book`, `/owner/waitlist`, `/owner/money`. Actions redirect to the owning tab. `FlashToast` lives in the layout and reads `ok`/`error` via `useSearchParams`. No `loading.tsx`. Login lands on `/owner/today`. Living map: `docs/owner-ia.md`.

**Why:** Shop/Academy cannot pile onto one page. Real routes give back-button and bookmarks (same pattern as public day chips). Layouts cannot take `searchParams` (local layout.md).

**Files:** `src/app/owner/layout.tsx`; `tab-bar.tsx`; `page.tsx`; `today/page.tsx`; `book/page.tsx`; `waitlist/page.tsx`; `money/page.tsx`; `today-lists.tsx`; `waitlist-list.tsx`; `money-panel.tsx`; `actions.ts`; `shared.tsx`; `skeletons.tsx`; `src/app/login/actions.ts`; `src/components/ui/flash-toast.tsx`; `src/modules/access/application/get-current-membership.ts` (`cache()`); `src/lib/ui-copy.ts`; `docs/owner-ia.md`; `docs/README.md`. Deleted `owner/rest.tsx`.

**Relation:** Use cases unchanged. `app/` still has no Prisma / no `tenantId`. Tab bar is the only new owner Client Component besides FlashToast. **No `loading.tsx`** on owner tabs (GET date fields must stay mounted). Proxy vs `middleware.ts` flagged in `docs/owner-ia.md`, not migrated here.

**How to verify:** `npm test`. Login Ã¢ÂÂ `/owner/today`. Header stays while tapping ÃÂ§ÃÂ­ÃÂ¬ÃÂ² / ÃÂÃÂ§ÃÂ¦ÃÂÃÂ© ÃÂ§ÃÂÃÂ§ÃÂÃÂªÃÂ¸ÃÂ§ÃÂ± / ÃÂ§ÃÂÃÂÃÂ§ÃÂ. Book GET stays on `/owner/book`. Approve toast on Today; create booking toast on Book; rate/expense on Money.

---

## Correction Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ Today lists live under today/lists.tsx

**When:** 2026-09-12

**What:** `OwnerToday` is `src/app/owner/today/lists.tsx` (imported by `today/page.tsx` as `./lists`). Same for waitlist/`list.tsx` and money/`panel.tsx`. The old `owner/today.tsx` is gone; it still called `keepOwnerQuery` after that helper was removed, and Turbopack kept serving it.

**Why:** A sibling `today.tsx` next to `today/page.tsx` is a bad split (and the stale module threw `keepOwnerQuery is not defined`).

**Files:** `src/app/owner/today/lists.tsx`; `waitlist/list.tsx`; `money/panel.tsx`; `docs/owner-ia.md`. Deleted `today-lists.tsx`, `waitlist-list.tsx`, `money-panel.tsx`.

**How to verify:** Refresh `/owner/today` Ã¢ÂÂ pending/confirmed render; cancel form has no `keepOwnerQuery` error.

---

## Chapter 120 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ Owner tab bar icons + dock

**When:** 2026-09-12

**What:** Owner bottom nav is a floating rounded dock: Lucide icons (list / calendar-plus / bell / wallet) over the existing Arabic labels, Volt tint + slight scale on the active tab, CSS `transition` only. Still `<Link>` + `usePathname` Ã¢ÂÂ not a client tab switcher.

**Why:** Text-only chips were hard to scan on a phone; four Arabic labels needed a simple visual.

**Files:** `src/app/owner/tab-bar.tsx`; `src/app/owner/layout.tsx`.

**Relation:** Routes and IA in `docs/owner-ia.md` unchanged. Logical CSS; no `pl`/`pr`.

**How to verify:** Open `/owner/today` Ã¢ÂÂ dock at the bottom. Tap ÃÂ§ÃÂ­ÃÂ¬ÃÂ² Ã¢ÂÂ icon tints Volt, header stays. Waitlist label may truncate; icon still readable.

---

## Chapter 121 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ Colocate owner tab files; split actions

**When:** 2026-09-12

**What:** Each owner tab keeps its own page, UI, skeleton, and (when it has a form POST) `actions.ts`. Root `/owner` keeps only chrome that two or more tabs share: `layout.tsx`, `tab-bar.tsx`, `shared.tsx` (membership, tenant slug, `queryString`, `formatLocalRange`), and `form-query.ts` (`field` / `ownerQuery` / `redirectOwner` used by today+book+money). One-tab helpers are folded into that tabÃ¢ÂÂs TSX (`keepTenantQuery` on Today, `keepBookQuery` on Book, period keep/format/labels on Money). `civilFromYyyyMmDd` / `parseOwnerBookOn` live in `book/date.ts`. Waitlist has no Server Action.

**Why:** A root `actions.ts` and `skeletons.tsx` mixed four products. Next tab (Shop) would dump more into the same files. Rule: used by exactly one tab Ã¢ÂÂ lives in that folder.

**Files:** `src/app/owner/form-query.ts`; `shared.tsx`; `today/{page,lists,actions,skeleton}.tsx`; `book/{page,slots,date,actions,skeleton}`; `waitlist/{page,list,skeleton}`; `money/{page,panel,actions,skeleton}`; `docs/owner-ia.md`. Deleted `owner/actions.ts`, `owner/skeletons.tsx`, `owner/book-slots.tsx`.

**Relation:** Use cases unchanged. Pages still have no Prisma / no `tenantId`. `"use server"` only on the three tab `actions.ts` files (plus login/public). Redirect map unchanged (today / book / money). No `loading.tsx`.

**How to verify:** `npm test`. Open `/owner/today` Ã¢ÂÂ approve still toasts on Today. Book a slot Ã¢ÂÂ stay on `/owner/book` with `bookOn`. Rate/expense still land on `/owner/money`. No import of `@/app/owner/actions`.

---

## Chapter 122 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ Owner chrome: waitlist cards, quieter header, Money heading

**When:** 2026-09-12

**What:** Waitlist people use the same card anatomy as Today (pitch + time + name/phone in `CardHeader`, ÃÂ¥ÃÂ¨ÃÂÃÂ§ÃÂº full-width in `CardContent`). Shared owner header no longer uses a `text-2xl` stadium `h1`; stadium + role are muted, logout is ghost icon-only. Money has a page `h2` ÃÂ§ÃÂÃÂÃÂ§ÃÂ; period/rate/expenses are `h3` subsections like Today. Book/Waitlist page titles match TodayÃ¢ÂÂs `text-xl`.

**Why:** Waitlist looked unfinished vs Today. Stadium/logout were competing with the tab the owner opened (BR-9). Money was the only tab without a page heading.

**Files:** `src/app/owner/waitlist/list.tsx`; `layout.tsx`; `money/page.tsx`; `money/panel.tsx`; `waitlist/page.tsx`; `book/page.tsx`.

**Relation:** No Server Actions, use cases, or module boundaries. `LtrIsolate` on times/phones unchanged. Notify is still `wa.me` `<a>`, not an action.

**How to verify:** Waitlist card Ã¢ÂÂ name/phone stacked under the time, ÃÂ¥ÃÂ¨ÃÂÃÂ§ÃÂº full-width like ÃÂ¥ÃÂÃÂºÃÂ§ÃÂ¡. Header: stadium small, tab title (ÃÂ§ÃÂÃÂÃÂÃÂ / ÃÂ§ÃÂÃÂÃÂ§ÃÂ) is the big type. Money opens with ÃÂ§ÃÂÃÂÃÂ§ÃÂ then ÃÂÃÂ°ÃÂ ÃÂ§ÃÂÃÂÃÂªÃÂ±ÃÂ©.

---

## Chapter 123 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ Shared SlotPicker for public hours and owner Book

**When:** 2026-09-12

**What:** Public and owner Book share one client `SlotPicker`: 2-col time+price grid, one expanded name/phone form. Props are `action`, `hiddenFields`, `submitLabel`, optional `locale`. Local pitch/slot view types Ã¢ÂÂ no `booking/`, access, or venue imports. Thin wrappers: `PublicSlotPicker` (`tenant`+`date`, ÃÂ§ÃÂ·ÃÂÃÂ¨) and `OwnerSlotPicker` (`tenant`+`bookOn`, ÃÂ§ÃÂ­ÃÂ¬ÃÂ²). Name/phone client checks moved to `src/lib/request-fields.ts`. Owner Book no longer stacks a form on every free slot. Auth stays on `/owner/book`.

**Why:** Owner booked more often than a visitor; N stacked forms was the public problem again. One picker, two wrappers, so the grids cannot drift.

**Files:** `src/components/slot-picker.tsx`; `src/lib/request-fields.ts`; `test/lib/request-fields.test.ts`; `src/app/(public)/slot-picker.tsx`; `hours.tsx`; `src/app/owner/book/picker.tsx`; `slots.tsx`; `skeleton.tsx`; `docs/owner-ia.md`. Deleted `(public)/request-fields.ts` and its old test path.

**Relation:** `submitPublicSlotRequest` / `submitCreateOwnerBooking` unchanged. `components/ui` still does not import `src/modules/*`. Pages still have no Prisma / no `tenantId`. No extra owner fields.

**How to verify:** `npm test`. Public Ã¢ÂÂ tap a free hour, one form, Taken muted, Request still `ok=requested`. Owner Book Ã¢ÂÂ same grid, one form, stays on `/owner/book` with `bookOn`. Staff without create still EmptyState. EN/ÃÂ¹ still only public labels.

---

## Chapter 124 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ Owner Book uses public day chips

**When:** 2026-09-12

**What:** Owner Book date is the same five Link chips + calendar overflow as public hours. Shared `DayChips` / `DateCalendarChip` take `pathname` + `dateQueryKey` (`date` on `/`, `bookOn` on `/owner/book`). The GET date form and ÃÂ¹ÃÂ±ÃÂ¶ ÃÂ§ÃÂÃÂ³ÃÂ§ÃÂ¹ÃÂ§ÃÂª button are gone. Chips sit outside `<Suspense>` so they stay mounted while slots load. Public `PublicDayChips` is a thin wrapper.

**Why:** Same interaction as public; owner books more often, so a submit-to-change-day form was extra friction.

**Files:** `src/components/day-chips.tsx`; `src/components/date-calendar-chip.tsx`; `src/app/(public)/day-chips.tsx`; `src/app/owner/book/page.tsx`; `docs/owner-ia.md`. Deleted `(public)/date-calendar-chip.tsx`.

**Relation:** `bookOn` query and create-booking redirect unchanged. `DateField` still used on Money. No use-case changes. Past `bookOn` still shows the past empty state.

**How to verify:** `npm test`. `/owner/book` Ã¢ÂÂ today/tomorrow chips, calendar for later days, slots update without a submit. Create booking still returns to the same `bookOn`. Public `?date=` chips unchanged.

---

## Chapter 125 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ SlotPicker v2: kickoff hierarchy, Volt duration, select motion

**When:** 2026-09-12

**What:** Slot tiles: start time is the hero; end is a smaller Slate line (`Ã¢ÂÂ 17:00`); price + duration share the third line. Idle duration is the only Volt accent. Idle fill is `bg-card` plus a 1px `#dee2e6` hairline (`border-border` on these tiles only Ã¢ÂÂ `#ffffff` vs page `#f8f9fa` is ~1.02:1 and would vanish in sun). Selected is a 200ms ease-out fill-invert (no ring, no hover, no shadow). Taken is the same stack, muted, instant. No globals / `--border` change.

**Why:** Equal-weight `16:00Ã¢ÂÂ17:00` plus a snap invert read as a flat box. Kickoff is the number that matters; duration is real info (1h / 1.5h).

**Files:** `src/components/slot-picker.tsx`; `test/components/slot-duration.test.ts`.

**Relation:** Day chips unchanged. Request form still the expanded card; header uses the same type stack. No booking/access/venue types.

**How to verify:** `npm test`. Public/owner Book Ã¢ÂÂ idle tile: large 16:00, small Ã¢ÂÂ 17:00, `$30.00 ÃÂ· 1h` with Volt on `1h`. Tap Ã¢ÂÂ Volt fill over ~200ms. Taken: no Volt, ÃÂÃÂ­ÃÂ¬ÃÂÃÂ². Day chips still have their own border.

---

## Chapter 126 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ Idle tile Slate hairline; light theme-color

**When:** 2026-09-12

**What:** Idle slot tiles use a 1px Slate hairline (`border-muted-foreground/40`, `#495057` at 40%) Ã¢ÂÂ not `#dee2e6`, not `shadow-sm`. Selected stays Volt invert (`border-primary`); taken stays the faint `border-border`. Root viewport is `themeColor: #f8f9fa` + `colorScheme: light` (local `generate-viewport.md`; Next default `themeColor` is null). `html` paints `--background` and `color-scheme: light` so OS-dark chrome / canvas does not show a black strip above the header.

**Why:** Chapter 125Ã¢ÂÂs `#dee2e6` hairline was still invisible on-screen (sunlight risk confirmed). The black bar was not a tile style Ã¢ÂÂ missing theme-color on a light page.

**Files:** `src/components/slot-picker.tsx`; `src/app/layout.tsx`; `src/app/globals.css`.

**Relation:** `--border` / day chips unchanged. No use-case or route change.

**How to verify:** `npm test`. Idle tiles have a visible Slate line, no shadow. Selected invert unchanged. View source: `<meta name="theme-color" content="#f8f9fa">` and `<meta name="color-scheme" content="light">`. No black strip above the header.

---

## Chapter 127 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ Slot form is a dialog; ticket split on every tile

**When:** 2026-09-12

**What:** Name/phone is a compact Dialog over the grid (Carbon dim `bg-foreground/45` + `backdrop-blur-sm`, not `bg-black/80`). The 2-col board does not shift. Selected tile stays in place (Volt invert). Overlay / Esc / X dismisses. Ticket split (time | fare) is now idle, selected, and taken. Same Server Action and hidden fields.

**Why:** In-grid `col-span-2` was the smallest Ã¢ÂÂone formÃ¢ÂÂ fix; it shoved stubs once tiles became tickets. Modal keeps the board still.

**Files:** `src/components/ui/dialog.tsx`; `src/components/slot-picker.tsx`; `src/lib/ui-copy.ts`; `src/app/(public)/skeletons.tsx`; `src/app/owner/book/skeleton.tsx`; `docs/owner-ia.md`.

**Relation:** `submitPublicSlotRequest` / `submitCreateOwnerBooking` unchanged. `components/ui` still does not import `src/modules/*`. No `--border` change.

**How to verify:** `npm test`. Public / owner Book Ã¢ÂÂ tap a free stub: grid stays put, tile inverts, dialog has the ticket face + name/phone. Overlay or Esc closes. Taken tiles use the same split. Request / ÃÂ§ÃÂ­ÃÂ¬ÃÂ² still `ok=`.

---

## Chapter 128 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ Scrollbar gutter both-edges; dialog does not open a white strip

**When:** 2026-09-12

**What:** `html { scrollbar-gutter: stable both-edges }` so `mx-auto` stays optically centered and the classic Windows bar never covers content. Dialog overlay is `left-0 w-screen` (covers the gutter). RemoveScrollÃ¢ÂÂs extra `margin/padding-right` on `body[data-scroll-locked]` is zeroed Ã¢ÂÂ that gap was the white column beside the dim.

**Why:** `stable` alone reserved only the barÃ¢ÂÂs side, so the column sat off-center. Opening the dialog hid the bar and RemoveScroll added a second gap on top of the gutter.

**Files:** `src/app/globals.css`; `src/components/ui/dialog.tsx`.

**Relation:** Same Dialog / Server Action. Overlay still Carbon dim + light blur.

**How to verify:** Long Book page Ã¢ÂÂ column centered with or without a bar. Open a slot Ã¢ÂÂ dim covers the full viewport, no white strip, page behind does not jump.

---

## Chapter 129 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ Thin Volt scrollbar; drop both-edges gutter

**When:** 2026-09-12

**What:** Dropped `scrollbar-gutter: stable both-edges` (empty lanes on both sides). Page and nested overflow use a 6px Volt thumb (`--primary`) on a transparent track; Firefox `scrollbar-width: thin`. One-side `stable` gutter remains so the bar does not cover tiles. Dialog overlay / RemoveScroll zeroing from ch. 128 stays.

**Why:** Both-edges reserved matching empty space opposite the bar Ã¢ÂÂ the new white columns. A thin Volt bar matches the rest of the UI and needs only one thin lane.

**Files:** `src/app/globals.css`.

**Relation:** Dialog dim still `w-screen`. No token change.

**How to verify:** Book page Ã¢ÂÂ thin Volt bar, no empty strip on the other side. Open a slot Ã¢ÂÂ dim edge to edge.

---

## Chapter 130 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ Drop scrollbar-gutter; overlay spans 100vw

**When:** 2026-09-12

**What:** Removed `scrollbar-gutter` (the reserved lane stayed empty and white when the dialog hid the bar). Overlay is `100vw` with `margin-left: calc(50% - 50vw)` so the dim covers the visual viewport. Volt thumb is inset via a transparent border so it reads as a thin overlay, not a solid column.

**Why:** `stable` + `overflow: hidden` on `html` left an uncovered gutter. Padding-zero on RemoveScroll was not enough.

**Files:** `src/app/globals.css`; `src/components/ui/dialog.tsx`.

**How to verify:** Open a slot on Book Ã¢ÂÂ dim is edge to edge, no white column. Scrollbar is a thin Volt pill, not a reserved white lane.

---

## Chapter 131 Ã¢ÂÂ 2026-09-12 Ã¢ÂÂ Owner header EN/ÃÂ¹ toggle

**When:** 2026-09-12

**What:** Owner header has the same EN/ÃÂ¹ control as public (`LangToggle`, cookie `stadium_locale`, `html` lang/dir). Shared component; `setUiLocale` lives at `src/app/locale-actions.ts`. Owner chrome, tabs, and tab pages pass `locale` into `ui()`. English strings cover owner / empty / role / category keys. Stadium and pitch names stay as stored.

**Why:** Public already flipped dir; owner copy was hardcoded Arabic so a header button would only change layout.

**Files:** `src/components/lang-toggle.tsx`; `src/app/locale-actions.ts`; `src/app/owner/layout.tsx`; `tab-bar.tsx`; today/book/waitlist/money pages + lists/panel/picker; `src/lib/ui-copy.ts`; `test/lib/ui-copy.test.ts`; `docs/owner-ia.md`.

**Relation:** Same cookie as public. No next-intl. Login still defaults to Arabic until that screen gets the button.

**How to verify:** `npm test`. `/owner/today` Ã¢ÂÂ EN in the header; tabs and Today copy go English + LTR. ÃÂ¹ returns Arabic + RTL. Public `/` still shares the cookie.

---

## Chapter 132 Ã¢ÂÂ 2026-09-13 Ã¢ÂÂ Home tab (replace Today inbox)

**When:** 2026-09-13

**What:** `/owner/today` is the Home tab (ÃÂ±ÃÂ¦ÃÂÃÂ³ÃÂÃÂ© / ÃÂ§ÃÂÃÂ±ÃÂ¦ÃÂÃÂ³ÃÂÃÂ©). Two sections, not a merged timeline. **ÃÂ·ÃÂÃÂ¨ÃÂ§ÃÂª:** all PENDING any date, soonest slot then BR-17 `requestedAt` inside a slot; competing requesters grouped on one card with approve/reject always visible. **ÃÂ§ÃÂÃÂÃÂ§ÃÂ¯ÃÂ:** compact confirmed rows (time, pitch, name, ÃÂÃÂ§ÃÂ¯ÃÂ/ÃÂÃÂ³ÃÂªÃÂ­ÃÂ/ÃÂÃÂ¯ÃÂÃÂÃÂ¹); tap-in Collect / ÃÂ¯ÃÂÃÂ¹ ÃÂ¨ÃÂ¹ÃÂÃÂÃÂªÃÂÃÂ / Cancel. Today by default; **ÃÂ¹ÃÂ±ÃÂ¶ ÃÂ§ÃÂÃÂ£ÃÂÃÂ§ÃÂ ÃÂ§ÃÂÃÂÃÂ§ÃÂ¯ÃÂÃÂ©** appends the next 7 Beirut civil days. **ÃÂÃÂªÃÂ£ÃÂ®ÃÂ±** prepends unpaid APPROVED before today (BR-49). URL stays `/owner/today`. Server Actions unchanged.

**Why:** Owner IA Ã¢ÂÂ ops inbox vs compact upcoming. BR-49 forbids dropping past unpaid with no collect path.

**Files:** `src/modules/booking/domain/home-inbox.ts`; `infrastructure/bookings.ts` (pending ORDER BY; approved in-range + starting-before); `application/list-due-bookings.ts`; `src/modules/venue/domain/availability.ts` (`civilDayUtcRange`); `src/app/owner/today/lists.tsx`, `upcoming-panel.tsx`, `date-label.ts`; `tab-bar.tsx`; `src/lib/ui-copy.ts`; `docs/owner-ia.md`.

**Relation:** Booking application still attaches remaining via Payment sums (no payment join in Booking SQL). `rejectOverlappingPending` still uses `listPendingBookings` (order unused). Home display sort is soonest slot; SPEC-05 approve semantics unchanged.

**How to verify:** `npm test`. `/owner/today` Ã¢ÂÂ tab House + ÃÂ±ÃÂ¦ÃÂÃÂ³ÃÂÃÂ©; pending any date with inline date; competing slot shows all requesters + buttons; today compact tags; tap row for collect/cancel; overdue unpaid above today; coming-days toggle. Staff without approve/collect: lists without those forms.

---

## Chapter 133 Ã¢ÂÂ 2026-09-13 Ã¢ÂÂ Home collect: due vs remaining figures

**When:** 2026-09-13

**What:** Tap-in collect detail shows due and remaining as two labeled tiles instead of one `Due $30 ÃÂ· remaining $30` sentence. Remaining uses Volt when still owed; both quiet when remaining is `$0.00`.

**Why:** Same number twice in one muted line was hard to scan on the phone.

**Files:** `src/app/owner/today/upcoming-panel.tsx`; `src/lib/ui-copy.ts` (`owner.remaining`).

**How to verify:** `/owner/today` Ã¢ÂÂ expand a confirmed row. Due is Slate tile; remaining is Volt if unpaid. Paid row: remaining muted.

---

## Chapter 134 Ã¢ÂÂ 2026-09-13 Ã¢ÂÂ Home cards: time hero, icons, real status pills

**When:** 2026-09-13

**What:** Home request and upcoming cards: time is the scan target (`text-lg semibold` + Clock). Pitch is MapPin + muted; phone is Phone + LTR (requests + expanded detail). Status tags are `Badge outline` in both locales Ã¢ÂÂ ÃÂÃÂ§ÃÂ¯ÃÂ/ÃÂÃÂ¯ÃÂÃÂÃÂ¹ were `ghost` (no pill). Paid includes a Volt `CircleCheck`. Dropped the extra Ã¢ÂÂpendingÃ¢ÂÂ pill on competing requesters (section is already ÃÂ·ÃÂÃÂ¨ÃÂ§ÃÂª). Weekday labels are short in both locales.

**Why:** Owner scans outdoors (G-1 / A-3). Ghost badges looked like plain text. Time was the same size as pitch and name.

**Files:** `src/app/owner/today/lists.tsx`; `upcoming-panel.tsx`; `date-label.ts`.

**How to verify:** `/owner/today` AR and EN. Time is the largest line. Upcoming/Due/Paid are pills. Expand a row: phone has a Phone icon, not a bare number.

---

## Chapter 135 Ã¢ÂÂ 2026-09-13 Ã¢ÂÂ Toast above the tab bar

**When:** 2026-09-13

**What:** Sonner Toaster is `top-center` (safe-area offset) instead of default bottom. Owner tab bar stays tappable after Approve/Collect.

**Why:** Bottom toasts sat on the Home tab strip on a phone.

**Files:** `src/components/ui/sonner.tsx`.

**How to verify:** Approve or collect on `/owner/today` Ã¢ÂÂ toast appears under the status bar, not over ÃÂ±ÃÂ¦ÃÂÃÂ³ÃÂÃÂ© / ÃÂ§ÃÂ­ÃÂ¬ÃÂ².

---

## Chapter 136 Ã¢ÂÂ 2026-09-13 Ã¢ÂÂ No Cancel on past unpaid (BR-49)

**When:** 2026-09-13

**What:** Cancel is hidden on Home when `start <= now` and remaining > 0. `cancelBooking` uses the same `sumCollectedUsd` + `remainingDue` as collect, then `assertNotPastUnpaidCancel`. Future games and past paid still cancel. Collect unchanged.

**Why:** SPEC-10 allowed Cancel on any APPROVED; cancelling a past unpaid game dropped the debt with no ledger trace (BR-49).

**Files:** `src/modules/booking/domain/decision.ts`; `application/cancel-booking.ts`; `infrastructure/bookings.ts` (`priceUsd` on decision load); `src/app/owner/today/lists.tsx`, `upcoming-panel.tsx`; `src/lib/error-messages.ts`; tests.

**Relation:** No Payment write. Action stays thin. No-show still unused.

**How to verify:** `npm test`. Home Ã¢ÂÂ expand a due/overdue row after kickoff: Collect, no Cancel. Future unpaid: Cancel still there. Paid past: Cancel still there. Stale POST Ã¢ÂÂ toast `booking.cancel_past_unpaid`.

---

## Chapter 137 Ã¢ÂÂ 2026-09-13 Ã¢ÂÂ Toast follows locale; dismiss X

**When:** 2026-09-13

**What:** Flash toasts use the cookie locale (`errorMessage` / `successMessage` take `UiLocale`). English catalog for every existing key. Sonner `closeButton` with lucide X; aria-label from `dialog.close`. Toaster `dir` matches `html`.

**Why:** Banner stayed Arabic after EN. No way to dismiss besides waiting/swiping.

**Files:** `src/lib/error-messages.ts`; `success-messages.ts`; `src/components/ui/flash-toast.tsx`; `sonner.tsx`; `src/app/layout.tsx`; owner + public FlashToast callers; tests.

**How to verify:** `npm test`. Switch to English, approve/collect Ã¢ÂÂ toast is English. X dismisses it. Arabic still Arabic.

---

## Chapter 138 Ã¢ÂÂ 2026-09-13 Ã¢ÂÂ Reports tab + More / Settings

**When:** 2026-09-13

**What:** Bottom bar is five tabs: Home / Book / Waitlist / Reports / More. `/owner/money` stays (heading + tab = ÃÂªÃÂÃÂ§ÃÂ±ÃÂÃÂ± / Reports); period + expenses stay; exchange-rate **set** form moved to `/owner/more/settings`. More is a hub (Settings only for now). Waitlist tab label shortens to ÃÂ§ÃÂÃÂªÃÂ¸ÃÂ§ÃÂ±; page heading stays ÃÂÃÂ§ÃÂ¦ÃÂÃÂ© ÃÂ§ÃÂÃÂ§ÃÂÃÂªÃÂ¸ÃÂ§ÃÂ±.

**Why:** Rate is stadium config, not a report. More is the reserved home for Settings extras, Tournaments, Shop, Academy Ã¢ÂÂ the bar does not grow again.

**Files:** `src/app/owner/tab-bar.tsx`; `money/page.tsx`, `panel.tsx`, `actions.ts`; `more/page.tsx`; `more/settings/{page,panel,actions,skeleton}.tsx`; `src/lib/ui-copy.ts`; `docs/owner-ia.md`; tests.

**Relation:** `setExchangeRate` / `recordExpense` use cases unchanged. Reports still **reads** `getCurrentRate()` for LBP display. No pitch UI (known gap). No `loading.tsx` under `/owner`.

**How to verify:** `npm test`. Owner bar shows 5 labels including ÃÂªÃÂÃÂ§ÃÂ±ÃÂÃÂ± and ÃÂ§ÃÂÃÂÃÂ²ÃÂÃÂ¯. Reports has period + expenses, no rate form. More Ã¢ÂÂ Settings: OWNER can set rate; toast lands on Settings. Waitlist tab says ÃÂ§ÃÂÃÂªÃÂ¸ÃÂ§ÃÂ±; heading is still ÃÂÃÂ§ÃÂ¦ÃÂÃÂ© ÃÂ§ÃÂÃÂ§ÃÂÃÂªÃÂ¸ÃÂ§ÃÂ±.

---

## Chapter 139 Ã¢ÂÂ 2026-09-13 Ã¢ÂÂ Reports Pass 1: hero, disclosure, expense rows

**When:** 2026-09-13

**What:** Reports summary: difference is `text-2xl`; In tile Volt, Out tile due-muted; CSS In/Out bars from the two totals (no library). Period GET form behind Ã¢ÂÂChange periodÃ¢ÂÂ; record-expense form behind Ã¢ÂÂAdd expenseÃ¢ÂÂ. Expense history is compact cards (lucide category icon, description, LTR date, mono amount). Default period remains this Beirut calendar month.

**Why:** Home-style priority disclosure. The form and raw em-dash list buried the number. SPEC-08 said no JS chart Ã¢ÂÂ this is two CSS bars, not a series.

**Files:** `src/app/owner/money/panel.tsx`, `reveal.tsx`, `bars.ts`; `src/lib/ui-copy.ts`; `docs/owner-ia.md`; `test/app/owner/money/bars.test.ts`.

**Relation:** `summarizeLedgerPeriod` / `recordExpense` / `listRecentExpenses` unchanged. No new query. Out color may still read as Ã¢ÂÂneeds actionÃ¢ÂÂ (Home due) Ã¢ÂÂ revisit after live use, not a new token now.

**How to verify:** `npm test`. `/owner/money` Ã¢ÂÂ net is the largest figure; In/Out tiles; bars; Ã¢ÂÂÃÂªÃÂºÃÂÃÂÃÂ± ÃÂ§ÃÂÃÂÃÂªÃÂ±ÃÂ©Ã¢ÂÂ / Ã¢ÂÂÃÂ¥ÃÂ¶ÃÂ§ÃÂÃÂ© ÃÂÃÂµÃÂ±ÃÂÃÂÃ¢ÂÂ collapsed. Expense rows are cards, not an em-dash sentence.

---

## Chapter 140 Ã¢ÂÂ 2026-09-13 Ã¢ÂÂ Pitch MVP: daily window + flatten/pending confirm

**When:** 2026-09-13

**What:** Owner Settings lists pitches and (OWNER only) create/edit: name, one open/close copied to all 7 days, slot duration, default USD. Writes go through `parseScheduleConfig` with `gapMinutes: 0` and `priceRules: []`. Hours-cover (not generated-slot match) refuses live APPROVED in a removed window; PENDING in a removed window and flatten-of-mixed-days/`priceRules` use the same checkbox second-submit (`confirmPending` / `confirmFlatten`). Duration-only changes do not trip hours-cover. `approveBooking` re-checks `resolveOfferedSlot` against current hours before flipping PENDING Ã¢ÂÂ APPROVED.

**Why:** Seed was the only pitch writer. Flatten must not silently wipe Ahmad A1 Fri/Sat hours and weekend `priceRules`. DR-001: Venue does not import Booking Ã¢ÂÂ `listLiveWindowsOnPitch` feeds `{ start, end, status }[]` into `updatePitch`.

**Files:** `src/modules/venue/domain/{daily-schedule,hours-cover}.ts`, `availability.ts` (`bookingFitsOpenHours`); `schemas/pitch-draft.ts`; `application/{create-pitch,update-pitch,list-pitch-summaries,get-pitch-editor}.ts`; `infrastructure/pitches.ts`; `src/modules/booking/infrastructure/bookings.ts` (`listLiveWindowsOnPitch`); `application/{list-live-pitch-windows,approve-booking}.ts`; `src/app/owner/more/settings/panel.tsx`; `pitches/{new,[pitchId],form,actions}`; copy catalogs; `docs/owner-ia.md`; tests.

**Relation:** Booking/Payment writes unchanged except the live-window read and approve re-check. No `priceRules` editor, per-day grid, `pitch_blocks`, or pitch delete.

**How to verify:** `npm test`. More Ã¢ÂÂ Settings: pitch list (A1 = ÃÂ³ÃÂ§ÃÂ¹ÃÂ§ÃÂª ÃÂÃÂ®ÃÂªÃÂÃÂÃÂ©). Edit A1 Ã¢ÂÂ flatten checkbox visible; save without it toasts `venue.confirm_flatten` and does not write. Check it, save Ã¢ÂÂ all 7 days match the form window, `priceRules` empty. Shrink hours over a live APPROVED Ã¢ÂÂ refuse. Over PENDING only Ã¢ÂÂ checkbox then save (request stays PENDING). Approve a request whose hour was closed Ã¢ÂÂ `booking.slot_not_offered`, still PENDING.

---

## Chapter 141 Ã¢ÂÂ 2026-09-13 Ã¢ÂÂ Day priceRules editor; flatten is hours-only

**When:** 2026-09-13

**What:** Pitch create/edit can add repeatable day-checkbox + USD `priceRules` (cap 10). Flatten retargeted to **hours mismatch only** Ã¢ÂÂ weekend prices no longer trip the confirm, and a duration/default-price save with unchanged hours keeps existing rules. `gapMinutes` stays hardcoded 0. Time-of-day rule clocks are not in the UI; stored `start`/`end` round-trip in the JSON draft if already present.

**Why:** BR-5 (weekend costs more). The MVP wrote `priceRules: []` and treated any rules as flatten, so A1 could not keep $40 Fri/Sat. Gap stays hidden because it moves the offered grid and hours-cover would not warn.

**Files:** `src/modules/venue/domain/daily-schedule.ts`; `schemas/pitch-draft.ts`; `application/{create-pitch,update-pitch,get-pitch-editor}.ts`; `src/app/owner/more/settings/pitches/{form,price-rules,actions,new,[pitchId]}`; copy catalogs; `docs/owner-ia.md`; tests.

**Relation:** No Booking/Payment write changes. Per-day hours grid, time-window rule editor, and `gapMinutes` UI stay out.

**How to verify:** `npm test` (includes duration+price-only save keeps weekend rules and `hoursSaveBlocker` is null). Edit a uniform-hours pitch with Fri/Sat $40 Ã¢ÂÂ no flatten checkbox; change duration or default USD; save; public/book still shows $40 on those days. Mixed-hours A1 still shows flatten for hours.

---

## Chapter 142 Ã¢ÂÂ 2026-09-13 Ã¢ÂÂ Price-rule checkbox ids must not use a module counter

**When:** 2026-09-13

**What:** `PriceRuleRows` used a module-level `rowSeq` for checkbox `id`/`htmlFor`. The Node module kept incrementing across SSR, so the client started at `r0` while the HTML was `r2` (hydration mismatch). Ids are now `useId()` + stable row index; new rows after click use a `useRef` (never during SSR).

**Why:** React hydrates against the server HTML. A process-wide counter is `Date.now()`/`Math.random()`-class input.

**Files:** `src/app/owner/more/settings/pitches/price-rules.tsx`

**How to verify:** Open `/owner/more/settings/pitches/[pitchId]` for A1 Ã¢ÂÂ no hydration warning in the console. Day checkboxes still toggle.

---

## Chapter 143 Ã¢ÂÂ 2026-09-13 Ã¢ÂÂ Hours groups; flatten retired

**When:** 2026-09-13

**What:** Pitch create/edit replaces the single Opens/Closes pair with repeatable hours groups (weekday checkboxes + one open/close per row). Collapse walks `WEEKDAYS`, skips `[]`, and groups identical window arrays Ã¢ÂÂ A1 is two rows (MonÃ¢ÂÂThu 16:00Ã¢ÂÂ22:00, FriÃ¢ÂÂSat 16:00Ã¢ÂÂ23:00) plus Sun closed. A day in two rows is disabled in the UI and rejected as `venue.hours_day_overlap`. Flatten (`confirmFlatten` / `needFlatten` / `venue.confirm_flatten`) is gone. Pending-in-removed-hours confirm stays. `gapMinutes` stays 0. Known limit: schema still allows several windows per day; the editor and collapse use `window[0]`.

**Why:** The schema already stored per-day hours; the form was writing one window onto all seven days and treating mixed days as a flatten confirm. That was a schema/form mismatch, not a copy problem. BR-3/4.

**Files:** `src/modules/venue/domain/{daily-schedule,hours-cover}.ts`; `schemas/pitch-draft.ts`; `application/{create-pitch,update-pitch,get-pitch-editor,list-pitch-summaries}.ts`; `src/app/owner/more/settings/{panel,pitches/form,hours-groups,actions,new,[pitchId]}`; copy catalogs; `docs/owner-ia.md`; tests.

**Relation:** Booking/Payment writes unchanged. Venue still does not import Booking. No time-window `priceRules` UI, no `gapMinutes` UI, no pitch delete, no `pitch_blocks`.

**How to verify:** `npm test`. Edit Ahmad A1 Ã¢ÂÂ two hours rows + Sun closed; Fri/Sat $40 still in Day Prices; no flatten checkbox. Duration-only save keeps hours groups and weekend prices. Duplicate day Ã¢ÂÂ `venue.hours_day_overlap`. Shrink hours over live APPROVED Ã¢ÂÂ refuse; PENDING-only Ã¢ÂÂ confirm then save.

---

## Chapter 144 Ã¢ÂÂ 2026-09-13 Ã¢ÂÂ SPEC-14 no-show (BR-22)

**When:** 2026-09-13

**What:** Fast-forwarded `main` to include Settings / hours groups, branched `feature/spec-14-no-show`. Owner (or `"bookings.no_show"`) records APPROVED Ã¢ÂÂ `NO_SHOW` after the hour has ended. Unpaid no-show stays on Home overdue/today so Collect still works (`assertCanCollect` allows `NO_SHOW`). Paid no-show leaves Home. Cancel, waitlist, exclusion, and ledger writes are unchanged. No confirm dialog.

**Why:** BR-22 wants Ã¢ÂÂdidnÃ¢ÂÂt happenÃ¢ÂÂ distinct from cancel. Cancel already refuses past unpaid (BR-49 / ch.136); no-show is that close-out without dropping the debt. DR-002 ÃÂ§2.12: status, not a boolean. SPEC-14.

**Files:** `docs/specs/SPEC-14-no-show.md`; `src/modules/access/domain/can.ts`; `booking/domain/decision.ts`; `application/{record-no-show,list-due-bookings,collect-booking-payment}.ts`; `infrastructure/bookings.ts`; `payment/domain/collect.ts`; `src/app/owner/today/{actions,lists,upcoming-panel}`; copy catalogs; `docs/owner-ia.md`; tests.

**Relation:** Payment still does not import Booking. Waitlist / public occupancy unchanged (`NO_SHOW` does not occupy). Pitch Settings untouched.

**How to verify:** `npm test`. Home Ã¢ÂÂ after a finished unpaid APPROVED, expand: Collect + ÃÂÃÂ ÃÂÃÂ­ÃÂ¶ÃÂ±, no Cancel. Tap no-show; still Collect. Collect remaining Ã¢ÂÂ row leaves. Future row: no No-show. `staff@ahmad`: no button. Stale POST before end Ã¢ÂÂ `booking.no_show_not_ended`.

---

## Chapter 145 Ã¢ÂÂ 2026-09-14 Ã¢ÂÂ Confirm-notify WhatsApp on Home

**When:** 2026-09-14

**What:** After Approve, HomeÃ¢ÂÂs confirmed row can ÃÂ¥ÃÂ¨ÃÂÃÂ§ÃÂº via `wa.me` with a Ã¢ÂÂbooking confirmedÃ¢ÂÂ Arabic body. Link is a static `<a>` (same as waitlist), not a Server Action. Expand groups ÃÂ¥ÃÂ¨ÃÂÃÂ§ÃÂº above ÃÂªÃÂ­ÃÂµÃÂÃÂ. Successful Approve redirects `ok=approved&highlight=<id>`; FlashToast still strips only `ok`; the row keeps a primary ring (coming-days opens if that id is in `later`). No auto-expand. Owner Book and reject-notify out.

**Why:** BR-71 Ã¢ÂÂbooking confirmedÃ¢ÂÂ. Players have no login. Waitlist Notify is the losersÃ¢ÂÂ hour-freed message; the winnerÃ¢ÂÂs confirm belongs on HomeÃ¢ÂÂs APPROVED expand. `approveBooking` is unchanged Ã¢ÂÂ notify is after the fact.

**Files:** `src/modules/notification/domain/whatsapp-link.ts` (`bookingConfirmedMessage`); `src/modules/booking/application/list-due-bookings.ts`; `src/app/owner/today/{actions,page,lists,upcoming-panel}`; `src/components/ui/flash-toast.tsx`; `src/lib/ui-copy.ts`; `docs/owner-ia.md`; tests.

**Relation:** Notification still does not import Booking. Booking builds the href. No Payment/Ledger write. `scrollIntoView` for a deep coming-days highlight is deferred on purpose (owner-ia Home deferred).

**How to verify:** `npm test`. Login `owner@ahmad` Ã¢ÂÂ pending Request Ã¢ÂÂ Approve Ã¢ÂÂ toast + ring on that ÃÂ§ÃÂÃÂÃÂ§ÃÂ¯ÃÂ row (`highlight=` stays in the URL). Expand: ÃÂ¥ÃÂ¨ÃÂÃÂ§ÃÂº then Collect/Cancel. Link opens WhatsApp; text is `{stadium}: {pitch} {start}Ã¢ÂÂ{end} ÃÂªÃÂ ÃÂªÃÂ£ÃÂÃÂÃÂ¯ ÃÂ­ÃÂ¬ÃÂ²ÃÂ.` Unpaid NO_SHOW: no ÃÂ¥ÃÂ¨ÃÂÃÂ§ÃÂº. Coming-days approve: that section is open, row may still be off-screen (no scrollIntoView yet).

---

## Chapter 146 Ã¢ÂÂ 2026-09-14 Ã¢ÂÂ Home confirmed details in a bottom sheet

**When:** 2026-09-14

**What:** Confirmed Home rows stay compact. Tap opens a shared bottom sheet (slide up, overlay, scroll inside) with ÃÂ¥ÃÂ¨ÃÂÃÂ§ÃÂº + Collect/Cancel/No-show. Rows show a trailing chevron (`rtl:rotate-180`), hover/active wash, and `cursor-pointer` so they read as tappable. `BottomSheet` is a general Dialog-based component Ã¢ÂÂ same overlay/RemoveScroll rules as the centered dialog; no extra library.

**Why:** Inline expand made the list very tall. A sheet keeps the list scannable and the actions on one surface. Chevron is the affordance that was missing.

**Files:** `src/components/ui/bottom-sheet.tsx`; `src/app/owner/today/upcoming-panel.tsx`; `src/lib/ui-copy.ts`; `docs/owner-ia.md`; `test/lib/ui-copy.test.ts`.

**Relation:** No Booking/Payment write changes. Highlight ring still on the compact row. Sheet is not auto-opened after Approve.

**How to verify:** `npm test`. Home Ã¢ÂÂ compact confirmed rows with chevron. Tap: sheet slides up over the tab bar; overlay tap / Esc / close dismisses. Collect and ÃÂ¥ÃÂ¨ÃÂÃÂ§ÃÂº still work in the sheet. RTL: chevron points toward the start edge.

---

## Chapter 147 Ã¢ÂÂ 2026-09-14 Ã¢ÂÂ Cancel booking is not Ã¢ÂÂclose the sheetÃ¢ÂÂ

**When:** 2026-09-14

**What:** Home sheet no longer has a full-width outline **ÃÂ¥ÃÂÃÂºÃÂ§ÃÂ¡** that reads as dismiss. The sheet still closes with X / overlay / Esc (`ÃÂ¥ÃÂºÃÂÃÂ§ÃÂ`). Booking cancel is a separate ghost **ÃÂ¥ÃÂÃÂºÃÂ§ÃÂ¡ ÃÂ§ÃÂÃÂ­ÃÂ¬ÃÂ²**, then a red **ÃÂªÃÂ£ÃÂÃÂÃÂ¯ ÃÂ¥ÃÂÃÂºÃÂ§ÃÂ¡ ÃÂ§ÃÂÃÂ­ÃÂ¬ÃÂ²** (hint: hour is freed) with **ÃÂªÃÂ±ÃÂ§ÃÂ¬ÃÂ¹**. `cancelBooking` is unchanged.

**Why:** In a bottom sheet, Ã¢ÂÂCancelÃ¢ÂÂ is the usual name for go-back. One tap was flipping APPROVED Ã¢ÂÂ CANCELLED forever. The owner (and the person who built it) hit it by mistake.

**Files:** `src/app/owner/today/upcoming-panel.tsx` (`CancelBookingControl`); `src/lib/ui-copy.ts`; `docs/owner-ia.md`; `test/lib/ui-copy.test.ts`.

**Relation:** No domain/status-rule changes. No-show stays one tap (`ÃÂÃÂ ÃÂÃÂ­ÃÂ¶ÃÂ±` does not mean close).

**How to verify:** `npm test`. Open a confirmed row Ã¢ÂÂ X / dim / Esc close the sheet, booking stays APPROVED. ÃÂ¥ÃÂÃÂºÃÂ§ÃÂ¡ ÃÂ§ÃÂÃÂ­ÃÂ¬ÃÂ² does not submit; ÃÂªÃÂ£ÃÂÃÂÃÂ¯ ÃÂ¥ÃÂÃÂºÃÂ§ÃÂ¡ ÃÂ§ÃÂÃÂ­ÃÂ¬ÃÂ² does. ÃÂªÃÂ±ÃÂ§ÃÂ¬ÃÂ¹ returns to the quiet button.

---

## Chapter 148 Ã¢ÂÂ 2026-09-14 Ã¢ÂÂ Cancel confirm replaces the sheet, does not grow it

**When:** 2026-09-14

**What:** Tap ÃÂ¥ÃÂÃÂºÃÂ§ÃÂ¡ ÃÂ§ÃÂÃÂ­ÃÂ¬ÃÂ² swaps the sheet to a short confirm view (title, which booking, hint, ÃÂªÃÂ£ÃÂÃÂÃÂ¯ / ÃÂªÃÂ±ÃÂ§ÃÂ¬ÃÂ¹). Collect / ÃÂ¥ÃÂ¨ÃÂÃÂ§ÃÂº go away until ÃÂªÃÂ±ÃÂ§ÃÂ¬ÃÂ¹. Confirm buttons stay above the screen edge; no extra scroll. Close / open another row resets the step.

**Why:** Appending the red confirm under Collect made a already-tall sheet taller; ÃÂªÃÂ£ÃÂÃÂÃÂ¯ sat under the fold.

**Files:** `src/app/owner/today/upcoming-panel.tsx`; `docs/owner-ia.md`.

**Relation:** Still two taps, same `submitCancelBooking`. No domain change.

**How to verify:** Open a confirmed row with Collect visible Ã¢ÂÂ ÃÂ¥ÃÂÃÂºÃÂ§ÃÂ¡ ÃÂ§ÃÂÃÂ­ÃÂ¬ÃÂ² Ã¢ÂÂ sheet shrinks; ÃÂªÃÂ£ÃÂÃÂÃÂ¯ and ÃÂªÃÂ±ÃÂ§ÃÂ¬ÃÂ¹ are on-screen without scrolling. ÃÂªÃÂ±ÃÂ§ÃÂ¬ÃÂ¹ restores Collect. X still only closes.

---

## Chapter 149 Ã¢ÂÂ 2026-09-14 Ã¢ÂÂ Smooth sheet height + close

**When:** 2026-09-14

**What:** Cancel confirm/back eases the sheet height (~320ms, same curve as the slide) and crossfades the two bodies. Closing X / overlay / Esc keeps the sheet mounted so it can slide down instead of vanishing. Opening the confirm step again does not replay that height anim during the slide-up.

**Why:** Instant swap felt hard. Unmounting `BottomSheetContent` on `openId = null` cancelled the exit animation.

**Files:** `src/components/ui/bottom-sheet.tsx` (`BottomSheetStage`); `src/app/owner/today/upcoming-panel.tsx`; `docs/owner-ia.md`.

**Relation:** Still two taps, same `submitCancelBooking`. No domain change.

**How to verify:** Open a confirmed row Ã¢ÂÂ sheet slides up. ÃÂ¥ÃÂÃÂºÃÂ§ÃÂ¡ ÃÂ§ÃÂÃÂ­ÃÂ¬ÃÂ² Ã¢ÂÂ sheet shrinks, buttons fade in. ÃÂªÃÂ±ÃÂ§ÃÂ¬ÃÂ¹ Ã¢ÂÂ sheet grows back. X / dim Ã¢ÂÂ sheet slides down. Reduced-motion: instant swap, no height tween.

---

## Chapter 150 Ã¢ÂÂ 2026-09-14 Ã¢ÂÂ Cancel step: inert, not aria-hidden on focused button

**When:** 2026-09-14

**What:** Hidden sheet step uses `inert` only (no `aria-hidden`). Tap ÃÂ¥ÃÂÃÂºÃÂ§ÃÂ¡ ÃÂ§ÃÂÃÂ­ÃÂ¬ÃÂ² blurs first, then focus moves to ÃÂªÃÂ£ÃÂÃÂÃÂ¯ ÃÂ¥ÃÂÃÂºÃÂ§ÃÂ¡ ÃÂ§ÃÂÃÂ­ÃÂ¬ÃÂ²; ÃÂªÃÂ±ÃÂ§ÃÂ¬ÃÂ¹ returns focus to ÃÂ¥ÃÂÃÂºÃÂ§ÃÂ¡ ÃÂ§ÃÂÃÂ­ÃÂ¬ÃÂ².

**Why:** Chrome blocked `aria-hidden` on the details panel because ÃÂ¥ÃÂÃÂºÃÂ§ÃÂ¡ ÃÂ§ÃÂÃÂ­ÃÂ¬ÃÂ² still had focus. Spec: donÃ¢ÂÂt hide a focused descendant; `inert` also prevents focus.

**Files:** `src/app/owner/today/upcoming-panel.tsx`

**Relation:** Same two-step cancel. No domain change.

**How to verify:** Open a confirmed row Ã¢ÂÂ ÃÂ¥ÃÂÃÂºÃÂ§ÃÂ¡ ÃÂ§ÃÂÃÂ­ÃÂ¬ÃÂ². Console should not show the aria-hidden focus warning. Focus ring lands on ÃÂªÃÂ£ÃÂÃÂÃÂ¯; ÃÂªÃÂ±ÃÂ§ÃÂ¬ÃÂ¹ lands on ÃÂ¥ÃÂÃÂºÃÂ§ÃÂ¡ ÃÂ§ÃÂÃÂ­ÃÂ¬ÃÂ².

---

## Chapter 151 Ã¢ÂÂ 2026-09-14 Ã¢ÂÂ Home sheet hierarchy and mixed-pay disclosure

**When:** 2026-09-14

**What:** Confirmed booking sheet: time is SlotFace-scale; pitch + name one muted line; phone is a small header icon+number. Due/remaining collapse to one remaining hero when they match; two tiles only after a partial. ÃÂ¥ÃÂ¨ÃÂÃÂ§ÃÂº is ghost above a divider; Collect is the primary. USD/LBP hide behind ÃÂ¯ÃÂÃÂ¹ ÃÂ¨ÃÂ¹ÃÂÃÂÃÂªÃÂÃÂ (one-tap Collect unmounts while open). Mixed USD is remaining, labeled ÃÂ§ÃÂÃÂÃÂªÃÂ¨ÃÂÃÂ ÃÂ¨ÃÂ§ÃÂÃÂ¯ÃÂÃÂÃÂ§ÃÂ±, not a $30 placeholder.

**Why:** Every field had the same weight. Slot picker and Home rows already had progressive disclosure; this sheet had not.

**Files:** `src/app/owner/today/upcoming-panel.tsx`; `src/lib/ui-copy.ts`; `test/lib/ui-copy.test.ts`; `docs/owner-ia.md`.

**Relation:** No `submitCollectPayment` / cancel / WhatsApp-href changes. Cancel-confirm step unchanged.

**How to verify:** `npm test`. Unpaid equal price/remaining: one hero, one Collect, no currency fields until ÃÂ¯ÃÂÃÂ¹ ÃÂ¨ÃÂ¹ÃÂÃÂÃÂªÃÂÃÂ. Open mixed: one-tap gone; USD prefilled remaining. Partial: two tiles. Paid: no Collect. RTL: no `pl`/`pr`.

---

## Chapter 152 Ã¢ÂÂ 2026-09-14 Ã¢ÂÂ Sheet start-edge, phone+ÃÂ¥ÃÂ¨ÃÂÃÂ§ÃÂº, mixed outline

**When:** 2026-09-14

**What:** Booking sheet copy and amounts use `text-start`; remaining hero/tiles drop extra `px` so `$` sits on the same start edge as ÃÂªÃÂ­ÃÂµÃÂÃÂ. ÃÂ¥ÃÂ¨ÃÂÃÂ§ÃÂº is a compact outline on the phone row (not its own section). ÃÂ¯ÃÂÃÂ¹ ÃÂ¨ÃÂ¹ÃÂÃÂÃÂªÃÂÃÂ is a full-width outline button; mixed disclosure (unmount one-tap, remaining USD) is unchanged.

**Why:** `$25.00` read as centered; ÃÂ¥ÃÂ¨ÃÂÃÂ§ÃÂº did not belong to the number; ghost `self-start` ÃÂ¯ÃÂÃÂ¹ ÃÂ¨ÃÂ¹ÃÂÃÂÃÂªÃÂÃÂ looked like a label.

**Files:** `src/app/owner/today/upcoming-panel.tsx`; `docs/owner-ia.md`.

**Relation:** Same `wa.me` `<a>` and `submitCollectPayment`. No domain change.

**How to verify:** Open a confirmed APPROVED row. Phone and ÃÂ¥ÃÂ¨ÃÂÃÂ§ÃÂº share a row. Time, remaining, Collect, ÃÂ¯ÃÂÃÂ¹ ÃÂ¨ÃÂ¹ÃÂÃÂÃÂªÃÂÃÂ, Cancel share the RTL start edge. ÃÂ¯ÃÂÃÂ¹ ÃÂ¨ÃÂ¹ÃÂÃÂÃÂªÃÂÃÂ has a border; tap still reveals USD/LBP and hides one-tap Collect.




























## Integration tests Ã¯Â¿Â½ dedicated prisma dev instance + Phase 1 cases

**When:** 2026-09-15

**What:** Priority-1 integration harness against real Postgres: smoke, `isExclusionViolation` (real `23P01`), `approveBooking` happy path, exclusion?`booking.slot_unavailable` mapping, deadlock guards A (elapsed < 5s) + B (`platformDb.tenant.findUnique` = 0 after warm-up).

**Why:** Prove exclusion + transactional approve without mocks of `23P01`. User confirmed dedicated test DB (not reuse-dev) and both A+B deadlock checks.

**Gotcha:** Local `prisma dev` **ignores the database name** in the URL and always serves `template1` for that named instance. `CREATE DATABASE stadiums_test` on the demo proxy does **not** isolate Ã¯Â¿Â½ early truncates wiped demo data (reseeded). Isolation = `prisma dev --name stadiums-test` on TCP **:51218**, never demo **:51214**. Local proxy is **single-connection**; truncate must use the app Prisma pool (no second `pg.Pool`); concurrent dual `` is not viable for the TOCTOU race Ã¯Â¿Â½ mapping test uses optional `deps.listApprovedRanges`.

**Files:** `test/integration/*`, `jest.integration.config.ts`, `jest.config.ts` (excludes `*.integration.test.ts`), `package.json` `test:integration`, `docs/guides/testing-jest.md`, `src/modules/booking/application/approve-booking.ts` (optional deps seam), `src/lib/prisma-base.ts` (`PG_POOL_MAX`).

**How it connects:** Integration suites import real application/domain/infra; request stubs mock `next/headers` + clearable React `cache`. Must not point `DATABASE_URL` at demo during truncate.

**How to verify:** `npx prisma dev --name stadiums-test --detach` (or `start`), then `npm run test:integration` ? 3 suites / 7 tests green. `npm test` still offline. Demo `:51214` still has seeded tenants after reseed.

## Local DB: Docker Postgres instead of prisma dev

**When:** 2026-09-15

**What:** Switched local development and integration tests from `prisma dev` (PGlite proxy) to Docker `postgres:16-alpine` with two databases: `stadiums_dev` (app/seed) and `stadiums_test` (integration). Deleted `ensure-db.ts` port/zombie workarounds. Inspect via DBeaver at localhost:5432 (no pgAdmin container).

**Why:** `prisma dev` ignores the database name in the URL; truncates could hit demo data. Real Postgres matches production droplet isolation.

**Files:** `docker-compose.yml`, `docker/postgres/init-test-db.sql`, `.env.example`, `test/integration/migrate-test-db.ts` (replaces `ensure-db.ts`), simplified `setup-env.ts` / `truncate.ts` / smoke; `package.json` `test:integration`; `docs/guides/testing-jest.md`.

**How to verify:** `docker compose up -d`; migrate + seed `stadiums_dev`; `npm run test:integration` green; DBeaver connects with `stadiums_local` / `stadiums_local_dev`.

**Correction:** Host port is **5433** (not 5432) because another local Docker Postgres already bound 5432. DBeaver ? localhost:5433.
## Money UI: signed USD + expense bottom sheet + row polish

**When:** 2026-09-15

**What:** Fixed Difference rendering `$-40.00` via `formatUsdMoney` (`-$40.00`). Expense form moved to a bottom sheet (`expense-sheet.tsx`). Expense rows: outline Add button, icon tile with category tint, description+amount primary, category/date separate secondary.

**Why:** Sign-inside-`$` is the same class of display bug as reversed time ranges; expense UI matched Home sheet/row hierarchy.

**Files:** `src/lib/money.ts`, `test/lib/money.test.ts`, `src/app/owner/money/{panel,expense-sheet}.tsx`.

**How to verify:** `/owner/money` with negative Difference shows `-$Ã¢ÂÂ¦`; Add expense opens sheet; list rows show tinted icons.

## Venue: atomic `updatePitch`

**When:** 2026-09-15

**What:** `updatePitch` wraps find Ã¢ÂÂ hours-cover classify Ã¢ÂÂ update in one `db.$transaction`. `findPitch` / `updatePitchRow` take `tx: TenantTx` (pass interactive `tx` or top-level `db`). `findPitchById` is a same-select alias for Booking call sites. Left `listPitches` / `insertPitch` / Access memberships on `db` (low near-term risk).

**Why:** Only realistic near-term mid-transaction Venue trigger from the engineering-audit footgun analysis Ã¢ÂÂ Settings hours save should be atomic.

**Files:** `src/modules/venue/infrastructure/pitches.ts`, `application/update-pitch.ts`, `application/get-pitch-editor.ts`.

**How to verify:** Edit pitch hours in Settings and save; approve/public booking still use `findPitchById(tx, Ã¢ÂÂ¦)`.

## Priority 3 dedup Ã¢ÂÂ starting

**When:** 2026-09-15

**What (planned):** (1) Shared internal booking insert helper; keep `insertPendingPublicBooking` / `insertApprovedOwnerBooking` exports. (2) One shared local HH:mm formatter. (3) Comments that `COMING_DAYS=7` vs `WINDOW_DAYS=5` are different concepts. (4) Delete dead `src/lib/db-with-comments.ts`.

**Why:** Engineering-audit Priority 3 Ã¢ÂÂ refactor/document only, no product behavior change.

## Priority 3 dedup Ã¢ÂÂ done

**When:** 2026-09-15

**What:** (1) `insertBookingDuring` shared helper; exports `insertPendingPublicBooking` / `insertApprovedOwnerBooking` unchanged. (2) `src/lib/format-local-hm.ts` Ã¢ÂÂ used by get-day-availability, list-due-bookings, list-open-waitlist, owner `formatLocalClock`. (3) Comments: `COMING_DAYS=7` = Home booking horizon; `WINDOW_DAYS=5` = day-chip strip (different concepts). (4) Deleted `src/lib/db-with-comments.ts` (zero imports).

**Why:** Engineering-audit Priority 3 Ã¢ÂÂ dedup/document only.

**Files:** `bookings.ts`, `format-local-hm.ts` + test, `get-day-availability.ts`, `list-due-bookings.ts`, `list-open-waitlist.ts`, `owner/shared.tsx`, `day-chips.tsx`; removed `db-with-comments.ts`.

**How to verify:** `npm test` Ã¢ÂÂ 224 passed.

## Docs: folder-structure.md matches the tree

**When:** 2026-09-15

**What:** Rewrote `docs/guides/folder-structure.md` from a stale target sketch (`[locale]`, `middleware.ts`, `lib/auth.ts`, `lib/i18n.ts`, `platform/`, module `ui/`) to the actual layout: `src/proxy.ts`, `(public)` / `login` / `owner/*`, `components/`, modules without `ui/`, access-owned auth, cookie locale helpers, `src/prisma/`.

**Why:** Engineering audit + owner-ia flagged this guide as describing files that are not in the repo.

**Files:** `docs/guides/folder-structure.md` only.

**How to verify:** Open the guide and walk the tree under `src/` Ã¢ÂÂ listed paths should exist; commented Ã¢ÂÂno Ã¢ÂÂ¦Ã¢ÂÂ notes should stay absent.

## Audit: error handling + logging (read-only)

**When:** 2026-09-15

**What:** Full consistency audit of Server Actions + application use cases vs DR-004/SPEC-12, plus logger completeness vs business events. No code fixes.

**Why:** Need evidence before claiming Ã¢ÂÂevery error has an expected shapeÃ¢ÂÂ / Ã¢ÂÂwe can debug production from logs.Ã¢ÂÂ

**Files:** `docs/guides/error-handling-logging-audit.md` (new).

**How to verify:** Open that guide Ã¢ÂÂ every claim cites file/line; ordered P0Ã¢ÂÂP3 list at the end.

## P0: logout action wrap + WhatsApp soft-fail logs

**When:** 2026-09-15

**What:** (1) `submitLogout` try/catch + `actionErrorKey` Ã¢ÂÂ `?error=` on login (same shape as `submitLogin`). (2) Home confirm + waitlist WhatsApp catch blocks `logger.info` with useCase + tenantId, still return null (no phone in log).

**Why:** Error-handling audit P0 Ã¢ÂÂ DR-004 action boundary + Ã¢ÂÂlog side-effect failuresÃ¢ÂÂ; RULE-9 soft-fail unchanged. `info` not `error`: bad phone is expected data, not a system bug.

**Files:** `src/app/login/actions.ts`, `list-due-bookings.ts`, `list-open-waitlist.ts`.

**How to verify:** `npm test` Ã¢ÂÂ 224 passed. Force logout DB failure Ã¢ÂÂ login `?error=`; bad phone on Home/waitlist Ã¢ÂÂ null href + line in `logs/`.

## P1: read-path wrap + business-log context

**When:** 2026-09-15

**What:** (1) `rethrowUnexpected` on every audited list/get/summarize use case (auth / `getCurrentTenant` stay outside try so `access.not_allowed` and `notFound` are unchanged). (2) Business `logger.info` lines pass `{ useCase, tenantId }` like error paths; message text unchanged.

**Why:** Error-handling audit P1 Ã¢ÂÂ Prisma failures on reads must hit the logger; success events must be greppable by tenant/useCase on the droplet.

**Files:** 11 read wraps + 12 info-context updates (23 unique application files).

**How to verify:** `npm test` Ã¢ÂÂ 224 passed. Approve/collect Ã¢ÂÂ `logs/` line includes `useCase=` + `tenantId=`.

## Audit: MVP readiness (read-only)

**When:** 2026-09-15

**What:** Full launch-readiness audit Ã¢ÂÂ BRD Phase 1 traceability, money integrity, isolation (unproven by automation), droplet performance, i18n/RTL, docs drift, deploy, fresh YAGNI/DRY. No code fixes. Isolation test not run (fixture needs parameterization).

**Why:** Need an honest Ã¢ÂÂhand to a paying owner?Ã¢ÂÂ answer with file evidence, not architecture vibes.

**Files:** `docs/guides/mvp-readiness-audit.md` (new).

**How to verify:** Open that guide Ã¢ÂÂ eight sections + ordered P0Ã¢ÂÂP3 must-close list; verdict is pilot-with-supervision, not production-ready.

## Isolation integration test (RULE-7) + tenant guard fix

**When:** 2026-09-15

**What:** Parameterized `seedMinimalFixture` + `seedTwoTenants`. New `test/integration/isolation.integration.test.ts` Ã¢ÂÂ under AÃ¢ÂÂs context: findUnique null for BÃ¢ÂÂs pitch, listPitches excludes B, update throws + B unchanged, `requestPublicSlot` Ã¢ÂÂ `booking.pitch_not_found` with no B booking. Guard fix in `db.ts`: inject `tenantId` into findUnique select when omitted; **pre-check** update/delete via `findFirst({ ...where, tenantId })` (post-check was too late Ã¢ÂÂ write already committed).

**Why:** MVP readiness P0 Ã¢ÂÂ prove RULE-7 in practice. First run exposed that `findPitch`/`updatePitchRow` selects without `tenantId` skipped the post-check, so cross-tenant update succeeded.

**Files:** `test/integration/fixtures.ts`, `isolation.integration.test.ts`, `src/lib/db.ts`.

**How to verify:** `npm run test:integration` Ã¢ÂÂ 11 passed (4 suites).

## Docs consolidation Ã¢ÂÂ NOW.md entry point

**When:** 2026-09-15

**What:** Added `docs/NOW.md` as the single living status entry. Rewrote root `README.md` and `docs/README.md` to point at it. Fixed living staleness (`owner-ia` proxy TODO, prisma-transaction-tenant-guard footer, progress **Where we are**). One-line superseded banners on SPEC-01, DR-001, DR-005, SPEC-13, and the three dated audits. No audit merges, no progress rollup.

**Why:** Docs had grown redundant/stale; agents need one clear start page.

**Files:** `docs/NOW.md`, `README.md`, `docs/README.md`, `docs/owner-ia.md`, `docs/guides/prisma-transaction-tenant-guard.md`, `docs/progress.md` (Where we are), banner lines on listed historical docs.

**How to verify:** Open `docs/NOW.md` Ã¢ÂÂ status, topic table, WhatÃ¢ÂÂs next = backup + deploy docs.

## Owner time display 12h/24h (Tenant.settings)

**When:** 2026-09-15

**What:** Additive `Tenant.settings` jsonb (default `{}`). Zod `timeDisplay: h23|h12`. OWNER Settings card below Exchange rate. `getCurrentTenant` parses settings once per request. Owner Home / Book / Waitlist pass `hourCycle` into `formatLocalHm` / `getDayAvailability`; public + WhatsApp keep default h23. No SPEC-15 Ã¯Â¿Â½ Settings slice like pitch hours.

**Why:** Owners asked for 12h clocks; Arabic AM/PM on WhatsApp was a known risk, so customer-facing surfaces stay 24h. DR-002 Ã¯Â¿Â½2.6 column finally exists for this knob only.

**Files:** `src/prisma/schema.prisma` + migration `20260915060000_tenant_settings`; `src/lib/tenant-settings.ts`; `src/lib/tenant-context.ts`; `src/lib/format-local-hm.ts`; `src/modules/access/{application/set-time-display,infrastructure/tenants}.ts`; `src/app/owner/{shared,today/lists,waitlist/list,book/slots}.tsx`; `src/modules/venue/application/get-day-availability.ts`; `src/app/owner/more/settings/{panel,actions}.tsx`; copy + success keys; `docs/owner-ia.md`; tests `test/lib/{tenant-settings,format-local-hm}.test.ts`.

**Relation:** ALS still only for tenant isolation Ã¯Â¿Â½ `timeDisplay` rides on the same `CurrentTenant` object already stored for id; UI reads via `getCurrentTenant()` in Server Components, not as a new ALS display bus. Access owns the OWNER write (platformDb Tenant row). Venue `getDayAvailability` takes optional `hourCycle`; public callers omit it. Must not import Booking from Access.

**How to verify:** `npm test`. Migrate applied on dev. Settings ? set 12-hour ? Home/Book/Waitlist show `4:00 PM`; public `/` and WhatsApp prepare links still `16:00`.

## Public clocks follow tenant timeDisplay

**When:** 2026-09-15

**What:** `PublicHours` passes `hourCycle: tenant.timeDisplay` into `getDayAvailability`. Owner + public share the setting; WhatsApp bodies still default h23.

**Why:** Product call after ship Ã¯Â¿Â½ stadium visitors should see the same clock format the owner chose.

**Files:** `src/app/(public)/hours.tsx`; comments in `get-day-availability.ts`, `tenant-settings.ts`; `docs/owner-ia.md`.

**How to verify:** Settings ? 12-hour ? reload public `/` for that tenant Ã¯Â¿Â½ slots show `4:00 PM`. WhatsApp prepare text still `16:00`.

## Slot picker: keep AM/PM on one line

**When:** 2026-09-15

**What:** `SlotFace` time column `whitespace-nowrap` + `shrink-0` so `5:00 PM` does not wrap under `text-xl` in the 2-col grid.

**Why:** 12h `timeDisplay` made start/end strings longer than the old `HH:mm` the card was sized for.

**Files:** `src/components/slot-picker.tsx`.

**How to verify:** Public or Book with 12h Ã¯Â¿Â½ PM stays beside the clock, not under it.

## GitHub Actions CI (tests + build, no deploy)

**When:** 2026-09-16

**What:** Workflow `.github/workflows/ci.yml` on every push/PR: `npm ci`, `prisma generate` (generated client is gitignored), `npm test`, `npm run test:integration` against a `postgres:16-alpine` service (`stadiums_test`), then `npm run build`. No deploy. Dummy DB creds only (same as `.env.example`).

**Why:** Catch unit/integration/build failures on the PR, not later. Backup/deploy still unsolved Ã¢ÂÂ out of scope.

**Files:** `.github/workflows/ci.yml`

**How it connects:** Invokes existing `test:integration` (`migrate-test-db.ts` + Jest). Does not change test files or scripts. ALS/tenant isolation unchanged.

**How to verify:** Push this branch or open a PR Ã¢ÂÂ Actions tab must go green. A red step fails the job (PR not "safe").

## CI build fixes (Prisma create types + Node 24)

**When:** 2026-09-16

**What:** First CI `next build` failed on two existing TS issues: `createPerson` data XOR (same cast as `insertRequesterParticipant` / `insertPitch`); `createOwnerBooking` catch did not `return await rethrowUnexpected` so the function looked like it could return `undefined`. Workflow actions bumped to checkout/setup-node `@v5` and Node 24 (Node 20 action runtime is deprecated on GH runners).

**Why:** Make the CI job green without changing test scripts.

**Files:** `src/modules/people/infrastructure/persons.ts`; `src/modules/booking/application/create-owner-booking.ts`; `.github/workflows/ci.yml`

**How to verify:** Push Ã¢ÂÂ CI build step passes. `npm test` still green.

## Remove ?tenant= (host-only tenant)

**When:** 2026-09-22

**What:** Deleted the half-finished `?tenant=` / `TenantHiddenField` / `tenant-query` WIP. Tenant slug is host-only (`ahmad.localhost` / `ahmad.lvh.me` / subdomain). Forms, links, redirects, and keep lists no longer carry `tenant`.

**Why:** Local already uses subdomain; query-param tenant was never isolation and the WIP imported a missing `@/lib/tenant-query`.

**Files:** `src/lib/tenant-slug.ts`, `src/proxy.ts`, owner/public login + tabs/forms/links; deleted `tenant-hidden-field.tsx` and `test/lib/tenant-query.test.ts`.

**How it connects:** `parseTenantSlug(host)` feeds proxy `x-tenant-slug`, then `getCurrentTenant`. Does not change Prisma, isolation, or business modules.

**How to verify:** `npm test`. Browse `ahmad.localhost:3000` Ã¢ÂÂ no `?tenant=` on links or after form POST.

## Fix 404 after Server Action redirect (collapsed Host)

**When:** 2026-09-22

**What:** After removing `?tenant=`, login/logout (and any Server Action `redirect()`) soft-nav showed Next 404 until hard refresh. Root cause: follow-up RSC request sends `Host: localhost:3000` while `x-forwarded-host` still has `ahmad.localhost:3000`. `resolveRequestHost` in `tenant-slug.ts` prefers forwarded / Origin / Referer when Host is bare localhost; proxy uses it.

**Why:** `?tenant=` used to mask this (query won over host). Host-only resolution exposed vercel/next.js#65893-class behavior. Not login-specific Â any action redirect.

**Files:** `src/lib/tenant-slug.ts`, `src/proxy.ts`, `test/lib/tenant-slug.test.ts`.

**How to verify:** `npm test`. Login on `ahmad.localhost:3000` ? lands on Home without 404; logout ? login form without 404. Approve/collect redirects should stay clean too.

## Login page Â tenant-first hierarchy + pinned Arabic RTL

**When:** 2026-09-22

**What:** Login card leads with tenant name, `????? ??????` as muted subtitle; removed slug line. Page forces `dir=rtl lang=ar` and Arabic `ui`/`errorMessage` so an EN cookie cannot left-align Arabic. Footer: muted `Powered by lebstads.com`. Identifier/password inputs `dir=ltr`. No locale toggle. No action/field changes.

**Why:** Slug `LtrIsolate block` sat on the left; cookie EN + Arabic copy risked LTR layout. Brand/tenant should own the card; platform credit below.

**Files:** `src/app/login/page.tsx`.

**How to verify:** `ahmad.localhost:3000/login` Â Ahmad Stadium large, login title smaller, no `ahmad` slug, footer under card, labels right-aligned even after public EN toggle.

## Owner typography consistency pass

**When:** 2026-09-22

**What:** Codified the dominant owner type scale. Page titles stay `h2 font-heading text-xl`. Section labels stay muted `h3 text-sm font-medium`. Unified pitch/entity names to `text-sm font-medium` (waitlist, settings, slot picker). Fieldset legends match section muted. EmptyState title `text-sm font-medium`. Tab labels `text-xs`. `global-error` h1 uses `font-heading text-2xl` like `error.tsx`. Time emphasis (row `text-lg` / sheet `text-xl`) left as intentional exceptions.

**Why:** Walk after login redesign Â headings and body felt uneven across tabs.

**Files:** `empty-state.tsx`, `slot-picker.tsx`, `waitlist/list.tsx`, `settings/panel.tsx`, `hours-groups.tsx`, `price-rules.tsx`, `tab-bar.tsx`, `global-error.tsx`, `globals.css`.

**How to verify:** Spot-check Home / Book / Waitlist / Settings Â page titles same; section eyebrows muted sm; pitch names same weight/size.

## Owner sticky header

**When:** 2026-09-22

**What:** Extracted `OwnerHeader` client chrome: `sticky top-0` with backdrop blur, safe-area padding, scroll elevation (border + soft shadow). Tenant name is Kufi `text-base`; role + identifier muted on one line; lang toggle + logout with hover transitions. Layout stays RSC and passes labels in.

**Why:** Header scrolled away with content; wanted modern fixed chrome matching the sticky tab bar.

**Files:** `src/app/owner/header.tsx` (new), `layout.tsx`, `docs/owner-ia.md`.

**How to verify:** Login ? scroll Home Â header stays; after a few px it gains a light border/shadow. Logout / EN still work.

## Owner header matches tab bar

**When:** 2026-09-22

**What:** Restyled `OwnerHeader` as a floating card like `OwnerTabBar`: `rounded-2xl border bg-card/95 shadow-lg backdrop-blur-md`, inset with `px-3` + safe-area. Scroll deepens shadow. Dropped full-bleed blur strip.

**Why:** Flat sticky strip did not read as chrome; user asked to match bottom nav.

**Files:** `src/app/owner/header.tsx`.

**How to verify:** `/owner/today` Â top pill mirrors bottom tab bar; scroll strengthens shadow.

## Day chips: no Tomorrow label

**When:** 2026-09-22

**What:** `DayChips` no longer labels offset 1 as `public.tomorrow` (???? / Tomorrow). Tomorrow uses weekday + day number like the rest of the strip; only Today stays special.

**Why:** Tomorrow overflowed the chip box on public + Book date rows.

**Files:** `src/components/day-chips.tsx`.

**How to verify:** Public `/` and `/owner/book` Â second chip shows e.g. Wed / 23, not Tomorrow.

## Drop in-progress slots from the grid

**When:** 2026-09-23

**What:** `dropEndedSlots` and `resolveOfferedSlot` now refuse slots whose **start** is `<= now` (was end-based). At 9:30 a 9:00Â10:00 hour no longer appears or accepts Request/Book/Approve.

**Why:** In-progress games were still listed because end was still after now.

**Files:** `src/modules/venue/domain/availability.ts`, `src/modules/booking/domain/offered-slot.ts`, matching tests.

**How to verify:** `npm test -- --testPathPatterns=availability|offered-slot`. Public/Book today mid-hour Â only starts still in the future show.

## Phase 1 Â design-system token layer

**When:** 2026-09-23

**What:** Three-layer tokens in `globals.css` (primitives ? roles ? shadcn aliases), real light/dark (surfaces step up), `--brand` / `--success` split (volt vs emerald), `next-themes` toggle with no FOUC, Big Shoulders as `font-display`, `LtrIsolate` tabular display, palette page at `/dev/palette`, `MIGRATION.md` started.

**Why:** `docs/theme.md` + `ui-foundations.md` Â components must stop reading hex; accent collision documented (shadcn `--accent` stays wash; action colour is `--brand` / `primary` / `accent-brand`).

**Files:** `src/app/globals.css`, `src/app/layout.tsx`, `src/components/theme-provider.tsx`, `src/components/theme-toggle.tsx`, `src/components/ui/sonner.tsx`, `src/components/ui/ltr-isolate.tsx`, `src/components/ui/button.tsx`, `src/components/ui/badge.tsx`, `src/lib/ui-copy.ts`, `src/app/dev/palette/page.tsx`, `docs/MIGRATION.md`.

**How it connects:** Layout owns ThemeProvider + fonts. Components still use shadcn class names; role utilities are available for Phase 2. Must not import modules from `app/`. Tenant `brandHex` injection not shipped yet.

**How to verify:** `http://ahmad.localhost:3000/dev/palette` Â Light/Dark/System; selected is carbon in light, volt in dark; accent is volt both themes; success is emerald.

## Volt is a fill; action ink is carbon in light

**When:** 2026-09-23

**What:** `--action-ink` is `--ink` in light and `--brand` in dark. `--ring` matches. Primary-as-text/border/ring/wash call sites use `action-ink`. Money-in figures and the in-bar use `success` (emerald).

**Why:** `#D7FF3F` on `#F6F5EF` is ~1.3:1. `--primary` used to be emerald and was used as ink. `docs/theme.md` ink-safe action colour.

**Files:** `src/app/globals.css`, `docs/theme.md`, `docs/MIGRATION.md`, `src/components/ui/button.tsx`, `src/components/ui/badge.tsx`, `src/components/day-chips.tsx`, `src/components/slot-picker.tsx`, `src/app/owner/tab-bar.tsx`, `src/app/owner/money/panel.tsx`, `src/app/owner/today/upcoming-panel.tsx`.

**How it connects:** Solid `bg-primary` stays volt. Must not use `text-primary` for labels. Money-in must not import booking.

**How to verify:** Light `/dev/palette` Ã¢ÂÂ computed `--action-ink` and `--ring` are `#111412`, `--primary` stays `#d7ff3f`. System theme flips when the OS scheme changes without reload. Login stays Arabic RTL and follows `.dark`.

## Slot request opens a bottom sheet

**When:** 2026-09-23

**What:** Public and owner Book name/phone flow uses `BottomSheet` instead of `Dialog`. Same props, selection state, and form. Sheet visuals are the existing component, not restyled.

**Why:** `ui-components.md` Ã¢ÂÂ a flow with inputs is a sheet. Structural move before the slot restyle, while the diff is only the wrapper.

**Files:** `src/components/slot-picker.tsx`, `docs/MIGRATION.md`.

**How it connects:** `SlotPicker` is shared by `(public)/slot-picker` and `owner/book`. Must not import booking or venue modules. Sheet restyle comes later in Phase 2.

**How to verify:** Public `/` on a tenant host Ã¢ÂÂ tap an open hour. Name and phone slide up from the bottom; close clears the selection.

## Typography roles: Manrope, stacks, Arabic scale

**When:** 2026-09-23

**What:** Manrope (400Ã¢ÂÂ800, latin) is `--font-manrope`. `font-sans` is Manrope then Plex Arabic. `font-heading` and `font-display` are Big Shoulders, then Kufi, then Plex Arabic. `:lang(ar)` sets looser line-height, steps text-xs/sm/base, and forces `letter-spacing: normal`. Root font-size is unchanged.

**Why:** Latin UI needed its own face. Arabic must not be tracked (joining). Numbers stay in `dir=ltr` display islands.

**Files:** `src/app/layout.tsx`, `src/app/globals.css`, `docs/theme.md`, `docs/MIGRATION.md`.

**How it connects:** next/font variables on `html`. Must not branch on lang in components. Plex Mono stays for codes.

**How to verify:** `/owner/book` Ã¢ÂÂ body font Manrope; a slot timeÃ¢ÂÂs computed family is `\"Big Shoulders\"` and `document.fonts.check('700 16px \"Big Shoulders\"')` is true. English `tracking-tight` is negative; Arabic is `normal`.

## Slot tile: inverse fill, until-word, muted duration

**When:** 2026-09-23

**What:** Slot presentation only. Idle tile is inverse in light and surface in dark. Selected tile is an accent fill with carbon ink. End time uses `public.until` (ÃÂ­ÃÂªÃÂ / until). Duration is a surface-2 micro pill with muted ink. Unavailable is a stripe and not a button.

**Why:** `ui-components.md` time slot. Volt duration was outranking the price. Arrow glyphs do not flip in RTL. Accent time stays on the dark tile only.

**Files:** `src/components/slot-picker.tsx`, `src/lib/ui-copy.ts`, `src/app/globals.css` (`.fill-stripe`), `docs/MIGRATION.md`.

**How it connects:** Shared by public hours and owner Book. No booking/venue imports. Passed state is not in the slot data. Sheet chrome is still unrestyled; the summary time uses ink because the sheet ground is surface.

**How to verify:** `/owner/book` light and dark, Arabic and English. Time is the largest volt figure on a dark tile; price is second; `1h` is a muted pill; the end line says ÃÂ­ÃÂªÃÂ or until.

## Day picker selected state is a fill

**When:** 2026-09-23

**What:** Selected day is `bg-selected` / `text-selected-ink` (carbon in light, volt in dark). Unselected is surface + line. No ring, no shadow. Today shows its date number. The calendar chip icon inherits the cell ink.

**Why:** `ui-components.md` day picker. `42e555f` had moved the ring onto `action-ink`, which is still an outline, not a fill swap.

**Files:** `src/components/day-chips.tsx`, `src/components/date-calendar-chip.tsx`, `docs/MIGRATION.md`.

**How it connects:** Shared by public `/` and owner Book. Links and the date query key are unchanged. Activity dots are not in the data.

**How to verify:** `/owner/book` Ã¢ÂÂ light selected cell is carbon with off-white ink; dark selected cell is volt with carbon ink. No ring.

## Empty state: dashed panel, display title

**When:** 2026-09-23

**What:** `EmptyState` sits on the page with a dashed `line-strong` outline and panel radius. Title is display; the sentence is muted ink. Props stay `title` and `next`.

**Why:** `ui-components.md` empty state. A filled card was the old ground. Icon tile and optional action would be new props; callers do not pass them.

**Files:** `src/components/ui/empty-state.tsx`, `docs/MIGRATION.md`.

**How it connects:** Used by public hours, Book, Today, waitlist, money, and settings. No module imports.

**How to verify:** `/owner/book` Pitch A3 â dashed outline, no fill, in light and dark, Arabic and English. Light border computes to `#D5D4CA`.

## Responsive shell: container, rail, slot density

**When:** 2026-09-23

**What:** One `Container` sets every page width. Slot tiles are two zones at 96px. The owner tab bar stays one component: a floating bottom bar below `lg`, and a 240px sticky start-side rail at `lg`. Screen titles scale; prices and slot numbers do not.

**Why:** Breakpoint plan for the design-system migration. Portrait tablets stay thumb-driven. The rail uses `inset-inline-start` and `border-inline-end` so Arabic puts it on the right without a direction branch.

**Files:** `src/components/ui/container.tsx`, `src/components/slot-picker.tsx`, `src/components/day-chips.tsx`, `src/components/ui/bottom-sheet.tsx`, `src/components/ui/sonner.tsx`, `src/app/owner/layout.tsx`, `src/app/owner/tab-bar.tsx`, `src/app/owner/header.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, public/login/error/palette pages, `docs/MIGRATION.md`.

**How it connects:** Presentation only. No booking or venue imports. Empty state props are unchanged. Sheet and toast positions follow the breakpoint; their visual contracts are still ahead.

**How to verify:** 390 / 768 / 1280, light and dark, Arabic and English, on `/owner/book`, `/owner/money`, `/owner/waitlist`, and `/`. Rail is on the right in Arabic and the left in English. Slot tiles stay at or under 320px. At max scroll the last line sits above the bottom bar. `viewport` meta includes `viewport-fit=cover`.

## Correction: mobile header float, day row always shows the calendar

**When:** 2026-09-23

**What:** Below `lg` the owner header is a floating inverse bar, inset like the bottom nav. At `lg` it stays the full-width dark block. The day row no longer scrolls: today stays first, the calendar stays last, and later days appear only when the row can hold them.

**Why:** The dark block was applied at every width, so the phone lost the floating bar. Hiding the calendar below `lg` removed the way to pick a day outside the strip.

**Files:** `src/app/owner/header.tsx`, `src/components/day-chips.tsx`, `src/app/globals.css` (`.day-strip`), `src/app/(public)/skeletons.tsx`, `docs/MIGRATION.md`.

**How it connects:** Same `DayChips` on public hours and owner Book. No booking imports. Container width is unchanged.

**How to verify:** `/owner/book` at 390 — header is a rounded inverse bar inset from the edges, today and the calendar are both visible, and the page does not scroll sideways. At 1280 the header is a square dark block and all seven days plus the calendar fit.

## Owner shell (UX-01 slice 1)

**When:** 2026-09-23

**What:** Amended `docs/owner-ux.md` after the audit, then shipped the shell. The header keeps the floating bar below `lg` and the dark block at `lg`, and it stays put on scroll. Avatar and name open a business menu (public page, settings shortcut, account with language and log out). The offline pill shows "بدون اتصال" only while offline. Destinations are Today, Requests, a center ＋, Money, and More. At `lg` the ＋ is a primary button at the top of the rail. `/owner/book` and `/owner/waitlist` stay routes with a title and a back button. Tab roots have no large title. `settings.manage` gates settings forms; `OWNER` still passes `can()`.

**Why:** UX-01, amended after audit. SPEC-14, session length, `recordNoShow`, `cancelBooking`, public `DayChips`, and cross-tenant membership were left alone.

**Files:** `docs/owner-ux.md`, `docs/owner-ia.md`, `.cursor/rules/100-rtl-i18n.mdc`, `src/modules/access/domain/can.ts`, `src/app/owner/header.tsx`, `src/app/owner/business-menu.tsx`, `src/app/owner/offline-pill.tsx`, `src/app/owner/tab-bar.tsx`, `src/app/owner/layout.tsx`, `src/app/owner/requests/page.tsx`, `src/app/owner/pending-list.tsx`, `src/app/owner/back-link.tsx`, settings and pitch gates, `src/lib/ui-copy.ts`.

**How it connects:** The shell calls `listPendingRequests` for the badge and reuses the pending list. It does not import payment or change booking mutations. Copy is `ui()` only. The ＋ sheet links to existing Book and Money screens. Search is a control with no results screen. Show QR reveals the public URL; there is no QR image library.

**How to verify:** Phone, Arabic, `http://ahmad.localhost:3000/owner/today`. Header stays while scrolling. Menu has no switch-business. Language and log out are under Account. Bar is اليوم / الطلبات / تسجيل / المال / المزيد. ＋ opens حجز and مصروف. Requests is not a 404. Today still lists pending. Settings still open for the owner. `npm test` and `npm run build`.

## Correction: theme toggle in the business menu

**When:** 2026-09-23

**What:** Light / dark / system sits under Account in the business menu, above the language toggle.

**Why:** The control existed only on the palette page, so the owner shell had no way to change theme.

**Files:** `src/app/owner/business-menu.tsx`, `src/components/theme-toggle.tsx`, `docs/owner-ux.md`.

**How it connects:** Same `ThemeToggle` as the palette. It writes the `next-themes` choice. No module imports.

**How to verify:** Open the business menu on `/owner/today`. فاتح / داكن / نظام switches the page. The choice survives a refresh.

## More hub and share-card header

**When:** 2026-09-23

**What:** The business sheet is a share card (avatar, name, public link, WhatsApp / QR / Copy, log out). More is grouped rows. Business rows need `settings.manage`. Preferences save on tap. `/owner/more/settings` redirects to `/owner/more`. The active tab is lime text. Lime fill stays on ＋.

**Why:** UX-01 §2.1 and §8, amended the same day. Exchange rate and time format still use the existing actions. Booking rules (BR-27) are not stored, so that sheet does not write.

**Files:** `docs/owner-ux.md`, `docs/owner-ia.md`, `src/app/owner/business-menu.tsx`, `src/app/owner/share-card.tsx`, `src/app/owner/more/hub.tsx`, `src/app/owner/more/page.tsx`, `src/app/owner/more/settings/page.tsx`, `src/app/owner/more/settings/pitches/page.tsx`, `src/app/owner/tab-bar.tsx`, `src/components/ui/bottom-sheet.tsx`, `src/modules/payment/application/get-current-rate.ts`.

**How it connects:** Sheets call `submitSetExchangeRate` and `submitSetTimeDisplay`. Pitch create/edit are unchanged aside from landing on the pitch list. No booking or payment rule changes. `getCurrentRate()` still returns the decimal.

**How to verify:** Phone, Arabic, `/owner/more`. Business group shows the rate with separators. Update rate is a primary button. Language choices are العربية and English. The active tab is lime text, and only ＋ is a lime fill.

## Today: request banner and card status

**When:** 2026-09-23

**What:** Today no longer lists pending cards. When there is at least one request, one row shows the count and the earliest time and opens Requests. Each confirmed card’s trailing state comes from `deriveCardDisplay` (before, live, unpaid, partial, paid). Ended unpaid and partial cards have Collect, which opens the existing collect sheet.

**Why:** UX-01 Today. The helper uses instants, so a game that ends after midnight stays live until that end. Cancel, no-show, and collect rules are unchanged. Paid no-shows stay off Today (existing list filter).

**Files:** `src/modules/booking/domain/card-display.ts`, `test/modules/booking/domain/card-display.test.ts`, `src/app/owner/today/lists.tsx`, `src/app/owner/today/upcoming-panel.tsx`, `src/lib/ui-copy.ts`.

**How it connects:** Display only. Today still calls `listPendingRequests` and `listDueBookings`. Collect still uses `submitCollectPayment`. Requests keeps the full pending list.

**How to verify:** Arabic, `/owner/today`. With a pending request, the banner is one row. A future game shows the price. An ended unpaid game shows the amount due and تحصيل. A paid approved game shows مدفوع. Jest: `card-display.test.ts`.

## Owner app installable as a PWA

**When:** 2026-09-23

**What:** Per-tenant web manifest at `/manifest.webmanifest`, placeholder icons, and a pass-through `public/sw.js` registered on `/owner`. The proxy matcher skips the manifest, the worker, icons, favicon, and apple-touch-icon.

**Why:** Those URLs 404’d (manifest and worker as HTML). Icons did not exist. `start_url` has to stay on the tenant origin. The worker rules after “Only:” were not in the request, so the worker does not cache.

**Files:** `src/app/manifest.ts`, `src/proxy.ts`, `src/app/layout.tsx`, `src/components/owner-service-worker.tsx`, `public/sw.js`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-512-maskable.png`.

**How it connects:** Manifest reads the tenant name with `platformDb` from the host (`parseTenantSlug`). It does not use `getCurrentTenant` (that 404s without `x-tenant-slug`, and the matcher no longer sets that header on this URL). No owner page, domain, or application module changes. No new dependencies.

**How to verify:** On `ahmad.localhost:3000`, `/manifest.webmanifest` is `application/manifest+json` with relative `start_url` `/owner/today` and scope `/owner/`, and the tenant name. `/sw.js` is `application/javascript`. The three icon URLs are `image/png` with no redirect. Open `/owner/today` while logged in and confirm the worker registers for scope `/owner/`.

## PWA scope, offline page, and login path

**When:** 2026-09-23

**What:** `short_name` keeps whole words up to 12 characters (`Ahmad Stadium` → `Ahmad`). Login moved to `/owner/login`; `/login` is a 308. The owner shell does not guard that page. The worker precaches only `/offline.html` and serves it when a navigation fails. `/sw.js` is `Cache-Control: no-cache`.

**Why:** A login URL outside `/owner/` leaves the installed app. Caching authenticated HTML would show stale money on a shared phone. The earlier worker had no cache rules.

**Files:** `src/lib/pwa-short-name.ts`, `test/lib/pwa-short-name.test.ts`, `src/app/manifest.ts`, `src/app/owner/login/page.tsx`, `src/app/login/actions.ts`, `src/app/owner/shared.tsx`, `src/app/owner/layout.tsx`, `src/proxy.ts`, `next.config.ts`, `public/sw.js`, `public/offline.html`, `test/lib/tenant-slug.test.ts`. Deleted `src/app/login/page.tsx`.

**How it connects:** `pwaShortName` is pure. Login still calls `submitLogin` and `getCurrentTenant`. `requireOwnerMembership` redirects to `/owner/login`. The layout skips that path via `x-pathname` from the proxy, so there is no loop and no tab bar. No domain or application module changes. The worker does not cache navigations, RSC, or actions.

**How to verify:** Jest `pwa-short-name.test.ts`. Manifest `short_name` is `Ahmad`. `/login?error=access.invalid_login` is 308 to `/owner/login?error=access.invalid_login`. Logged-out `/owner/today` is 307 to `/owner/login`, and `/owner/login` is 200. `/sw.js` is `Cache-Control: no-cache`. DevTools: worker active, scope `/owner/`. Offline reload of `/owner/today` shows the offline page; Retry loads the app. Public `/` does not register the worker.

## Owner shell route group

**When:** 2026-09-23

**What:** Shell routes live under `src/app/owner/(app)/`. Login stays at `src/app/owner/login` with no shell. `x-pathname` is gone. Each `(app)` page calls `requireOwnerMembership`; the layout does not redirect. Login actions moved to `src/app/owner/login/actions.ts`. Worker cache is `owner-shell-v2`, and a missing offline cache returns a 503 text response.

**Why:** Local route-groups.md: a parenthesized folder is not part of the URL, and only routes inside it share that layout. The path header was only used to skip the shell on login.

**Files:** `src/app/owner/(app)/` (layout and the former owner routes), `src/app/owner/login/page.tsx`, `src/app/owner/login/actions.ts`, `src/app/owner/business-menu.tsx`, `src/app/owner/pending-list.tsx`, `src/proxy.ts`, `public/sw.js`, `test/app/owner/money/bars.test.ts`. Deleted `src/app/login/`.

**How it connects:** URLs are unchanged. The layout still reads membership for the tab bar via `getCurrentMembership` and skips the pending list when there is no session, so a logged-out page can redirect. No domain or application changes. `/login` still 308s to `/owner/login`.

**How to verify:** `npx jest --watchAll=false` (250) and `npm run build`. Logged-out `/owner/today` is 307 to `/owner/login`. `/owner/login` is 200 without the shell. Build lists the same `/owner/*` routes.

## UX-02 slice 1 — a Beirut day on Today

**When:** 2026-09-24

**What:** `/owner/today?date=YYYY-MM-DD` opens one civil day. The strip steps with ‹ ›, shows اليوم when the day is not today, and leaves the calendar icon disabled. Past days have no limit. Future days stop at `OWNER_FUTURE_DAYS` (60). A bad date, or a date past that limit, opens today. The line under the strip is game count, USD collected, and USD still owed, from one aggregate. The list is APPROVED, CANCELLED, and NO_SHOW whose start falls on that day. On today only, للتحصيل lists up to five ended games that still have remaining (oldest first), then عرض الكل to Money. Cancelled cards are grey and struck. An unpaid no-show says لم يحضر and can still be collected. A paid no-show says مدفوع.

**Why:** `docs/ux-02-history.md`, amended after audit the same day (D1–D4, D8, D10). A game stays on the Beirut day of its start, including a window that ends after midnight. Collected means payments on that day’s games, whatever day the money came in. Owed is what those games still have left.

**Files:** `docs/ux-02-history.md`, `src/modules/booking/domain/start-day.ts`, `src/modules/booking/domain/card-display.ts`, `src/modules/booking/application/load-owner-day.ts`, `src/modules/booking/infrastructure/bookings.ts`, `src/prisma/migrations/20260924030000_booking_start_day_index/migration.sql`, `src/app/owner/(app)/today/page.tsx`, `src/app/owner/(app)/today/lists.tsx`, `src/app/owner/(app)/today/day-strip.tsx`, `src/app/owner/(app)/today/upcoming-panel.tsx`, `src/lib/ui-copy.ts`, `test/modules/booking/domain/start-day.test.ts`, `test/modules/booking/domain/card-display.test.ts`.

**How it connects:** Today no longer calls `listDueBookings`. That function, the public day chips, and the approved-overlap exclusion are unchanged. Collect, cancel, and no-show rules are unchanged. Cancelled games are not in للتحصيل, because collect rejects them. The new index is `("tenantId", lower(during))`. Search, the month page, transaction rows, and actor columns are later slices.

**How to verify:** `npx jest --watchAll=false` (258) and `npm run build`. Migration `20260924030000_booking_start_day_index` is applied. On the phone, open today, `?date=2026-09-23` (paid no-show and a cancelled game), a future `?date=`, and a date past 60 days (it opens today).

## Today day line is summarizeDay

**When:** 2026-09-24

**What:** The day summary is `summarizeDay(rows, now)` in booking domain, over the rows the day list already loaded. Games are APPROVED only. No-shows are a count, shown when at least 1. Collected is USD on every status. Owed is remaining on ended APPROVED games plus remaining on no-shows. Expected is remaining on APPROVED games that have not ended, including one in progress. Zero owed, expected, and no-shows drop off the line. On today the date header is "اليوم · <date>". A cancelled card strikes only the time. The name, pitch, and ملغى stay grey, on the card surface.

**Why:** UX-02 D8 correction the same day. The old aggregate counted cancelled games and treated all remaining as owed.

**Files:** `src/modules/booking/domain/day-summary.ts`, `test/modules/booking/domain/day-summary.test.ts`, `src/modules/booking/application/load-owner-day.ts`, `src/modules/booking/infrastructure/bookings.ts`, `src/app/owner/(app)/today/lists.tsx`, `src/app/owner/(app)/today/day-strip.tsx`, `src/app/owner/(app)/today/upcoming-panel.tsx`, `src/lib/ui-copy.ts`, `docs/ux-02-history.md`.

**How it connects:** `summarizeStartDay` is gone. Nothing else called it. `listBookingsForStartDay` and `listEndedWithRemaining` stay. No other screen changed. Money’s LBP toggle is untouched.

**How to verify:** `npx jest --watchAll=false` (265) and `npm run build`. Arabic Today: an upcoming game shows متوقع and not مستحق. After that game ends unpaid, the same amount moves to مستحق. A cancelled paid game shows in محصّل only. A future day omits مستحق and متوقع.

## Day line plurals and compact dollars

**When:** 2026-09-24

**What:** `plural()` in `src/lib` picks a counted-noun template with `Intl.PluralRules`. Game and no-show copy lives next to `ui()` with a form per category. The day line drops every zero money figure, including collected. An empty day says لا مباريات / No games. `formatUsdCompact` prints `$30` or `$12.50` on that line and on card trails. The collect sheet still uses `formatUsd`.

**Why:** "2 مباريات" and "$30.00" were the wrong Arabic and the wrong precision for a glance.

**Files:** `src/lib/plural.ts`, `src/lib/ui-copy.ts`, `src/lib/money.ts`, `src/app/owner/(app)/today/lists.tsx`, `test/lib/plural.test.ts`, `test/lib/money.test.ts`, `docs/ux-02-history.md`.

**How it connects:** Display only. `summarizeDay` is unchanged. No other screen. Exact USD strings stay two decimals.

**How to verify:** `npx jest --watchAll=false` and `npm run build`. Arabic: 1 game is مباراة واحدة, 2 is مباراتان, 3 is 3 مباريات, an empty future day is لا مباريات, and $12.50 keeps the cents.

## SPEC-15 slice 1 — amount due on the booking

**When:** 2026-09-24

**What:** Booking gains `collectionMode` (default WHOLE) and `amountDueUsd`, backfilled from `priceUsd`. Remaining, card paid-state, day owed/expected, collect, and cancel use `amountDueUsd`. `priceUsd` stays the agreed price on the card. `splitEvenly`, `personOwedOnBooking`, and the three USD remainders are pure. `setBookingAmountDue` is the later write path and nothing calls it yet. Migration `20260924060000_per_player_foundation` is written and not applied.

**Why:** SPEC-15 slice 1. DR-002 §2.11 and §2.14: the due can leave the price, and a payment still has no participant column. SPEC-03 / SPEC-06 / SPEC-14 stay WHOLE. Screens must show the same numbers while `amountDueUsd` equals `priceUsd`.

**Files:** `src/prisma/schema.prisma`, `src/prisma/migrations/20260924060000_per_player_foundation/migration.sql`, `src/modules/payment/domain/collect.ts`, `src/modules/booking/domain/split-evenly.ts`, `src/modules/booking/domain/person-owed.ts`, `src/modules/booking/domain/day-summary.ts`, `src/modules/booking/infrastructure/bookings.ts`, `src/modules/booking/application/collect-booking-payment.ts`, `src/modules/booking/application/cancel-booking.ts`, `src/modules/booking/application/list-due-bookings.ts`, `src/modules/booking/application/load-owner-day.ts`, `src/app/owner/(app)/today/lists.tsx`, `src/lib/error-messages.ts`, and the new Jest files next to the domain helpers.

**How it connects:** `bookingRemaining` lives in payment domain (same subtract as `remainingDue`; payment does not learn WHOLE vs PER_PLAYER). `splitEvenly` and `personOwedOnBooking` live in booking domain (slot order and requester). `people` is unchanged. The exclusion constraint is unchanged. Per-player mode, naming, and allocations are later slices. Prisma cannot declare `WHERE`, so the phone unique and the one-requester unique are SQL comments in the schema, not `@@unique`.

**How to verify:** `npx jest --watchAll=false` (277) and `npm run build`. Do not open Today until `npx prisma migrate deploy --config prisma7.config.ts` — the new column is not on `stadiums_dev` yet. Duplicate requester rows were 0. No booking has a partial collection.

## SPEC-15 slice 1 migration applied

**When:** 2026-09-24

**What:** The same migration `20260924060000_per_player_foundation` gained slot indexes, non-negative due checks, a requester-must-have-person check, and a unique `(paymentId, participantId)` on `PaymentAllocation`. It was applied to `stadiums_dev`. Existing rows that would break those checks: 0 negative `priceUsd`, 0 negative participant `amountDueUsd`, 0 requesters with a null person. Guards raise if that is not true.

**Why:** Review additions on slice 1. Prisma still cannot declare `WHERE` or `CHECK`, so those stay in SQL. `@@index([bookingId, slotNumber])` and `@@unique([paymentId, participantId])` match the indexes Prisma can express.

**Files:** `src/prisma/migrations/20260924060000_per_player_foundation/migration.sql`, `src/prisma/schema.prisma`.

**How it connects:** Exclusion constraint unchanged. For slice 2, `collectBookingPayment` must assert that every allocated participant belongs to the booking the payment is for. `Payment.sourceId` has no foreign key, so the database cannot enforce that.

**How to verify:** On `ahmad.localhost`, Today (24 Sep) is مباراة واحدة · $30 متوقع. Hussein’s sheet is المتبقي $30.00 and تحصيل $30.00. 23 Sep is لا مباريات · غياب واحد · $30 محصّل. Mahmoud’s sheet is مستحق $30.00 and المتبقي $0.00, card لم يحضر · مدفوع. سامي is ملغى.

## UX-02 slice 2 — person page and search

**When:** 2026-09-24

**What:** `/owner/people/[personId]` shows the name, the phone when it exists, and stats: games played, no-shows, total paid, owes now. Owes now is the sum of `personOwedOnBooking` on APPROVED and NO_SHOW participations. The games list is every participation, newest first, 20 per page, keyset `(lower(during), booking id)`. Header search is `/owner/search`. Names on Today and Requests link with the person id from the query. `Person.searchName` is backfilled in the migration SQL with the same fold as `normalizeName`.

**Why:** UX-02 §4 as amended (D5). SPEC-15 §2.3 is the owes rule, so the person page does not use the booking price. `people` does not import `booking`; the page calls both. Search orders by folded name. Sorting by latest booking would make `people` read `Booking`.

**Files:** `src/modules/people/domain/normalize-name.ts`, `src/modules/people/infrastructure/persons.ts`, `src/modules/people/application/get-person.ts`, `src/modules/people/application/search-people.ts`, `src/modules/booking/domain/person-owed.ts`, `src/modules/booking/domain/person-stats.ts`, `src/modules/booking/application/get-person-booking-stats.ts`, `src/modules/booking/application/list-person-bookings.ts`, `src/modules/booking/infrastructure/bookings.ts`, `src/prisma/migrations/20260924070000_person_search_name/migration.sql`, `src/prisma/schema.prisma`, `src/app/owner/(app)/people/[personId]/`, `src/app/owner/(app)/search/`, `src/app/owner/header.tsx`, `src/app/owner/(app)/today/upcoming-panel.tsx`, `src/app/owner/pending-list.tsx`, `src/lib/ui-copy.ts`.

**How it connects:** `createPerson` writes `searchName`. There is no rename yet. A missing person on this tenant is 404. Logged-in membership may open the page, same as Today. Who-owes is still later. For SPEC-15 slice 2, collect must still assert each allocated participant belongs to `Payment.sourceId`'s booking.

**How to verify:** `npx jest --watchAll=false` (282) and `npm run build`. Migration applied on `stadiums_dev`. Search احمد finds أحمد. Phone `78862587` finds Mahmoud Hijazi.

## Stale Prisma client after searchName

**When:** 2026-09-24

**What:** Creating an owner booking for a new person failed with `Unknown argument searchName` on `person.create`. The generated client on disk already had the field. The running `npm run dev` still held the client from before `prisma generate`. `isCurrentGeneratedClient` now also requires `Person.searchName` on `_runtimeDataModel`, and the dev server was restarted.

**Why:** `globalThis.prismaBaseSingle` survives for the life of the process. The old check only looked for `expense.findMany`, so a client from before the search column stayed in use.

**Files:** `src/lib/prisma-base.ts`.

**How it connects:** `createPerson` still writes `searchName` via `normalizeName`. No schema or migration change. A generate that adds a column still needs a process restart; the check only drops a cached client when this module loads again.

**How to verify:** On `ahmad.localhost`, create a booking for a new name and phone. The person row should save. `/owner/today` without a session redirects to `/owner/login`.

## UX-02 fixes — one due rule and Levantine dates

**When:** 2026-09-24

**What:** `classifyDue` decides owed, expected, or none. `summarizeDay` and person stats both use it. Owes now is owed only; expected shows beside it when it is above zero. Calendar dates go through `formatDisplayDate` (`ar-LB` / `en`, Western digits). Person stats and game rows use `formatUsdCompact`. Owed amounts use `text-alert`, the same token as Today cards.

**Why:** UX-02 follow-up after slice 2. An upcoming game was counted as owed on the person page and expected on the day line. Arabic dates used `ar`, which prints سبتمبر.

**Files:** `src/modules/booking/domain/classify-due.ts`, `src/modules/booking/domain/day-summary.ts`, `src/modules/booking/domain/person-stats.ts`, `src/lib/format-display-date.ts`, `src/app/owner/(app)/today/date-label.ts`, `src/app/owner/(app)/today/day-strip.tsx`, `src/components/day-chips.tsx`, `src/app/owner/(app)/people/[personId]/stats.tsx`, `src/app/owner/(app)/people/[personId]/games.tsx`.

**How it connects:** Person remaining still comes from `personOwedOnBooking`. Cancelled remainder is none in this step and owed after SPEC-16 slice 1. `people` still does not import `booking`.

**How to verify:** `npx jest --watchAll=false` (291) and `npm run build`. Hussein's page shows $0 · $30 متوقع and 24 أيلول. أحمد's games show أيلول. Today header is اليوم · الخميس، 24 أيلول.

## SPEC-16 slice 1 — due changes, unapplied

**When:** 2026-09-24

**What:** `BookingDueChange` migration is written and not applied. Settings gain `cancellationWindowHours` (24), `lateCancellationFeePercent` (0), and `noShowFeePercent` (100) with Zod defaults, so existing jsonb parses. `suggestFee`, `assertAdjustDue`, and `adjustBookingDue` are in. Cancel and no-show take a fee and write the due change in the same transaction as the status. `bookings.adjust_due` is OWNER yes, STAFF no. `classifyDue` treats a cancelled remainder as owed.

**Why:** SPEC-16 slice 1. The fee is a change of `amountDueUsd`, logged with a reason. The ledger stays cash-only.

**Files:** `src/prisma/schema.prisma`, `src/prisma/migrations/20260924080000_booking_due_change/migration.sql`, `src/lib/tenant-settings.ts`, `src/lib/db.ts`, `src/modules/booking/domain/suggest-fee.ts`, `src/modules/booking/domain/adjust-due.ts`, `src/modules/booking/domain/classify-due.ts`, `src/modules/booking/application/adjust-booking-due.ts`, `src/modules/booking/application/write-due-change.ts`, `src/modules/booking/application/cancel-booking.ts`, `src/modules/booking/application/record-no-show.ts`, `src/modules/access/domain/can.ts`.

**How it connects:** Do not apply the migration until it is approved. Until then, cancelled rows still have `amountDueUsd = priceUsd`, and the new classify rule would show them as owed. Collect still refuses CANCELLED. `Payment.sourceId` still has no foreign key.

**How to verify:** `npx jest --watchAll=false` (308) and `npm run build`. Migration file is not in `_prisma_migrations`. Two CANCELLED bookings, both collected 0, would go from amountDueUsd 30.00 to 0.00.

## SPEC-16 review fixes, migration applied, waitlist after cancel

**When:** 2026-09-25

**What:** Collect allows CANCELLED when remaining is above zero. To collect and `listDueBookings` include a cancelled remainder only when `classifyDue` says owed. Cancel and no-show omit the fee from the form; the use case uses the suggestion, then `confirmedFee` keeps the due at least at what was collected and logs `CANCELLATION_NO_FEE` when nothing above collected is charged. `suggestFee` uses `amountDueUsd`. Migration `20260924080000_booking_due_change` is applied. After a cancel, the same sheet lists open interests for that pitch and window (earliest first, excluding the person who cancelled) via `listOpenWaitlist`. A future cancelled card shows an interested-count chip. Requests shows "ساعات فاضية فيها مهتمون" under pending, hidden when that list is empty.

**Why:** Review of SPEC-16 slice 1 (RULE-9, never below collected) and UX-01 §6.3. SPEC-16 supersedes "a cancellation is not a debt" in `docs/ux-02-history.md`.

**Files:** `src/modules/payment/domain/collect.ts`, `src/modules/booking/domain/suggest-fee.ts`, `src/modules/booking/domain/waitlist.ts`, `src/modules/booking/application/cancel-booking.ts`, `src/modules/booking/application/record-no-show.ts`, `src/modules/booking/application/list-due-bookings.ts`, `src/modules/booking/infrastructure/bookings.ts`, `src/app/owner/notify-list.tsx`, `src/app/owner/(app)/requests/free-slots.tsx`, `src/app/owner/(app)/requests/free-slot-list.tsx`, `src/app/owner/(app)/today/upcoming-panel.tsx`, `docs/ux-02-history.md`.

**How it connects:** `peopleWaitingOn` only filters groups `listOpenWaitlist` already marked open. Open means the window has not ended and no APPROVED range overlaps that pitch. A new APPROVED booking closes the window, so the chip and the Requests section drop it. `/owner/waitlist` (`page.tsx`, `list.tsx`, `skeleton.tsx`) is still a route and is not in the tab bar. `people` still does not import `booking`.

**How to verify:** `npx jest --watchAll=false` (314) and `npm run build`. `npx prisma migrate deploy --config prisma7.config.ts` applied `20260924080000`. 23 أيلول and 24 أيلول show the old cancelled cards as ملغى with no مستحق on the day line. Cancelling Saturday 4:00–5:00 after approving لينا listed أحمد then كريم, chip مهتمان. Rebooking that hour removed it from ساعات فاضية فيها مهتمون.

## SPEC-16 slice 2 — cancel, no-show, adjust, booking rules

**When:** 2026-09-25

**What:** Owner UI for SPEC-16 §5.1, §5.2, §5.3, and §5.7. The cancel sheet asks اللاعب ألغى or أنا ألغيت, then shows the server-side `suggestFee` line with تعديل and إعفاء only when `bookings.adjust_due` is on. The fee is posted only after edit or waive. The no-show sheet uses the same line (`noShowFeePercent` of the current due). Adjust amount, for an owed or expected WHOLE booking, posts `adjustBookingDue` and blocks a new due below what was collected with "تم تحصيل $X، لا يمكن الاسترداد بعد." More → قواعد الحجز saves the window and the 0/50/100 percents through `setBookingRules` (`settings.manage`). `/owner/waitlist` is a 308 to `/owner/requests`. App copy "فاضية" is now "متاحة".

**Why:** SPEC-16 slice 2. Slice 3 (request warning, public policy line, WhatsApp fee text) is not in this step. Domain files were not changed.

**Files:** `next.config.ts`, `src/lib/ui-copy.ts`, `src/lib/tenant-settings.ts`, `src/lib/tenant-context.ts`, `src/lib/success-messages.ts`, `src/lib/error-messages.ts`, `src/modules/access/application/set-booking-rules.ts`, `src/modules/booking/schemas/adjust-due-form.ts`, `src/app/owner/(app)/more/hub.tsx`, `src/app/owner/(app)/more/page.tsx`, `src/app/owner/(app)/more/settings/actions.ts`, `src/app/owner/(app)/today/actions.ts`, `src/app/owner/(app)/today/lists.tsx`, `src/app/owner/(app)/today/fee-forms.tsx`, `src/app/owner/(app)/today/upcoming-panel.tsx`, `src/modules/booking/infrastructure/bookings.ts`, `src/modules/booking/application/load-owner-day.ts`. Deleted `src/app/owner/(app)/waitlist/`.

**How it connects:** Display calls `suggestFee` and `classifyDue`. Confirm still goes through `cancelBooking`, `recordNoShow`, and `adjustBookingDue`. A missing fee means the use case applies the suggestion and `confirmedFee` will not drop the due below collected. `people` still does not import `booking`. WhatsApp copy stays colloquial and is not this slice.

**How to verify:** `npx jest --watchAll=false` (317) and `npm run build`. `GET /owner/waitlist` is 308 to `/owner/requests`. Arabic sheets: player cancel inside 24 hours shows ألغى قبل 15 ساعة · الرسوم $20 on a $40 game after rules are 24 / 50 / 100; أنا ألغيت hides the line when nothing was collected; إعفاء shows $0; no-show on a $30 game shows لم يحضر · الرسوم $30; adjust to $5 after $10 collected shows تم تحصيل $10، لا يمكن الاسترداد بعد.

## Requests — interests in the slot, full time-ago, collected kept

**When:** 2026-09-25

**What:** A Requests group that already has pending requests also shows open interests on the same pitch when the windows overlap. Interests and requests are one list, earliest first (interest `createdAt`, request `requestedAt`). An interest row is the name, ينتظر منذ plus the date, and the existing notify control. Approve and Reject stay on request rows. ساعات متاحة فيها مهتمون lists only open interests with no overlapping pending request. The heading is the plural helper (طلب واحد / طلبان / 3 طلبات) with the digits isolated; the Today pending banner uses the same phrase. Time-ago is قبل 5 دقائق, قبل ساعة, قبل ساعتين, قبل 3 ساعات, أمس, قبل 3 أيام, and the English forms. On cancel and no-show, when something was collected and the owner waives or edits the fee to no more than that, the sheet adds تم تحصيل $X ويبقى محفوظاً under the fee line.

**Why:** Requests tab fix. No domain change.

**Files:** `src/app/owner/(app)/requests/merge-slots.ts`, `src/app/owner/(app)/requests/free-slots.tsx`, `src/app/owner/pending-list.tsx`, `src/app/owner/notify-list.tsx`, `src/app/owner/(app)/today/fee-forms.tsx`, `src/app/owner/(app)/today/lists.tsx`, `src/app/owner/(app)/more/hub.tsx`, `src/lib/ui-copy.ts`, `src/modules/booking/application/list-open-waitlist.ts`, `test/app/owner/merge-slots.test.ts`, `test/lib/ui-copy.test.ts`.

**How it connects:** Overlap is `overlaps()` from `offered-slot` in the app layer. `groupPendingBySlot` and `waitlist.ts` are unchanged. `listOpenWaitlist` now returns `createdAt`; the SQL already selected it. The heading counts pending rows only. The kept line is display-only: waive still posts `feeUsd` 0.00, and `confirmedFee` will not drop the due below collected. `people` still does not import `booking`. WhatsApp `slotAvailableMessage` is unchanged. `pendingCount`, `confirmedCount`, and `overdueCount` still return an unused "label · n" string and are not rendered.

**How to verify:** `npx jest --watchAll=false` (323) and `npm run build`. Arabic Requests: Saturday 9:00–10:00 shows player-y (ينتظر منذ 25 أيلول, إبلاغ) above player-z (قبل … دقيقة, موافقة/رفض) under طلب واحد. Saturday 7:00–8:00 is only under ساعات متاحة فيها مهتمون. Waive on رامي shows تم تحصيل $10 ويبقى محفوظاً under الرسوم $0. That confirm was reverted: رامي is APPROVED, amountDueUsd 40.00, and the $10 payment remains.

## SPEC-16 slice 3 — debt warning, public policy, WhatsApp

**When:** 2026-09-25

**What:** Requests shows a debt warning on a pending row and on an interest row when `classifyDue` says owed and `personOwedOnBooking` puts the remainder on that person. The line is ⚠ عليه, the compact total, the latest owed reason, and that booking's start date. Tapping it opens the person page. Approve and Reject stay as they were. One `listDebtParticipations` query covers every person on the pending list and the open-interest section. The public request sheet shows the cancellation policy only when `lateCancellationFeePercent` is above 0, with the window and percent from tenant settings. WhatsApp Arabic bodies are Lebanese. The cancel sheet picks the player/no-fee, player/with-fee, or owner template from the initiator and the fee on screen.

**Why:** SPEC-16 §5.4–§5.6. App labels stay standard Arabic. The warning never blocks a decision.

**Files:** `src/modules/booking/domain/debt-warning.ts`, `src/modules/booking/application/list-debt-warnings.ts`, `src/modules/booking/infrastructure/bookings.ts`, `src/modules/booking/domain/person-stats.ts`, `src/modules/notification/domain/whatsapp-link.ts`, `src/app/owner/(app)/requests/inbox.tsx`, `src/app/owner/(app)/requests/page.tsx`, `src/app/owner/(app)/requests/free-slots.tsx`, `src/app/owner/pending-list.tsx`, `src/app/owner/notify-list.tsx`, `src/app/owner/(app)/today/fee-forms.tsx`, `src/app/owner/(app)/today/upcoming-panel.tsx`, `src/app/owner/(app)/today/lists.tsx`, `src/app/owner/(app)/people/[personId]/stats.tsx`, `src/app/(public)/hours.tsx`, `src/app/(public)/slot-picker.tsx`, `src/components/slot-picker.tsx`, `src/components/ui/ltr-isolate.tsx`, `src/lib/ui-copy.ts`, `src/modules/booking/application/list-open-waitlist.ts`, `src/modules/booking/application/load-owner-day.ts`, `src/modules/booking/application/list-due-bookings.ts`.

**How it connects:** The fold is `debtWarnings`. The query is infrastructure. `people` still does not import `booking`. Expected games are not owed. The note is the owed booking with the latest start; the reason is that booking's latest `BookingDueChange`, or omitted when there is none. `IsolatedDigits` keeps a trailing `%` inside the same LTR isolate as the digits. WhatsApp times stay `h23`. English WhatsApp bodies are parallels of the same placeholders; the live templates were Arabic only. `bookingRejectedMessage` is tested and has no send button (no reject-reason chips). No-show has no WhatsApp template. Confirm, slot-available, payment reminder, and the three cancel templates are wired.

**How to verify:** `npx jest --watchAll=false` (329) and `npm run build`. Arabic Requests: رامي's Saturday 8:00 PM request shows ⚠ عليه $10 · رسوم إلغاء، الجمعة، 25 أيلول with موافقة and رفض. هدى's Saturday 7:00 PM interest shows ⚠ عليه $20 · رسوم إلغاء، الجمعة، 25 أيلول. The public sheet says الإلغاء قبل أقل من 24 ساعة من الموعد: رسوم 50% من السعر. Player cancel inside the window shows مرحبا هدى، انلغى حجزك يوم الجمعة، 25 أيلول الساعة 19:00. رسوم الإلغاء $20. Rules stay 24 / 50 / 100. رامي's Friday 5:00 PM is CANCELLED with $10 collected and $10 still owed, plus the Saturday request. هدى's Friday 6:00 PM is CANCELLED with a $20 fee and $0 collected. A Friday 7:00 PM booking made only to open that message was then cancelled by the owner with no fee.

## Messaging gaps — reject chips, approve notify, no-show, shared clock

**When:** 2026-09-25

**What:** رفض opens a reason sheet (الساعة محجوزة / الملعب مغلق / سبب آخر, plus English Slot taken / Pitch closed / Other reason). Confirm still calls `rejectBooking(bookingId)` with no reason stored, then the notify list uses the rejected template with `{reason}` from the chip, or the free-text note for سبب آخر. موافقة now opens the same notify list: the requester on the confirmed template, then every sibling auto-rejected in that approve, on the rejected template with reason الساعة محجوزة. The no-show sheet shows an optional إبلاغ عبر واتساب row. With a fee: مرحبا {name}، ما إجيت على حجزك يوم {day} الساعة {time}. رسوم عدم الحضور {fee}. With waive or a zero fee: the same line ending نشوفك المرة الجاي! English parallels exist. Every WhatsApp clock and the app clocks that have a locale go through `formatLocalHm` and the tenant `timeDisplay`: 12-hour Arabic is 7:00 مساءً / 7:00 صباحاً, 12-hour English is 7:00 PM / 7:00 AM, 24-hour is 19:00.

**Why:** UX-01 §4.2–§4.3. Correction to the slice 3 chapter above: the rejected template now has a sender, no-show now has templates, and WhatsApp times follow `timeDisplay` instead of a hardcoded 24-hour clock.

**What existed:** Approve redirected to `/owner/today?ok=approved&highlight=` (a row ring only). The details sheet had one إبلاغ عبر واتساب for the confirmed booking. Auto-rejected siblings became slot interests and were not listed. Reject posted immediately, with no chips and no notify list. The no-show sheet had the fee line and confirm, and no message. WhatsApp times were `h23` while the app clock used `timeDisplay`.

**Files:** `src/lib/format-local-hm.ts`, `src/app/owner/shared.tsx`, `src/modules/venue/application/get-day-availability.ts`, `src/modules/notification/domain/whatsapp-link.ts`, `src/lib/ui-copy.ts`, `src/modules/booking/application/approve-booking.ts`, `src/modules/booking/application/reject-overlapping-pending.ts`, `src/modules/booking/application/load-decision-notify.ts`, `src/modules/booking/infrastructure/bookings.ts`, `src/app/owner/(app)/today/actions.ts`, `src/app/owner/(app)/today/fee-forms.tsx`, `src/app/owner/(app)/requests/reject-sheet.tsx`, `src/app/owner/(app)/requests/decision-notify.tsx`, `src/app/owner/(app)/requests/inbox.tsx`, `src/app/owner/(app)/requests/page.tsx`, `src/app/owner/notify-list.tsx`, `src/app/owner/pending-list.tsx`, `src/modules/booking/application/list-open-waitlist.ts`, `src/modules/booking/application/load-owner-day.ts`, `src/modules/booking/application/list-due-bookings.ts`, `test/lib/format-local-hm.test.ts`, `test/modules/notification/domain/whatsapp-link.test.ts`, `test/lib/ui-copy.test.ts`.

**How it connects:** `rejectBooking` is unchanged. The reason lives only in the notify query and the message. `approveBooking` returns the people rejected in that transaction; the page reloads them from slot interests on that window and drops ids that are not interests there. `people` still does not import `booking`. `formatLocalHm` defaults locale to `en`, so callers that omit it keep Latin AM/PM. Notifications stay after the transaction.

**How to verify:** `npx jest --watchAll=false` (332) and `npm run build`. Arabic, tenant `h12`. Reject ندى (Saturday 5:00–6:00 PM, chip الساعة محجوزة): مرحبا ندى، للأسف ما منقدر نأكدلك حجز السبت، 26 أيلول الساعة 5:00 مساءً (الساعة محجوزة). إذا بدك وقت تاني، شوف الساعات المتاحة: http://ahmad.localhost:3000/ Approve ليلى (Saturday 6:00–7:00 PM) lists ليلى تم التأكيد (… الساعة 6:00 مساءً … منشوفك!) then سامي and كريم on the rejected template with (الساعة محجوزة). Hussein's Thursday 7:00–8:00 PM no-show sheet, not confirmed: مرحبا Hussein، ما إجيت على حجزك يوم الخميس، 24 أيلول الساعة 7:00 مساءً. رسوم عدم الحضور $30. Left in the database: ندى REJECTED, ليلى APPROVED, سامي and كريم REJECTED with slot interests. Hussein is still APPROVED and paid.

## Notify after commit, bidi isolates

**When:** 2026-09-25

**What:** A WhatsApp send control is offered only after the action is saved, and that body is rebuilt from the saved due and status. Cancel and no-show keep a live preview while the fee is edited, with no send button. After confirm, Today opens a send row from the saved fee (`notify=cancelled` or `notify=no_show`). Cancel then lists interested people on that window when there are any. Adjust amount (`notify=due`) offers an optional payment-reminder row with the saved remaining. Every placeholder in a WhatsApp body (name, stadium, pitch, day, time, amount, link, reason) is wrapped in U+2068 … U+2069.

**Why:** The preview can describe a fee that is not the one that gets stored. The send must match the row that was written. Isolates keep `$10`, a Latin name, and the clock in order inside an Arabic sentence.

**What already sent only after a save:** Reject has no send on the reason sheet. The notify list opens only after `rejectBooking`, and only if the status is REJECTED. The reason is still not a column, so that phrase is the chip from the confirm, not a live unsaved field. Approve's notify list is after approve. The details إبلاغ عبر واتساب is only for an APPROVED booking. Interest and waitlist إبلاغ describe a slot that is already free. The person-page reminder uses saved debt. The share card sends the public link, not a booking outcome.

**Files:** `src/modules/notification/domain/whatsapp-link.ts`, `src/modules/booking/application/cancel-booking.ts`, `src/modules/booking/application/load-outcome-notify.ts`, `src/modules/booking/infrastructure/bookings.ts`, `src/app/owner/(app)/today/actions.ts`, `src/app/owner/(app)/today/fee-forms.tsx`, `src/app/owner/(app)/today/page.tsx`, `src/app/owner/(app)/today/lists.tsx`, `src/app/owner/(app)/today/upcoming-panel.tsx`, `test/modules/notification/domain/whatsapp-link.test.ts`.

**How it connects:** `people` does not import `booking`. Cancel stores `PLAYER` or `OWNER` on the due-change note, including when the due does not change, so the later message can tell the owner template from the player template. The fee in that message is the saved `toUsd`. No-show uses the saved `amountDueUsd`. Adjust uses `amountDueUsd` minus collected. Notifications stay after the transaction.

**How to verify:** `npx jest --watchAll=false` (333) and `npm run build`. Arabic cancel for ِali, Friday 10:00–11:00 PM, fee edited to 10.00: the sheet shows the preview and تأكيد إلغاء الحجز, and no إبلاغ. After confirm the send row is مرحبا ِali، انلغى حجزك يوم الجمعة، 25 أيلول الساعة 10:00 مساءً. رسوم الإلغاء $10. That hour had no one waiting, so the interested list is absent. The booking is CANCELLED with due $10. Jest asserts U+2068 around `ali`, `$10`, and `10:00 مساءً` in the Arabic player-fee body.

## Message endings, name cleanup, booking/money integration

**When:** 2026-09-25

**What:** Auto-rejected siblings (after an approval) use the rejected WhatsApp template ending in " إذا فضيت الساعة منخبرك." / " We'll tell you if it frees up." Manual reject from the chip sheet still ends with the public-hours link. Confirmed Arabic is "تأكد حجزك في {stadium}". `cleanPersonName` trims, collapses inner spaces, and strips leading combining marks only; `createPerson` stores that string and folds `searchName` from it. Integration scenarios cover approve-and-interest, a concurrent APPROVED insert collision, owner price, late player cancel, owner cancel of a paid game, mixed-currency collect, collecting a cancel fee, no-show then waiver, due below collected, tenant isolation, and a midnight-crossing game. One helper checks ledger vs tenders, latest due-change vs `amountDueUsd`, no overlapping APPROVED rows, and day-summary vs person stats.

**Why:** Sibling copy should say we will tell them if the hour frees, not send them to the public hours. A leading kasra was being stored on the display name. The booking and money rules need a real Postgres run, separate from the unit suite and from `stadiums_dev`.

**Public link:** Built from the request headers in `publicPageUrl` (`load-decision-notify.ts` and the same helper in `load-outcome-notify.ts`): `x-forwarded-host` else `host`, `x-forwarded-proto` else `http`. There is no configured base URL. `https://<tenant>.lebstads.com/` appears when the proxy sets those headers to that host.

**Existing leading mark (not modified):** Person `cmug5scit0005vkl2stcom97d` on tenant `ahmad`, name starts with U+0650 (Arabic kasra) then `ali`. There is no person rename. `findOrCreatePerson` does not overwrite a stored name. A future rename must call `cleanPersonName`.

**Concurrency note:** Two `approveBooking` calls on overlapping pendings deadlock (each rejects the other's row, Prisma P2034). The scenario runs two `createOwnerBooking` calls. Both read an empty occupied list (optional `listApprovedRanges` seam, same idea as approve), then both insert APPROVED. The loser fails with `23P01` / `Booking_approved_during_excl`, mapped to `booking.slot_unavailable`. Exactly one APPROVED row remains. Omitting the seam leaves production owner-create unchanged.

**Files:** `src/modules/notification/domain/whatsapp-link.ts`, `src/modules/booking/application/load-decision-notify.ts`, `src/modules/people/domain/clean-person-name.ts`, `src/modules/people/infrastructure/persons.ts`, `src/modules/booking/application/create-owner-booking.ts`, `test/modules/notification/domain/whatsapp-link.test.ts`, `test/modules/people/domain/clean-person-name.test.ts`, `test/integration/truncate.ts`, `test/integration/invariants.ts`, `test/integration/booking-money.integration.test.ts`.

**How it connects:** `people` does not import `booking`. Notifications stay after the transaction. Tenant and membership in tests are the existing request stubs (`x-tenant-slug`, `stadium_session`) plus `clearReactCache` when the slug changes. No production ALS was added. The integration database is `stadiums_test` via `DATABASE_URL_TEST`, never `stadiums_dev`. `npm test` stays unit-only.

**How to verify:** `npx jest --watchAll=false` (338). `npm run test:integration` (migrate deploy on `stadiums_test`, then 5 suites, 22 tests). Jest: `"\u0650ali"` → `ali`, `"  أحمد   علي "` → `أحمد علي`, interior Arabic marks kept.

## Pitch lock, public link domain, integration exit

**When:** 2026-09-25

**What:** `approveBooking`, `createOwnerBooking`, `cancelBooking`, and `recordNoShow` lock the pitch row (`SELECT ... FOR UPDATE`) at the start of the transaction so approved writes on one pitch run one at a time. If the request is no longer PENDING when the lock is acquired, approve throws `booking.no_longer_pending` (`تم حجز هذه الساعة للتو` / `This hour was just booked`). The exclusion constraint stays; `23P01` still maps to `booking.slot_unavailable`. The owner-create occupied-list test callback is gone. The approve race is two `approveBooking` calls, ten times: one APPROVED, the other REJECTED with a slot interest, the loser gets `booking.no_longer_pending`, no P2034. A raw overlapping APPROVED insert still raises 23P01. Message links are `${APP_PROTOCOL}://${slug}.${APP_BASE_DOMAIN}/` (protocol defaults to https). Each integration file disconnects the Prisma client and ends its pg pool. `forceExit` is off.

**Why:** Two approves used to deadlock because each tried to reject the other's row. The pitch lock makes the second wait until the first has committed the reject. Public links must not depend on proxy headers. Jest was staying open because `$disconnect` does not end an external pg pool, and each test file has its own pool.

**Files:** `src/modules/booking/infrastructure/bookings.ts`, `src/modules/booking/application/approve-booking.ts`, `src/modules/booking/application/create-owner-booking.ts`, `src/modules/booking/application/cancel-booking.ts`, `src/modules/booking/application/record-no-show.ts`, `src/lib/public-page-url.ts`, `src/lib/ui-copy.ts`, `src/lib/error-messages.ts`, `src/lib/prisma-base.ts`, `src/modules/booking/application/load-decision-notify.ts`, `src/modules/booking/application/load-outcome-notify.ts`, `.env.example`, `jest.integration.config.ts`, `test/integration/teardown.ts`, `test/integration/booking-money.integration.test.ts`, and the other integration `afterAll` hooks, `test/lib/public-page-url.test.ts`, `test/lib/ui-copy.test.ts`, `test/lib/errors.test.ts`.

**How it connects:** `people` does not import `booking`. The pitch lock is raw SQL with `tenantId` (the extension does not stamp `$queryRaw`). Notifications stay after the transaction. Local `.env` sets `APP_BASE_DOMAIN=localhost:3000` and `APP_PROTOCOL=http`. Production sets `APP_BASE_DOMAIN=lebstads.com` and can omit the protocol.

**How to verify:** `npx jest --watchAll=false` (341), `npm run build`, `npm run test:integration` (5 suites, 23 tests, no force-exit warning).

## Time ranges stay left-to-right

**When:** 2026-09-26

**What:** A clock range is "7:00–8:00 م" (or "7:00–8:00 PM", or "19:00–20:00" when the tenant uses 24-hour time). The digits and the dash sit in one LTR isolate. The period marker sits outside it. Noon-crossing ranges keep both markers, each clock in its own isolate, inside one left-to-right run. Cards, requests, free-slot sheets, the Today sheet, the person games list, the public slot sheet, and the Today requests banner use that.

**Why:** "7:00 مساءً–8:00 مساءً" inside one isolate painted the clocks backwards in Arabic.

**Files:** `src/lib/format-local-hm.ts`, `src/components/ui/ltr-isolate.tsx`, `src/app/owner/shared.tsx`, `src/app/owner/pending-list.tsx`, `src/app/owner/notify-list.tsx`, `src/app/owner/(app)/requests/free-slot-list.tsx`, `src/app/owner/(app)/today/upcoming-panel.tsx`, `src/app/owner/(app)/today/lists.tsx`, `src/app/owner/(app)/people/[personId]/games.tsx`, `src/components/slot-picker.tsx`, `test/lib/format-local-hm.test.ts`.

**How it connects:** Display only. WhatsApp still uses a single `formatLocalHm` clock. `people` does not import `booking`.

**How to verify:** `npx jest --watchAll=false` (346), `npm run test:integration` (5 suites, 23 tests), `npm run build`.

## Precise relative time

**When:** 2026-09-26

**What:** `formatRelativeTime` labels a timestamp against now in Asia/Beirut. Under a minute, or in the future, is "الآن" / "Just now". 1–59 minutes uses the plural helper ("قبل دقيقة", "قبل دقيقتين", "قبل 3 دقائق", "قبل 11 دقيقة"), and that minutes phrase wins even across midnight. One hour or more on the same Beirut day is "اليوم {time}". The previous civil day is "أمس {time}". Two to six civil days is the weekday plus the time. Older is the day and Levantine month ("17 أيلول"). The clock follows the tenant `timeDisplay`. Requests and the exchange-rate line use it. `relativePastLabel` is gone.

**Why:** "قبل 3 ساعات" and "قبل 3 أيام" hid the actual hour, and a request just after midnight looked like yesterday while it was still twenty minutes old.

**Files:** `src/lib/format-relative-time.ts`, `src/lib/ui-copy.ts`, `src/app/owner/pending-list.tsx`, `src/app/owner/notify-list.tsx`, `src/app/owner/(app)/more/page.tsx`, `src/app/owner/(app)/more/hub.tsx`, `test/lib/format-relative-time.test.ts`, `test/lib/ui-copy.test.ts`.

**How it connects:** Display only. Civil days come from `Intl` in Asia/Beirut, so the October fall-back does not shrink two civil days into one. `people` does not import `booking`.

**How to verify:** `npx jest --watchAll=false` (370), `npm run test:integration` (5 suites, 23 tests), `npm run build`.

## Missed requests

**When:** 2026-09-26

**What:** A PENDING request is missed when its slot start is now or earlier. That is derived, not stored. Missed rows leave the Requests queue, the tab badge, the Today banner, and the heading count. They sit in a collapsed "طلبات فائتة (N)" section. "لعبوا فعلاً" approves through `approveBooking` with `allowStarted`, which is the only path that skips the future-start check. The pitch lock and the exclusion constraint stay. "تجاهل" sets REJECTED with no reason and offers the missed WhatsApp line. "تجاهل الكل" rejects every missed request and leaves future ones. A future request starting within two hours shows an amber "يبدأ بعد X".

**Why:** A request for an hour that already started was still in the queue and the badge, and Approve refused it as `booking.slot_ended`.

**Dismiss status:** REJECTED with no stored reason. Booking has no reason column; a manual reject already stores nothing, and the message is only the optional WhatsApp row. A new status would need a migration and a new branch in every status check, and would not make the message clearer.

**Files:** `src/modules/booking/domain/expired-request.ts`, `src/modules/booking/domain/offered-slot.ts`, `src/modules/booking/application/approve-booking.ts`, `src/modules/booking/application/dismiss-missed-requests.ts`, `src/modules/booking/application/load-decision-notify.ts`, `src/modules/notification/domain/whatsapp-link.ts`, `src/lib/ui-copy.ts`, `src/app/owner/pending-list.tsx`, `src/app/owner/(app)/requests/inbox.tsx`, `src/app/owner/(app)/requests/page.tsx`, `src/app/owner/(app)/layout.tsx`, `src/app/owner/(app)/today/lists.tsx`, `src/app/owner/(app)/today/actions.ts`, and the matching tests.

**How it connects:** `people` does not import `booking`. Notifications stay after the decision. The badge count is `actionablePending`, the same split the integration test asserts.

**How to verify:** `npx jest --watchAll=false` (379), `npm run test:integration` (5 suites, 24 tests), `npm run build`.

## Live request badge

**When:** 2026-09-26

**What:** The owner shell polls `GET /owner/requests/live` every 20 seconds while the tab is visible, and again as soon as the page becomes visible or the window focuses. The response is `{ pendingCount, latestRequestedAt }` for actionable (not missed) requests, one query. A change updates the tab badge and the Today banner count, and calls `router.refresh()` so Requests and Today render again from the server. If a bottom sheet is open, the refresh waits until it closes. `navigator.setAppBadge` is used when it exists, and cleared at zero. Two failed polls in a row slow the interval to 60 seconds; a success returns it to 20.

**Why:** The badge and the Requests list were server renders. Nothing asked the server again until the owner navigated or reloaded, so a public request sat unseen on an open tab.

**How the data was loaded:** `OwnerLayout` calls `listPendingRequests()` and passes the actionable length to `OwnerTabBar`. The Requests page calls `listPendingRequests()` again inside `RequestsInbox`. Both run only when that server render happens. There was no poll and no client cache invalidation.

**Files:** `src/modules/booking/domain/live-queue.ts`, `src/modules/booking/infrastructure/bookings.ts`, `src/modules/booking/application/get-live-queue.ts`, `src/app/owner/(app)/requests/live/route.ts`, `src/app/owner/live-queue.tsx`, `src/app/owner/(app)/layout.tsx`, `src/app/owner/tab-bar.tsx`, `src/app/owner/(app)/today/lists.tsx`, `test/modules/booking/domain/live-queue.test.ts`.

**How it connects:** The route is tenant-scoped through the existing request tenant and requires a membership. `people` does not import `booking`. The poll does not run while `document.visibilityState` is hidden.

**How to verify:** `npx jest --watchAll=false` (383), `npm run test:integration` (5 suites, 24 tests), `npm run build`. A public request shows on the owner's Requests tab within 20 seconds without a manual reload.

## Docs sync and CLAUDE.md

**When:** 2026-09-29

**What:** `NOW.md` lists what shipped after SPEC-14: UX-01 shell and Requests (through missed requests and the live badge), UX-02 slices 1–2, SPEC-15 slice 1, SPEC-16 slices 1–3, the design-system token layer. Next up is SPEC-15 slices 2–5 after its open decisions P1–P5; UX-02 slices 3–5 are not started. `docs/README.md` catalogs SPEC-15, SPEC-16, `owner-ux.md`, `ux-02-history.md`, `ui-foundations.md`, `ui-components.md`, `theme.md`, `MIGRATION.md`. SPEC-15 and SPEC-16 each carry a one-line status banner. `theme.md` §3 has a banner naming `MIGRATION.md` as the source of truth for fonts, because the §1 `@theme` block still says `--font-sans: plex-arabic` and `--font-heading: kufi`. `CLAUDE.md` keeps `@AGENTS.md` and adds a project summary, a task → doc table, the non-negotiables, the progress-log rules, and the read → report → stop → build → verify → append workflow.

**Why:** `NOW.md` and the README stopped at SPEC-14, so an agent starting there would not know UX-01, UX-02, SPEC-15 or SPEC-16 existed. Claude Code reads `CLAUDE.md`, not `.cursor/rules/`, so the non-negotiables live there as well. Statuses were checked against progress entry headings and dates, not memory. Fonts were checked against `src/app/globals.css` (Manrope for sans, Big Shoulders for heading and display).

**Files:** `docs/NOW.md`, `docs/README.md`, `docs/specs/SPEC-15-per-player-payments.md`, `docs/specs/SPEC-16-due-adjustments.md`, `docs/theme.md`, `CLAUDE.md`.

**How it connects:** Docs only. Historical SPEC and DR bodies are unchanged apart from the banners. The middleware/proxy wording in DR-001 / SPEC-01, "no language switch" in DR-005 / SPEC-13, and `BookingLike` in `.cursor/rules/000-core-architecture.mdc` stay as they were (historical, already flagged by the audits).

**How to verify:** Docs-only pass; no code or tests changed. `npx jest --watchAll=false` and `npm run build` were run afterwards only to confirm nothing moved.

## Live queue: session-expiry redirect and stale-badge reconciliation

**When:** 2026-09-29

**What:** Two fixes to the live request badge, found in a read-only diagnosis of commit 9323f77.
1. Session expiry. A 401 from `GET /owner/requests/live` used to count as an ordinary failure, so polling slowed to 60 seconds and the badge stayed stale with no sign of why. The poll now stops on a 401 and calls `router.replace("/owner/login")`. Other errors still use the backoff.
2. Stale badge after refresh. The snapshot sync effect only ran when `initial.pendingCount` or `initial.latestRequestedAt` changed. If a poll-triggered `router.refresh()` rendered an older count than the poll had seen, the effect did not run and nothing asked again, so the list stayed behind until the count changed later. `router.refresh()` returns `void`, so the component marks that it started a refresh and reconciles when the next `initial` object renders. If the render matches the poll it is accepted. If it is behind, the poll's snapshot is kept and the tree is refreshed again, at most 2 more times. After that the server render is trusted, so it cannot loop.

**Why:** A frozen badge on an expired session and a list that disagrees with the badge both cost the owner requests, which is the reason the badge exists (RULE-12). Follows "Live request badge" (2026-09-26).

**Commits:** `a0bfd27` (redirect on 401), `d93c9f0` (reconcile after refresh).

**Files:** `src/app/owner/live-queue.tsx`, `src/modules/booking/domain/live-queue.ts` (`reconcileAfterRefresh`, `MAX_RECONCILE_REFRESHES`), `test/modules/booking/domain/live-queue.test.ts`.

**How it connects:** `reconcileAfterRefresh` is a pure domain function with no imports beyond its own types. The client component calls it. Nothing new imports `booking` from `people` or the reverse, and the route and query are unchanged.

**How to verify:** `npm test` (387 tests; 4 new `reconcileAfterRefresh` cases: match, retry, give-up, same count with an older timestamp) and `npm run build`, both run after each fix. Not tested: the component wiring (`awaitingRender`, the effect, the `router.refresh` call) and the 401 redirect, because this Jest setup is node-only with no React Testing Library. Neither was exercised in a browser. `npm run test:integration` was not run, since nothing here touches transactions, money or isolation.

## SPEC-15 slice 2: per-player mode, slots, one-tap collect

**When:** 2026-09-29

**What:** A booking can switch Whole game to Per player and back, and cash is taken per slot.
- `Pitch.defaultPlayerCount` (INT NOT NULL DEFAULT 10, CHECK 1..30) is a pitch setting on the create/edit form.
- `buildSlots(amountDueUsd, count, requesterPersonId)` gives 1..30 slots from `splitEvenly` (exact cents, P1). Slot 1 is the requester; the rest have no person.
- `switchToPerPlayer({ bookingId, count })` needs `bookings.adjust_due`, runs in one transaction and only from an APPROVED WHOLE booking with a due above zero and no allocations. CANCELLED and NO_SHOW get `booking.switch_fee_booking`. Payments already taken stay Unassigned (nothing is auto-allocated). `amountDueUsd` does not change, so no `BookingDueChange` row is written.
- `switchToWhole({ bookingId })` only while there are zero allocations. It deletes the unnamed slots and puts the whole due back on the requester row.
- `collectSlotPayment` (one tap) and `collectAllRemaining` (booker pays all) take USD only. Each writes one payment, one USD tender, one ledger IN and the allocations in one transaction. The booking row is locked (`FOR UPDATE`) and the slot remaining is recomputed after the lock, so a double tap gets `payment.nothing_due`. Only the slot's own remaining is checked, never the booking remaining (P3, RULE-9).
- Sheet: mode switch, count input, slot list (due / paid), Pay per slot, Booker pays all remaining, Unassigned line, "N of M paid". The per-player actions do not redirect and call `revalidatePath("/owner/today")`, so the sheet stays open across taps. The whole-game forms are hidden while a booking is per player, and `collectBookingPayment` refuses a per-player booking (`booking.collect_per_player`).

**Why:** SPEC-15 section 3 and slice 2, with P1 to P5 at the spec defaults (RULE-12: ten payers must be faster than paper). Unassigned is not re-assigned here (slice 5).

**Found while building:**
- `PaymentAllocation` was missing from `TENANT_SCOPED_MODELS` in `src/lib/db.ts` (slice 1 gap). The extension would not have stamped `tenantId` on create or scoped reads. Added, with an isolation test.
- Cancel and no-show on a per-player booking, checked by integration test: `writeDueIfChanged` does refuse a fee different from the due (`booking.due_whole_only`), so an owner cancel (fee 0) on a per-player booking is refused and the booking stays APPROVED. A no-show at the default fee (= the due) succeeds and leaves the booking NO_SHOW + PER_PLAYER. Because the whole-game collect is closed on per-player bookings, slot pay was opened to APPROVED, NO_SHOW and CANCELLED (same rule as `assertCanCollect`) so that fee can be collected.
- Open, not fixed: the Cancel button still shows on a per-player booking and the owner gets the error. Going back to whole first works only while there are no allocations, so a per-player booking with payments cannot be cancelled. Needs a decision.

**Files:** `src/prisma/schema.prisma`, `src/prisma/migrations/20260929120000_pitch_default_player_count/`, `src/lib/db.ts`, `src/lib/error-messages.ts`, `src/lib/ui-copy.ts`, `src/modules/booking/domain/build-slots.ts`, `src/modules/booking/domain/switch-mode.ts`, `src/modules/booking/schemas/per-player.ts`, `src/modules/booking/application/switch-collection-mode.ts`, `src/modules/booking/application/collect-player-payment.ts`, `src/modules/booking/application/collect-booking-payment.ts`, `src/modules/booking/application/load-owner-day.ts`, `src/modules/booking/infrastructure/bookings.ts`, `src/modules/payment/infrastructure/payments.ts` (`insertAllocations`), `src/modules/venue/*` (pitch draft, create, update, editor, infrastructure), `src/app/owner/(app)/today/{actions,lists,upcoming-panel,per-player-collect}.tsx`, `src/app/owner/(app)/more/settings/pitches/*`, and the matching tests.

**How it connects:** Booking imports Payment (`recordPayment`, `freezeTenders`, `assertCanCollect`); Payment never imports Booking and `insertAllocations` only sees ids. The use case that starts the action owns `$transaction`, authorizes before it, and touches no `platformDb` inside it. Venue does not import Booking.

**How to verify:** `npm test` (58 suites, 402 tests; new: `build-slots`, `switch-mode`), `npm run test:integration` (6 suites, 36 tests; new file `per-player.integration.test.ts`: 12 cases covering the switch and its refusals, rollback, one-tap and pay-all writes, the concurrent double tap, Unassigned and overpaid, allocation tenant scoping, cancel and no-show), `npm run build`. Not verified in a browser: that the sheet stays open and updates after a non-redirect action plus `revalidatePath`. The local dev database has the new migration applied.

## SPEC-15 slice 2 follow-up: cancel collapses a per-player booking to whole

**When:** 2026-09-29

**What:** Correction to the "Open, not fixed" note in the slice 2 entry. `cancelBooking` now handles a PER_PLAYER booking: inside the cancel transaction, before the fee logic, `collapseToWhole` deletes the booking's `PaymentAllocation` rows and non-requester participants, puts the due back on the requester row and sets `collectionMode = WHOLE`. The existing suggest, edit and waive logic then runs unchanged with `collectionMode` WHOLE. Payments, tenders and ledger rows are untouched, so everything collected (slots plus Unassigned) still counts as collected. This is the one path allowed to remove allocations, so it skips the zero-allocation guard that `switchToWhole` keeps. The cost is that who paid what is lost on that booking.

**Why:** A per-player booking with payments could not be cancelled (`booking.due_whole_only`), and switching back to whole is blocked once allocations exist.

**Unchanged:** `booking.switch_fee_booking` still applies to `switchToPerPlayer` on a cancelled or no-show booking. It was never a cancel error. No-show is not collapsed: at the default fee (= the due) it goes through and its slots take the cash; a no-show fee different from the due is still refused with `booking.due_whole_only`.

**Files:** `src/modules/booking/application/cancel-booking.ts`, `src/modules/booking/infrastructure/bookings.ts` (`collapseToWhole`), `test/integration/per-player.integration.test.ts` (the old refusal test became cancel-with-payments, cancel with an edited fee, cancel with nothing paid).

**How it connects:** Same booking-to-payment direction as before. `collapseToWhole` lives in Booking infrastructure and runs in the cancel use case's transaction.

**How to verify:** `npm test`, `npm run test:integration` and `npm run build`. See the results reported when this entry was written.

## SPEC-15 slice 2 follow-up 2: no-show collapses too, cancel locks the row

**When:** 2026-09-30

**What:** Correction to the previous entry, which left no-show per player.
- `recordNoShow` now collapses a PER_PLAYER booking to WHOLE the same way cancel does: allocations and unnamed slots removed, requester carries the due, then the unchanged fee logic and the NO_SHOW status, all in one transaction. A no-show fee different from the due (0% or 50% policy, an edit, a waive) no longer hits `booking.due_whole_only`.
- Slot pay is back to APPROVED only. The NO_SHOW/CANCELLED opening added in the slice 2 entry is removed, since a per-player booking can no longer be in those statuses.
- Cancel and no-show both read the booking with `FOR UPDATE` (`findBookingForUpdate`) after the pitch lock, so a slot tap in flight finishes before the collapse. Lock order is pitch then booking; slot pay and the switches lock only the booking, so there is no cycle.
- The existing fee clamp still applies: a fee below what was collected is raised to what was collected. A waived no-show with $3 collected ends with due $3.

**Files:** `src/modules/booking/application/record-no-show.ts`, `src/modules/booking/application/cancel-booking.ts`, `src/modules/booking/domain/switch-mode.ts`, `test/modules/booking/domain/switch-mode.test.ts`, `test/integration/per-player.integration.test.ts` (no-show default fee, no-show edited fee, no-show waived; the no-show-then-slot-pay case is gone), `docs/per-player-payments.md`.

**How to verify:** `npm test` (58 suites, 402 tests), `npm run test:integration` (6 suites, 40 tests), `npm run build`. Not exercised: a cancel or no-show racing a slot tap (the lock is in place, no concurrent test), and the sheet in a browser.

## SPEC-15 slice 2: final verification and commit

**When:** 2026-09-30

**What:** Closes out slice 2 (per-player mode, slots, one-tap collect) with the two follow-ups: cancel and no-show collapse a per-player booking to whole, and both lock the booking row. Summary of the slice: `Pitch.defaultPlayerCount`; `buildSlots`; `switchToPerPlayer` / `switchToWhole`; `collectSlotPayment` / `collectAllRemaining` (USD, one transaction, booking row lock, `payment.nothing_due` on a double tap); the sheet mode switch, slot list, "N of M paid" and Unassigned line; whole-game collect refused on a per-player booking; `PaymentAllocation` added to the tenant-scoped models (a slice 1 gap).

**Scope boundary (intentional):** the per-player switch is offered only after the game has ended and cash is still owed. Splitting before the game ends is not possible yet and may be reconsidered after slices 3–5. Because of that, cancel reaches the collapse only when a per-player game is fully paid (cancel is refused once a game has started with money owed). No-show is the main path. The cancel collapse stays: it shares `collapseToWhole` with no-show and is needed once early splitting is allowed.

**Manual verification (owner, in the browser, 2026-09-30):** slot taps do not close the sheet; the pitch edit page opens; no-show collapse checked at the default fee and with a waived fee; cancel collapse reachable only for the fully paid case, matching the integration test.

**Results before commit:** `npm test` 58 suites, 402 tests; `npm run test:integration` 6 suites, 40 tests; `npm run build` compiled.

**Commits:** the code in one commit, the docs (`per-player-payments.md`, `NOW.md`, `README.md`, `owner-ux.md`, the SPEC-15 banner, `progress.md`) in a second.

**How it connects:** see the two slice 2 entries above for files and module rules. Living reference: `docs/per-player-payments.md`.

## Cancel only before the game starts

**When:** 2026-09-30

**What:** Cancel is now offered and accepted only while the game has not started, paid or not. `isPastUnpaidCancel(start, remaining, now)` (start passed and money owed) is replaced by `isCancelWindowClosed(start, now)`. `assertNotPastUnpaidCancel` becomes `assertCancelWindowOpen`, and the error key `booking.cancel_past_unpaid` becomes `booking.cancel_started` ("A game that has started can't be cancelled. If it didn't happen, record a no-show.", with Arabic). Call sites: `showCancel` in `today/lists.tsx` and `cancelBooking`. BR-26 "at any time" is read as "any time before the game starts".

**Why:** A game that ended and was fully paid still showed Cancel. The old guard only stopped an unpaid started game from dropping a debt (BR-49). Cancelling a played, paid game only flips the status: the fee is clamped to what was collected and no refund exists. BR-22 and DR-002 keep "did not happen" as a separate no-show status, and SPEC-14 and SPEC-16 §4.4 already direct the owner to No-show after the start. Live and ended paid games no longer offer Cancel.

**Consequences:** cancel can no longer reach the per-player collapse in the UI (splitting is only offered after the game ends). The collapse code stays, tested, for when early splitting is allowed. Known gap, out of scope: no clean path for "it rained, refund or waive a prepaid game" after the start (Adjust cannot go below collected, refunds are out); possibly a no-show variant with a $0 default suggestion later.

**Files:** `src/modules/booking/domain/decision.ts`, `src/modules/booking/application/cancel-booking.ts`, `src/app/owner/(app)/today/lists.tsx`, `src/lib/error-messages.ts`, `test/modules/booking/domain/decision.test.ts`, `test/lib/errors.test.ts`, `test/integration/booking-money.integration.test.ts` (ended paid and ended unpaid cancels refused), `docs/owner-ux.md`, `docs/requirements/brd.md` (BR-26 note), `docs/per-player-payments.md`, `docs/NOW.md`. Older guides that mention `isPastUnpaidCancel` (`mentor-defense-backend.md`, `engineering-audit.md`) are historical and were not edited.

**How to verify:** `npm test` (58 suites, 402 tests), `npm run test:integration` (6 suites, 41 tests), `npm run build`. In the app, an ended fully paid game no longer shows Cancel; an upcoming game still does.

## Booking row lock on every money path

**When:** 2026-09-30

**What:** Fix 1 of the booking and payments production audit (§2.6, races R1–R4 and R9, punch list #1 and #8).
- `collectBookingPayment` reads the booking with `findBookingForUpdate` (`SELECT … FOR UPDATE`) and sums what was collected after the lock, like slot pay, cancel and no-show already do. The unlocked `findBookingForCollect` is deleted so nothing can go back to it.
- `adjustBookingDue` does the same, and refuses PENDING and REJECTED with `booking.due_not_confirmed` (`assertDueAdjustableStatus` in `booking/domain/adjust-due.ts`; Arabic and English copy).
- Lock order, checked across every use case: approve, owner-create, cancel and no-show take the pitch row, then booking rows. Collect, adjust, slot pay, pay-all and the two switches take only the one booking row, then child rows (participants, allocations). No use case takes a booking lock and then a pitch lock, and every money path holds at most one booking lock, so there is no cycle among them. One pre-existing, non-money case can still deadlock: `dismissMissedRequests` updates several PENDING rows without the pitch lock, while "They played" (`approveBooking` with `allowStarted`) updates the missed row and its PENDING siblings under the pitch lock, possibly in another order. Postgres would abort one of the two; no money is involved. Not changed here.

**Why:** Collect used a plain `SELECT`, so the row locks in cancel and no-show were one-sided and adjust had none. The audit probe showed 10/10 double collects ($60 on $30), and 30/30 cancels, no-show waivers and adjusts that left the due below cash landing at the same moment (RULE-9, SPEC-16 §4.3, SPEC-06).

**What the lock does not change:** overpay is still allowed (SPEC-06). If an adjust lowers the due to $10 and a $30 collect runs right after, the collect now sees due $10 (its `Payment.amountDueUsd` snapshot says 10.00) and records a knowing overpay. That end state is due < collected by product rule, not a race. The R3 test asserts the order instead of the end state.

**Files:** `src/modules/booking/application/collect-booking-payment.ts`, `src/modules/booking/application/adjust-booking-due.ts`, `src/modules/booking/domain/adjust-due.ts`, `src/modules/booking/infrastructure/bookings.ts`, `src/lib/error-messages.ts`, `test/integration/money-races.integration.test.ts` (new), `test/modules/booking/domain/adjust-due.test.ts` (new), `docs/NOW.md`.

**How it connects:** Booking still imports Payment only through `sumCollectedUsd` / `recordPayment`; Payment does not import Booking. No schema change. The exclusion constraint and the pitch lock are unchanged.

**How to verify:** `npm test` (59 suites, 407 tests), `npm run test:integration` (7 suites, 47 tests), `npm run build`. The new race file runs each pair ten times on real connections: R1 double collect, R2 owner cancel × collect, R3 adjust × collect, R4 waived no-show × collect, R9 split × whole collect (order proven with `xmin`), plus adjust refused on PENDING and REJECTED. With the two use-case changes reverted, all six fail. The audit's integrity SQL rerun on fresh probe data: 0 due changes below what was collected at that moment (was 24), per-booking ledger = tenders, no orphans.

## Per-player charges capped at what the booking owes

**When:** 2026-09-30

**What:** Fix 2 of the booking and payments production audit (§3.6, punch list #2).
- New pure `planSlotCharge` in `booking/domain/slot-charge.ts`. The cap is the booking remaining: `amountDueUsd` minus everything collected, Unassigned included. Pay-all charges min(sum of unpaid slot remainings, cap) and fills unpaid slots in slot order, the last possibly partial. One tap charges min(slot remaining, cap). Cap ≤ 0 charges nothing.
- `collectSlotPayment` / `collectAllRemaining` charge exactly that plan, after the booking row lock. `assertCanPaySlot` now takes the capped charge (`payment.nothing_due` when it is zero).
- The sheet uses the same function, not a copy: `lists.tsx` builds the pay-all total with `planSlotCharge` and each slot's state with `slotPayState`. A slot the booking no longer owes for shows "مغطّى بدفعة سابقة" / "Covered by earlier payment" and has no Pay button. A partial tap shows its amount. Pay-all is hidden when it would charge nothing.
- Unassigned stays Unassigned. Moving it onto slots is slice 5.

**Why:** Pay-all and the slot tap looked only at slot remainings, so money paid before the split was charged again. The audit probe: due $30, $10 whole-game before the split, two slots paid, pay-all took $24 where $14 was owed. This supersedes the slice 2 rule "only the slot's own remaining is checked" (it predates knowing about the double charge). SPEC-15 P3 already said excess stays Unassigned. Whole-game overpay (SPEC-06) is unchanged.

**Files:** `src/modules/booking/domain/slot-charge.ts` (new), `src/modules/booking/domain/switch-mode.ts`, `src/modules/booking/application/collect-player-payment.ts`, `src/app/owner/(app)/today/lists.tsx`, `src/app/owner/(app)/today/per-player-collect.tsx`, `src/lib/ui-copy.ts`, `test/modules/booking/domain/slot-charge.test.ts` (new), `test/modules/booking/domain/switch-mode.test.ts`, `test/integration/per-player.integration.test.ts`, `docs/per-player-payments.md`.

**How it connects:** Booking domain only; Payment still does not import Booking (`insertAllocations` receives the plan's ids and amounts). `app/` calls the domain function for display; the server recomputes it under the lock. SPEC-15 is historical and was not edited; `per-player-payments.md` describes the new rule.

**How to verify:** `npm test` (60 suites, 417 tests), `npm run test:integration` (7 suites, 49 tests), `npm run build`. New integration cases: the audit probe (pay-all charges exactly $14, slots 1/4/5/6 get $3 and slot 7 gets $2, collected = due = $30, later taps refused), a fully paid booking split then tapped (refused, covered), and a partial single tap ($1.50). All three fail on the old code. The audit's integrity SQL on fresh probe data: no overpaid per-player booking, allocations ≤ tenders per payment, no orphans. Not exercised: the sheet in a browser.

## Staff cannot drop a fee by choosing "I cancelled"

**When:** 2026-09-30

**What:** Fix 3 of the booking and payments production audit (§1.5, §4, punch list #3).
- New pure `ownerInitiatorLowersFee` in `booking/domain/suggest-fee.ts`: true when the PLAYER-initiated suggestion for this booking is higher than what the OWNER path would store (after the clamp to collected).
- `cancelBooking` refuses `initiator = OWNER` with `access.not_allowed` when that is true and the member lacks `bookings.adjust_due`. The existing edit/waive check is unchanged.
- The cancel sheet hides "أنا ألغيت" / "I cancelled" for members without `adjust_due` when choosing it would lower the fee (`ownerCancelLowersFee` on the row, from the same domain function). It stays visible when it changes nothing: outside the window, a 0% policy, or when collected money already keeps the fee at the player amount.
- New STAFF integration suite covering every guarded booking/payment use case, each refused without its flag (and writing nothing) and allowed with it: approve, owner-create, cancel (suggested, edited, waived, "I cancelled" that lowers the fee, "I cancelled" that does not), no-show (suggested, edited), adjust, split, whole collect, slot pay.

**Why:** SPEC-16 §6: staff with `bookings.cancel` may accept the suggested fee but may not Edit or Waive. The initiator is chosen by the caller and the OWNER suggestion is always $0, so picking it was a waiver without the permission (audit probe: staff with only `bookings.cancel` cancelled a late booking with due $0 instead of $15).

**Files:** `src/modules/booking/domain/suggest-fee.ts`, `src/modules/booking/application/cancel-booking.ts`, `src/app/owner/(app)/today/lists.tsx`, `src/app/owner/(app)/today/upcoming-panel.tsx`, `src/app/owner/(app)/today/fee-forms.tsx`, `test/modules/booking/domain/suggest-fee.test.ts`, `test/integration/staff-permissions.integration.test.ts` (new).

**How it connects:** Authorization stays in the use case (DR-003); the sheet only hides what the server would refuse. No new permission flag, no schema change. `app/` imports the booking domain function; the domain imports nothing new.

**How to verify:** `npm test` (60 suites, 421 tests), `npm run test:integration` (8 suites, 62 tests), `npm run build`. With the `cancelBooking` change reverted, only the "I cancelled that drops a late fee" case fails; the other twelve pin guards that already held. Not exercised: the sheet in a browser.

## Slots after midnight can be booked

**When:** 2026-09-30

**What:** Fix 4 of the booking and payments production audit (§1.7, punch list #4, BR-7).
- `resolveOfferedSlot` (used by public request, approve and owner-create) matches a slot against the windows of the start's civil day **and** of the day before. A 00:00 or 01:00 slot from Friday's 22:00–02:00 window resolves against Friday's window. Before, it was looked up only on Saturday and failed with `booking.slot_not_offered`.
- Price rules match the weekday of the window the slot came from (`priceForSlot` gets the window's weekday). A 00:30 slot from Friday's window takes Friday's rules. The rule's clock range is still checked against the slot's wall-clock start.
- `bookingFitsOpenHours` (the hours-shrink guard) checks the same two days, via the new `windowDaysForStart`, so a post-midnight booking is no longer treated as outside the hours.
- The start-day rule for Today (UX-02, `bookingStartDay`) is **not** changed.

**Where a 00:00 game from Friday's window shows up:** in the owner Book page and the public page it is listed under **Friday** (the window's day), where it was booked. In Today and the day line it is under **Saturday** (start day). On the person page, in the Requests tab date label and in the WhatsApp confirmation ("السبت … 00:00") it also reads as **Saturday**. Flag, not changed: an owner who books "Friday night 00:00" from Friday's list will not find it in Friday's Today and has to move to Saturday. The WhatsApp message saying Saturday is correct but may surprise a player who asked for "Friday night". Worth a UX decision (for example, show post-midnight games of a crossing window at the end of the window's day, marked "after midnight").

**DST:** the fall-back night (Beirut, Saturday 2025-10-25, 23:00 happens twice) is bucketed by start instant: both 23:00 games on Saturday, the 00:00 game on Sunday. That already worked; there is now a test.

**Files:** `src/modules/venue/domain/availability.ts`, `src/modules/booking/domain/offered-slot.ts`, `test/modules/venue/domain/availability.test.ts`, `test/modules/booking/domain/offered-slot.test.ts`, `test/integration/midnight.integration.test.ts` (new).

**How it connects:** Venue domain stays pure and imports nothing from Booking. Booking's `offered-slot` imports `addCalendarDays` from Venue (already a downward import). Callers of `resolveOfferedSlot` are unchanged: they still pass the start's civil day. No schema change.

**How to verify:** `npm test` (60 suites, 427 tests), `npm run test:integration` (9 suites, 66 tests), `npm run build`. New integration cases: 00:00 and 01:00 booked through owner-create and through public request plus approve, both at the window day's $50 rule; the 00:00 game on the next day in Today; the DST fall-back night. With the source change reverted, the three booking cases and five unit cases fail; the DST case passes either way (it pins existing behavior).

## Business day: 06:00 rollover

**When:** 2026-09-30

**What:** A game belongs to the business day it starts in, and a business day runs 06:00 to 06:00 Beirut. A game starting 00:30 Saturday is on Friday.
- `booking/domain/business-day.ts`: `BUSINESS_DAY_ROLLOVER_HOUR = 6`, `businessDate(start)` (local civil date, minus one day when the local wall-clock hour is before 6), `businessDayUtcRange(date)` ([D 06:00, D+1 06:00) local, converted with the DST-aware Intl helpers, never a fixed offset), `isNightStart(start)`. The rollover is a parameter with a default so it can become a tenant setting; there is no setting or column.
- Venue exports two thin helpers on top of the existing civil-date code: `localWallClock` (civil date + local hour) and `localTimeToUtc`.
- `loadOwnerDay(dateParam, now = new Date())`: today is `businessDate(now)`; the day's games are `lower(during)` in `businessDayUtcRange(day)`; new `afterMidnight` flag.
- Before 06:00, Today opens on the previous business date, and under the day strip it says "بعد منتصف الليل: اليوم مستمر حتى السادسة صباحاً." / "After midnight: Today runs until 6:00 AM."
- Real time stays real. A 00:00–05:59 start gets "ليلة <weekday>" / "night of <weekday>" (the business date's weekday) beside the real date: on the Today card and its sheet, on person-page game rows, and in every WhatsApp `{day}` (confirm, approve/reject, missed, cancel/no-show/due outcome, slot available, and the sheet's client-built texts). One helper, `booking/application/night-hint.ts` (`nightHint`, `messageDayLabel`); copy via `ui-copy` (`nightOfLabel`, `owner.afterMidnightToday`).
- `bookingStartDay` is removed (superseded). The integration money-invariants helper groups by `businessDate`.

**Changed (day bucketing):** Today list (`loadOwnerDay` → `listBookingsForStartDay` with the business range), the day summary line (same rows), the day strip and "Today" label and default day (`ownerDay.today`), the `?date=` 60-day limit (counted from the business today), `test/integration/invariants.ts` day grouping.

**Deliberately not changed:**
- Instant logic: live/ended/owed (`classifyDue`, card display), missed and starts-soon requests, cancel and no-show windows, To collect (`listEndedWithRemaining`).
- The schedule engine and the slot lists (public page day chips, owner Book page, `getDayAvailability`): slots stay under their hours window's day and those pages' "today" is the calendar day.
- Ledger and Money period: cash stays on the calendar day of payment (documented in NOW.md).
- Relative date labels on cards and request rows (`slotDateKind` / `formatSlotDateLabel`: "Today", weekday, date): they describe the real calendar date, and the night hint sits beside them.
- `listDueBookings` / `partitionHomeConfirmed`: dead code with no caller (audit §6), left as is.
- There is no month overview or day-grouped history yet (UX-02 slices 3–5), so nothing else to change.

**Why:** The owner books Friday night's 00:00 game from Friday's list; with the calendar start day it then appeared on Saturday in Today (PR #3 finding). A night belongs to the evening it started.

**Query plan:** 20,000 bookings on two tenants, day range [2025-02-01 03:00Z, 2025-02-02 04:00Z): `Index Scan using "Booking_tenantId_lower_during_idx" on "Booking" b`, `Index Cond: (("tenantId" = 't1') AND (lower(during) >= …) AND (lower(during) < …))`, then nested loops on primary keys. The expression index still applies.

**Files:** `src/modules/booking/domain/business-day.ts` (new), `src/modules/booking/domain/start-day.ts`, `src/modules/booking/application/night-hint.ts` (new), `src/modules/booking/application/load-owner-day.ts`, `load-decision-notify.ts`, `load-outcome-notify.ts`, `list-open-waitlist.ts`, `src/modules/booking/infrastructure/bookings.ts` (comment), `src/modules/venue/domain/availability.ts`, `src/lib/ui-copy.ts`, `src/app/owner/(app)/today/lists.tsx`, `upcoming-panel.tsx`, `src/app/owner/(app)/people/[personId]/games.tsx`, `test/modules/booking/domain/business-day.test.ts` (new), `test/modules/booking/application/night-hint.test.ts` (new), `test/modules/booking/domain/start-day.test.ts`, `test/integration/midnight.integration.test.ts`, `test/integration/invariants.ts`, `docs/NOW.md`, `docs/ux-02-history.md` (banner), `docs/owner-ux.md` (banner).

**How it connects:** Booking domain imports only Venue's civil-date helpers (downward). Venue does not import Booking. `app/` calls `night-hint` for display. No schema change, no new index.

**How to verify:** `npm test` (62 suites, 450 tests), `npm run test:integration` (9 suites, 68 tests), `npm run build`. Unit: `businessDate` table for 23:59 / 00:00 / 00:30 / 05:59 / 06:00 / 06:01, spring forward 2026-03-29 (06:00 EEST is the new day, which "minus 6h" would get wrong) and fall back 2026-10-24 (both 23:30s, 00:00 and 05:59 on Saturday, 06:00 on Sunday), 23-hour and 25-hour ranges; night hint present at 00:30, absent at 06:00 and 23:00. Integration: 00:00 via owner-create and 01:00 via public request + approve on Friday's Today and summary and not Saturday's (confirm message has Saturday's date and "ليلة الجمعة"); 05:59 on the previous day, 06:00 on its own; Today at 05:00 opens Friday with `afterMidnight`, at 06:00 opens Saturday; DST fall-back night on one day. With the source reverted, four of these fail.

## No stranded PENDING on a taken hour

**When:** 2026-09-30

**What:** Audit §1.2, punch list #7.
- `requestPublicSlot` takes the pitch lock first (`lockPitchForUpdate`, same as approve and owner-create), then checks APPROVED overlap after the lock.
- A taken hour creates no PENDING row. The person is recorded as a `SlotInterest` on the approved booking's window (the BR-21 convention approve uses, so they show up if that booking is cancelled), with no duplicate if they ask again. The transaction commits the interest, then the use case throws `booking.slot_taken`.
- The public action shows `booking.slot_taken_noted`: "هذه الساعة حُجزت. سجّلنا اهتمامك وسنبلغك إذا صارت متاحة." / "That hour was just booked. We noted your interest and will tell you if it frees up." The copy lives in the error catalog (`error-messages.ts`, DR-004), because the public toast renders `errorMessage`; `booking.slot_taken` itself keeps its short copy for the owner screens.
- New `hasSlotInterest` repository read.

**Why:** Without the lock, a request that read "no APPROVED range" could commit after an approve had already rejected the siblings, leaving a PENDING row on a taken hour (audit probe R10: 10/10). The requester never got an interest.

**Lock order:** request now takes pitch, then inserts booking rows, the same order as approve and owner-create. No use case takes a booking lock and then a pitch lock, so there is still no cycle.

**Files:** `src/modules/booking/application/request-public-slot.ts`, `src/modules/booking/infrastructure/bookings.ts`, `src/app/(public)/request-slot.ts`, `src/lib/error-messages.ts`, `test/integration/pending-races.integration.test.ts` (new).

**How it connects:** No schema change. Public requests on different pitches do not wait on each other; requests on one pitch now serialize with approvals on that pitch. The slot validity check (offered, not started, price) is unchanged and still runs before the person is created.

**How to verify:** `npm test` (62 suites, 450 tests), `npm run test:integration` (10 suites, 70 tests), `npm run build`. Race: a public request against an approve of another request on the same hour, ten times. Every run ends with no PENDING overlapping an APPROVED window, and the late requester has exactly one interest. Sequential: a request for an approved hour, sent twice, gives `booking.slot_taken` twice, no PENDING, one interest. Both fail without the change.

## Dismiss missed and "They played" lock pending rows in one order

**When:** 2026-09-30

**What:** Follow-up to the lock-order note in "Booking row lock on every money path".
- New `lockPendingRowsInOrder(tx, ids)`: `SELECT … FOR UPDATE` on those booking rows `ORDER BY id`. It returns the ones still PENDING.
- `dismissMissedRequests` locks every missed row through it, then rejects only the rows still PENDING, in id order.
- `approveBooking` (including "They played") locks the request and its overlapping PENDING siblings through it before changing any of them. If a dismiss already rejected the request, it throws `booking.no_longer_pending` instead of `booking.not_found`.
- `rejectOverlappingPending` (approve and owner-create) locks the losers the same way and skips any a dismiss already rejected. `listOverlappingPending` is split out so approve can lock target and siblings together.

**Why:** The two paths updated overlapping PENDING rows in different orders: approve did the target first, dismiss followed list order. That is a deadlock waiting to happen (Postgres aborts one side, P2034). In practice the race showed a lost update: with three missed requests on one hour, "They played" racing "Dismiss all" failed with a misleading `booking.not_found` in 10/10 runs, because dismiss had already rejected its row. No deadlock was observed in those runs; the fixed lock order removes both.

**Lock order now:** pitch row (approve, owner-create, public request, cancel, no-show), then booking rows. Several pending rows are always locked in id order; a single booking row is locked alone (collect, adjust, slot pay, switches). Dismiss takes no pitch lock and locks only PENDING rows in id order, so it cannot form a cycle with approve.

**Files:** `src/modules/booking/infrastructure/bookings.ts`, `src/modules/booking/application/approve-booking.ts`, `src/modules/booking/application/reject-overlapping-pending.ts`, `src/modules/booking/application/dismiss-missed-requests.ts`, `test/integration/pending-races.integration.test.ts`.

**How it connects:** No schema change. Owner-create keeps its pitch lock; its sibling rejection now also locks in id order.

**How to verify:** `npm test` (62 suites, 450 tests), `npm run test:integration` (10 suites, 71 tests), `npm run build`. Race: three missed requests on one past hour, "They played" on the middle one against "Dismiss all", ten times. There is no P2034, dismiss always succeeds, and approve either succeeds or reports `booking.no_longer_pending`. No PENDING row is left, and at most the played request is APPROVED. Fails without the change (`booking.not_found`).

## Audit addendum: punch-list status

**When:** 2026-09-30

**What:** Appended a status table to `docs/audits/booking-payments-production-audit.md`: each punch-list item marked closed, open, partly closed or deferred, with the commit and the reason. The audit body is unchanged.

**Why:** The audit is historical; the addendum records what PR #3 and this branch closed and what is still open.

**Files:** `docs/audits/booking-payments-production-audit.md`.

**How to verify:** Read the addendum; each commit hash is on this branch or on main (PR #3).

## Cancel and no-show fees: capped at the due, no-show logged as a no-show

**When:** 2026-09-30

**What:** Audit #8 (fee cap) and #13 (no-show reason).
- `assertFeeWithinDue` (`booking/domain/suggest-fee.ts`): a fee the owner types on cancel or no-show must be at most the booking's current `amountDueUsd`. Otherwise `booking.fee_above_due`: "الرسوم لا يمكن أن تكون أكثر من المبلغ المستحق على الحجز." / "The fee can't be more than what the booking owes." Checked in `cancelBooking` and `recordNoShow` under the booking lock, before anything is written. A fee equal to the due is accepted. Suggestions are percentages of the due, so they never exceed it.
- `confirmedFee` reason when the fee is clamped to what was collected: cancel still logs `CANCELLATION_NO_FEE`. A no-show now logs `WAIVER` when the owner lowered a non-zero suggestion (waive, or edit down to at most collected), and `NO_SHOW_FEE` otherwise (suggestion kept, or a 0% policy). Only existing enum values; no migration.

**Why:** A typed fee above the due created a debt out of nothing (audit §1.5 gap 3). A waived no-show was logged as a cancellation, so the debt-warning reason and the future booking timeline would say "cancellation" for a game that was a no-show (audit §1.6).

**Existing rows:** no-show due changes written before this change with `CANCELLATION_NO_FEE` are mislabeled. They are exactly `BookingDueChange` rows with `reason = 'CANCELLATION_NO_FEE'` on a booking whose status is `NO_SHOW`: a NO_SHOW booking cannot be cancelled, and Adjust never writes that reason. They cannot all be relabeled mechanically. `WAIVER` vs `NO_SHOW_FEE` depends on the suggestion at that time, which is not stored (a `toUsd` of 0 is almost certainly a waiver). They were not changed. Check with: `SELECT d.id, d."fromUsd", d."toUsd" FROM "BookingDueChange" d JOIN "Booking" b ON b.id = d."bookingId" WHERE b.status = 'NO_SHOW' AND d.reason = 'CANCELLATION_NO_FEE';`.

**Files:** `src/modules/booking/domain/suggest-fee.ts`, `src/modules/booking/application/cancel-booking.ts`, `src/modules/booking/application/record-no-show.ts`, `src/lib/error-messages.ts`, `test/modules/booking/domain/suggest-fee.test.ts`, `test/integration/fees.integration.test.ts` (new).

**How it connects:** No schema change. The Edit field in the sheets is not limited in the browser; the server refuses with the new message.

**How to verify:** `npm test` (62 suites, 457 tests), `npm run test:integration` (11 suites, 76 tests), `npm run build`. Integration: cancel and no-show fee $30.01/$45 on a $30 due refused with nothing written, $30 accepted. Stored reasons: 100% default no-show writes no row (due unchanged); 50% default → `NO_SHOW_FEE` 30→15; 50% with $20 collected → `NO_SHOW_FEE` 30→20; edited to $10 → `NO_SHOW_FEE`; edited to $2 with $5 collected → `WAIVER` 30→5; waived with $0 and $3 collected → `WAIVER`. All five fail on the old code.

## Public and Book pages open on the business date

**When:** 2026-09-30

**What was there (00:00–06:00 Beirut):** both pages took "today" as the calendar date (`civilDateInTimeZone`). At 00:30 Saturday the chip strip started at Saturday. The 01:00 slot of Friday's 22:00–02:00 window is generated under Friday, and Friday was not in the strip (a past day), so a player could not reach it without typing `?date=`. Started slots were already never offered: `dropEndedSlots` keeps only `start > now`, and `resolveOfferedSlot` refuses `slot_ended` on the server.

**What:** The public page and the owner Book page use `businessDate(now)` for their default day and the "Today" chip, the same rule as owner Today. At 00:30 Saturday they open on Friday and show only the 01:00 slot; from 06:00 they open on Saturday. `getDayAvailability` takes an optional `today` so the empty-state wording says "hours ended" rather than "past" for last night after its last slot; Venue still does not import Booking (the pages pass it). Slot generation is unchanged. No reason against it was found: the only case it would disadvantage is a stadium whose own day opens before 06:00, already unsupported under the business-day rule.

**Files:** `src/app/(public)/page.tsx`, `src/app/(public)/hours.tsx`, `src/app/owner/(app)/book/page.tsx`, `src/app/owner/(app)/book/slots.tsx`, `src/modules/venue/application/get-day-availability.ts`, `test/integration/slot-pages.integration.test.ts` (new), `docs/NOW.md`.

**How it connects:** `app/` imports `businessDate` from the booking domain; Venue receives the date. The Money page keeps the calendar day (cash rule).

**How to verify:** `npm test` (62 suites, 457 tests), `npm run test:integration` (12 suites, 79 tests), `npm run build`. With `now` injected: at 00:30 Saturday the default day is Friday and only 01:00 is offered (22:00, 23:00, 00:00 have started), Saturday still shows 16:00 and 17:00; at 02:30 Friday is Today with "hours ended"; at 06:30 the default is Saturday and Friday is past with nothing offered. The test drives the same calls as the pages; the pages themselves (server components) are not rendered in a test.

## Tests for the untested money paths

**When:** 2026-09-30

**What:** Audit §6 / punch list #5. Real use cases on the real test database, no source change.
- `expense-ledger.integration.test.ts`:
  - `recordExpense` with USD, LBP and mixed tenders. The expense is at 12:00 Beirut, each tender freezes the current rate (90,000, then 100,000 after a rate change), and there is one ledger OUT equal to the sum of the tenders' USD equivalents (payment `amountDueUsd` too).
  - Staff with only `payments.collect` is refused and nothing is written; staff with `expenses.record` succeeds.
  - An LBP tender with no rate fails after the expense row was inserted, and everything rolls back.
  - `summarizeLedgerPeriod` / `sumAmountUsdByDirection`: IN, OUT and net over three days, rows outside the period and another stadium's rows ignored.
  - Fall-back Saturday (25 h): rows at 23:59:59 Friday, 00:00 Saturday, the repeated 23:30, an expense at noon and 00:00 Sunday all land on the right day.
  - Spring-forward: Saturday ends exactly where Sunday begins (at the 01:00 jump), 23:30 Saturday on Saturday, 01:00 Sunday on Sunday.
- `collect-notify-debt.integration.test.ts`:
  - `listEndedWithRemaining` (To collect) lists ended unpaid, partial, no-show with fee, per-player and cancelled-with-fee games, oldest first. It leaves out fully paid, upcoming and another stadium's games. A 23:30–00:30 game appears only once it has ended (00:15 vs 00:45), and the extra row for "more" is returned.
  - `loadOutcomeNotify` / `findBookingFeeState`: after a player cancel the message fee is the saved `toUsd` ($15 on a $30 game with $5 collected) and the note is PLAYER. An owner cancel uses the no-fee owner template. An edited no-show shows the saved $20. After an adjust the reminder is due minus collected ($25 − $10 = $15).
  - `listDebtWarnings` / `listDebtParticipations`: a per-player booking with $10 Unassigned and two paid slots gives the requester only their own $3 slot; the nine unnamed slots owe no person (pins the open gap #6). A person's owed games are summed ($20 no-show + $30 unpaid) with the latest owed game as the note; paid and upcoming are left out.
- `split-evenly.test.ts`: property test over n = 1…30 for every cent up to $30, 1,000 seeded amounts up to $1,000,000 and edge amounts (120,150 splits): exact total, at most 1¢ spread, whole cents, extra cents on the first slots.
- `createStaffSession` added to `test/integration/fixtures.ts`; the staff-permissions suite now uses it.

**Bugs found:** none. The DST period bounds, the To collect SQL, the outcome fee text and the debt query all behaved as specified. The per-player debt case pins the known open gap #6 rather than a new bug.

**Files:** `test/integration/expense-ledger.integration.test.ts` (new), `test/integration/collect-notify-debt.integration.test.ts` (new), `test/integration/fixtures.ts`, `test/integration/staff-permissions.integration.test.ts`, `test/modules/booking/domain/split-evenly.test.ts`.

**How it connects:** Tests only. `recordPayment` is called directly for ledger rows at chosen instants, because collect always stamps `now`.

**How to verify:** `npm test` (62 suites, 458 tests), `npm run test:integration` (14 suites, 95 tests), `npm run build`.

## Dead code removed: the old Home confirmed lists

**When:** 2026-09-30

**What:** Audit §6 / punch list #5 (dead code).
- Deleted `src/modules/booking/application/list-due-bookings.ts` (`listDueBookings`, the old Home confirmed lists) and, in `infrastructure/bookings.ts`, `listApprovedBookingsInRange`, `listApprovedBookingsStartingBefore`, `mapApprovedCollect`, `ApprovedCollectRow` and `HomeCollectStatus`.
- Also deleted `partitionHomeConfirmed` (`booking/domain/home-inbox.ts`), whose only caller was `listDueBookings`, and its test block in `home-inbox.test.ts`; the rest of that test file stays.
- **Kept `sumCollectedUsdBySourceIds`:** it is not dead. `expense/application/list-recent-expenses.ts` uses it for the Money tab's recent expenses.

**Grep before deleting** (src and test, generated client excluded): `listDueBookings`, `listApprovedBookingsInRange` and `listApprovedBookingsStartingBefore` were referenced only inside `list-due-bookings.ts` and their own definitions (plus a comment in `load-owner-day.ts`). `partitionHomeConfirmed` was referenced only by `list-due-bookings.ts` and `home-inbox.test.ts`. `sumCollectedUsdBySourceIds` was referenced by `list-due-bookings.ts` and `list-recent-expenses.ts`. After deleting, each removed name has 0 references in `src`, `test` and the living guides.

**Files:** `src/modules/booking/application/list-due-bookings.ts` (deleted), `src/modules/booking/infrastructure/bookings.ts`, `src/modules/booking/domain/home-inbox.ts`, `src/modules/booking/application/load-owner-day.ts` (comment), `test/modules/booking/domain/home-inbox.test.ts`, `docs/guides/module-map-and-request-walkthroughs.md` (removed the file's row).

**How to verify:** `npm test` (62 suites, 457 tests; one test removed with `partitionHomeConfirmed`), `npm run test:integration` (14 suites, 95 tests), `npm run build`.

## Audit addendum: round 2 status

**When:** 2026-09-30

**What:** Appended "Update — hardening round 2" to the addendum in `docs/audits/booking-payments-production-audit.md`: #5, #8, #12 and the no-show reason bug closed, plus the public/Book pages change, each with its commit.

**Files:** `docs/audits/booking-payments-production-audit.md`.

**How to verify:** Read the update table; each commit is on this branch.

## Open logic findings recorded (not fixed)

**When:** 2026-09-30

**What:** New `docs/audits/logic-findings.md` (the detail) and `docs/ROADMAP.md` (the short ordered list). Nothing in code changed. They record four items:
- **F-1**, audit #6: money paid before a per-player split credits nobody. Proposed rule, not implemented: Unassigned is credited to the booker. The booker's Total paid includes it; Owes now = max(own slot remaining − Unassigned, 0); any excess stays Unassigned on the booking until SPEC-15 slice 5.
- **F-2**, audit #9: ledger hardening, deferred. Needs a migration and a design decision.
- **F-3**: old no-show fee rows labelled `CANCELLATION_NO_FEE` (SQL in the "Cancel and no-show fees" entry above), not fixed.
- **F-4**: three setState-in-effect lint errors (`fee-forms.tsx` lines 55 and 59, `upcoming-panel.tsx` line 353) and the unused `Decimal` import in `list-debt-warnings.ts`.

`NOW.md` and `docs/README.md` link both files.

**Why:** These are known and deliberately left open; they need one place other than the dated audit.

**Files:** `docs/audits/logic-findings.md` (new), `docs/ROADMAP.md` (new), `docs/NOW.md`, `docs/README.md`.

**How to verify:** Docs only. The lint lines match `npx eslint "src/app/owner/(app)/today/fee-forms.tsx" "src/app/owner/(app)/today/upcoming-panel.tsx" src/modules/booking/application/list-debt-warnings.ts` on main at `7ba058d`.

## Security audit: full application (report)

**When:** 2026-09-30

**What:** New `docs/audits/security-audit.md`. It covers:
- tenant isolation: models vs `TENANT_SCOPED_MODELS`, 31 raw SQL calls, 22 cross-tenant id probes, host resolution, `platformDb`, the manifest;
- auth and sessions, and an authorization matrix of every server action and `route.ts`;
- the public request surface, injection and CSRF, secrets and the seed;
- headers, caching and the service worker, `npm audit`, DoS, and RLS against DR-001's trigger;
- a "to confirm on the server" list, all UNVERIFIED.

Findings: 0 Critical, 1 High (S-1: the seed has no production guard), 7 Medium, 13 Low. The four logic findings F-1–F-4 were re-checked and still hold, so no Correction was needed. `docs/ROADMAP.md` gets items 5–12 and `docs/audits/logic-findings.md` gets a short pointer section; nothing existing was edited.

**Why:** DR-001 (isolation, RLS trigger), DR-003 (auth, `can()`), DR-004 (errors and logs). Before the first non-friend paying tenant.

**Files:** `docs/audits/security-audit.md` (new), `docs/ROADMAP.md`, `docs/audits/logic-findings.md`, `docs/NOW.md`, `docs/README.md`.

**How it connects:** Docs only. Probes ran against `stadiums_test` only: an integration test file, a flood test and curl against `next start`. They were kept outside the repo and deleted afterwards. `stadiums_dev` was not touched.

**How to verify:** Read the report. Each finding names a file and function; the probe results are in §1.3, §1.4 and §4.

## Seed refuses production and unknown databases

**When:** 2026-09-30

**What:** Security audit S-1 (High). `src/prisma/seed.ts` deletes every table and recreates `owner@ahmad`, `owner@sami` and `staff@ahmad` with the public `dev-owner` password. Before this fix, nothing stopped it from running against production. The audit probe ran it under `NODE_ENV=production` and it wiped and refilled the database.
- New pure guard `assertSeedAllowed({ nodeEnv, databaseUrl })` in `src/prisma/seed-guard.ts`. It throws when `NODE_ENV === "production"`, or when the database name in `DATABASE_URL` is missing, unparsable, or not in `SEEDABLE_DATABASES` (`stadiums_dev`, `stadiums_test`).
- `seed.ts` calls it at module load, before the pool is created, so a refused run opens no connection and writes nothing.

**Why:** [security-audit.md S-1](./audits/security-audit.md#s-1-the-seed-wipes-any-database-it-is-pointed-at-including-production). The database names match `.env.example` and `docs/guides/testing-jest.md`.

**Files:** `src/prisma/seed-guard.ts` (new), `src/prisma/seed.ts`, `test/prisma/seed-guard.test.ts` (new), `README.md`, `docs/guides/folder-structure.md`, `docs/ROADMAP.md`, `docs/audits/security-audit.md` (addendum).

**How it connects:** The guard is used by the seed only; it imports nothing, and the app never imports it. A production database under another name is refused even if `NODE_ENV` is not set.

**How to verify:**
- The test was written first and failed (module not found). `npm test` now passes: 63 suites, 461 tests (+4 in `seed-guard.test.ts`).
- `npm run test:integration`: 14 suites, 95 tests. `npm run build` is green.
- Manual check, with `DATABASE_URL` pointed at `stadiums_test`:
  - `NODE_ENV=production npx tsx src/prisma/seed.ts` fails with "Seed refused: NODE_ENV is production.", and the user count stays 0.
  - A URL naming `stadiums_prod` is refused.
  - Without `NODE_ENV=production` the seed runs and creates 3 users.

## Operator password tool

**When:** 2026-09-30

**What:** New `scripts/set-password.ts`, a CLI that sets a login's password on the server.
- `npx tsx scripts/set-password.ts <identifier>`:
  - shows the database name from `DATABASE_URL` and refuses unless the operator types that name;
  - asks for the new password twice at hidden prompts. The password is never taken from an argument or an env var, and it must be at least 12 characters;
  - hashes it with the app's `hashPassword`;
  - in one transaction, updates `User.passwordHash` and deletes every session of that user;
  - prints only `updated <identifier>`. Prompts go to stderr.
- `--list` prints identifier, role and tenant slug per membership, never hashes.
- It refuses to run without an interactive terminal.
- The logic is in `scripts/set-password-core.ts`, with the terminal injected so tests can script it. `databaseNameFromUrl` is now exported from `src/prisma/seed-guard.ts` and shared with the seed guard.
- New `docs/RUNBOOK.md` with only a "Passwords" section: exact commands, and the note that `tsx` and the generated Prisma client are dev-dependency tooling.

**Why:** Security audit S-1 follow-up. Any server where the seed ran has users with the public `dev-owner` password, and there was no safe way to change a password.

**Files:** `scripts/set-password.ts` (new), `scripts/set-password-core.ts` (new), `src/prisma/seed-guard.ts`, `test/integration/set-password.integration.test.ts` (new), `docs/RUNBOOK.md` (new), `docs/NOW.md`, `docs/README.md`, `docs/guides/folder-structure.md`.

**How it connects:** An operator tool, not part of the app. It uses `platformDb`, because a user and their sessions are global (DR-003), and it imports only `platform-db`, `password` and `seed-guard`. Nothing in `src/` imports `scripts/`.

**How to verify:**
- The test was written first and failed (module not found).
- `npm run test:integration`: 15 suites, 101 tests, including 6 new ones:
  - a wrong database name refuses and leaves the hash and sessions unchanged;
  - a short password refuses and leaves them unchanged;
  - two different entries refuse;
  - an unknown identifier refuses;
  - on success the new password verifies, all of that user's sessions are deleted, another user's session is kept, the only output is `updated <identifier>`, and both password prompts are hidden;
  - `--list` prints no hash.
- `npm test`: 63 suites, 461 tests. `npm run build` is green.
- Manual check in a pseudo-terminal on `stadiums_test`:
  - `--list` printed three rows;
  - piped stdin was refused;
  - a full run printed `updated owner@ahmad`, the typed password never appeared in the output, and the session count went to 0.

## Session tokens: 256-bit random, stored as SHA-256

**When:** 2026-09-30

**What:** Security audit S-2. Session ids used to be Prisma cuid v1: `Math.random`, about 41 unpredictable bits. The raw id was the cookie value, so a read of the Session table gave live cookies.
- New `access/infrastructure/session-token.ts`:
  - `newSessionToken()` returns 32 bytes from `crypto.randomBytes`, as base64url (43 characters);
  - `hashSessionToken()` returns the hex SHA-256.
- `Session.tokenHash` is new, `@unique`. The cookie carries the raw token and the row stores only the hash. `createSession` returns `{ token }`.
- `findSessionByToken` and `deleteSessionByToken` replace the lookups by id. Login, `getCurrentMembership` and logout go through them.
- Migration `20260930120000_session_token_hash` **deletes every existing session** (old rows have no hash) before adding the column. Every user must log in again after deploy.
- The integration mocks now record the cookies written, via `writtenCookies()`. Fixtures create sessions through `createSession`, and `fixture.sessionId` is now the raw token.
- The set-password test creates its extra session the same way. The tool still deletes by `userId`, and its "sessions deleted, another user's session kept" test passes.
- `isCurrentGeneratedClient` also requires `Session.tokenHash`, so a dev server drops a stale client.

**Why:** [security-audit.md S-2](./audits/security-audit.md#s-2-session-ids-are-cuid-v1-not-cryptographically-random). No server secret is needed: the token is random and only its hash is kept.

**Files:** `src/modules/access/infrastructure/session-token.ts` (new), `src/modules/access/infrastructure/sessions.ts`, `src/modules/access/infrastructure/session-cookie.ts`, `src/modules/access/application/login.ts`, `src/modules/access/application/logout.ts`, `src/modules/access/application/get-current-membership.ts`, `src/lib/prisma-base.ts`, `src/prisma/schema.prisma`, `src/prisma/migrations/20260930120000_session_token_hash/migration.sql` (new), `test/modules/access/infrastructure/session-token.test.ts` (new), `test/integration/auth-sessions.integration.test.ts` (new), `test/integration/fixtures.ts`, `test/integration/setup-mocks.ts`, `test/integration/request-stubs.ts`, `test/integration/set-password.integration.test.ts`.

**How it connects:** Access module only, and User/Session stay global (DR-003). The migration was written by hand and never run against `stadiums_dev`. `prisma migrate diff` from `stadiums_test` to the schema shows no Session drift.

**How to verify:**
- The unit test was written first and failed (module not found).
- `npm test`: 64 suites, 464 tests.
- `npm run test:integration`: 16 suites, 105 tests. The new ones check that:
  - the cookie is 43 base64url characters and the row holds its SHA-256, with the raw token in no column;
  - the token authenticates, but the row id or the stored hash does not;
  - two logins get different tokens;
  - logout deletes only that token's row and clears the cookie.
- `npm run build` is green.

## Rolling 30-day session

**When:** 2026-09-30

**What:** Sessions now last 30 days from the last use, instead of 7 days from login.
- `access/domain/session-lifetime.ts`: `renewedSessionExpiry(expiresAt, now)` returns now + 30 days once the last renewal is at least a day old. It returns null inside that day, and it never revives an expired session.
- `getCurrentMembership` calls it and writes with `extendSession`, an `updateMany` that only moves the expiry forward, so concurrent requests are harmless. That is at most one write per session per day.
- **Cookie half:** Server Components cannot set cookies. `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md` says `.set` is allowed only in a Server Function or a Route Handler, and `proxy.md` shows `response.cookies.set` in the proxy. So `src/proxy.ts` re-sends the session cookie with the same value, the same flags and `Max-Age` of 30 days.
  - It does this on GET only, when the cookie is present and the day-long marker `stadium_session_renewed` is absent, and then sets that marker.
  - Login and logout are POST Server Actions and write the cookie themselves.
- The flags live in the new `session-cookie-options.ts` (no `next/headers`), shared by the proxy and `session-cookie.ts`.
- **Expired session:** `getCurrentMembership` returns null, and `requireOwnerMembership` redirects to `/owner/login`. A test now covers that redirect.
- **Login:** `deleteExpiredSessions(userId, now)` removes that user's dead rows before the new one is created.

**Why:** The user asked for a rolling 30-day session. Owners stay logged in on their phone while dead rows are cleaned (audit S-17, for the logged-in user's rows).

**Files:** `src/modules/access/domain/session-lifetime.ts` (new), `src/modules/access/infrastructure/session-cookie-options.ts` (new), `src/modules/access/infrastructure/session-cookie.ts`, `src/modules/access/infrastructure/sessions.ts`, `src/modules/access/application/get-current-membership.ts`, `src/modules/access/application/login.ts`, `src/proxy.ts`, `test/modules/access/domain/session-lifetime.test.ts` (new), `test/proxy.test.ts` (new), `test/integration/auth-sessions.integration.test.ts`.

**How it connects:** The proxy imports only the pure cookie-options module and never reads the database. The renewal is a platform `Session` write, outside any tenant transaction (DR-001, one-pool rule).

**How to verify:**
- Tests were written first. The unit test failed (module not found); the proxy test and 3 integration tests failed. The expired-session redirect already worked.
- `npm test`: 66 suites, 471 tests.
- `npm run test:integration`: 16 suites, 110 tests.
- `npm run build` is green.

## Login brute-force limit (Postgres counters)

**When:** 2026-09-30

**What:** Security audit S-3.
- **Table:** new `RateLimit (key PK, windowStart, count)` with an index on `windowStart`; migration `20260930130000_rate_limit`. It is global like Session, and the key carries the account or IP.
- **`src/lib/rate-limit.ts`:**
  - `hitRateLimit(key, windowMs)` is one atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING count`. The window restarts at the first hit after it ends.
  - `rateLimitCount`, `resetRateLimit` and `pruneRateLimits` complete the set.
- **Login** (`access/domain/login-limits.ts`):
  - 8 failures per account within 15 minutes start a 15-minute block. While blocked, every attempt, including one with the right password, gets `access.login_throttled` ("Too many attempts. Try again in 15 minutes."). The password is not checked while blocked.
  - Failures count for unknown identifiers too, so the limit reveals nothing about which accounts exist.
  - A successful login resets that account's failure count and prunes rows older than a day.
- **Per IP:**
  - It applies only when `TRUSTED_CLIENT_IP_HEADER` is set. `src/lib/client-ip.ts` reads that header, takes the last entry and requires a valid IP.
  - Limit: 40 failures in 15 minutes, then a 15-minute block. The user gave no per-IP login number, so this one was chosen here and needs confirming.
  - If the variable is unset, no IP limit applies (fail safe).
- **Trade-off:** anyone can keep an owner's account blocked by sending 8 bad passwords every 15 minutes. A session that is already logged in keeps working, and an operator can lift the block (`docs/RUNBOOK.md`, "Login lockout").
- **Wiring:** the seed and the test truncation now also wipe `RateLimit`. The integration header stub gained `setRequestHeader`. `.env.example` documents `TRUSTED_CLIENT_IP_HEADER` (commented out).

**Why:** [security-audit.md S-3](./audits/security-audit.md#s-3-no-brute-force-protection-on-login).

**Files:** `src/lib/rate-limit.ts` (new), `src/lib/client-ip.ts` (new), `src/modules/access/domain/login-limits.ts` (new), `src/modules/access/application/login.ts`, `src/lib/error-messages.ts`, `src/prisma/schema.prisma`, `src/prisma/migrations/20260930130000_rate_limit/migration.sql` (new), `src/prisma/seed.ts`, `test/integration/login-rate-limit.integration.test.ts` (new), `test/integration/truncate.ts`, `test/integration/request-stubs.ts`, `.env.example`, `docs/RUNBOOK.md`, `docs/guides/folder-structure.md`.

**How it connects:**
- `lib/rate-limit` uses `platformDb` and never runs inside a tenant transaction. Part 3 (public requests) will reuse it.
- `access` imports `lib` only.
- The migration was written by hand. `prisma migrate diff` from `stadiums_test` shows no RateLimit or Session drift.

**How to verify:**
- The test was written first and failed (module not found).
- `npm run test:integration`: 17 suites, 120 tests. The 10 new ones cover:
  - 20 concurrent hits count 1…20, and the window restarts;
  - 8 failures block, and the right password is refused at 14 minutes and accepted after 15;
  - 7 failures do not block;
  - failures older than 15 minutes do not count;
  - a success resets the count;
  - an unknown account is throttled the same way;
  - the block covers only that account, and its live session keeps working;
  - with no env setting, no IP limit applies;
  - with the setting, 40 failures from one IP block that IP while another IP is fine, and the block lifts after 15 minutes;
  - with the setting but no header, only the account limit applies.
- `npm test`: 66 suites, 471 tests. `npm run build` is green.

## Login: same cost and same error for an unknown account

**When:** 2026-09-30

**What:** Security audit S-4. Login skipped the password check when the identifier did not exist: about 50 ms for a real account against about 6 ms for an unknown one, which revealed which accounts exist.
- New `verifyAgainstDummy(password)` in `access/infrastructure/password.ts` verifies against a throwaway hash made once per process with `hashPassword`, so it always uses the current cost, and returns false.
- `login` calls it when no user is found. The error stays `access.invalid_login` for an unknown account, a wrong password, or no membership on this stadium.

**Why:** [security-audit.md S-4](./audits/security-audit.md#s-4-login-reveals-which-identifiers-exist-by-timing).

**Files:** `src/modules/access/infrastructure/password.ts`, `src/modules/access/application/login.ts`, `test/integration/login-timing.integration.test.ts` (new).

**How it connects:** Access module only. The brute-force limit from the previous entry is checked first and counts unknown accounts the same way.

**How to verify:**
- The test was written first and failed: a 41 ms gap against a 13 ms allowance.
- Now 7 interleaved attempts each (the rate-limit rows are cleared between attempts) give medians within 30% of each other, and both fail with `access.invalid_login`. It passed 4 runs in a row.
- `npm test`: 66 suites, 471 tests.
- `npm run test:integration`: 18 suites, 121 tests.
- `npm run build` is green.

## Password hash cost: measured default, env override, rehash on login

**When:** 2026-09-30

**What:** Security audit S-16.
- **Measurement:** scrypt on this machine (4 cores, r=8, p=1, median of 5):

  | log2 N | Time per hash |
  |---|---|
  | 14 | 42 ms |
  | 15 | 94 ms |
  | 16 | 193 ms |
  | 17 | 387 ms |
  | 18 | 780 ms |

  N must be a power of two. 16 is the closest to the requested 250 ms (17 is further away and needs 128 MB per hash), so `DEFAULT_PASSWORD_HASH_COST = 16`, which uses 64 MB per hash.
- **Override:** `PASSWORD_HASH_COST` (an integer from 14 to 20); an invalid value throws.
- **Format:** a hash now records its parameters, `scrypt:cost:r:p:salt:hex`. Old `salt:hex` hashes (N = 2^14) still verify, and malformed hashes return false.
- **Upgrade:** `passwordNeedsRehash` is true when the stored cost differs from the current one. After a successful login, `login` rehashes with the password it just checked (`updatePasswordHash`). A failed login never touches the hash.
- The S-4 dummy hash uses the same cost, and the timing test still passes.
- `.env.example` and `docs/RUNBOOK.md` ("Password hash cost") explain how to lower the cost and how to time one hash on the server.

**Why:** [security-audit.md S-16](./audits/security-audit.md#s-16-scrypt-at-default-cost).

**Files:** `src/modules/access/infrastructure/password.ts`, `src/modules/access/infrastructure/users.ts`, `src/modules/access/application/login.ts`, `test/modules/access/infrastructure/password.test.ts` (new), `test/integration/auth-sessions.integration.test.ts`, `.env.example`, `docs/RUNBOOK.md`.

**How it connects:** The seed, `scripts/set-password.ts` and the fixtures all go through `hashPassword`, so they write the new format.

**How to verify:**
- The tests were written first; 4 of the 6 unit tests failed.
- `npm test`: 67 suites, 477 tests.
- `npm run test:integration`: 18 suites, 123 tests. The new ones check that an old hash is upgraded once on a successful login and left alone on a failed one.
- `npm run build` is green.

## End-to-end test: the real session cookie in production

**When:** 2026-09-30

**What:** New `test/e2e/login-cookie.e2e.test.ts`, run by the new `npm run test:e2e` (`jest.e2e.config.ts`, after `npm run build`).
- It seeds two tenants on `stadiums_test` and starts `next start` with `NODE_ENV=production` on 127.0.0.1. It reads the login Server Action id from the login page, then posts a real login with a tenant `Host` and a matching `Origin`.
- **The login `Set-Cookie`:** `stadium_session` is a 43-character token with `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, a 30-day `Max-Age`, and **no `Domain`** (host-only).
- **The proxy renewal on `GET /owner/today`:** it carries the same flags, and the marker cookie is `Secure` with no `Domain`.
- **Tenant B:** with tenant A's cookie, B's host answers 307 to `/owner/login`.
- CI runs `npm run test:e2e` after the build. The unit Jest config ignores `*.e2e.test.ts`.

**Why:** User request: prove the cookie flags from a real production response, not from code.

**Files:** `test/e2e/login-cookie.e2e.test.ts` (new), `jest.e2e.config.ts` (new), `jest.config.ts`, `package.json` (`test:e2e`), `.github/workflows/ci.yml`, `docs/guides/testing-jest.md`.

**How it connects:** Test-only. It reuses the integration `setup-env.ts`, which forces `stadiums_test`, plus the fixtures and truncate. `stadiums_dev` has 0 transactions in `pg_stat_database` after the builds and test runs.

**How to verify:**
- `npm run build && npm run test:e2e`: 2 tests pass.
- The test passed on its first run, because the flags were already correct. As a check that it catches a regression, adding `domain: "lebstads.test"` to the cookie options and rebuilding made both tests fail; the change was then reverted.
- `npm test`: 67 suites, 477 tests. `npm run test:integration`: 18 suites, 123 tests. `npm run build` is green.

## Rolling session: end-to-end test

**When:** 2026-09-30

**What:** New `test/integration/rolling-session.integration.test.ts`. It fakes only `Date` and models a browser cookie jar: `Max-Age` from the time a cookie is set, and expired cookies are dropped. Each page view runs the real `proxy` (the cookie renewal) and then `getCurrentMembership` (the DB renewal).
- A session used on day 25 is still valid on day 50.
- A session unused for 31 days is rejected: the browser has dropped the cookie, and a client that kept it is refused by the DB expiry.
- The cookie expiry and the DB expiry stay within one day of each other at every use (days 0, 0.5, 1, 2, 10, 25, 25.9, 26, 49).

**Result:** no mismatch between the DB expiry and the cookie refresh. The first run reported a 23-day gap, but that was the test reading the fixture's own 7-day session. It now looks the row up by the jar token's hash.

**Why:** User request, before the public-surface fixes.

**Files:** `test/integration/rolling-session.integration.test.ts` (new).

**How it connects:** Test-only. It imports `src/proxy.ts` and the access use cases.

**How to verify:** `npm run test:integration` (19 suites, 126 tests), `npm test` (67 suites, 477 tests), `npm run build`.

## Person names: invisible characters stripped, public name capped at 60

**When:** 2026-09-30

**What:** Security audit S-5 (unbounded name) and S-14 (bidi spoofing).
- **`cleanPersonName`** (`people/domain/clean-person-name.ts`) is the shared cleaner. `createPerson` uses it for every Person name, from both the public request and the owner's form. It:
  - strips the bidi controls U+061C, U+200E, U+200F, U+202A–202E and U+2066–2069;
  - strips U+200B, U+FEFF and the C0/C1 control characters;
  - turns tabs and newlines into one space;
  - keeps ZWJ and ZWNJ, which Arabic-script names need.
- **Public request schema:** the name is cleaned first, then must be 1–60 characters (`PUBLIC_NAME_MAX`). A name made only of invisible characters is refused. The phone still goes through the existing `normalizePhone` (8–15 digits).
- **The shared slot-picker name input** has `maxLength={60}`.

**Why:** [security-audit.md S-5](./audits/security-audit.md#s-5-public-requests-can-be-flooded-and-names-are-unbounded), [S-14](./audits/security-audit.md#s-14-names-accept-bidi-overrides-and-control-characters).

**Files:** `src/modules/people/domain/clean-person-name.ts`, `src/modules/booking/schemas/public-slot-request.ts`, `src/components/slot-picker.tsx`, `test/modules/people/domain/clean-person-name.test.ts`, `test/modules/booking/schemas/public-slot-request.test.ts`.

**How it connects:** The booking schema imports the people domain cleaner (downward). `searchName` is still `normalizeName` of the cleaned name.

**How to verify:**
- The tests were written first; 5 failed.
- `npm test`: 67 suites, 485 tests.
- `npm run test:integration`: 19 suites, 126 tests.
- `npm run build` is green.

## Public requests: per-phone and per-IP limits, pending cap

**When:** 2026-09-30

**What:** Security audit S-5.
- **Per phone:** 5 requests per phone per stadium per hour. Requests for a taken hour count too.
- **Per IP:** 60 requests per IP per hour across all stadiums, only when `TRUSTED_CLIENT_IP_HEADER` is set.
- **Where the counters run:** both use the Postgres `RateLimit` counters from the login work, and are hit in `requestPublicSlot` before the tenant transaction (platform tables, one-pool rule).
- **Pending cap:** inside the transaction, after the pitch lock, a phone may have at most 3 **future** PENDING requests at one stadium (`countFuturePendingForRequester`: requester participant, `lower(during) > now`). Old missed requests do not count, and a Person created by the refused request is rolled back.
- **One answer for every limit:** `booking.request_limit`, "No more requests can be sent right now. Try again later or call the stadium." / "لا يمكن إرسال طلبات أخرى الآن. حاول لاحقاً أو اتصل بالملعب.". It does not say which limit was hit, so a phone typed by someone else reveals nothing about its owner's requests.
- **SlotInterest dedupe per person and window:** already in place (`hasSlotInterest`, checked under the pitch `FOR UPDATE` lock). It is now pinned by a test: 5 requests for the same taken hour leave one interest.

**Why:** [security-audit.md S-5](./audits/security-audit.md#s-5-public-requests-can-be-flooded-and-names-are-unbounded). The user asked for generic messages that reveal nothing about other people's data.

**Files:** `src/modules/booking/domain/public-request-limits.ts` (new), `src/modules/booking/application/request-public-slot.ts`, `src/modules/booking/infrastructure/bookings.ts`, `src/lib/error-messages.ts`, `test/integration/public-limits.integration.test.ts` (new).

**How it connects:** Booking imports `lib/rate-limit` and `lib/client-ip` (downward). The new raw SQL filters by the ALS tenant, like its neighbours.

**How to verify:**
- The tests were written first; 5 of 7 failed. The 2 that passed pin existing behaviour: no IP limit without the setting, and a decided request freeing a place.
- `npm run test:integration`: 20 suites, 133 tests.
- `npm test`: 67 suites, 485 tests.
- `npm run build` is green.

## Request card: the typed name when it differs from the saved one

**When:** 2026-09-30

**What:** Security audit S-6. A public request under a known phone is filed under that Person, and the saved name is never overwritten. The owner now also sees what the requester typed.
- **Schema:** new nullable `Booking.requestedName` (TEXT, no default). Migration `20260930140000_booking_requested_name` only adds the column, so it is safe while the old code is still running. The user approved this before migrating: Booking only, no change to SlotInterest or Person.
- **Write:** `requestPublicSlot` writes the cleaned typed name only when its `normalizeName` fold (the same as `searchName`) differs from the saved Person name's fold. أحمد/احمد/إحمد, tashkeel, letter case and spacing never count as different. The column stays NULL for a new phone, for matching names and for owner-created bookings.
- **Read:** `listPendingBookings` returns `requestedName`.
- **Card:** the new `RequestedNameNotice` shows `ui("owner.requestedNameDiffers")` ("الاسم يختلف عن المسجّل:" / "Name differs from the saved one:") followed by the name in `<bdi>`. It appears under the saved name on both the pending and the missed request cards, and only when the value is not null.

**Why:** [security-audit.md S-6](./audits/security-audit.md#s-6-anyone-can-file-a-public-request-under-someone-elses-phone).

**Files:** `src/prisma/schema.prisma`, `src/prisma/migrations/20260930140000_booking_requested_name/migration.sql` (new), `src/modules/booking/application/request-public-slot.ts`, `src/modules/booking/infrastructure/bookings.ts`, `src/app/owner/requested-name-notice.tsx` (new), `src/app/owner/pending-list.tsx`, `src/lib/ui-copy.ts`, `test/integration/requested-name.integration.test.ts` (new), `test/app/owner/requested-name-notice.test.ts` (new).

**How it connects:** Booking imports the people domain `cleanPersonName` and `normalizeName` (downward). The migration was written by hand; `prisma migrate diff` from `stadiums_test` shows no drift for the column.

**How to verify:**
- The tests were written first. The unit test failed (module not found) and all 4 integration tests failed.
- The integration tests cover: NULL for a new phone; NULL for other Arabic spellings, case and spacing; a different name stored cleaned while the saved name stays; NULL for an owner-created booking.
- The unit test covers: nothing rendered for NULL; the Arabic warning with a `<bdi>` name; the English copy.
- `npm test`: 68 suites, 488 tests. `npm run test:integration`: 21 suites, 137 tests. `npm run build` is green.

## Page list queries bounded

**When:** 2026-09-30

**What:** Security audit S-8. Every infrastructure list query was listed and checked for a limit.
- **Capped:**
  1. `listPendingInbox`, new, used by `listPendingRequests` (Requests inbox, Today, owner layout): the next 200 upcoming PENDING plus the 50 most recent missed, still in start order. `listPendingBookings` stays uncapped **on purpose**: approve (`rejectOverlappingPending`) and dismiss-missed must see every row. A test approves one of 260 same-slot requests, and all 259 others are rejected.
  2. `listApprovedRanges`: bounded by time, not rows. Only APPROVED windows ending after now − 24 h. Its callers are the public page, the Book page, the public request and owner-create overlap checks, and the waitlist, and all of them only look at slots that have not ended. A row cap could have dropped a future booking from an overlap check.
  3. `listSlotInterestsWithPeople` (waitlist, decision notify): windows ending after now − 24 h, at most 500.
- **Already capped:** `searchPersons` (20), `listRecentExpenses`, `listEndedWithRemaining`, `listPersonBookingRows`, `listDebtParticipations`.
- **Left as they are:**
  - bounded by their input or a day: `listBookingsForStartDay` (one business day), `listSlotsForBookings` and `sumCollectedUsdBySourceIds` (given ids), `listPersonStatRows` (aggregate for one person), `listLiveWindowsOnPitch` (future bookings of one pitch, a conflict check that must be complete);
  - owner-created and small: `listPitches`;
  - single-row lookups and locks.

**Why:** [security-audit.md S-8](./audits/security-audit.md#s-8-unbounded-queries-on-hot-paths).

**Files:** `src/modules/booking/infrastructure/bookings.ts`, `src/modules/booking/application/list-pending-requests.ts`, `test/integration/list-caps.integration.test.ts` (new).

**How it connects:** Booking infrastructure only. Every new SQL statement filters by the ALS tenant, including the CTE's join back to Booking.

**How to verify:**
- The tests were written first; 3 of 4 failed. The approve test passed, as the guard it is meant to be.
- `npm run test:integration`: 22 suites, 141 tests.
- `npm test`: 68 suites, 488 tests.
- `npm run build` is green.

## Hosts: strict allowlist, tenant from the validated Host only

**When:** 2026-09-30

**What:** Security audit S-9, S-10 and S-11.
- **Resolver:** `src/lib/tenant-slug.ts` has a new pure resolver, `classifyHost` / `resolveTenantHost` / `resolveTenantFromHeaders`.
  - Valid hosts are the bare `APP_BASE_DOMAIN` (the apex, no tenant) or a single-label subdomain of it, case- and port-insensitive, with a trailing dot allowed.
  - Anything else is invalid: another domain, a deeper subdomain, a bad label, or a missing base (fails closed).
  - `X-Forwarded-Host` (its last entry) is used only with `TRUST_PROXY_HEADERS=true`.
  - The old Origin/Referer fallback for the `next dev` redirect issue now runs only outside production, only from the bare domain, and only to a host that is itself a valid tenant host.
- **`src/proxy.ts`:** an invalid host gets a 404 before any tenant lookup, and the proxy always forwards the request headers with `x-tenant-slug` removed.
- **`tenant-context.loadTenant`** resolves the slug from the same validated Host and **never reads `x-tenant-slug`**. This also closes the image-extension paths the proxy matcher skips.
- **`manifest.ts`** uses the same resolver.
- **Tests:** integration stubs now set `Host: <slug>.lebstads.test` (`setup-env` sets `APP_BASE_DOMAIN=lebstads.test`), and the e2e server gets the same base.
- **Docs:** README, folder-structure, owner-ia, the module map and the tenant-guard guide no longer mention `?tenant=` or `x-tenant-slug`. `.env.example` and `docs/RUNBOOK.md` ("Hosts") cover `TRUST_PROXY_HEADERS` and the nginx `Host` line.

**Why:** [security-audit.md S-9](./audits/security-audit.md#s-9-spoofed-x-tenant-slug-is-believed-on-image-extension-paths), [S-10](./audits/security-audit.md#s-10-any-base-domain-is-accepted), [S-11](./audits/security-audit.md#s-11-x-forwarded-host-is-trusted-when-host-is-localhost).

**Files:** `src/lib/tenant-slug.ts`, `src/lib/tenant-context.ts`, `src/proxy.ts`, `src/app/manifest.ts`, `test/lib/tenant-slug.test.ts`, `test/proxy.test.ts`, `test/integration/host-tenant.integration.test.ts` (new), `test/integration/request-stubs.ts`, `test/integration/setup-env.ts`, `test/e2e/login-cookie.e2e.test.ts`, `.env.example`, `README.md`, `docs/RUNBOOK.md`, `docs/owner-ia.md`, `docs/guides/folder-structure.md`, `docs/guides/module-map-and-request-walkthroughs.md`, `docs/guides/prisma-transaction-tenant-guard.md`.

**How it connects:** `lib` only; the proxy still never queries Postgres.

**How to verify:**
- The tests were written first; 10 unit/proxy tests and 3 integration tests failed.
- `npm test`: 68 suites, 490 tests.
- `npm run test:integration`: 23 suites, 145 tests.
- `npm run build` is green, and `npm run test:e2e` passes (2 tests).

## Security headers from next.config; CSP Report-Only

**When:** 2026-09-30

**What:** Security audit S-7 and S-13.
- **Headers on every route** (`/:path*`) via `next.config.ts` `headers()`:
  - `X-Content-Type-Options: nosniff`;
  - `Referrer-Policy: strict-origin-when-cross-origin`;
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`;
  - `X-Frame-Options: DENY`.
- **`poweredByHeader: false`.**
- **No HSTS:** nginx sets it.
- **CSP decision:** shipped as **`Content-Security-Policy-Report-Only`** with the local guide's "Without Nonces" policy. On top of the guide's policy it adds `connect-src`, `manifest-src` and `worker-src 'self'`, and it drops `upgrade-insecure-requests`, which has no effect in Report-Only.
  - Report-Only cannot block scripts, the service worker or the manifest, so the PWA is unaffected.
  - Fonts come from `next/font` (self-hosted), so `font-src 'self'` holds.
  - There is no report endpoint; violations show in the browser console.
  - Enforcing needs per-request nonces, which stay deferred by decision.

**Why:** [security-audit.md S-7](./audits/security-audit.md#s-7-no-security-headers), [S-13](./audits/security-audit.md#s-13-x-powered-by-nextjs).

**Files:** `next.config.ts`, `test/next-config.test.ts` (new), `test/e2e/login-cookie.e2e.test.ts`.

**How it connects:** Config only.

**How to verify:**
- The tests were written first; 3 of 4 unit tests failed.
- The e2e test now also checks a real production response: the headers are present, there is no `X-Powered-By` and no HSTS, and a foreign host gets 404.
- `npm test`: 69 suites, 494 tests. `npm run test:integration`: 23 suites, 145 tests.
- `npm run build` is green, and `npm run test:e2e` passes (4 tests).

## Startup env validation

**When:** 2026-09-30

**What:** Security audit S-18.
- **Schema:** `src/lib/env.ts` validates the environment with Zod.
  - Required: `DATABASE_URL` (postgres URL), `APP_BASE_DOMAIN` (host with an optional `:port`), `APP_PROTOCOL` (`http` or `https`).
  - Optional: `PASSWORD_HASH_COST` (14–20), `TRUSTED_CLIENT_IP_HEADER` (a header name), `TRUST_PROXY_HEADERS` (`true` or `false`), `PG_POOL_MAX` (a positive integer).
  - Errors name the variable and never print its value (`DATABASE_URL` holds the password). There is no session secret, by the user's decision: tokens are random and stored hashed.
- **Startup:** the new `src/instrumentation.ts` `register()` runs it once at server start under `NEXT_RUNTIME=nodejs`. `next build` never runs it, so CI builds need no production env.
  - **Found while testing:** a throw in `register()` only logs "Failed to prepare server", and `next start` keeps running. So `enforceEnvAtStartup` exits the process in production. Outside production it only warns.
  - The exit lives in `env.ts`, which is imported only under the Node runtime, so the Edge-runtime build warning is gone.
- **`.env.example`** is synced: a header naming the required set, and `PG_POOL_MAX` added. `docs/RUNBOOK.md` gains an "Environment" section.

**Why:** [security-audit.md S-18](./audits/security-audit.md#s-18-no-env-validation-at-startup).

**Files:** `src/lib/env.ts` (new), `src/instrumentation.ts` (new), `test/lib/env.test.ts` (new), `test/e2e/login-cookie.e2e.test.ts`, `.env.example`, `docs/RUNBOOK.md`.

**How it connects:** `lib` only. The e2e server now gets `APP_PROTOCOL=http` as well.

**How to verify:**
- The unit test was written first and failed (module not found).
- The e2e test `next start` with `NODE_ENV=production` and a malformed `APP_BASE_DOMAIN` now exits with a non-zero code and names the variable. Before the exit was added, the process kept running and the test failed.
- `npm test`: 70 suites, 501 tests. `npm run test:integration`: 23 suites, 145 tests.
- `npm run build` is green with no warnings, and `npm run test:e2e` passes (5 tests).

## Security audit: status of every finding

**When:** 2026-09-30

**What:** Appended "Addendum: status of every finding after the security fixes" to `docs/audits/security-audit.md`. It gives S-1 to S-21 and RLS a status (fixed, partly fixed, deferred or open), with the commits and the reason. The audit body is unchanged. `docs/ROADMAP.md` items 6–12 now carry their fix commits or deferral.

**Deferred by decision:** RLS, an enforced nonce-based CSP, and the Low findings outside this round: S-12, S-15, S-17 (global sweep and log rotation), S-20 and S-21. S-19 stays open by design (DR-003).

**Files:** `docs/audits/security-audit.md`, `docs/ROADMAP.md`.

**How to verify:** Docs only. Every commit in the table is on `main` (PRs #7–#9) or on `fix/public-surface`.

## Production server listens on 127.0.0.1 only

**When:** 2026-09-30

**What:** The `start` script in `package.json` is now `next start -H 127.0.0.1 -p 3000` (it was `next start`, which listens on `0.0.0.0`). `docs/RUNBOOK.md` has a new section, "Listen on localhost only", with the reason and the server check `sudo ss -tlnp | grep ':3000'`, which must show `127.0.0.1:3000`.

**Why:** Audit "to confirm on the server" item 3 (port 3000 not public). Reaching the app directly bypasses nginx: TLS, HSTS, `limit_req`, and the host and client-IP headers the app trusts (S-3, S-9 to S-11).

**Verification of the flag (not guessed):**
- `next start --help` and `node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md` ("`next start` options") document `-H, --hostname` (default 0.0.0.0) and `-p, --port` (default 3000, env `PORT`).
- The `HOSTNAME` env var is documented only for the standalone `server.js` (`05-config/01-next-config-js/output.md`).

**Files:** `package.json`, `docs/RUNBOOK.md`.

**How it connects:**
- CI never runs `npm start`: it runs unit, integration, build and `test:e2e`.
- The e2e tests spawn `node_modules/.bin/next start -p 3217 -H 127.0.0.1` (and 3218) directly, so they are unaffected.

**How to verify:**
- Local run: `npm start` with `NODE_ENV=production` against `stadiums_test`. `/proc/net/tcp` showed exactly one listener, `127.0.0.1:3000`; `ss` is not installed in this container. `curl` to 127.0.0.1:3000 answered, and the container's external IP on port 3000 was refused.
- `npm run test:e2e`: 5 tests. `npm test`: 70 suites, 501 tests.

## Tenant management 1/4: platform tables and pure rules

**When:** 2026-10-01

**What:** The data and pure rules for the platform operator's tenant management (a CLI, BR-103/BR-104).
- **Schema** (migration `20261001090000_tenant_management`, additive only, so safe while the old code runs):
  - `Tenant.suspendedAt` and `Tenant.suspendedReason`, both nullable;
  - **`Subscription`** (tenantId, plan text, startsAt, paidUntil?, amountUsd?, note?, recordedBy, createdAt);
  - **`PlatformAuditLog`** (action, tenantId?, actor, detail jsonb, createdAt).
- **Append-only:** both new tables have a `BEFORE UPDATE OR DELETE` row trigger (`platform_append_only()`). `TRUNCATE` is not a row event, so the test truncate helper and the seed (now `TRUNCATE "PlatformAuditLog", "Subscription"`) still work. Foreign keys are `ON DELETE RESTRICT`.
- **Classification:**
  - `src/lib/db.ts` exports `TENANT_SCOPED_MODELS` and a new `PLATFORM_ONLY_MODELS` (Subscription, PlatformAuditLog). The scoped client throws for platform-only models.
  - New `test/lib/model-classification.test.ts` parses the schema: every model with a `tenantId` must be in exactly one set. No such check existed before.
  - Both tables were added to `truncate.ts`.
- **Pure rules** in the new `src/modules/platform/domain`:
  - `validateSlug`: 3–30 characters, `[a-z0-9-]`, no edge hyphen, and not in `RESERVED_SLUGS`, the 23 names from decision 3.
  - `suspension.ts`: `tenantStatus`, `assertCanSuspend` (reason required, at most 200 characters, not already suspended), `assertCanResume`, and `isOverdue` (the paid-until day is fully over).
- `isCurrentGeneratedClient` also requires the `platformAuditLog` model.

**Why:** The user's tenant-management decisions 2, 3, 5, 6 and 8. BR-103 (plans) is PARTIAL by decision: a label only.

**Files:** `src/prisma/schema.prisma`, `src/prisma/migrations/20261001090000_tenant_management/migration.sql` (new), `src/lib/db.ts`, `src/lib/prisma-base.ts`, `src/prisma/seed.ts`, `src/modules/platform/domain/slug.ts` (new), `src/modules/platform/domain/suspension.ts` (new), `test/modules/platform/domain/*.test.ts` (new), `test/lib/model-classification.test.ts` (new), `test/integration/platform-tables.integration.test.ts` (new), `test/integration/truncate.ts`.

**How it connects:** The platform domain imports only `lib/errors`. The migration was written by hand; `prisma migrate diff` against `stadiums_test` shows no drift for the new columns and tables.

**How to verify:**
- The tests were written first; all 3 unit suites failed (modules not found).
- The integration tests cover:
  - UPDATE and DELETE are blocked on both tables;
  - TRUNCATE works;
  - the scoped client refuses both models;
  - the suspension columns default to null.
- `npm test`: 73 suites, 536 tests. `npm run test:integration`: 24 suites, 150 tests.
- `npm run build` is green, and the seed runs on `stadiums_test`.

## Tenant management 2/4: suspension enforced at the tenant choke point

**When:** 2026-10-01

**What:** Decision 7, suspending a tenant.
- **Choke point:** `CurrentTenant.suspended` comes from the same `loadTenant` query (`suspendedAt` added to the select), so no query is added; a test counts exactly one `tenant.findUnique` per request. `getCurrentTenantId()` throws `tenant.suspended`. Every tenant-scoped Prisma call and every raw-SQL tenant stamp goes through it, so no entry point can read or write a suspended tenant's data, even one that forgets a check.
- **Owner side:**
  - `getCurrentMembership` returns null first, without looking at or renewing the session, so every owner use case fails as `access.not_allowed`.
  - The `(app)` layout, `requireOwnerMembership`, the login page and the login action (`tenant.suspended`) redirect to the new `/owner/suspended`, which is outside the shell. It renders the fixed "account suspended" copy and sends an active tenant to `/owner/today`. It never redirects to login, so there is no loop.
  - The live route answers 403 `{ error: "tenant_suspended" }`, and `live-queue.tsx` goes to `/owner/suspended` on that code.
  - `login` calls `getCurrentTenantId()` first, so no password is checked and no failure is counted.
- **Public side:**
  - The new `(public)/layout.tsx` gates **every** public path. It renders the neutral `UnavailableNotice`, with robots noindex from `generateMetadata`; `Cache-Control: no-store` is Next's own header for dynamic pages. The page checks too.
  - `requestPublicSlot` refuses at the choke point before its rate counters, so nothing is written.
  - The manifest answers as for an unknown host.
- **Status code, by the user's decision:** the neutral page answers 200, not 503. Next 16 pages cannot set 503 (local `loading.md`, "Status codes"), and the proxy would need a DB query per request.
- **Copy:** `ui()` keys `unavailable.{public,owner}.{title,body}` and the error key `tenant.suspended`, in AR and EN. No reason text is ever shown.
- **Unchanged:** sessions and data. Resume restores everything.

**Why:** User decision 7; BR-104.

**Files:** `src/lib/tenant-context.ts`, `src/modules/access/application/get-current-membership.ts`, `src/modules/access/application/login.ts`, `src/modules/booking/application/request-public-slot.ts`, `src/app/owner/shared.tsx`, `src/app/owner/(app)/layout.tsx`, `src/app/owner/login/page.tsx`, `src/app/owner/login/actions.ts`, `src/app/owner/suspended/page.tsx` (new), `src/app/owner/(app)/requests/live/route.ts`, `src/app/owner/live-queue.tsx`, `src/app/(public)/layout.tsx` (new), `src/app/(public)/page.tsx`, `src/app/manifest.ts`, `src/components/unavailable-notice.tsx` (new), `src/lib/ui-copy.ts`, `src/lib/error-messages.ts`, `test/integration/suspension.integration.test.ts` (new), `test/e2e/login-cookie.e2e.test.ts`, `docs/owner-ia.md`.

**How it connects:** `lib/tenant-context` imports `lib/errors` (which has no imports).

**How to verify:**
- The tests were written first; the suite failed (the page was missing).
- The 10 integration tests cover:
  - membership null and use cases refused;
  - the choke point throws;
  - the redirect target is `/owner/suspended` with or without a session;
  - the login page and use case, with no failure counted;
  - the suspended page renders, or redirects when the tenant is active;
  - the live route answers 403;
  - `requestPublicSlot` writes nothing;
  - the other tenant is unaffected;
  - resume keeps the same session valid and deletes no rows;
  - one tenant query per request.
- The e2e tests (`next start`, production) check that `/`, `/?date=` and `/?error=` return 200 with the robots noindex meta, `Cache-Control` containing no-store, the neutral copy, and no tenant name, pitch name or id. They also check the neutral manifest, the 307s to `/owner/suspended`, the 403 poll, and the other tenant unaffected.
- `npm test`: 73 suites, 536 tests. `npm run test:integration`: 25 suites, 160 tests.
- `npm run build` is green, and `npm run test:e2e` passes (9 tests).

## Tenant management 3/4: platform use cases and the operator CLI

**When:** 2026-10-01

**What:** The platform operator's CLI, decisions 1 and 3–6, 8 and 12.
- **Use cases** (`src/modules/platform/application`): `listTenants`, `createTenant`, `suspendTenant`, `resumeTenant`, `setSubscription`.
  - Each takes an explicit `actor` and returns plain data or throws `platform.*` DomainError keys.
  - They never print, prompt, read `process.argv` or exit (decision 12).
  - Every mutating one writes its row changes and **one** `PlatformAuditLog` row in the same `platformDb` transaction. The detail never includes a password or hash.
- **`createTenant`** writes the Tenant (settings = `parseTenantSettings({})`), the User, an OWNER Membership, the first Subscription (default plan label `basic`) and the audit row.
  - The owner identifier defaults to `owner@<slug>`; an override must use the same slug (DR-003: local@tenant-slug).
  - A duplicate slug or identifier becomes `platform.slug_taken` / `platform.identifier_taken`, and the whole transaction rolls back, so no orphan tenant is left.
- **`listTenants`** returns slug, name, status, latest plan, paidUntil + OVERDUE, created, pitch count and bookings requested in the last 30 days. No hashes, tokens or suspension reason.
- **Pure input checks:** `src/modules/platform/domain/inputs.ts`.
- **Cross-tenant reads and the audit writer:** `src/modules/platform/infrastructure/platform-store.ts`.
- **Slug rule tightened (a step-0 conflict, resolved by the user):**
  - `validateSlug` now refuses consecutive hyphens, so `owner@<slug>` always passes `parseLoginIdentifier`, and it refuses `xn--` explicitly (reason `punycode`).
  - A property-style test checks every accepted slug against the identifier rule: 3 and 30 characters, a leading digit, single hyphens.
- **CLI** (`scripts/platform.ts` → `scripts/platform-cli.ts`, `node:util` `parseArgs`, strict):
  - Commands: `tenants list | create | suspend | resume` and `subscriptions set`. The actor is `cli:<os user>@<hostname>`.
  - Every mutating command refuses without a TTY and requires typing the database name; suspend and resume also require typing the slug.
  - `create` asks the owner password hidden, twice. There is no rename command, because slugs are immutable.
- **Shared, not copied** (decision 4):
  - The terminal code (hidden prompt, the TTY check, database confirmation, the two-entry password prompt) moved from `set-password` into `scripts/lib/operator-io.ts`, which both scripts use.
  - The 12-character rule is `MIN_PASSWORD_LENGTH` in `access/domain/password-policy.ts`, re-exported by `set-password-core` and enforced by `createTenant`.

**Why:** The user's tenant-management decisions; BR-103 (plans are a label only, PARTIAL by decision) and BR-104.

**Files:** `src/modules/platform/{domain/inputs.ts,application/*.ts,infrastructure/platform-store.ts}` (new), `src/modules/platform/domain/slug.ts`, `src/modules/access/domain/password-policy.ts` (new), `scripts/platform.ts` (new), `scripts/platform-cli.ts` (new), `scripts/lib/operator-io.ts` (new), `scripts/set-password.ts`, `scripts/set-password-core.ts`, `test/integration/platform-use-cases.integration.test.ts` (new), `test/integration/platform-cli.integration.test.ts` (new), `test/modules/platform/domain/slug.test.ts`, `docs/guides/folder-structure.md`.

**How it connects:**
- `platform` imports `access` (identifier, password policy, hashing) and `lib`; nothing imports `platform` except `scripts/`.
- The use cases use `platformDb` directly. They run in the CLI process, never inside a tenant request.

**How to verify:**
- The tests were written first; both suites failed (modules not found).
- The use-case tests (10) call each use case directly with fake actors (`test:jest@ci`, `admin:42`) and no terminal.
- The CLI tests (13) cover:
  - a wrong database name refuses;
  - non-interactive runs refuse before any prompt;
  - a wrong slug confirmation refuses;
  - one audit row per command, with the actor stored as given;
  - the password prompts are hidden and not printed;
  - the list prints no secrets and writes nothing;
  - unknown commands and flags are refused.
- The set-password tests still pass after the refactor.
- A manual run against `stadiums_test`: non-interactive create refused with exit 1; create in a pseudo-terminal printed `created demo-club (owner login: owner@demo-club)` and never echoed the password; `tenants list` printed the row.
- `npm test`: 73 suites, 540 tests. `npm run test:integration`: 27 suites, 182 tests. `npm run build` is green.

## Tenant management 4/4: platformDb import guard and docs

**When:** 2026-10-01

**What:**
- **Guard:** new `test/platform-db-imports.test.ts` scans `src/` and `scripts/` (generated client excluded) for imports of `lib/platform-db`: alias, relative and dynamic `import()`. It compares them with an allowlist where each entry has its reason.
  - Allowed: the tenant lookup (`tenant-context`), `src/modules/platform/`, and `scripts/set-password-core.ts` (the body of `scripts/set-password.ts`). `scripts/platform.ts` reaches the database only through the platform use cases. `prisma/seed.ts` builds its own client and does not import `platform-db`.
  - Also allowed: the pre-existing importers DR-003 and the security work need, namely `access/infrastructure/{sessions,users,tenants}.ts` (global User and Session, tenant settings by the resolved id), `lib/rate-limit.ts` (a global table) and `app/manifest.ts` (lookup by slug). These go beyond the list in the request.
  - Any new importer fails the test.
- **`docs/RUNBOOK.md`** (extended, not overwritten) gains "Tenant management": the commands, the confirmation rules, audit, the onboarding checklist, the suspend/resume procedure, reserved slugs and slug immutability. Password resets point to "Passwords".
- **`docs/ROADMAP.md`** gains "Deferred on purpose: tenant management", with reasons: the web platform admin, date-based suspension, plan limits and pricing, forced password change at first login, and a real HTTP 503 (Next 16 pages cannot set it; the proxy would need a DB query per request).
- **`docs/NOW.md`** now lists the security fixes and tenant management in "Shipped since" and points to the RUNBOOK.

**Why:** User request, commit 4 of the tenant-management work.

**Files:** `test/platform-db-imports.test.ts` (new), `docs/RUNBOOK.md`, `docs/ROADMAP.md`, `docs/NOW.md`.

**How it connects:** Test-only and docs.

**How to verify:**
- The guard passes on the current tree. A probe file `src/modules/booking/zz-probe.ts` importing `platformDb` made it fail, naming the file; the probe was then deleted.
- `npm test`: 74 suites, 543 tests. `npm run test:integration`: 27 suites, 182 tests.
- `npm run build` is green, and `npm run test:e2e` passes (9 tests).

## Today free-slot strip

**When:** 2026-10-01

**What:**
- New strip on Today between the day summary and the bookings list: one line per pitch (pitch name only with more than one pitch) of horizontally scrollable time chips. Free = engine slot, start after now, not overlapped by an APPROVED booking. PENDING keeps the chip and adds a count badge. A price shows only when it differs from the pitch default. Tap opens the existing booking sheet (extracted from `SlotPicker` as `SlotBookSheet`, so Book and Today share one form), prefilled; the action returns to Today on the same day. Without `bookings.create` the chips show and do nothing.
- Past day: no strip. No hours on the day: one "Closed" line. No games and no free slots: the existing empty state is unchanged.
- To collect is one amber row ("N games to collect · $X", "5+" when the inbox is capped) that expands in place to the same cards. It opens by itself for a highlighted or opened card, so money is never hidden.
- Pure `buildFreeStrip`; `loadFreeStrip` use case; `countPendingBySlot` (one grouped query); `PitchDayAvailability` gained `defaultPriceUsd`. The strip has its own Suspense boundary.

**Why:** G-2, see the free hour and book it in one tap, without a busier Today. UX-01 §3 amended (banner only). No DR covers it; no change to booking creation, the exclusion constraint or slot rules.

**Files:** `booking/domain/free-strip.ts`, `booking/application/load-free-strip.ts`, `booking/infrastructure/bookings.ts`, `venue/application/get-day-availability.ts`, `components/slot-picker.tsx`, `app/owner/(app)/today/{free-strip,free-strip-section,lists,upcoming-panel}.tsx`, `app/owner/(app)/book/actions.ts`, `lib/ui-copy.ts`, `test/modules/free-strip.test.ts`, `test/integration/free-strip.integration.test.ts`, `docs/owner-ux.md`, `docs/NOW.md`.

**How it connects:** Booking imports Venue's availability (down only); Venue still imports nothing from Booking (occupied ranges and pending counts are passed in). `buildFreeStrip` is pure. The strip does not touch `$transaction`, `platformDb` or the ledger; booking goes through `createOwnerBooking` and its authorization.

**How to verify:**
- Unit: 6 tests for `buildFreeStrip`. Integration: 10 tests (17:00 and 19:00 booked, PENDING badge then approve, started slots with injected now, past day, rule price, Friday post-midnight slots, Closed, other tenant, staff without `bookings.create`, To collect count and total, query count).
- Today render queries (membership, tenant, `loadOwnerDay`, waitlist, pending inbox): 8 before, 11 after (+3: pitches, approved ranges, pending counts). Fixed at three however many slots.
- `npm test`: 75 suites, 549 tests. `npm run test:integration`: 28 suites, 192 tests. `npm run build` is green.
- Not covered by a test: the accordion's open/close and chip tap (client state; no component test runner in the repo).
- Known limit: a window that starts after midnight is listed under its own calendar day by the engine, but its bookings belong to the previous business day.

## Free strip restyle

**When:** 2026-10-01

**What:** Styling only on the Today free strip. Chips wrap (no sideways scroll); more than 12 per pitch show 12 plus a "+N more" chip that expands. Heading "Available hours (N)". Quiet outline chips, lime on press, focus and pick; pending badge kept. One small period marker (م / ص, AM / PM) from the tenant's 12/24-hour setting, digits LTR-isolated. One pitch: no label; two: a small label per row; three or more: All / per-pitch filter chips kept in `?pitch=` (kept across a booking from the strip). Arabic booking-card range checked: `4:00–5:00 م` is already in order (digits in one LTR isolate, marker after it); a test now pins it.

**Why:** UX-01 §3 amended; booking cards must stay the dominant element. No query or logic change.

**Files:** `today/free-strip.tsx`, `book/actions.ts` (keeps `pitch`), `lib/format-local-hm.ts` (exports `shortPeriod`), `lib/ui-copy.ts`, `test/lib/clock-range-order.test.ts`.

**How it connects:** UI only; imports unchanged.

**How to verify:** `npm test`: 76 suites, 552 tests. `npm run test:integration`: 28 suites, 192 tests. `npm run build` is green. Screenshots taken from a production build on the test database (mobile, AR and EN, light and dark, one and three pitches).

## Person link: no accidental taps

**When:** 2026-10-01

**What:** Structure and styling only. The Today card's player name is plain text inside the card's button, so the whole card opens the booking sheet. The sheet header gets the person link instead. New shared `app/owner/person-link.tsx` (`PersonLink`: person icon, name, chevron, `w-fit`, 44px, underlined accent, stops propagation) used in the sheet, Requests cards (both lists) and the interest rows (`NotifyPersonRow`). Search results still link to the person page as a whole row. No link sits inside a button or another link.

**Why:** UX-01 owner UI; a full-width name link under the card was hit by accident.

**Files:** `app/owner/person-link.tsx` (new), `today/upcoming-panel.tsx`, `notify-list.tsx`, `pending-list.tsx`.

**How it connects:** UI only; no new imports across modules.

**How to verify:** `npm test`: 552 tests. `npm run test:integration`: 192 tests. `npm run build` is green. Dark screenshots in Arabic and English, card and sheet, from a production build on the test database.

## UI rules doc and screen audit

**When:** 2026-10-01

**What:** New `docs/ui-rules.md`: eight rules for owner screens (money colours, whose number, what a count counts, no heading without an action, one primary button, icons only with meaning, display font only for the title and biggest figure, current task first), each with an AR and EN example, then an audit table of Today, the booking sheet, the person page, Requests and Money (15 rows), then six conflicts with `ui-foundations.md`, `ui-components.md` and `theme.md`. Docs only; no code changed, and the three source docs are untouched.

**Why:** User request. The four seeded findings are confirmed in code: person page "Paid $3" vs row "$30", "1 game" above two rows, green "Remaining" on an unplayed game, and the "Collect" heading with no collect action.

**Files:** `docs/ui-rules.md` (new), `docs/README.md`, `docs/NOW.md` (links).

**How it connects:** The rules are proposed. Rule 1 needs an amber `owed` role that no doc defines, and rule 7 narrows `ui-foundations.md` §2; both wait for a decision.

**How to verify:** Read the audit rows against `people/[personId]/{stats,games}.tsx`, `today/upcoming-panel.tsx` (`DueRemainingFigures`, `UpcomingRowActions`), `pending-list.tsx` and `money/panel.tsx`.

## Money tokens, Figure, and approved UI rules

**When:** 2026-10-01

**What:** `docs/ui-rules.md` rules 1–8 approved, decisions recorded there. `LtrIsolate` is direction-only; digits are tabular from the body; new `<Figure>` (display, tabular, LTR) for the one big figure (sheet Remaining, Money Net). New tokens `paid` / `owed` / `expected` (text and subtle, light and dark, AA checked, owed amber never red). Raw amber and coral-owed replaced on Today, Requests, Money and the person page. Money-in is `paid`; Out and Net are neutral, Net labelled "Net = in − out". The sheet's Remaining takes its colour from the game's state (paid / owed / expected) with a check or alert icon. Decorative row icons (clock, pin, expense category tile) dropped. Foundations §2 and theme §3 carry a one-line amended note.

**Why:** User decisions on the ui-rules conflicts. Presentation only: no query, use case or rule changed.

**Files:** `globals.css`, `components/ui/{ltr-isolate,figure}.tsx`, `today/{upcoming-panel,per-player-collect}.tsx`, `pending-list.tsx`, `requested-name-notice.tsx`, `notify-list.tsx`, `people/[personId]/{stats,games}.tsx`, `money/panel.tsx`, `lib/ui-copy.ts` (`owner.net`), `docs/{ui-rules,ui-foundations,theme}.md`.

**How it connects:** UI only. Branch `ui/tokens-and-rules` is stacked on `feat/today-free-slots` because `docs/ui-rules.md` is not on main yet.

**How to verify:** `npm test`: 552 tests. `npm run test:integration`: 192 tests. `npm run build` is green. Screenshots (Today, person page, Money; Arabic dark, English light) from a production build on the test database.

## Trust fixes: labels on the sheet, person page and Today card

**When:** 2026-10-01

**What:** Applied `docs/ui-rules.md` to the three screens. Person page: stat labels are "N games played · N upcoming" and "Total paid"; each game row shows this person's own figure with its label and state colour (Owed / Paid / Expected / Share, with a status icon) and, on a per-player game, "Share $3 · Game $30". Booking sheet: the "Collect" heading renders only when a collect control is shown; the figure is Expected (neutral), Remaining (owed) or Paid (green); the Due box is labelled Game. Today card: the upcoming trail reads "Game $30".

**Why:** Open audit rows from `ui-rules.md` (rules 1–4). Copy, headings and tokens only. The one data addition is a read-only `upcoming` count in `summarizePersonBookings`.

**Files:** `people/[personId]/{stats,games}.tsx`, `today/upcoming-panel.tsx`, `booking/domain/person-stats.ts`, `lib/ui-copy.ts`.

**How it connects:** UI and one pure domain counter; no new imports across modules.

**How to verify:** `npm test`: 552 tests. `npm run test:integration`: 192 tests. `npm run build` is green. Dark screenshots in Arabic and English.

## Final audit pass: abuse probes and a short architecture review

**When:** 2026-10-05

**What:**
- Resumed `docs/audits/security-audit-2.md` with runs:
  - **a)** Staff `{}`: 19 of 19 flag-gated use cases refused. **N-6:** the expense list and person money totals are visible without `reports.view`.
  - **b)** Public visitor: edge validation holds. **N-8:** the use case trusts its caller. **N-9:** no booking horizon (400 days ahead accepted). N-2 confirmed.
  - **c)** Owner A with B's ids: every write refused, every read empty.
  - **d)** Suspended tenant: every entry point refused or neutral.
- New `docs/audits/architecture-review.md`: ten ranked items before owner #3, and five "do not touch" items.
- N-1 (the `next` RCE advisory) is still open.

**Why:** Final review before onboarding more owners (DR-001, DR-003, SPEC-08).

**Files:** `docs/audits/security-audit-2.md` (appended), `docs/audits/architecture-review.md` (new). No code changed.

**How it connects:** Docs only. The probe files and the seeded rows were deleted. `stadiums_dev` was not touched.

**How to verify:**
- The probes ran on `stadiums_test`: use cases through the Jest integration harness, and HTTP against a production build (`next start`).
- Full suites were not run, per instructions.
## Today schedule-grid mockup (dev only)

**When:** 2026-10-01

**What:** Dev-only preview at `/dev/mockups/today` (404 when `NODE_ENV` is production). Fake data, no database or use case. Reusable presentational components in `components/day-grid/`: `DayGrid` (time axis on the start side, one column per pitch, 30-minute rows, closed bands, past dimming, now line), `BookingBlock` (name, status by token + label + icon), `FreeCell` (quiet dashed "+"; inert without `onSelect`). `?pitches=2..5` (3+ adds A3 with a paid and an owed booking and a "now" of 18:45; more than 3 uses pitch filter chips), `?now=HH:MM`.

**Why:** Explore Today as a grid against `docs/ui-rules.md` and the paid / owed / expected tokens. Not wired to the real Today.

**Files:** `components/day-grid/*`, `app/dev/mockups/today/*`, `lib/ui-copy.ts` (`owner.closedCell`, `owner.nowLabel`), `lib/format-local-hm.ts` (`shortPeriodOf`).

**How it connects:** No imports from modules; the components take geometry and translated labels as props.

**How to verify:** Open the route in `next dev` at 390px. With 3 pitches the 16:00 booking on A1 reads Owed, because "now" is after it. `npm test`: 552 tests; `npm run build` is green.

## RTL: inputs pick their direction, typed names are isolated

**When:** 2026-10-05

**What:**
- The shared `Input` sets `dir` itself. Phones, amounts, times, email and password fields (by `type` or `inputMode`) get `ltr`. Free text gets `auto`, so English typed on an Arabic page keeps its own order and caret.
- On RTL pages every field stays aligned to the right (`rtl:text-right`). A caller's `dir` still wins.
- Names and expense descriptions that people typed are wrapped in `<bdi>`: notify list, search results, reject sheet, Today card, person page title, `PersonLink`, and the Money expense rows.

**Why:** DR-005 and SPEC-13: LTR-isolate Latin runs. Inputs had no `dir`, so English or digits typed in Arabic showed reordered punctuation and a jumping caret.

**Files:** `components/ui/input.tsx`, `app/owner/{notify-list,person-link}.tsx`, `app/owner/(app)/{money/panel,search/results,requests/reject-sheet,today/upcoming-panel,people/[personId]/page}.tsx`.

**How it connects:** UI only. No imports were added.

**How to verify:** `npx tsc --noEmit` is clean. eslint is clean on the touched files except `upcoming-panel.tsx` (its F-4 errors are older and not linted here). `npx jest test/components test/app` passes 10 of 10. The build and a browser check were not run.

## Booking sheet: close when the booking leaves Today's lists (stale Pay on the last player)

**When:** 2026-10-05

**What:** Paying players one by one on a per-player game sometimes ended with "nothing is due" on the last player.
- **Cause:** the sheet reads its booking from the live lists (`toCollect` + `games`), and falls back to `heldRow`, a snapshot taken when the sheet opened.
- "To collect" lists only ended games with `amountDueUsd > collected` (`listEndedWithRemaining`). A game from an earlier day is not in `games`.
- So once its last player was paid, the booking was in neither list. The sheet then showed the opening snapshot again, with Pay buttons on slots already paid. The next tap was refused by the server (`payment.nothing_due`).
- Today's games stay in `games`, which is why it only happened sometimes.
- The server was right throughout: it locks the booking, recomputes, and never charges twice.
- **Fix:** when the open booking leaves both lists, the sheet closes. The exception is a sheet showing that booking's WhatsApp notify (`saved`), which still uses the snapshot. This also covers the same stale Collect after a full WHOLE collect or a due adjustment on an earlier day's game.

**Why:** SPEC-15 §3.2, and RULE-12 (the sheet must never offer an action that is already done).

**Files:** `app/owner/(app)/today/upcoming-panel.tsx`.

**How it connects:** UI only. No server, query or rule changed.

**How to verify:**
- `npx tsc --noEmit` is clean.
- eslint on `upcoming-panel.tsx` shows only its existing F-4 error.
- `npm run build` is green.
- Not exercised in a browser. Manual check: per-player game from yesterday, pay each player in turn; after the last one, the sheet closes and the card leaves "To collect".

## One pitch: hide the pitch name everywhere it says nothing

**When:** 2026-10-05

**What:**
- New `venue/application/has-several-pitches.ts` `hasSeveralPitches()`: one capped count per request (React `cache`, `countPitchesUpTo(2)` in `venue/infrastructure/pitches.ts`). It needs no membership because the public page lists pitches anyway.
- With a single pitch, the pitch name is now left out of:
  - Today card meta line (the line is dropped when empty) and the booking sheet subtitle (parts joined with " · ");
  - requests inbox and missed groups;
  - free-slot groups;
  - person page game rows;
  - public and owner slot pickers (pitch heading and booking-sheet line);
  - the free-strip booking sheet;
  - the WhatsApp "booking confirmed" message, where the "on <pitch>" / "على <pitch>" clause is omitted.
- The free strip already hid its row labels for one pitch (`showPitchNames`).
- Settings and the More hub still show the pitch.

**Why:** Owner feedback: with one pitch, "Pitch 1" on every card and message is noise (RULE-12).

**Files:**
- `modules/venue/{application/has-several-pitches,infrastructure/pitches}.ts`;
- `modules/booking/application/{load-owner-day,load-decision-notify}.ts`;
- `modules/notification/domain/whatsapp-link.ts` (`pitchName` optional);
- `app/owner/{pending-list,notify-list}.tsx`;
- `app/owner/(app)/today/{lists,upcoming-panel,free-strip}.tsx`;
- `app/owner/(app)/requests/{free-slots,free-slot-list}.tsx`;
- `app/owner/(app)/people/[personId]/games.tsx`;
- `components/slot-picker.tsx`;
- `test/modules/notification/domain/whatsapp-link.test.ts`.

**How it connects:** booking → venue/application, an allowed direction. `PendingRequestList`, `MissedRequestSection` and `FreeSlots` became async Server Components; they are rendered only from Server Components. `SlotPicker` counts its own `pitches` prop, which includes closed pitches.

**How to verify:**
- `npx tsc --noEmit` is clean.
- eslint on touched files: only the existing F-4 error in `upcoming-panel.tsx`.
- `npm test`: 553 passed (new: confirm message without a pitch).
- Integration `collect-notify-debt`, `slot-pages`, `free-strip`, `smoke`, `midnight`: 30 passed.
- `npm run build` is green.
- Not checked in a browser.

## Mixed USD + LBP: live total and "left to complete" as the owner types

**When:** 2026-10-05

**What:**
- **Collect (Today sheet):** the "pay in two currencies" form now shows a line under the fields as the owner types: the total, then one of:
  - "Left to complete $10.00 · 895,000 LBP" (amber);
  - "Covers the full amount" (green);
  - "More than due by $1.17 · 104,715 LBP" (amber; warns, never blocks).
- A "Complete with 895,000 LBP" button fills the LBP field with what the USD part leaves.
- **Expense sheet:** shows the running total once an LBP amount is typed.
- A format the server would refuse ("20.5", "895,000") gets a hint. LBP with no rate set shows the existing `payment.rate_required` text.

**Why:** Owner request: for "$30 = $20 + 10 × rate", show the rest in both currencies while typing (RULE-12, DR-002 §2.18, SPEC-06).

**Files:**
- `modules/payment/domain/tender-preview.ts` (new: `previewTenders`, `lbpCovering`);
- `app/owner/tender-balance.tsx` (new, client);
- `app/owner/(app)/today/{upcoming-panel,lists}.tsx` (`MixedCollectForm`, rate passed in);
- `app/owner/(app)/money/{expense-sheet,panel}.tsx`;
- `lib/ui-copy.ts` (`owner.tender*`);
- `docs/domain/money.md` §2;
- `test/modules/payment/domain/tender-preview.test.ts`.

**How it connects:** `previewTenders` is pure: `decimal.js` and `lib/money` parsers only. It runs in the browser and mirrors `usdEquivalent` rounding; a test checks them against each other. No server path changed: the actions, schemas and `freezeTenders` are as before. The rate comes from `getCurrentRate` (membership-only) on the Today and Money pages.

**How to verify:**
- `npm test`: 561 passed (8 new).
- `npx tsc --noEmit` is clean.
- eslint: only the existing F-4 error in `upcoming-panel.tsx`.
- `npm run build` is green.
- Browser (Playwright, production build on `stadiums_test`, rate 89,500, $30 due), each step showing:
  - USD 20 → "Left to complete $10.00 · 895,000 LBP";
  - fill → LBP 895000, "Covers the full amount";
  - LBP 1000000 → "More than due by $1.17 · 104,715 LBP";
  - "895,000" and "20.5" → hints.
- Submitting $20 + 895,000 LBP recorded tenders USD 20.00 and LBP 895000 → 10.00, and one ledger IN of 30.00.
- Expense: $10 + 447,500 LBP → "Total $15.00".
- Probe data truncated afterwards.

## Per-player split is an optional tenant setting (off by default)

**When:** 2026-10-07

**What:**
- New `perPlayerSplitEnabled` (boolean, default `false`) in the tenant settings schema. No migration: old rows parse as off.
- A checkbox with one line of help in the Booking rules sheet (More > Business), saved with the existing Save under `settings.manage`. Copy in AR and EN.
- Off means: the Whole / Per player switch is hidden for whole-game bookings, `switchToPerPlayer` refuses with `booking.split_disabled` (checked on the server), and the pitch "Players per game" field is hidden (its stored value still posts through a hidden input).
- A booking already per player is untouched: slot pay, pay-all, switch back to whole, and the collapse on cancel / no-show keep working. Money owed is never hidden.

**Why:** Owner request: most stadiums do not split a game between players, so the feature should not clutter their sheets. Governing rule RULE-12; SPEC-15 behaviour unchanged once enabled; DR-002 §2.6 (settings jsonb).

**Files:** `lib/tenant-settings.ts`, `lib/tenant-context.ts`, `lib/{ui-copy,error-messages}.ts`, `modules/booking/application/switch-collection-mode.ts`, `app/owner/(app)/more/{hub,page}.tsx`, `more/settings/actions.ts`, `more/settings/pitches/{form,new/page,[pitchId]/page}.tsx`, `today/lists.tsx`, `docs/{per-player-payments,NOW}.md`, `test/integration/{fixtures,split-setting,staff-permissions,collect-notify-debt}`, `test/lib/tenant-settings.test.ts`.

**How it connects:** the flag rides on `getCurrentTenant()` like the fee policy. `switchToPerPlayer` reads it before the transaction; nothing in Payment reads it. Test fixtures seed it on so the existing per-player suites run unchanged.

**How to verify:** see the results line appended below.

- `npm test`: 561 passed. `npm run test:integration`: 198 passed (6 new in `split-setting`). `npm run build` is green.

## Today: date strip, section order, compact debt rows

**When:** 2026-10-07

**What:**
- **Date strip (commit 1):** the ‹ › arrows and the separate "Today" chip are gone. Scrollable day tabs instead: 14 days back, up to the 60-day limit (`OWNER_FUTURE_DAYS`), the selected day centred on load, past on the right in Arabic. Labels are Yesterday / Today / Tomorrow, otherwise weekday + number ("الجمعة 9" / "Fri 9"). Selected tab is bold with a lime underline; tabs are 44px tall with `role="tab"` / `aria-selected`. A calendar button at the end shows today's day number and opens the native date picker (max = last allowed day). `?date=` and the back button work as before.
- **Order (commit 2):** strip, day summary (+ amber pill "$X owed from earlier days" that jumps to the debts section), requests row, "Games" heading + cards, "Available hours (N)" + chips, then (today only) "To collect from earlier days". One debt shows its compact row; two or more show "N games · $X" that expands (collapsed by default). The compact `DebtRow` has an amber edge, relative day, time, name, "Owed $X" and the Collect button. Empty day: one neutral line. Closed day: "Closed" / "مغلق".
- The section lists owed games from **earlier business days only**. A game that ended earlier today and is owed stays in Games (it has its Collect button there) instead of appearing twice.

**Why:** Owner request: scan Today faster and keep old debts visibly apart from today's games (RULE-12, `docs/ui-rules.md` rules 4 and 8). No query, rule or money logic changed.

**Files:** `modules/booking/domain/day-tabs.ts` (new, pure), `app/owner/(app)/today/{day-strip,day-tabs,debt-row,lists,upcoming-panel,date-label,free-strip-section}.tsx`, `lib/ui-copy.ts`, `test/modules/booking/domain/day-tabs.test.ts`.

**How it connects:** `buildDayTabs` is pure (date maths + `ui()` / `formatDisplayDate`); `today` is the business date, so the 06:00 rule comes from `loadOwnerDay`. `DebtRow` is presentational and opens the same booking sheet as the cards. `owner.prevDay` / `owner.nextDay` copy is now unused.

**How to verify:** `npm test`: 566 passed (5 new in `day-tabs`). `npm run build` is green. eslint shows only the existing F-4 errors (`fee-forms`, `upcoming-panel`). Integration suite not run: only components and one pure domain file changed. Not done: the 390px screenshots (no browser tool in this session).

## Today date strip: hidden scrollbar, active marker, edge fades

**When:** 2026-10-07

**What:**
- The lime bar under the strip was the native scrollbar thumb. The scrollbar is now hidden in all browsers (`scrollbar-width: none`, `::-webkit-scrollbar` hidden); the strip still scrolls by touch, drag, trackpad and wheel.
- The selected tab now has a bold label and a 3px rounded bar (60% of the label width, centred, 6px below). The bar is on every tab and only fades in (150ms, none under reduced motion), so tabs never shift. A hidden bold copy of each label keeps the width the same when it turns bold.
- The bar and the mask use `action-ink`: ink on light backgrounds (the volt lime is about 1.2:1 there), lime in dark.
- 24px gradient mask at both ends of the strip; the calendar button is outside it.
- `aria-current="date"` on today's tab (`role="tab"` and `aria-selected` kept).
- Bottom padding: `<main>` already has `pb-[calc(88px+env(safe-area-inset-bottom))]` on mobile, and the nav is about 86px plus `max(12px, inset)`, so the last block clears the nav. No change.

**Why:** Owner feedback on the strip. Styling only, no logic change.

**Files:** `app/owner/(app)/today/day-tabs.tsx`.

**How to verify:** `npm test`: 566 passed. `npm run build` is green. Screenshots not taken (no browser tool in this session).

## Today strip details, scrollbars, day transition

**When:** 2026-10-07

**What:**
- **Strip details:** the active bar is the full label width (3px, rounded) and sits out of flow under the label, so the label is centred in the tab. The calendar button is a fixed 44px slot outside the scroller with an 8px gap, centred on the labels; the edge fade lives inside the scroller, so it never covers the slot.
- **Scrollbars:** the global lime `*::-webkit-scrollbar` rules and the global `scrollbar-width: thin` on `html` are gone. Below `lg` the page scrollbar is hidden (wheel, touch and keyboard still scroll); from `lg` it is thin and neutral with `scrollbar-gutter: stable`. Inner scroll areas use the same neutral thin style. `.no-scrollbar` stays for the date strip.
- **Day change:** the selected tab updates at once (`useOptimistic` in a transition). The old day stays visible at 60% opacity until the new one has rendered. The new content slides in 16px from the side of the new day (future side; mirrored in RTL) with opacity, 200ms ease-out, via the Web Animations API (transform and opacity only). It plays only when the selected date changes, never on `router.refresh()` or a same-day booking, and not under reduced motion. Only the days next to the selected one are prefetched.
- **Choice:** a small client wrapper (`day-nav.tsx`), not `<ViewTransition>`. The Next guide says `<ViewTransition>` runs on every transition and Suspense reveal, so the live poll's `router.refresh()` would animate, and it relies on React canary. The wrapper keys the animation on the date alone.

**Files:** `app/globals.css`, `app/owner/(app)/today/{day-nav,day-tabs,day-strip,lists}.tsx`.

**How to verify:** `npm test`: 566 passed. `npm run build` is green. Not rendered (no browser tool in this session): see the DevTools checks given with this change.

## Page scrollbar: thin, shown only while scrolling

**When:** 2026-10-07

**What:** The page (`html`) scrollbar is very thin (8px) and transparent at rest. `ScrollbarPeek` (`components/scrollbar-peek.tsx`, in the root layout) sets `data-scrolling` on `<html>` while the page scrolls and removes it 800ms after the last scroll event; `globals.css` shows the thumb only while it is set. `scrollbar-gutter: stable` keeps the gutter reserved, so content never shifts. This replaces the "hidden below lg, thin from lg" rule from the previous entry. Touch devices keep their OS overlay scrollbar.

**Files:** `app/globals.css`, `components/scrollbar-peek.tsx`, `app/layout.tsx`.

**How to verify:** build is green. Not rendered (no browser in this session): on desktop, `html` should show `scrollbar-gutter: stable` and `scrollbar-width: thin`; the `data-scrolling` attribute should appear on scroll and disappear about 0.8s after.

## Correction: page scrollbar is now a true overlay (takes no width)

**When:** 2026-10-07

**What:** The previous entry kept `scrollbar-gutter: stable`, which still reserved a blank strip. The native page scrollbar is now hidden (`scrollbar-width: none`, `::-webkit-scrollbar` hidden), so it never takes width. `ScrollbarPeek` draws a 3px fixed thumb over the content while the page scrolls (height and position from `scrollTop` / `scrollHeight`) and fades it out 800ms after the last scroll event. It is an indicator only (`pointer-events: none`), so it cannot be dragged. Inner scroll areas are unchanged.

**Files:** `app/globals.css`, `components/scrollbar-peek.tsx`.

**How to verify:** build is green. Not rendered (no browser in this session): `html` should compute `scrollbar-width: none`; a fixed 3px element should fade in at the inline-end edge while scrolling and out about 0.8s later; page content width should not change.

## Today calendar button opens the app calendar, not the native picker

**When:** 2026-10-07

**What:** The calendar button in the Today date strip now opens the app's own `Calendar` (react-day-picker, already used by `DateCalendarChip` and `DateField`) in a `Popover`, instead of the hidden `<input type="date">` and `showPicker()`. Days after the 60-day limit are disabled; past days are open. The month caption uses the shared date formatter (Levantine months in Arabic), the grid is RTL in Arabic, digits are Latin. Picking a day goes through the same optimistic day change as the tabs. No new dependency.

**Files:** `app/owner/(app)/today/{day-tabs,day-strip}.tsx`.

**How to verify:** `npm test` passes, build is green. Not rendered (no browser in this session): tap the calendar button at 390px in Arabic and English; the popover should stay inside the viewport, show the selected day highlighted, and disable days past 60 days ahead.

## One booking card: `BookingRow`

**When:** 2026-10-07

**What:**
- One component, `app/owner/booking-row.tsx`, draws every booking card: Today games, the earlier-debts rows and the person page rows. Variants: upcoming, live, owed, partial, paid, no-show, cancelled, debt. `variantOf(display)` maps the existing `deriveCardDisplay` kinds, so no new states.
- Line 1 is the player (semibold, the largest text, wraps instead of truncating, `<bdi>`); line 2 is the time range (muted, LTR-isolated) plus the pitch name only when the stadium has several pitches (and the "night of" hint). The trailing slot is a vertically centred status pill: Live (dot + minutes left), Owed/Partial (owed token + icon), Paid, No-show, Cancelled. A plain upcoming game has no pill and no price; the "Game $30" label is gone from cards.
- The chevron is gone. The whole card is one button (min 64px, pressed state, no nested interactive element). The "N interested" chip sits below the button, not inside it.
- **Debt variant:** amber edge, line 2 starts with the relative day, and the trailing "Collect $X" button (44px) is a sibling of the body, 12px away. The body still opens the sheet. Without `payments.collect` the row shows an Owed pill instead.
- **Person page:** same component; the title is the date and the pill is that person's own figure, as before. The per-player share line is the footer.
- `docs/ui-rules.md` rule 2 amended: a card shows money only when it signals state; the booking sheet always shows the game price, labelled.

**Behaviour change to know:** Today's owed cards no longer carry an inline Collect button (no nested interactive element); tapping the card opens the sheet, where Collect is the primary button. That is one extra tap for today's own owed games. The earlier-debts rows keep their Collect button.

**Files:** `app/owner/booking-row.tsx` (new), `today/{upcoming-panel,debt-row}.tsx`, `people/[personId]/games.tsx`, `docs/ui-rules.md`.

**How to verify:** `npm test`: 566 passed (no test asserted the removed copy). `npm run build` is green. eslint: only the existing F-4 errors. Not rendered (no browser in this session).

## Typography: self-hosted fonts, one stack per language, stacked day tabs

**When:** 2026-10-08

**What:**
- **Before (step 0):** `next/font/google`. Sans = Manrope (400–800, latin) then Plex Arabic (400–700, arabic + latin); heading and display = Big Shoulders (700–900) then Noto Kufi Arabic then Plex Arabic; mono = Plex Mono (400–600). The display face was on every `h1–h3` (base layer) and on `font-display` uses (Figure, empty state, person title, day chips, slot picker). Body had tabular digits everywhere. Arabic text set in `font-extrabold` (800) had no Plex face (Plex Arabic stops at 700); it only worked where the display stack fell through to Kufi.
- **Commit 1:** all fonts self-hosted with `next/font/local` from woff2 files in `src/fonts/` with their OFL licences (from the `@fontsource/*` packages, which repackage the official Google Fonts OFL releases). Sizes: Plex Arabic arabic 400/600 = 43 KB / 46 KB, latin 400/600 = 19 KB / 21 KB; Manrope 400/600 = 14 KB each; Big Shoulders 800 = 15 KB; Plex Mono 400/600 = 15 KB / 16 KB. Noto Kufi Arabic removed. The Plex files are two loaders (`--font-plex-arabic`, `--font-plex-arabic-latin`) because `next/font/local` has no per-face `unicode-range`; the stack falls through per glyph. The build output has no Google Fonts URL. RUNBOOK "Fonts" and MIGRATION updated.
- **Commit 2:** `--font-ui` per language: English Manrope, Plex Arabic; Arabic (`html:lang(ar)`, `[dir=rtl]`) Plex Arabic (arabic + latin) then Manrope. `--font-sans` and `--font-heading` use it; headings are 600. `--font-display` (Big Shoulders) is for the one big figure; in Arabic `.font-display` falls back to the UI face. Today surface, booking row, pill, date strip and sheet use sizes 12/14/16/20 and weights 400/600 only. `font-synthesis: none` on `html`. Tabular digits moved from `body` to `LtrIsolate` (times and amounts).
- **Commit 3:** stacked day tab: top line `topLabel` (relative word or weekday name), bottom line the day number (16px, 600), fixed 64px wide, bar under the number. `buildDayTabs` gained `topLabel` (test added).
- **Commit 4:** after-midnight notice reads "6:00 ص" / "6:00 AM", 12px muted caption.

**Kept on purpose:** the existing `:lang(ar)` size bump (`text-xs/sm/base` become 13/15/17 px) from the Arabic reading-size rule. Headings elsewhere keep their larger sizes (`text-3xl` page titles).

**How to verify:** `npm test`: 567 passed. `npm run build` green after each commit. Not rendered (no browser in this session): see the DevTools checks given with this change.

## Business-day start hour is a per-tenant setting

**When:** 2026-10-08

**What:**
- New tenant setting `dayStartHour` (integer 0 to 6, default 6 when absent or junk, so existing tenants are unchanged). No migration. It rides on `getCurrentTenant()` (the row it already loads): no extra query.
- `businessDate`, `businessDayUtcRange` and `isNightStart` now take the hour as an explicit required parameter (the range is [D at hour, D+1 at hour) in wall-clock time, so DST days keep the boundary at that local hour; the query still filters on `lower(during)`). `BUSINESS_DAY_ROLLOVER_HOUR` stays only as the default value. Call sites pass `tenant.dayStartHour`: Today's day and range, the free-hour strip, the earlier-debts filter and its day labels, the "night of" hint, the WhatsApp day labels, the public page and the Book page. The date strip follows through the business `today` it is given; the day summary through the day's games. The "after midnight" notice now names the tenant's hour.
- Booking rules sheet: a select "When does your business day start?" (12 midnight, then 1 to 6 AM), saved with the existing Save under `settings.manage`. It shows a warning when the chosen hour falls inside a pitch's opening window (`startHoursInsideWindows`), and always the note "Changing this changes which day games after midnight appear under. It changes no amounts."
- `tenants create --day-start-hour <0-6>` (refused outside 0 to 6 before any prompt), added to the RUNBOOK onboarding checklist with the question to ask the owner.
- Untouched: instant logic (live, ended, owed, expired, cancel, no-show), the schedule engine, the ledger and the Money tab (cash stays bucketed by calendar day).

**Why:** a stadium that opens before 06:00 saw its early games on the previous day (NOW.md trade-off, UX-02 §2.3).

**Files:** `lib/{tenant-settings,tenant-context,ui-copy}.ts`, `modules/booking/domain/business-day.ts`, `modules/booking/application/{load-owner-day,load-free-strip,night-hint,list-open-waitlist,load-decision-notify,load-outcome-notify}.ts`, `modules/platform/{domain/inputs,application/create-tenant}.ts`, `scripts/platform-cli.ts`, `app/(public)/page.tsx`, `app/owner/(app)/{book/page,more/*,today/*,people/[personId]/games}.tsx`, `components/ui/select-field.tsx`, docs (RUNBOOK, NOW, ux-02-history banner).

**How to verify:** `npm test`: 578 passed. `npm run test:integration`: 205 passed (day-start integration file, CLI cases). `npm run build` is green. No `docs/domain/booking-lifecycle.md` exists, so nothing to update there.

## Back from a person page returns to where the owner came from

**When:** 2026-10-08

**What:** The "Back" link on the person page, search and Book always went to `/owner/today`, so a past or future Today day (or a search) was lost. `OwnerBackLink` gained a `history` prop: it calls `router.back()` when the browser has history, and follows its `href` (`/owner/today`) only for a fresh tab or shared link. Used on the person page, search and Book. Settings pages keep their fixed parents.

**Files:** `app/owner/back-link.tsx` (now a client component), `app/owner/(app)/{people/[personId],search,book}/page.tsx`.

**How to verify:** build is green. Not run in a browser: open Today on another day, tap a player name, tap Back; you should land on that same day. Open the person page in a new tab; Back should go to Today.
## Today mockup redone as a one-column day sheet (dev only)

**When:** 2026-10-01

**What:** `/dev/mockups/today` is now a one-column day sheet; `components/day-grid/` and its 3+ pitch handling are deleted. New presentational `components/day-sheet/`: `buildDaySheet` (pure: slot rows in time order, past free slots hidden, past bookings kept, a Now divider, an unaligned booking at its own time, rule prices, pending counts), `BookingCard`, `FreeRow`, `DaySheet` / `NowDivider`, `PitchSwitcher` (two pitches max, `?pitch=`). Day strip is the live `OwnerDayStrip`. Fake data: A1 (17:00 owed, 19:00 expected, free 20:00 with 2 pending and 21:00 at $40), A2 with `?pitches=2`.

**Why:** Replace the grid after review. One column fits 390px and keeps names unwrapped and whole.

**Files:** `components/day-sheet/*`, `app/dev/mockups/today/{page,guard,today-mockup,data}`, `lib/ui-copy.ts` (`owner.freeCount`), tests `test/components/build-day-sheet.test.ts`, `test/app/dev/today-mockup.test.ts`.

**How it connects:** No module imports. The guard lives in `guard.ts` (a Next page file may only export its page), and the test runs it, and the page, with NODE_ENV=production.

**How to verify:** `npm test`: 561 tests. `npm run build` is green. Screenshots were taken from a production build with the guard temporarily bypassed (restored before commit).

## Account: change your own password (commit 1 of 3)

**When:** 2026-10-08

**What:**
- **One password policy**, `access/domain/password-policy.ts` `checkPassword`: at least 12 characters (counted as characters), not equal (case-insensitive, trimmed) to the login, its local part or the tenant slug, not on a small denylist; no composition rules, spaces allowed. The app, `scripts/set-password.ts` and `scripts/platform.ts` (`tenants create`) all call it (`askNewPassword` and `requireOwnerPassword` now take the identifier and slug). New copy keys `access.password_*`, `platform.password_weak`.
- **Use case `changeOwnPassword({ currentPassword, newPassword })`**: the user comes from the session (`getCurrentMembership` + the cookie), never from the client; any role may change its OWN password. A suspended tenant has no membership, so it is refused at the existing choke point. Order: policy (reveals nothing), block check, current password. A wrong current password counts under `pwchange:<userId>` (5 failures in 15 minutes, then a 15-minute block, key `pwchange:block:<userId>`, generic message), separate from the login counter; success resets it. On success one `platformDb.$transaction` stores the new hash (current cost) and deletes every OTHER session of the user, matched by the hash of the cookie token; the current one stays.
- **UI:** More > Account row opens a sheet with the login (read-only) and "Change password". The password step has current password, new password with show/hide (no confirm), the hint "12+ characters; a phrase works", the exact refusal inline, one primary Save, and a toast "Password changed. Other devices were logged out." Fields use `current-password` / `new-password`; the action never logs or echoes a password.
- No migration.

**Files:** `modules/access/{domain/{password-policy,credential-limits},application/{own-credentials,change-own-password},infrastructure/users}.ts`, `modules/platform/{domain/inputs,application/create-tenant}.ts`, `scripts/{lib/operator-io,set-password-core,platform-cli}.ts`, `app/owner/(app)/more/{hub.tsx,account/*}`, `lib/{ui-copy,error-messages}.ts`, tests `test/modules/access/domain/password-policy.test.ts`, `test/integration/account-credentials.integration.test.ts`.

**How to verify:** see the results line appended below. Not rendered (no browser in this session).

- `npm test`: 605 passed. `npm run test:integration`: 216 passed (11 new in `account-credentials`). `npm run build` is green.

## Account: log out other devices (commit 2 of 3)

**What:** `logOutOtherDevices()` deletes every session of the logged-in user except the current one (matched by the hash of the cookie token) and returns how many it closed. The user comes from the session; any role may do it for itself; a suspended tenant is refused by the existing choke point. In the Account sheet a secondary "Log out other devices" button opens a confirm step ("Every other device will be logged out. This one stays logged in."), then a toast with the count ("Logged out of 2 other devices." / zero: "No other devices were logged in."). No migration.

**Files:** `modules/access/{application/log-out-other-devices,infrastructure/sessions}.ts`, `app/owner/(app)/more/account/{actions,account-sheet}.tsx`, `lib/ui-copy.ts`, tests added to `test/integration/account-credentials.integration.test.ts`.

**How to verify:** `npm test`: 605 passed. `npm run test:integration`: 219 passed (3 new). `npm run build` is green. Not rendered (no browser).

## Account: change the part of your login before the @ (commit 3 of 3)

**What:**
- `changeOwnIdentifier({ localPart, currentPassword })`: the server builds `local@<tenant slug>` and drops any suffix the client typed (`parseLocalPart` cuts at the first `@`), so another tenant's identifier can never be claimed. The local part is lowercased and validated (letters and digits, a single `.` `_` `-` between parts, 1 to 32 characters, so `a--b` is refused); the full result must also pass `parseLoginIdentifier`. The current password is required and counted under the same `pwchange` counter. The update runs in a `platformDb.$transaction`; a unique violation becomes `access.identifier_taken`. Sessions stay valid. The user comes from the session; any role may change its own; a suspended tenant is refused.
- UI: an input with a fixed `@slug` beside it, a live "From now on you log in with: <identifier>" line, the current password, one primary Save; success toast "Your login is now: …" and the row refreshes.
- Docs: RUNBOOK "Owner account self-service" and the forgotten-password procedure (confirm by phone, `set-password.ts`, tell the owner to change it); NOW.md; ROADMAP (forced change at first login is the next job and needs a `User` flag, so a migration). `docs/domain/permissions.md` does not exist, so nothing to update there.
- No migration was needed for any of the three commits.

**Files:** `modules/access/{domain/identifier,application/change-own-identifier}.ts`, `app/owner/(app)/more/{hub.tsx,page.tsx,account/*}`, `lib/{ui-copy,error-messages}.ts`, tests `test/modules/access/domain/local-part.test.ts` and `test/integration/account-credentials.integration.test.ts`, docs.

**How to verify:** `npm test`: 628 passed. `npm run test:integration`: 232 passed (13 new for the login change; the full run was before moving the user update into `infrastructure/users.ts`, after which `account-credentials` was re-run: 27 passed). `npm run build` is green. Not rendered (no browser).
## Bottom sheets: a minimum height on phones

**When:** 2026-10-08

**What:** `BottomSheetContent` gets `max-lg:min-h-[max(15rem,38dvh)]` (at least 15rem, or 38% of the viewport, whichever is larger), so a one-line sheet no longer hugs the bottom edge. Content stays at the top of the sheet. From `lg` up the sheet is a centred dialog and keeps sizing to its content. Applies to every bottom sheet (they all use this component).

**Files:** `components/ui/bottom-sheet.tsx`.

**How to verify:** build is green. Not rendered (no browser): open a sheet with one line (e.g. the language sheet) at 390px; it should be about 15rem or 38% of the screen tall, and a tall sheet should still cap at 92% of the viewport.

## Pitch editor, part 1 of 4: the pure model

**When:** 2026-10-08

**What:** `venue/domain/pitch-form-model.ts`, no UI yet. `hoursToRows` (seven Mon..Sun rows, closed days keep the first group's times) and `rowsToHours` (merge identical windows); `rulesToPriceCards` and `priceCardsToRules` (non-overlapping day cards: a day that a later all-day rule also covers is removed from the earlier one, which is exactly the engine's last-matching-rule-wins, so prices do not change); `formatHoursSummary` / `formatDays` / `formatClock` (consecutive-day compression, "every day", "until 11:00 PM", AR and EN, 12 or 24 hour).
- **Not expressible, kept as it is:** price rules with a time range (`start`/`end`) have no control in the editor. They are carried aside with their position (`TimedRule.at`) and put back in the same place on save, and the form shows them as a read-only line. A day with a second hours window cannot be expressed either: the stored-to-form step (`collapseHoursGroups`) has always kept only the first window, and the writer rebuilds hours from groups, so a second window is dropped on save as before. That is a known limit of the existing writer; fixing it needs a writer change, which this task forbids. Nothing in the UI creates one.
- **One validation change, agreed:** `pitchDraftSchema` refused any window where close is not after open, so 22:00 to 02:00 could not be saved from the form (only seed data had them). It now refuses only open == close. The engine, schedule schema and everything else are untouched.
- Property test: 500 seeded configs (windows that cross midnight, overlapping rules, timed rules, 30/45/60/90/120 minute games) go through hours -> rows -> groups and rules -> cards -> rules; every slot and its price is identical for a normal week and for the spring-forward week, and again with 15-minute games (price and availability at every 15-minute time).

**Step 0 answers (for the editor):** stored hours are `hours.{mon..sun}: [{start, end}]`; groups are `{days, open, close}`, one per distinct window. Price rules are `{days, priceUsd, start?, end?}` (start and end together or neither; no minimum length). Game length is any positive integer (no maximum); the engine needs `duration <= window` to offer a slot. Today, saving hours that leave a future APPROVED booking outside the new windows is refused (`venue.hours_approved`); future PENDING ones need a confirm checkbox (`venue.hours_pending`). `Players per game` is shown only when the tenant's `perPlayerSplitEnabled` is on; otherwise a hidden input keeps the stored value.

**Files:** `modules/venue/domain/pitch-form-model.ts`, `modules/venue/schemas/pitch-draft.ts` (the one refine), `lib/ui-copy.ts`, tests `test/modules/venue/domain/pitch-form-model.test.ts`, `test/modules/venue/schemas/pitch-draft.test.ts`.

**How to verify:** `npm test`: 652 passed. `npm run test:integration`: 232 passed. `npm run build` is green.

## Pitch editor, part 2 of 4: opening hours as seven day rows

**What:** The hours-groups UI (checkbox groups with `<input type="time">`) is replaced by `HoursRows`: Monday to Sunday, the full day name in Arabic, an Open / Closed switch with a text label (role="switch", never colour alone) and, when open, two chips "From 4:00 PM" and "To 10:00 PM". Rows are at least 56px. A summary line on top (`formatHoursSummary`, 12 or 24 hour per the tenant setting) and a "Same hours every day" button (the first open day's times on all days). The chips open a bottom sheet (`TimeSheet`): 30-minute steps, the current value centred, "Other time…" for the native picker; for "To", times at or before "From" are labelled "(next day)" and the opening time itself cannot be picked. Digits are Western and LTR-isolated. If the day-start hour falls inside a window, the existing Booking-rules warning is shown under the rows (it never blocks).
- The form still posts `hoursGroupsJson` (`rowsToHours`), so the server parses and validates exactly what it did; all error keys are unchanged.
- Deleted `hours-groups.tsx`. New copy: `owner.dayFull.*`, `owner.dayOpen`, `owner.dayClosed`, `owner.fromLabel`, `owner.toLabel`, `owner.pitchNextDay`, `owner.otherTime`, `owner.sameHoursEveryDay`.
- Integration tests (`pitch-editor`): a pitch saved with the new editor's fields has the same stored config, slots and prices as one saved with the old form's output (week and weekend hours, a window closing at 02:00, overlapping price rows); staff without `settings.manage` cannot create or save; another tenant's pitch id is refused; a suspended tenant is refused.

**Files:** `app/owner/(app)/more/settings/pitches/{hours-rows,time-sheet,form}.tsx`, `new/page.tsx`, `[pitchId]/page.tsx`, `lib/ui-copy.ts`, `test/integration/pitch-editor.integration.test.ts`.

**How to verify:** `npm test`: 652 passed. `npm run test:integration`: 237 passed (5 new). `npm run build` is green. Not rendered (no browser).

## Pitch editor, part 3 of 4: game length, price, price cards, preview, save bar

**What:**
- **Game length:** a segmented 60 / 90 / 120 / Other (Other = a numeric field, in minutes). "Players per game" keeps its gating (shown only when the tenant's per-player split is on, otherwise a hidden input) and sits under the game length.
- **Price per game:** a currency field with a "$" prefix; text only (digits, one dot, two decimals), padded to cents on blur ("25" becomes "25.00"); no floats anywhere.
- **Different price on some days:** a list of cards, each with day chips and a price; a day another card uses is disabled in the rest, so overlap cannot happen. Delete asks for a second tap; "+ Add a price" at the end. The sentence "last row wins when days overlap" is gone. Rules with a time range are kept as they are and listed read-only ("Special prices for set hours (kept as they are)").
- **Preview:** a weekday selector (default the next open day) and the slots `generateSlotsForDay` returns for the next date of that weekday, computed in the browser from the form's current state with `scheduleFromHoursGroups` (the same functions the booking pages use; no query). It shows "N games · $X each" (or a price range, with each chip's price) and a muted note when the end of the opening hours is too short for another game (or the game does not fit at all).
- **Save bar:** sticky, above the floating bottom nav and its safe-area inset, "Save changes" appears only when the form is dirty (always on a new pitch, "Add pitch"); one primary button, disabled while a required value is missing. Leaving with unsaved changes asks for confirmation (browser prompt on reload or close, a confirm on in-app links). `SubmitButton` now also honours a `disabled` prop.
- **New pitch defaults:** every day 4:00 PM to 11:00 PM, 60 minutes, $20.
- **Upcoming bookings outside the new hours:** not added. The save already refuses it when an APPROVED booking would fall outside the new hours (`venue.hours_approved`) and asks for a confirm for PENDING ones, so a note saying they "stay booked" would be wrong. A pre-save count needs a new query path; recorded in `docs/ROADMAP.md` (12a).
- Deleted `price-rules.tsx`. `form.tsx` is now a client component holding the whole form state; it still posts the same fields.

**Files:** `app/owner/(app)/more/settings/pitches/{form,money-input,price-cards,preview-card}.tsx`, `new/page.tsx`, `components/ui/submit-button.tsx`, `lib/ui-copy.ts`, `docs/ROADMAP.md`, `test/app/owner/pitch-money-input.test.ts`.

**How to verify:** `npm test`: 668 passed. `npm run test:integration`: 237 passed. `npm run build` is green; eslint clean on the pitches folder. Not rendered (no browser).

## Pitch editor, part 4 of 4: the pitch list

**What:** More > Pitches cards now show the human summary from `formatHoursSummary` ("Mon–Thu 4:00–10:00 PM · Fri–Sat until 11:00 PM · Sun closed", 12 or 24 hour per the tenant setting), then the game length and the price ("90 minutes · $25"), instead of the day-by-day lines. The name uses the 16px / 600 scale.

**Files:** `app/owner/(app)/more/settings/pitches/page.tsx`.

**How to verify:** `npm test`: 668 passed. `npm run test:integration`: 237 passed. `npm run build` is green. Not rendered (no browser).

## More typography, part 1 of 3: type roles and a guard

**Step 0:** before this, `globals.css` had no role tokens: only the Arabic size bump (`:lang(ar) .text-xs/sm/base` = 13/15/17px). Across `more/**` the raw classes were `text-sm` x37, `font-semibold` x23, `font-medium` x15, `text-xs` x8, `text-base` x6, `text-4xl` x3, `text-3xl` x3, `text-lg` x1 (about a dozen distinct combinations, 12 to 36px, weights 400/500/600). The 12/14/16/20 and 400/600 scale from the typography job exists as Tailwind defaults plus the shipped faces (only 400 and 600 are loaded); the roles below now name it.

**What:** nine role classes in `globals.css` (`@layer components`, so a colour utility such as `text-owed` still wins): `type-title` 20/600, `type-section` 12/600 muted, `type-body` 16/400, `type-strong` 16/600, `type-label` 14/600, `type-secondary` 14/400 muted, `type-caption` 12/400 muted, `type-field` 16/400, `type-button` 16/600. Latin line-height 1.4; Arabic 1.55 (about 10% taller). The roles are exact in Arabic too (the Arabic size bump only touches `text-xs/sm/base`).
- **Contrast of muted text (`--muted-foreground`), measured:** light 5.75:1 on page (#f6f5ef), 6.28:1 on card (#fff), 5.11:1 on surface-2; dark 8.35:1 on page, 7.53:1 on card, 6.55:1 on surface-2. All pass 4.5:1, so no token was raised.
- **Guard** `test/app/owner/more-type-guard.test.ts`: fails with `file:line` on `text-xs` to `text-9xl`, `text-[<size>]`, `font-medium/bold/semibold/...`, `fontSize`, `fontWeight` anywhere under `src/app/owner/(app)/more/**`.
- Every raw size and weight under `more/**` was mapped to a role (look is close to before; the structure follows in parts 2 and 3).
- **Shared components changed (check Today and Money):** `Label` (14/500 -> `type-label` 14/600), `Button` base (14/500 -> `type-button` 16/600: every button is a little larger and bolder; the `xs` size keeps `text-xs`), `Input` (`type-field` 16/400; the `md:text-sm` that made desktop inputs 14px is removed), `Select` trigger (14 -> `type-field` 16) and item (14 -> `type-body` 16), `BottomSheetTitle` (20/600 with `leading-none` -> `type-title` 20/600 with normal leading).
- No logic, copy or validation change.

**Files:** `app/globals.css`, `components/ui/{label,button,input,select,bottom-sheet}.tsx`, `app/owner/(app)/more/**` (class names only), `test/app/owner/more-type-guard.test.ts`.

**How to verify:** `npm test`: 670 passed (2 new guard tests). `npm run build` is green. Not rendered (no browser).

## More typography, part 2 of 3: one list, one row

**What:** `more/settings-list.tsx` adds `SettingsSection` (a section heading in the section role, `px-4` so it lines up with the rows' inner start, 8px above the card; the page's 24px gap sits between sections) and `SettingsRow` (min-height 56px; label = body, or strong for a name; optional secondary line and caption line; trailing value = secondary, one line with an ellipsis, numbers LTR-isolated by the caller; chevron 16px muted; with `selected` it is a picker choice and shows a check). The hub (Business, Preferences, Account), the pitch list and the language and time-format pickers in sheets all use them, so no screen has its own row markup. Pitch cards: name strong, hours summary secondary, game length and price caption.
- Sheets: titles are the title role (via `BottomSheetTitle`), field labels the label role (`Label`), inputs the field role (`Input`), the current rate is the single `<Figure>` at 20px. Nothing on a More screen is larger than 20px.
- Spacing is on an 8px grid: 24 between sections, 16 between fields, 8 inside a group.
- Removed the hub's own `rowClass`, `choiceClass` and `RowValue`.

**Files:** `app/owner/(app)/more/{settings-list,hub}.tsx`, `more/settings/pitches/page.tsx`.

**How to verify:** `npm test`: 670 passed. `npm run build` is green. Not rendered (no browser).

## More typography, part 3 of 3: the pitch editor

**What:**
- Roles applied to the editor: section labels (legends, the preview heading) are the section role; the opening-hours summary is secondary; the game-length segments, day chips and preview chips are the label role; the price field and "$" use the field/body roles; the save bar button is the button role (the shared `Button`). Page titles are the title role.
- **Visible change (its own hunk, in `hours-rows.tsx`; revert that hunk alone to undo):** each day is one line: day name (body, muted when closed), the switch alone (44px hit area, no "Open"/"Closed" word beside it), then for open days the two times as a range "4:00 PM – 11:00 PM" (label role, 36px pill inside a 44px hit area each; the sheet titles still say "Opens" / "Closes"), or the word "Closed" (secondary) for a closed day. This also removes the "From" / "To" words inside the chips. The rows wrap the chips under the day name when they do not fit (360px, or a window that closes the next day), never below 14px. `DaySwitch`'s `label` prop is gone.
- **Review fixes (same commit):** the More rows' trailing value was floating in the middle (value and chevron were separate flex children); they are now one group pushed to the end. Row labels are the 14px label role (the body 16px was slightly too big). Day rows are tighter: 72px day name at 14px, the switch's 44px hit area overlaps its neighbours by 4px, smaller chip padding, and the next-day marker inside a chip is a short "+1" (spoken as "next day") so a closing-after-midnight row no longer wraps.
- Unchanged: all the pure model and round-trip tests, the pitch-editor integration tests, validation and copy keys.

**Files:** `more/settings/pitches/{hours-rows,form,price-cards,preview-card,money-input}.tsx`, `docs/ui-rules.md` (rule 7 amended with the role table and the guard), `docs/NOW.md`.

**How to verify:** `npm test`: 670 passed. `npm run test:integration` (pitch editor): 5 passed, unchanged. `npm run build` is green (one transient Windows Turbopack process-start failure, 0xc0000142, passed on retry). Not rendered (no browser).
## Light mode: header and bottom nav on the surface colour, plus a fade under the nav

**What:** In light mode the floating header and the bottom nav were the dark `inverse` colour; in dark mode they were already `surface` (slightly different from the page). Both now use `bg-surface text-ink` with the existing border in both themes (light: white on the `#f6f5ef` page; dark: unchanged, `surface` = the old inverse value), a small shadow on the floating bars, and the same surface colour for the lg sidebar and header. The selected tab uses `text-action-ink` (ink in light, the lime brand in dark) because lime on white is unreadable. A phones-only gradient behind the nav (page colour from the bar's edge up 24px) hides scrolled content colliding with the bar and the gaps beside it.

**Files:** `app/owner/header.tsx`, `app/owner/tab-bar.tsx`.

**How to verify:** `npm test` and `npm run build` pass. Not rendered (no browser): in light mode the header and nav should be white cards on the cream page; scroll a long list under the nav and no text should show beside or above the bar edge.

## Bottom tab bar: a sliding pill for the active tab

**What:** Phones only (the lg rail is unchanged). The active tab sits on one rounded pill (48px high, tab width minus 8px, the `surface-2` raised token, not lime) with its icon and label in `action-ink` (ink in light, lime in dark); inactive tabs are muted with no background. The pill is a single absolutely positioned element that slides to the active tab with a 220ms ease-out transition on `transform` and `width` only. It is measured in pixels (`offsetLeft` / `offsetWidth`) in a layout effect and re-measured by a `ResizeObserver`, so it is right in RTL with no separate logic; it stays invisible until the first measurement and the transition is switched on only after it, so it does not slide in from the corner on load. No transition under `prefers-reduced-motion` (it jumps).
- **Optimistic:** tapping a tab sets `{ href, from: pathname }`; the pill follows at once. It counts only while the pathname is still the one it was tapped on, so a finished navigation takes over by itself, and a failed or cancelled one gives up after 4 seconds and the pill returns to the real page. `aria-current` still follows the real pathname.
- Kept: the pending-request badge, 44px+ targets (tabs are 56px), the safe-area padding, the desktop rail, and the Record "+" code (it is still intentionally hidden by `HIDE_RECORD`, uncommitted).
- **Contrast (measured):** active label on the pill: light 15.08:1 (ink #111412 on #e9e8e0), dark 12.64:1 (lime #d7ff3f on #232b26). Inactive labels on the bar: light 6.28:1, dark 7.53:1. All pass 4.5:1.

**Files:** `app/owner/tab-bar.tsx`.

**How to verify:** `npm test` and `npm run build` pass. Not rendered (no browser).

- **Arabic labels:** the tab label had `leading-none` inside a `truncate` (overflow hidden) box, which cut Arabic letters below the baseline. It now has 1.5 line-height and 1px vertical padding, so descenders and diacritics fit.
- **Pill padding:** the taller Arabic label left the icon almost touching the 48px pill's edge. The label now clips only sideways (`overflow-x: clip` with an ellipsis, so nothing is ever cut below the baseline) at 1.2 line-height, and the icon-to-label gap is 2px, so the stack is about 36px inside the 48px pill (about 6px of room above and below).

## Money refactor, part 1 of 4: period chip and a profit headline

**What:**
- **Period chip** (default this month) opens a sheet: Today, This week (Monday to Sunday), This month, Last month, Custom (two dates). The chip and the headline use human labels via the app date formatter ("October" / "تشرين الأول", "12 Oct – 18 Oct"), never ISO dates. Periods are calendar days in Asia/Beirut (`rangeForPeriod`, `previousRange` in `ledger/domain/period.ts`). The URL is `?period=week` (or `?from=&to=` for custom); `moneyHref` builds it.
- **Headline:** one `<Figure>` with "Profit in October" or "Loss in October" (a negative net is shown as its size in a neutral colour; no red), In and Out as two small figures, and one neutral comparison line ("↑ $5 vs September"). A calendar month is compared with the month before it (so by name); any other range with the same number of days straight before it ("vs the previous period"). That is one more aggregate (`summarizeLedgerPeriod({ compare: true })` returns `previous`). Removed: "Net = in − out", the two progress bars (`bars.ts`), the in-card "Change period" reveal (`reveal.tsx`), the typed display-rate field.
- The $ / LBP display toggle stays, beside the chip, and is hidden when no rate is known. Amounts come from the same ledger sums (Decimal); LBP is only the existing display conversion.
- Reports.view is still checked inside `summarizeLedgerPeriod`. No monospace on the page.
- **Query count per Money render** (counted from the code; per-request tenant, session and membership lookups are the same before and after): before 4 (expenses 2, rate 1, ledger sum 1); after this commit 5 (the previous-period aggregate is the one extra).

**Files:** `ledger/domain/period.ts`, `ledger/application/summarize-ledger-period.ts`, `ledger/schemas/period-query.ts`, `app/owner/(app)/money/{page,panel,headline,period-sheet,period-label,query,actions,expense-sheet}`, `lib/ui-copy.ts`; deleted `bars.ts`, `reveal.tsx`, `bars.test.ts`. Tests: `test/modules/ledger/domain/period-named.test.ts` (month edges, a DST day, the spring-forward and clock-change days), `test/app/owner/money/headline-copy.test.ts`, `test/integration/money-headline.integration.test.ts` (Beirut-midnight edges, previous-period comparison, loss, isolation, reports.view).

**How to verify:** `npm test`: 695 passed. `npm run test:integration`: 242 passed (5 new). `npm run build` is green. Not rendered (no browser).
