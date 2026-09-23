# Stadium SaaS — progress & learning log

This is the **story of what we actually built**, in order, in plain language.

It is for you: to stay current, to explain a file to yourself a month from now, and to **defend a decision** in an interview or a review (“we did X because DR-002 said Y, not because the tutorial did”).

It is **not** the source of truth for product or architecture. Those stay in:

| Document | Job | Example |
|---|---|---|
| [BRD](./requirements/brd.md) | What the business needs | “Two confirmed bookings never overlap” |
| [DR-001](./decisions/DR-001-tenancy-and-modules.md), [DR-002](./decisions/DR-002-core-data-model.md) | Why the technical shape is this way | jsonb schedule, no slots table, Prisma guard not RLS yet |
| [SPEC-01](./specs/SPEC-01-tenancy-foundation.md), [SPEC-02](./specs/SPEC-02-venue-availability.md) | What to build in one slice | numbered steps + definition of done |
| **This file** | What we did, when, which files, how they connect | “proxy sets a header because Next middleware cannot share memory with the page” |

Agents **append** here after each finished SPEC step or notable decision. They do not rewrite old chapters. See `.cursor/rules/050-progress-log.mdc`.

---

## How to read this (if you are learning)

1. Skim **Where we are** (next section).
2. When a file confuses you, search this page for its name.
3. For “why not the other design?”, jump to the linked DR — this log only *points* there.
4. Code changes. If this log and the repo disagree, **the repo wins**; then we append a correction.

---

## Where we are (2026-09-15)

**On `main`.** SPEC-01–14 shipped. UI is Arabic + RTL by default. Public `/` and owner chrome have an EN/ع toggle (cookie `stadium_locale`) that flips `html` `lang`/`dir`. Latin times/phones/money/day numbers use `<bdi dir="ltr">` / `LtrIsolate`. Domain failures stay on the page (`?error=<key>`). Unexpected goes to `error.tsx` / `logs/`. RULE-7 isolation is proven by `test/integration/isolation.integration.test.ts` (plus a tenant-guard fix for findUnique select / update pre-check).

**What a visitor can do:** public PENDING request. Owner approves, Books a caller's hour, Collects, Cancels, marks No-show, sees waitlist + Notify, confirms via WhatsApp after approve, records expenses, and sees This period.

**What they cannot do yet:** refunds, per-player split, pitch blocks, subscriptions/suspend, other WhatsApp templates (reject/cancel/reminder), public location/contact/QR, games-played / pitch-busy (BR-57). Ops: no written backup cadence; prod env checklist still thin — see [NOW.md](./NOW.md).

**Local logins (seed only):** password `dev-owner`. Identifiers `owner@ahmad`, `owner@sami`, `staff@ahmad` (STAFF, cannot approve, collect, record expenses, view reports, Book, or cancel).

**Next:** MVP P0 remaining — backup cadence, then deploy/prod env truth ([NOW.md](./NOW.md)).

---

## The product in one paragraph

Lebanese stadium owners run bookings and cash on paper. This SaaS is a **subscription per stadium** (a *tenant*). Each owner gets his own site (subdomain). Players usually have **no account**. Phase 1 is bookings + mixed USD/LBP money + expenses + a public page. Phase 2 is shop. Phase 3 (the real business) is academy. **G-1:** every owner action must be faster than paper.

That paragraph lives in the BRD. Code so far only proves: *the right stadium’s data, and a day of slots from a rule, not a slots table.*

---

## Stack — what we chose and why it shows up in files

| Piece | Why it is here | Where you see it |
|---|---|---|
| **Next.js 16** (App Router) | UI + server in one repo. **This version is not “the Next.js you memorized.”** `AGENTS.md` + `.cursor/rules`: read `node_modules/next/dist/docs/` before APIs. | `src/app/`, `src/proxy.ts` (not `middleware.ts`) |
| **Prisma 7 + Postgres** | Typed queries; Postgres for later **exclusion constraint** (no double-booking). Prisma 7 uses a config file for the DB URL. | `src/prisma/schema.prisma`, `prisma7.config.ts` |
| **Shared DB, `tenantId` on tenant tables** | One cheap droplet, many stadiums. Schema-per-tenant rejected (DR-001). | `Pitch.tenantId` |
| **Prisma extension, not RLS yet** | Laravel-style global scope. RLS is a second line of defense, deferred until a real paying stranger. | `src/lib/db.ts` |
| **Jest** | Lock **pure** rules (slug parse, Zod, slot engine) without starting the browser. | `test/` mirrors `src/` |
| **Zod + decimal.js** | Json is `unknown`; money must not be a float. | `src/modules/venue/schemas/`, `src/lib/money.ts` |

**Module idea (DR-001):** `src/app/` is only routes (thin). Real work is `src/modules/<feature>/{domain, application, infrastructure}`. Domain = thinks (no DB). Application = orchestrates (`await`). Infrastructure = Prisma. Arrows point **down** (Booking may ask Venue; Venue must not import Booking).

We **do not** create empty folders for Shop/Academy/Booking until that SPEC.

---

## Chapter 0 — create-next-app and Prisma (before SPEC-01)

**Commits:** `ceb9d55` Create Next App → `413d3bc` move to `src/` and Prisma.

**What:** A stock Next app, then the project was moved so source lives under `src/` (including Prisma schema at `src/prisma/`). Postgres is reached via `DATABASE_URL` in `.env`, wired in `prisma7.config.ts` (Prisma 7 style — the URL is **not** in `schema.prisma`).

**Why `src/`:** keeps `app/` from mixing with `modules/` later; matches `docs/guides/folder-structure.md`.

**Relation:** Everything later hangs off this. Demo `User` table from the init migration was later dropped in SPEC-01.

**Gotcha you will hit:** local `DATABASE_URL` has pointed at Postgres database `template1`. Putting app tables in `template1` breaks Prisma `migrate dev`’s **shadow database** (it clones template1, already has `Tenant`, migration says “already exists”). SPEC-02 step 1 used `migrate deploy` with a handwritten SQL file instead. That is an environment quirk, not a product decision.

---

## Chapter 1 — planning docs and the Cursor leash

**Commit:** `9fce834` (this was `origin/main` before the feature branch).

**What we added (not product code):**

- `docs/decisions/DR-001` — tenancy, modules, transactions, notifications after commit, RLS deferred.
- `docs/decisions/DR-002` — core tables for MVP (people, venue, booking, payment, ledger, expense) and rejected alternatives.
- Guides: folder structure, Cursor workflow, Jest, how `.mdc` rules work.
- `.cursor/rules/000-core-architecture.mdc` (always on), `100-rtl-i18n.mdc` (UI), `200-database-prisma.mdc` (schema/infra).
- `SPEC-01` written as the first **build** slice.

**Why this before more code:** decision → spec → code. If the agent invents a table in chat, you cannot defend it. The BRD was still a placeholder here (`docs/requirements/` said “add when ready”).

**How you work with Cursor (from the workflow guide):** one SPEC step at a time; you verify; then the next step. New chat per slice keeps token cost down.

---

## Chapter 2 — SPEC-01 Tenancy foundation (implemented)

**Goal of the slice:** prove isolation with the smallest real read: *list this tenant’s pitches*. If scoping is wrong, show **zero rows**, never Sami’s pitches on Ahmad’s site.

**Depends on:** DR-001 (URL = tenant; session later only authorizes), DR-002 (Pitch has `tenantId`).

**Branch at the time:** `feature/spec-01-tenancy-foundation` (later merged into `main` and deleted).

### Step 1 — Schema: Tenant + Pitch

**Files:** `src/prisma/schema.prisma`, migration `src/prisma/migrations/20260909010000_tenancy_foundation/migration.sql`

**What:** `Tenant` (`id`, `slug` unique, `name`, `createdAt`). `Pitch` (`id`, `tenantId`, `name`, `createdAt`) + relation + index on `tenantId`. Dropped leftover `User`.

**Why not more columns:** `schedule_config`, blocks, bookings wait for later SPECs. `tenantId` on Pitch is mandatory even for this tiny table (RLS later needs it on every tenant table).

**Relation:** every later Pitch query rides this table. Seed creates Ahmad/Sami here.

### Step 2 — Resolve tenant without touching the DB

**Files:** `src/lib/tenant-slug.ts`, `src/proxy.ts`, `test/lib/tenant-slug.test.ts`

**What:** `parseTenantSlug(host, searchParams)` — `ahmad.stadiums.com` → `"ahmad"`. Local: `ahmad.localhost`, `ahmad.lvh.me`, or `?tenant=ahmad` (query **wins** so you can test without DNS). Invalid slugs → `null`.

**`src/proxy.ts`:** Next.js 16 **proxy** (same job as old “middleware”). Runs **before** the page, in a **different runtime**. It **cannot** put tenant id in AsyncLocalStorage for the page to read (DR-001 corrected that). It only sets header `x-tenant-slug`. It **must not** query Postgres.

**Why a pure function:** Jest can test it without Next. If you ever change URL scheme, you change one function.

**Relation:** proxy → header → `tenant-context` (next step).

### Step 3 — Tenant exists? 404 if not

**File:** `src/lib/tenant-context.ts`

**What:** Page/server code reads `x-tenant-slug` via `headers()` (Next — request-time API, must `await`). Looks up `Tenant` with **`platformDb`** (unscoped — you are looking up the tenant row itself). Missing slug or unknown slug → `notFound()`. `cache()` so one lookup per request.

**Rule to defend:** *The URL chooses the tenant. A future login only asks “is this person allowed **here**?”* Invert that and a stolen cookie could show the wrong stadium.

**Relation:** `getCurrentTenantId()` is what the Prisma extension uses.

### Step 4 — The isolation guard (`db` vs `platformDb`)

**Files:** `src/lib/prisma-base.ts` (one Prisma client + `pg` pool), `src/lib/platform-db.ts` (unscoped, awkward name on purpose), `src/lib/db.ts` (extended client).

**What `db` does:** for model `Pitch`, inject `tenantId` on reads and creates. Callers **must not** write `where: { tenantId }` themselves — that is the proof the guard works. Unique finds that return another tenant’s row are rejected.

**Why two clients:** seed and “find tenant by slug” **cross** tenants. If they used `db`, they would be filtered to one tenant and lie. `platformDb` is the exception hatch (DR-001).

**Why not RLS yet:** extra Postgres role and wrapping every request. Trigger: first real paying tenant who isn’t a friend.

**Relation:** `listPitches()` uses `db` and never mentions `tenantId`.

### Step 5 — Thin page + venue infrastructure

**Files:** `src/modules/venue/infrastructure/pitches.ts` (`listPitches`), `src/app/page.tsx` (then: names only).

**What:** First real **module** folder. Query lives in Venue infrastructure, not in the page. Page: resolve tenant, list names.

**Why even for a list:** if we put Prisma in `app/`, dropping Next for Express would smear the whole app. Self-test: *only `app/` should change if we left Next.*

### Step 6 — Seed two businesses

**File:** `src/prisma/seed.ts` (`npm run db:seed`). Uses an unscoped client like `platformDb`.

**What:** Wipe pitches/tenants, create `ahmad` (A1–A3) and `sami` (S1–S2). Later SPEC-02 filled `scheduleConfig` on those pitches.

**Acceptance you already ran:** two hosts (or `?tenant=`), different lists; unknown tenant 404; break the extension → empty list, not a leak.

**Jest for this slice:** only `test/lib/tenant-slug.test.ts`. Domain tests wait until there is domain logic.

---

## Chapter 3 — BRD in the repo

**File:** `docs/requirements/brd.md` (draft v0.1). Docs index and `docs/requirements/README.md` updated to point at it.

**What:** Full product vision: goals G-1…G-6, roles, phases, BR-1…BR-105, RULE-1…12, risks. DR-002 already cited these numbers before the file was in git.

**Relation:** SPEC-02 was written **from** BR-3/4/5/7/10/12 + DR-002 §2.4–2.5, not invented in chat.

---

## Chapter 4 — SPEC-02 written, then built one step at a time

**File:** `docs/specs/SPEC-02-venue-availability.md`

**What the spec pinned** (DR-002 had jsonb, not the keys): weekly `hours` (all seven days required; `[]` = closed), `slotDurationMinutes`, `gapMinutes`, `defaultPriceUsd` as **string** `"30.00"`, `priceRules` last-match-wins. No slots table. Engine takes `occupied[]` so **blocks and bookings plug in later** without Venue importing Booking. `pitch_blocks` and `tenant.settings` **deferred**. Timezone is an **argument** (`Asia/Beirut`), not a column yet.

**Workflow:** you approved each numbered step before the next.

### Step 1 — `scheduleConfig` on Pitch

**Files:** `schema.prisma` (`Json` → Postgres **jsonb**), migration `20260909030600_pitch_schedule_config`.

**What:** Required jsonb with a **closed-week default** so old rows stayed valid. Prisma v7: `@default` for Json is an escaped JSON string.

**Why default closed:** generate-slots then returns `[]` until seed overwrites — safer than `{}` which Zod would reject.

### Step 2 — Zod at the edge + money helper

**Files:** `zod`, `decimal.js`; `src/lib/money.ts`; `src/modules/venue/schemas/schedule-config.ts`; tests under `test/lib/money.test.ts` and `test/modules/venue/schemas/schedule-config.test.ts`.

**What:** `parseScheduleConfig(unknown)` throws on bad jsonb (`z.strictObject` — extra keys fail). Prices: strings only, two cents, `parseUsd` uses Decimal **not** `parseFloat`. Times: `HH:mm` via Zod `z.iso.time({ precision: -1 })`.

**Why:** Prisma types Json as `unknown`. Invalid owner data must not become a silent new feature. BR-40 / DR-002 §2.18.

**Relation:** seed and the use case both parse **before** trust. Domain receives `ScheduleConfig`, never raw Json.

### Step 3 — Pure engine

**File:** `src/modules/venue/domain/availability.ts` — `generateSlotsForDay`.

**What:** Civil date + timezone + config + occupied ranges → UTC `Date`s + Decimal prices + `available`. No `await`, no Prisma. Windows that end before they start **cross midnight** (BR-7). Full games only; leftover minutes discarded. Occupied overlap is half-open `[start, end)`.

**Why Intl for timezone:** `Date#getHours()` is the **server’s** local time, not Beirut. We convert wall clock ↔ UTC with `Intl` offsets.

**Relation:** Booking (later) will pass approved ranges into `occupied`. Same function. No upward import.

**Spec slip we documented:** “16:00–22:00 → four slots” is six hours → **six** 60-minute slots. Tests follow the **rule**, not the count typo.

### Step 4 — Jest for the engine

**File:** `test/modules/venue/domain/availability.test.ts`

**What:** closed day, 6 slots, 90-min leftover, 15-min gap, weekend price, after-20:00 price, midnight window (last slot ends **next local morning**), occupied vs adjacent.

**Why here not in the page:** the engine is the product risk for wrong schedules (R-5). Pages stay thin and untested.

### Step 5 — Application glues DB + parse + engine

**Files:** `listPitches` also selects `scheduleConfig`; `src/modules/venue/application/get-day-availability.ts`.

**What:** `await` load pitches → parse each config (fail the request if invalid) → `occupied: []` → DTO with `16:00` local strings and `"30.00"`.

**Relation:** page must not call `generateSlotsForDay` on raw Json. Infrastructure still has **no** `tenantId` in the query.

**Gotcha:** a long-running `next dev` kept an **old Prisma client** in `globalThis` (see `prisma-base.ts` singleton) and said `Unknown field scheduleConfig`. Restart `npm run dev` after `prisma generate`.

### Step 6 — Thin page + `?date=`

**File:** `src/app/page.tsx`

**What:** Next 16: `searchParams` is a **Promise** (`PageProps<'/'>`). `?date=` or **today in Asia/Beirut** (not UTC “today” — midnight would show the wrong Lebanese day). Renders `18:00–19:00 · $30.00` or “Closed / No slots.”

**Relation:** still no Prisma / no `tenantId` in the page. `?tenant=` still handled in **proxy**, not in this date parser.

### Step 7 — Seed real hours

**File:** `src/prisma/seed.ts` — `parseScheduleConfig` before write.

| Pitch | Rule (so you can demo) |
|---|---|
| A1 | Mon–Thu 16:00–22:00 60 min $30; Fri/Sat to 23:00 **$40** |
| A2 | Mon–Thu 16:00–22:00 **90 min $35** |
| A3 | **Monday only** 10:00–14:00 $20 |
| S1 | 18:00–22:00 $25 (not Sunday) |
| S2 | Saturday morning 09:00–12:00 $15 |

Useful URLs: `/?tenant=ahmad&date=2026-09-09` (Wed), `date=2026-09-12` (Sat $40), `date=2026-09-07` (Mon A3 open), `/?tenant=sami&date=2026-09-09`.

---

## Chapter 5 — Git: finish the branch

**What:** Committed SPEC-02 implementation (`e9352fb`). Fast-forward **merged** `feature/spec-01-tenancy-foundation` into **`main`**. Deleted the feature branch. Working tree was clean.

**Why not keep the old branch name:** SPEC-01 and SPEC-02 both lived on it; after merge, `main` *is* the product so far.

**Not done unless you did it:** `git push` (local was ahead of `origin/main` by several commits).

---

## Chapter 6 — Phone on the same Wi‑Fi

**File:** `next.config.ts` — `allowedDevOrigins: ["192.168.10.194"]`

**What:** Next 16 blocks `/_next/hmr` from LAN IPs unless the **hostname** (no `http://`) is listed. `allowedDevOrigins: true` is invalid and crashed the config (`all is not defined`).

**How to open:** `http://192.168.10.194:3000/?tenant=ahmad` — query `?tenant=`, not path `/tenant=ahmad`. If DHCP changes the PC IP, update the array and restart `npm run dev`.

**Relation:** this is **dev ergonomics**, not a product decision. Do not confuse with tenant subdomains in production.

---

## File map (what exists now)

```
src/
  proxy.ts                         # host / ?tenant= → x-tenant-slug
  app/page.tsx                     # thin: tenant + getDayAvailability
  app/layout.tsx                   # root HTML
  lib/
    tenant-slug.ts                 # pure parser
    tenant-context.ts              # header → Tenant row or 404
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
  prisma/migrations/…

test/  mirrors the pure pieces above
docs/  BRD, DRs, SPECs, guides, this log
.cursor/rules/  000 core, 050 this log, 100 RTL, 200 Prisma
```

**Not created yet (correct):** `modules/booking`, `people`, `payment`, `access`, `pitch_blocks`, auth, next-intl.

---

## How we defend a decision (cheat sheet)

| If they ask… | You say… |
|---|---|
| Why not a `slots` table? | Empty future rows forever; rule changes would desync. DR-002 §2.5. Engine is a function. |
| Why jsonb for hours? | Shape of rules will change; columns = a migration per tweak. Zod on every read/write. |
| Why no `booking_id` on payments? | Payment must stay closed when Academy/Shop arrive. Polymorphic `source_type + source_id`. |
| Why subdomain not `/ahmad`? | Feels like *his* site (A-12). One parser function either way. |
| Why not RLS now? | Extension is the guard; RLS is cost for a bug in that guard. |
| Why Decimal strings in JSON? | JSON numbers are floats in JS. BR-40. |
| Why proxy not “set tenant in memory”? | Separate runtime from the page. Header only. |

---

## What’s next (do not invent)

1. Auth (email@domain + password) **before** owner UI.
2. Then owner approve (exclusion actually fires), payment, dashboard.

One SPEC step at a time. Append here when a step is done.

---

## Appendix — how to append (humans and agents)

Add a new `##` or `###` under a dated chapter. Include:

- **When** (date)
- **What** (one sentence)
- **Why** (link DR/SPEC/BR if it exists)
- **Files** (paths)
- **Relation** (what it talks to; what it must not import)
- **How to verify** (command or URL)

Do **not** delete old chapters to “clean up.” If we reversed a decision, write a short **Correction** note.

Keep entries boring and specific. This file is your memory, not a brochure.

---

## Chapter 7 — 2026-09-09 — simple file logger

**When:** 2026-09-09

**What:** Server-side `logger.info` / `logger.error` that appends a timestamped line (plus optional error stack) to `logs/YYYY-MM-DD.log`.

**Why:** No shared place to record failures (invalid jsonb, seed crashes). Ops plumbing, not a DR. Node `fs` only — no Winston/Pino yet.

**Files:** `src/lib/logger.ts`; `logs/.gitkeep`; `.gitignore` ignores `logs/*` except `.gitkeep`. First callers: `get-day-availability.ts` (bad `schedule_config`), `src/prisma/seed.ts`.

**Relation:** Shared `lib/` like `money.ts`. **Must not** import from Client Components or `src/proxy.ts` (no Node filesystem). Domain stays pure — no logger in `availability.ts`. Do not log secrets.

**How to verify:** trigger `logger.info` (e.g. `npm run db:seed`) then open `logs/<UTC-date>.log`.

---

## Chapter 8 — 2026-09-09 — SPEC-03 written (not built)

**When:** 2026-09-09

**What:** Branch `feature/spec-03-booking-public-request`. Spec for **option A**: public name+phone request → PENDING booking + person + requester participant. Exclusion SQL ships now; approve UI does not.

**Why:** `docs/README.md` next slice is Booking; auth must exist before owner screens. BR-15/16, RULE-2. People module appears because Booking asks People find-or-create by phone (DR-002).

**Files:** `docs/specs/SPEC-03-booking-public-request.md`; index links in `docs/README.md`, root `README.md`.

**Relation:** Booking → Venue (offered slots + price) and People. Venue must not import Booking. `user_person_links` waits for User/auth.

**How to verify:** read the spec; no product code until you OK a numbered step.

---

## Chapter 9 — 2026-09-09 — SPEC-03 step 1: Person + Booking + BookingParticipant

**When:** 2026-09-09

**What:** Three tenant-owned tables for a public PENDING request. No modules, no UI, no exclusion yet.

**Why:** DR-002 §2.1–2.3 (person = name+phone, unique per tenant phone), §2.9–2.10 (booking has no person; requester is a participant), §2.18 (`Decimal(12,2)`). SPEC-03 step 1. `tenant_id` on all three including the child table (DR-001 / DR-002 §3).

**Prisma 7 docs (then the code):**
- `enum` blocks map to Postgres enums ([Models — Defining enums](https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/models)).
- Money: `Decimal` + `@db.Decimal(12, 2)` so we do not get the default `decimal(65,30)`.
- `tstzrange` has no Prisma scalar. [Unsupported field types](https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/unsupported-database-features): `Unsupported("tstzrange")` creates the column; the field is **not** in Prisma Client. A required Unsupported field also drops typed `create` / `upsert` on that model (schema reference). Step 7 will insert `during` with raw SQL. We did **not** add `startAt`/`endAt` — DR-002’s column is `during`.
- `team` omitted this slice (SPEC: omit or nullable; unused).

**Files:** `src/prisma/schema.prisma`; migration `src/prisma/migrations/20260909080100_person_booking/migration.sql`.

**Relation:** Tenant and Pitch gain reverse lists. Booking FK → Pitch. BookingParticipant FKs → Tenant, Booking, Person. Venue module must not import Booking (still true — we added no app code). `db.ts` still only scopes `Pitch` (step 3).

**Gotcha:** `migrate dev` needs a shadow DB; this local URL is `template1` (Chapter 0). Same as SPEC-02: handwritten SQL from `migrate diff --from-config-datasource --to-schema`, then `migrate deploy`. `npx prisma migrate status` is clean.

**How to verify:** Prisma Studio — three empty tables; Person unique on `(tenantId, phone)`; Booking has `during` tstzrange and `priceUsd` DECIMAL(12,2); no `personId` on Booking.

```
npx prisma studio --config prisma7.config.ts
```

---

## Chapter 10 — 2026-09-09 — SPEC-03 step 2: APPROVED exclusion

**When:** 2026-09-09

**What:** GiST exclusion on `Booking`: same `"pitchId"` + overlapping `"during"` is refused **only** when `status = APPROVED`. PENDING may overlap (RULE-2 / BR-19).

**Why:** DR-002 §2.8 — the database is the double-booking guard, not app code. Prisma cannot express `EXCLUDE`; it is handwritten SQL (`.cursor/rules/200-database-prisma.mdc`). Ships now so we do not “forget” why we picked Postgres, even though this slice only inserts PENDING.

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

## Chapter 11 — 2026-09-09 — SPEC-03 step 3: tenant extension

**When:** 2026-09-09

**What:** `Person`, `Booking`, and `BookingParticipant` are now in `TENANT_SCOPED_MODELS`. App queries must not pass `tenantId`.

**Why:** DR-001 §3 — the Prisma extension is the isolation guard. SPEC-03 step 3. Child tables are scoped too, not “because they hang off Booking.” Prisma 7 query extensions: `$extends` + `query.$allModels.$allOperations` ([v7 query component](https://www.prisma.io/docs/orm/v7/prisma-client/client-extensions/query)).

**Files:** `src/lib/db.ts` only.

**Relation:** Same client `listPitches` already uses. Seed / tenant lookup still use `platformDb` (unscoped). No people/booking modules yet (step 4).

**Gotcha:** required `Unsupported("tstzrange")` means Prisma Client has no `booking.create`. Prisma 7 then types `$allOperations` as the **intersection** of operations, so `create` disappeared from the type even though Person still creates. We compare `operation` as a string so Person/participant inserts still get `tenantId`. Step 7’s raw SQL for `during` will **not** be stamped by this extension — that write must include `tenantId` in the SQL.

**How to verify:** read `TENANT_SCOPED_MODELS` in `src/lib/db.ts`. No Studio change. There is still no app query against Person/Booking; proof comes when step 4/7 repositories omit `tenantId` from `where`.

---

## Chapter 12 — 2026-09-09 — SPEC-03 step 4: People find-or-create

**When:** 2026-09-09

**What:** First `people/` module. Normalize phone to digits; find-or-create by phone inside the caller's `tx`; never overwrite an existing name.

**Why:** DR-002 §2.2 / RULE-8 — phone unique per stadium. SPEC-03: Booking asks People, does not own “create person.” DR-001: the starting use case opens `$transaction` and passes `tx`; repositories never import `db`. Prisma 7 interactive transactions: `tx` is `Prisma.TransactionClient` ([Client `$transaction`](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions)).

**Files:**
- `src/modules/people/domain/phone.ts` — `normalizePhone` (pure)
- `src/modules/people/infrastructure/persons.ts` — `findPersonByPhone`, `createPerson` (no `tenantId` in `where`/`data`)
- `src/modules/people/application/find-or-create-person.ts`
- `test/modules/people/domain/phone.test.ts`

No `ui/` or empty folders.

**Relation:** Booking (step 7) will call `findOrCreatePerson(tx, …)` inside its transaction. People must not import Booking. Venue unchanged.

**How to verify:** `npm test` — new suite plus SPEC-01/02. Same digits after stripping spaces/`-`/`+` → same string. Isolation (two tenants, two people) waits until a request can write rows (step 7/8).

---

## Chapter 13 — 2026-09-09 — SPEC-03 step 5: Booking domain

**When:** 2026-09-09

**What:** Pure `resolveOfferedSlot`: the UTC window must be one of Venue’s generated slots for that civil date, and `end` must be after injected `now`. Price is copied from that slot. `overlaps` is half-open, for tests.

**Why:** SPEC-03 step 5. Booking **asks** Venue (`generateSlotsForDay`); it does not invent times or trust a posted price (DR-002 §2.18). `occupied` stays `[]` — PENDING must not hide the slot (RULE-2). `now` is an argument so Jest can freeze time.

**Files:** `src/modules/booking/domain/offered-slot.ts`; `test/modules/booking/domain/offered-slot.test.ts`. No application/infra/UI yet.

**Relation:** Booking domain imports Venue domain. Venue must not import Booking.

**How to verify:** `npx jest test/modules/booking/domain/offered-slot.test.ts` — closed day and unknown window fail; a real 16:00 Wednesday slot passes with `$30.00`; `now === slot.end` fails.

### In plain language (what this step is for)

This is a **gatekeeper**. It answers one question **before** we ever touch the database:

> “Is this the kind of game Ahmad’s stadium actually sells, and has that game already finished?”

Nothing is saved yet. No person row, no booking row. Just yes/no, plus the **real** price.

**The situation:** a visitor will later click a slot on the public page, e.g. Wednesday 16:00–17:00. The form sends two times (start and end). We cannot trust that blindly. Someone can change the form and send 03:00–04:00, or a price of $1. The page is not the source of truth. The opening-hours **rule** is — the same function that draws the list: `generateSlotsForDay`.

**What `resolveOfferedSlot` does:**

1. Ask Venue: for this pitch, this calendar day, in Beirut, which games exist?
2. Is the requested start/end **exactly** one of those games? If not → reject. Closed day, wrong time, 90 minutes when games are 60 — all fail the same way (`Slot is not offered`).
3. Has that game **already ended**? If `end` is before or equal to `now` → reject (`Slot has already ended`). We pass `now` in so tests can pretend it is 5pm without waiting.
4. If both pass: return that slot **and its price from the engine**. We copy `$30.00` from Venue. We never take a price from the browser (DR-002 §2.18).

**What we skip on purpose:** we do **not** ask “is this already booked?” Two PENDING requests for the same hour are allowed (RULE-2). Occupied time comes later, when something is APPROVED. So this function always asks Venue with an empty occupied list.

**`overlaps`:** a small helper — do two time ranges crash into each other? 16:00–17:00 and 17:00–18:00 do **not** (the first ends when the second starts). 16:00–17:00 and 16:30–17:30 **do**. Same half-open rule as Venue. The public request does not use it yet; it is here for tests and later approve.

**Why a Booking file, not inside Venue:** Venue’s job is to **list** possible games. Booking’s job is to **allow or refuse a request**. If we mixed them, “what hours do we sell?” and “may this visitor request this hour?” would live in one place and get messy when approve and payments arrive.

**One sentence:** you may only request a real, still-open game, at the stadium’s price — as a pure function, so we can test it without the database or the webpage.

---

## Chapter 14 — 2026-09-09 — SPEC-03 step 6: Zod for the public form

**When:** 2026-09-09

**What:** `parsePublicSlotRequest` — name, phone (8–15 digits after normalize), pitchId, start/end as UTC ISO strings. Extra keys fail.

**Why:** SPEC-03 step 6. The form is untrusted. Zod checks *shape* before the use case. Step 5 still decides “is this a real unfinished game?” Phone length lives here, not in `normalizePhone`. Zod 4: `z.strictObject`, `z.iso.datetime()` ([Zod API](https://zod.dev/api) — UTC with `Z`, no `+02:00` unless we opt in; we did not).

**Files:** `src/modules/booking/schemas/public-slot-request.ts`; `test/modules/booking/schemas/public-slot-request.test.ts`.

**Relation:** Schema uses People `normalizePhone`. Does not import domain `resolveOfferedSlot` (different question). Use case (step 7) will parse first, then domain.

**How to verify:** `npx jest test/modules/booking/schemas/public-slot-request.test.ts` — missing name, `"12"` / `"abc"` phone, extra `priceUsd` all throw; `"03 123 456"` becomes `"03123456"`.

### In plain language

Two gates, different jobs:

| Gate | Question | Example fail |
|---|---|---|
| **Zod (this step)** | Did they fill the form like we expect? | No name, phone `12`, extra `priceUsd` |
| **Domain (step 5)** | Is that window a real game that has not ended? | Tuesday closed, 03:00, already finished |

Zod never opens the database. A valid form can still be a fake slot — step 7 will run both.

---

## Chapter 15 — 2026-09-09 — SPEC-03 step 7: `requestPublicSlot`

**When:** 2026-09-09

**What:** One use case opens `db.$transaction` and writes Person (find-or-create) + PENDING/PUBLIC Booking + requester participant. Price from Venue. No notifications.

**Why:** SPEC-03 step 7 / DR-001 (the starting use case owns the transaction and passes `tx`). DR-002 §2.10 requester is a participant. Prisma 7: `$transaction` callback + tagged `$executeRaw` for `during` ([raw SQL](https://www.prisma.io/docs/orm/v7/prisma-client/using-raw-sql); Client has no `booking.create`).

**Files:**
- `src/modules/booking/application/request-public-slot.ts`
- `src/modules/booking/infrastructure/bookings.ts`
- `src/modules/venue/infrastructure/pitches.ts` (`findPitchById(tx, id)`)
- `src/modules/venue/domain/availability.ts` (`civilDateInTimeZone`)
- `src/lib/db.ts` (`TenantTx` = the extended interactive `tx`)

**Relation:** Booking asks Venue (pitch + schedule + civil date) and People (`findOrCreatePerson`). Venue must not import Booking. Page still has no form (step 8).

**How to verify:** `npm test` (33 passed). No page yet — proof write waits for step 8 + Studio. Two overlapping PENDINGs are allowed (exclusion ignores them).

### In plain language

This is the **do-it** function. Zod already checked the form. Domain already knows the rule. Now we save:

1. Load this stadium’s pitch (wrong id / Sami’s pitch on Ahmad’s site → not found).
2. Parse opening hours. Ask: is this start/end a real game that has not ended? Copy the **engine** price.
3. Find or create the person by phone (keep the old name if they exist).
4. Insert a booking: PENDING, PUBLIC, time range in Postgres `during`.
5. Insert one participant flagged “this is who asked,” owed the full game price.

All of that is **one transaction**: if the participant insert fails, the booking and person-create roll back together.

We log the booking id on success, not the phone (PII). Nothing is sent to WhatsApp.

The page still cannot call this until step 8 (a small form + Server Action).

---

## Chapter 16 — 2026-09-09 — SPEC-03 step 8: thin public form

**When:** 2026-09-09

**What:** Each slot on the existing page has a name + phone form. Submit runs a Server Action: Zod → `requestPublicSlot` → redirect with `?received=1`. Slot stays listed. Plain “Request received”. No styling system.

**Why:** SPEC-03 step 8. `app/` stays thin (no Prisma, no `tenantId`). Next 16 local docs: [`forms.md`](../../node_modules/next/dist/docs/01-app/02-guides/forms.md) — `<form action={serverFn}>` still receives `FormData`. [`redirect`](../../node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md) after success, **outside** try/catch. `searchParams` stays a Promise.

**Files:** `src/app/request-slot.ts`; `src/app/page.tsx`. Hidden `tenant` is the **slug** (already on the page), not `tenantId` — so local `?tenant=` survives the redirect.

**Relation:** Page calls the Action only. Action calls Zod + use case. Isolation still comes from the proxy header, not from the hidden slug.

**How to verify:**
1. `http://localhost:3000/?tenant=ahmad&date=2026-09-09` — Pitch A1 16:00 form. Submit Ali / `03 123 456`.
2. URL keeps `date=` and shows **Request received**. Slots still there.
3. Prisma Studio: Person + Booking (PENDING, PUBLIC) + BookingParticipant (`isRequester`).
4. Same slot, different phone → second PENDING. Same phone again → same Person, new Booking.
5. `?tenant=sami` — Sami’s pitches only; Ahmad’s people/bookings stay Ahmad’s.
6. `npm test` (33).

Could not click-submit from this session (no browser automation). Page HTML was fetched: Ahmad/Sami forms render; `?received=1` shows the message.

### In plain language

The page is still just a **thin waiter**. It does not decide prices or create rows. It collects name + phone, plus hidden pitch/start/end, and hands that to the Action. The Action is the bouncer (Zod) then the kitchen (`requestPublicSlot`). After a successful save we send you back to the same day’s list with a sticky note: “Request received.” We do not hide the slot — PENDING is not occupancy.

---

## Chapter 17 — 2026-09-09 — Gotcha: expired interactive transaction on public request

**When:** 2026-09-09

**What:** Submitting the public form failed with Prisma “query cannot be executed on an expired transaction” (timeout 5000 ms, ~5029 ms elapsed) on `pitch.findUnique` — the **first** query inside `$transaction`, not a slow insert.

**Why:** `platformDb` is an alias of the same Prisma client/pool as `db` (`src/lib/prisma-base.ts`). Interactive `$transaction` holds one connection (`BEGIN`). The tenant query extension then calls `getCurrentTenantId()` → `platformDb.tenant.findUnique` on that **same** client. The Server Action is a new request, so React `cache()` is cold. Tenant lookup waits for the connection the transaction is holding; the transaction waits for the tenant lookup. After 5s Prisma kills the transaction. Prisma 7 interactive options: `timeout` / `maxWait` ([transactions](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions)); we did **not** raise the timeout — that would only make the form hang longer.

**Files:** `src/modules/booking/application/request-public-slot.ts` (await `getCurrentTenantId()` before `$transaction`); `src/lib/db.ts` (comment on the extension).

**Relation:** Same rule as SPEC-01: one tenant lookup per request via `cache()`. The use case must fill that cache **before** `BEGIN`. Repositories still do not pass `tenantId`.

**How to verify:** Submit name + phone on `/?tenant=ahmad&date=2026-09-09` again. Should redirect with **Request received** in well under 5s. Prisma Studio: new PENDING row.

### In plain language

Postgres will not let two things use the same “phone line” at once. The booking save picks up the line and says “wait, I’m in a transaction.” The security guard then tries to look up which stadium this is — on that **same** line — and both wait until the timer rings. We look up the stadium **first** (short call, then remembered for this click), and only then start the transaction. The guard’s later checks are free memory hits, not a second database call.

---

## Chapter 18 — 2026-09-09 — Correction: `platformDb` must be a second pool

**When:** 2026-09-09

**What:** Chapter 17’s warm-`cache()` fix did **not** work. Submit still 500’d at ~5.1s on `tx.pitch.findUnique` (`run(args)` in `db.ts`). Warming tenant before `BEGIN` does not help: React `cache()` does not apply inside Prisma’s `$allOperations` callback, so the guard still queried `platformDb` **during** the transaction.

**Why:** `platformDb` was `export const platformDb = prismaBase` — one client, one pool. Prisma will not run a second query on that client while an interactive transaction is open. DR-001 already named a **separate** `platformDb`; the implementation had aliased it. Prisma 7: one `PrismaClient` per adapter/pool ([constructor](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/instantiate-prisma-client)).

**Files:** `src/lib/platform-db.ts` (own `pg.Pool` + `PrismaClient`); `src/lib/prisma-base.ts` (comment); `src/lib/db.ts` (comment); `src/modules/booking/application/request-public-slot.ts` (removed the useless pre-warm).

**Relation:** `db` = tenant-scoped, transactional. `platformDb` = unscoped Tenant lookup on a **different** connection. Repositories still do not pass `tenantId`.

**How to verify:** Submit the public form again. Should finish well under 5s with **Request received**. Dev log: `POST` not 500.

### In plain language

Remembering the stadium in React’s notebook does not help the Prisma guard — that guard runs in a back room and never reads the notebook. Two clerks also cannot share one phone line: while the booking clerk says “I’m in a meeting,” the stadium-lookup clerk must use a **second** line. `platformDb` is that second line.

---

## Chapter 19 — 2026-09-09 — Correction: one pool, two Prisma clients

**When:** 2026-09-09

**What:** After Chapter 18, the homepage 500’d: `Connection terminated unexpectedly` on `listPitches`. Not a Venue bug — Postgres (local proxy, `connection_limit=10` on `DATABASE_URL`) dropped sockets.

**Why:** Chapter 18 gave `platformDb` its **own** `pg.Pool` (default max 10). Two pools tried to open ~20 connections against a cap of 10. HMR also left old pools alive. Prisma 7 still wants two **PrismaClient** instances so tenant lookup is not serialized onto `db.$transaction` — they must **share one Pool**.

**Files:** `src/lib/prisma-base.ts` (one `pg.Pool` `max: 10`, two clients); `src/lib/platform-db.ts` (re-export); `src/lib/db.ts` (comment).

**Relation:** Same as Chapter 18’s intent. `platformDb` is a second clerk, not a second phone company.

**How to verify:** Restart `npm run dev` (old leaked pools die with the process). `/?tenant=ahmad` renders pitches. Submit name+phone → **Request received** under 5s.

### In plain language

We gave the stadium-lookup clerk a second phone **company**, and the switchboard only has ten lines — it hung up on everyone, including the page that only lists pitches. Both clerks now share one switchboard (ten lines). They are still two different clerks, so the booking meeting does not block the stadium lookup.

---

## Chapter 20 — 2026-09-09 — Correction: one client; tenant in ALS before BEGIN

**When:** 2026-09-09

**What:** GET pitches worked (200). POST still 500 in ~52ms: `Connection terminated unexpectedly` inside `submitPublicSlotRequest` / `$transaction`. Not the 5s deadlock.

**Why:** Two `PrismaClient`s on one `pg.Pool` is unsafe with Prisma 7 `adapter-pg`. The adapter treats the pool as exclusive. Interactive `$transaction` on client A plus Tenant lookup on client B (same sockets) kills the connection. React `cache()` still does not apply inside `$allOperations`.

**Fix (matches DR-001):** one client, one pool. App code loads the tenant **before** `BEGIN` and stores it on the request (`AsyncLocalStorage` — this is the request-scoped context DR-001 already described; middleware still only sets the header). The Prisma guard reads that store. No nested Prisma query during the transaction. Prisma 7 interactive `$transaction` ([transactions](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions)).

**Files:** `src/lib/prisma-base.ts` (single client; ends the Chapter 19 dual pool on HMR); `src/lib/platform-db.ts` (alias again); `src/lib/tenant-context.ts` (`withCurrentTenant`); `src/lib/db.ts` (`$transaction` wrapped).

**Relation:** Repositories still do not pass `tenantId`. `platformDb` stays the unscoped *name* for Tenant lookup, not a second engine.

**How to verify:** Reload `/?tenant=ahmad`. Submit name+phone. **Request received** in well under 5s. If HMR still looks sick, restart `npm run dev` once.

### In plain language

Two clerks sharing one switchboard still grabbed the same handset and yanked the cord out. So we went back to **one** database client. Before the booking meeting starts, we write the stadium’s name on a sticky note on the desk. During the meeting the guard only reads the sticky note — they do not call the database again. That is allowed: DR-001 said application code (not middleware) sets request-scoped tenant context.

---

## Chapter 21 — 2026-09-09 — Guide: Prisma transaction + tenant guard

**When:** 2026-09-09

**What:** Standalone write-up of Chapters 17–20 so we can return to it without rereading the chat.

**Why:** Same gotcha will hit owner approve (next `$transaction` after auth) if we forget.

**Files:** [docs/guides/prisma-transaction-tenant-guard.md](./guides/prisma-transaction-tenant-guard.md); linked from [docs/README.md](./README.md).

**How to verify:** Open that file. §5 is the rule; §4 is what not to retry.

---

## Chapter 22 — 2026-09-10 — DR-003 written (auth)

**When:** 2026-09-10

**What:** Settled Access decisions before SPEC-04. No auth code yet.

**Why:** [DR-003](./decisions/DR-003-auth-sessions.md). URL still chooses tenant; login is `local@tenant-slug` + hashed password (BR-99 vs the old “email@domain” note). Users have no `tenant_id`; memberships do.

**Files:** `docs/decisions/DR-003-auth-sessions.md`; `docs/README.md`.

**How to verify:** Read DR-003. Confirm or correct by section. Then SPEC-04, then code.

---

## Chapter 23 — 2026-09-10 — SPEC-04 written (not started in code)

**When:** 2026-09-10

**What:** Numbered Access slice: schema → guard → `can`/identifier → Zod → login/logout → `/login` + `/owner` → seed `owner@ahmad` / `owner@sami`. No approve UI.

**Why:** [SPEC-04](./specs/SPEC-04-access-login.md) implements [DR-003](./decisions/DR-003-auth-sessions.md).

**Files:** `docs/specs/SPEC-04-access-login.md`; `docs/README.md`.

**How to verify:** Read the spec. OK step 1 before any Prisma models.

---

## Chapter 24 — 2026-09-10 — SPEC-04 step 1: Access schema

**When:** 2026-09-10

**What:** `User` (identifier + passwordHash, no `tenantId`), `Membership` (`tenantId` + role + permissions jsonb), `Session` (no `tenantId`), `UserPersonLink` (empty; `tenantId` required). Enums `OWNER|STAFF`, `SELF|GUARDIAN`.

**Why:** SPEC-04 step 1 / DR-003 §3. Login accounts are not stadium rows; the **membership** is. Link table exists so we never retrofit Person↔User (DR-002 §2.1). Prisma 7 schema + handwritten SQL + `migrate deploy` (local DB is `template1`; no `migrate dev` shadow).

**Files:** `src/prisma/schema.prisma`; `src/prisma/migrations/20260910032700_access_user_membership/migration.sql`.

**Relation:** No Access module yet. Guard not updated (step 2). Seed does not create owners yet (step 7).

**How to verify:** Prisma Studio: four new tables, `UserPersonLink` empty. `npx prisma migrate status --config prisma7.config.ts` → up to date.

### In plain language

A **User** is a login (who knows the password). A **Membership** is “this login may work at Ahmad’s stadium as OWNER.” The cookie will remember the login, not the stadium — the URL still picks the stadium. The person-link table is a spare drawer; we do not put anything in it yet.

---

## Chapter 25 — 2026-09-10 — SPEC-04 step 2: guard vs platformDb

**When:** 2026-09-10

**What:** `Membership` and `UserPersonLink` added to `TENANT_SCOPED_MODELS`. User and Session stay off that list (no `tenantId`). Still one Prisma client / one pool. No Access folders yet (step 3).

**Why:** SPEC-04 step 2 / DR-003 §3. A membership list must be Ahmad-only without the caller writing `tenantId`. Looking up `owner@ahmad` must not be filtered to a tenant (User has no `tenantId`). Nested `platformDb` inside `db.$transaction` is still forbidden ([guide](./guides/prisma-transaction-tenant-guard.md)).

**Files:** `src/lib/db.ts`; `src/lib/platform-db.ts`; `src/lib/prisma-base.ts` (comments).

**Relation:** Login (step 5) will `platformDb.user.findUnique({ where: { identifier } })` then `db.membership.findFirst` (guard injects tenant).

**How to verify:** Read the Set in `db.ts`. Studio still empty. Public page still works.

### In plain language

The security guard now also watches **memberships** (and the empty person-link drawer). Logins and cookies are not stamped with a stadium — the guard would have nothing to stamp. We still have one database client. Access code is not written yet.

---

## Chapter 26 — 2026-09-10 — SPEC-04 step 3: Access domain

**When:** 2026-09-10

**What:** Pure rules: login id is `local@slug` after trim/lower-case; `can(membership, "bookings.approve")` is always yes for OWNER, and for STAFF only if the jsonb flag is strictly `true`. No Prisma, no password hash (that needs `node:crypto` later).

**Why:** SPEC-04 step 3 / DR-003 §2 and §5. Domain takes `MembershipLike`, not a Prisma type.

**Files:** `src/modules/access/domain/identifier.ts`, `can.ts`; `test/modules/access/domain/`.

**Relation:** Access must not import Booking. Booking will later ask `can`, not the other way around.

**How to verify:** `npm test` — 9 suites, 39 passed.

### In plain language

Two small rules with no database. First: the username looks like `owner@ahmad`, not an email we send mail to. Second: the owner of a stadium can approve; a staff member cannot unless we later flip a switch on their membership. The login page is still not built.

---

## Chapter 27 — 2026-09-10 — SPEC-04 step 4: Zod login body

**When:** 2026-09-10

**What:** `parseLogin` — `identifier` + `password`, `strictObject`, identifier run through domain normalize + shape. Password not hashed here.

**Why:** SPEC-04 step 4. Same two-gate idea as public booking: Zod = form shape; login use case (step 5) = user exists + membership on this URL.

**Files:** `src/modules/access/schemas/login.ts`; `test/modules/access/schemas/login.test.ts`.

**How to verify:** `npm test` — 10 suites, 42 passed.

### In plain language

The bouncer for the login form: you must send exactly a username and a password, nothing extra. `Owner@Ahmad` becomes `owner@ahmad`. We do not talk to the database yet.

---

## Chapter 28 — 2026-09-10 — SPEC-04 step 5: login / logout / membership

**When:** 2026-09-10

**What:** `login` (URL tenant → user on `platformDb` → hash verify → membership on `db` → session + HTTP-only cookie), `logout`, `getCurrentMembership`. Same `"Invalid login"` for unknown user, bad password, or no membership *here*. Cookie: no `domain` (host-only), `httpOnly`, 7 days. Next 16: `await cookies()`; `.set`/`.delete` only from a Server Action ([cookies.md](../../node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md)). Password hash is `scrypt` via `node:crypto`. No `$transaction` wrapping User+membership (tenant-guard guide).

**Files:** `src/modules/access/application/{login,logout,get-current-membership}.ts`; `infrastructure/{password,users,sessions,memberships,session-cookie}.ts`.

**Relation:** Access does not import Booking. Pages not built (step 6). No seeded owners yet (step 7) — click-test waits.

**How to verify:** `npm test` (42). Click-proof after steps 6–7.

### In plain language

The kitchen for login: first we know which stadium this URL is. Then we look up the username (not filtered by stadium). We check the password. Then we ask: does this person have a pass for **this** stadium? If not, we say “Invalid login” — we do not say “wrong stadium.” The cookie remembers the login, not Ahmad vs Sami. You cannot try this in the browser until we add the form and seed a password.

---

## Chapter 29 — 2026-09-10 — SPEC-04 step 6: thin login / owner pages

**When:** 2026-09-10

**What:** `/login` form (identifier + password) and `/owner` (name, identifier, role, logout). Hidden `tenant` slug for local `?tenant=`. No Prisma / no `tenantId` on pages. Invalid login → same page with “Invalid login”. Unauthenticated `/owner` → `/login`. Public `/` unchanged.

**Why:** SPEC-04 step 6. Next 16: `searchParams` Promise; `<form action>`; `redirect` outside try/catch ([redirect.md](../../node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md)). Cookie `.set` only from the Server Action.

**Files:** `src/app/login/page.tsx`, `src/app/login/actions.ts`, `src/app/owner/page.tsx`.

**Relation:** Pages call Access only. Seed (step 7) still required to click-test.

**How to verify:** `http://localhost:3000/login?tenant=ahmad` renders the form. `/owner?tenant=ahmad` redirects to login. Real sign-in after seed.

### In plain language

The waiter for login: a small form and a locked “you are in” page. They do not talk to Prisma. Until we plant a password in the database (next step), every login will fail on purpose.

---

## Chapter 30 — 2026-09-10 — SPEC-04 step 7: seed owners + staff

**When:** 2026-09-10

**What:** Seed now plants hashed logins on the unscoped client: `owner@ahmad` OWNER on Ahmad, `owner@sami` OWNER on Sami, `staff@ahmad` STAFF with `permissions: {}`. Password is `LOCAL_DEV_PASSWORD` (`dev-owner`) in `seed.ts` only — not imported from `app/`. Delete order now covers Session / Membership / UserPersonLink / User before Tenant. `npm run db:seed` ran successfully.

**Why:** SPEC-04 step 7 / DR-003 §2–3. Owners must exist so login can be click-tested. Staff is optional in the spec; seeded so `can(..., "bookings.approve")` stays false until a later flag.

**Files:** `src/prisma/seed.ts`; `src/app/login/actions.ts` (log unexpected login errors only — `"Invalid login"` stays silent); `docs/README.md`.

**Relation:** Seed uses its own PrismaClient (not `@/lib/db`). Access still does not import Booking. Public `/` is unchanged.

**Gotcha:** After adding User/Session models, a long-running `npm run dev` can keep an old `prismaBase` on `globalThis` (`src/lib/prisma-base.ts`). Then `platformDb.user` is undefined and login looks like “Invalid login”. Restart the Next process after `prisma generate` / new models. Seed in a separate process was fine; the app process was stale.

**How to verify:** `http://localhost:3000/login?tenant=ahmad` → `owner@ahmad` / `dev-owner` → `/owner` shows Ahmad Stadium. Same cookie on `?tenant=sami` → `/login`. `owner@ahmad` on Sami → Invalid login. Logout → `/owner` redirects to login. Public form still loads without a cookie. `npm test` — 10 suites, 42 passed.

### In plain language

We planted three keys in the test lockbox. Ahmad’s owner key opens Ahmad’s door. It does not open Sami’s. A staff key exists for Ahmad but cannot approve bookings yet (there is still no approve button). The password is only for local development — it is not a mailbox and must not live in the browser.

---

## Chapter 31 — 2026-09-10 — SPEC-05 written (not started in code)

**When:** 2026-09-10

**What:** Numbered owner-approve slice: `slot_interests` → guard → domain (overlap + occupied on `resolveOfferedSlot`) → Zod → infra → `approveBooking` / `rejectBooking` (auth **before** `$transaction`) → public occupied → `/owner` pending inbox. No payment, no owner-created bookings, no waitlist UI.

**Why:** [SPEC-05](./specs/SPEC-05-owner-approve.md) implements [DR-002](./decisions/DR-002-core-data-model.md) §2.8 / §2.13 and BR-17–21 / BR-23–25. Pins: auto-reject = overlapping PENDING on the same pitch; interest `during` = the **approved** window; manual reject writes no interest; same `bookings.approve` flag for reject; Venue still does not import Booking.

**Files:** `docs/specs/SPEC-05-owner-approve.md`; `docs/README.md`.

**How to verify:** Read the spec. Confirm or correct the pins. Then OK step 1.

### In plain language

The next chapter of the product: the owner looks at a list of “please can I have this hour?” and taps yes or no. Yes makes it a real game (the database will not allow two games on one pitch at once). Everyone else who asked for that hour is automatically told no, and we remember they were interested. The public page stops offering a Request button for that hour. We have not built that yet — only the instruction sheet.

---

## Chapter 32 — 2026-09-10 — SPEC-05 step 1: SlotInterest schema

**When:** 2026-09-10

**What:** `SlotInterest` table: `tenantId` required, `pitchId`, `during` tstzrange (Prisma `Unsupported`, same as Booking), `personId`, `createdAt`. Empty this step. No unique on (pitch, during, person) — DR-002 does not require one.

**Why:** SPEC-05 step 1 / DR-002 §2.13. Approval later writes “who wanted this filled hour” as a window, not a rejected booking id. Guard is step 2.

**Files:** `src/prisma/schema.prisma`; `src/prisma/migrations/20260910041000_slot_interest/migration.sql`.

**Relation:** Booking module not touched. `TENANT_SCOPED_MODELS` not updated yet.

**How to verify:** Prisma Studio → `SlotInterest` (empty). Columns include `tenantId` and `during`. `npx prisma migrate status --config prisma7.config.ts` up to date after generate/deploy.

### In plain language

A spare drawer for “this person wanted that hour.” We built the drawer. We do not put names in it until the owner taps Approve.

---

## Chapter 33 — 2026-09-10 — SPEC-05 step 2: SlotInterest on the tenant guard

**When:** 2026-09-10

**What:** `SlotInterest` added to `TENANT_SCOPED_MODELS`. Prisma `findMany`/`create` on that model get `tenantId` injected. Raw `$executeRaw` for `during` still stamps `tenantId` from ALS (same as Booking insert) — the extension does not wrap raw SQL.

**Why:** SPEC-05 step 2 / DR-001 §1. Interests are Ahmad’s or Sami’s, never mixed.

**Files:** `src/lib/db.ts`.

**Relation:** No Booking use case yet. Callers still must not pass `tenantId`.

**How to verify:** Read the set in `src/lib/db.ts`. No Studio change (table already empty).

### In plain language

The bouncer now knows the waitlist drawer. When we later list interests, we only get this stadium’s names, without writing `tenantId` in the kitchen.

---

## Chapter 34 — 2026-09-10 — SPEC-05 step 3: approve domain rules

**When:** 2026-09-10

**What:** `resolveOfferedSlot` takes `occupied` (default `[]`); covering APPROVED range → `"Slot is taken"`. `overlappingPendingIds` = same pitch + half-open overlap. `assertPendingForDecision`: only PENDING may be approved/rejected. No Prisma in domain.

**Why:** SPEC-05 step 3 / BR-18, BR-20 pin, BR-23 via occupied. Public request still compiles: occupied omitted → empty.

**Files:** `src/modules/booking/domain/offered-slot.ts`, `decision.ts`; `test/modules/booking/domain/`.

**Relation:** Venue still does not import Booking. Application/UI not this step.

**How to verify:** `npm test` — new cases: adjacent 16:00–17:00 / 17:00–18:00 not overlapping; loser id returned; occupied slot throws; APPROVED status throws.

### In plain language

Three paper rules, no database. You can only say yes/no to a *pending* request. If two people asked for the same hour on the same pitch, approving one names the other as a loser. If that hour is already a real game, a new public request must fail.

---

## Chapter 35 — 2026-09-10 — SPEC-05 step 4: Zod booking decision

**When:** 2026-09-10

**What:** `parseBookingDecision` — `bookingId` only, `strictObject`, trim + min 1. No `tenant` / `tenantId` in the schema.

**Why:** SPEC-05 step 4. Same two-gate idea: Zod = form shape; the use case (step 6) = membership + PENDING + exclusion.

**Files:** `src/modules/booking/schemas/booking-decision.ts`; `test/modules/booking/schemas/booking-decision.test.ts`.

**How to verify:** `npm test` — missing id, extra field, happy `bk_1`.

### In plain language

The bouncer for the Approve/Reject button: you must send exactly one booking id, nothing extra. The hidden stadium slug on the form is only so local `?tenant=` survives a redirect. It is not how we pick the stadium.

---

## Chapter 36 — 2026-09-10 — SPEC-05 step 5: Booking infrastructure

**When:** 2026-09-10

**What:** Raw SQL for `during` (`listPendingBookings`, `findBookingForDecision`, `listApprovedRanges`, `insertSlotInterest`). Prisma `updateMany` for PENDING → APPROVED/REJECTED (Client has update, not create, because Unsupported). Requester `personId` via participant find. Seed deletes `SlotInterest` before Person/Pitch.

**Why:** SPEC-05 step 5. Prisma 7 generated Booking/SlotInterest have no `create` (no `during` on the Client model). `$executeRaw` is not stamped by the extension — ALS `tenantId` in SQL, same as SPEC-03 insert.

**Files:** `src/modules/booking/infrastructure/bookings.ts`; `src/prisma/seed.ts`.

**Relation:** No use case yet. Pages unchanged.

**How to verify:** Code review. Click-proof waits for step 6–8 + a running `prisma dev`.

### In plain language

The warehouse for approve: list who asked, load one request’s hour, mark it approved or rejected, and drop a waitlist row. We still do not have the kitchen (use case) or the waiter (buttons).

---

## Chapter 37 — 2026-09-10 — SPEC-05 step 6: approve / reject use cases

**When:** 2026-09-10

**What:** `listPendingRequests` (membership required, no `can`). `approveBooking` / `rejectBooking`: `getCurrentMembership` + `can(..., bookings.approve)` **outside** `$transaction`; then load → PENDING gate → status write. Approve auto-rejects overlapping PENDING on that pitch and inserts `slot_interests` for the **approved** window. Exclusion `23P01` / `Booking_approved_during_excl` → `"Slot no longer available"` and the whole tx rolls back.

**Why:** SPEC-05 step 6 / BR-17–21, BR-24, DR-003 (Booking asks Access; Access does not import Booking). Authorize before `$transaction` so session/User (`platformDb`) never run inside `tx` ([guides/prisma-transaction-tenant-guard.md](./guides/prisma-transaction-tenant-guard.md)).

**Files:** `src/modules/booking/application/list-pending-requests.ts`, `approve-booking.ts`, `reject-booking.ts`.

**Relation:** No Server Action / `/owner` buttons yet (step 8). Public occupied is step 7. Venue still does not import Booking.

**How to verify:** Code review now. Click-proof: step 8 + two PENDING on the same Ahmad hour → owner approve → one APPROVED, loser REJECTED + one interest; `staff@ahmad` gets `"Not allowed"`.

### In plain language

The kitchen: a logged-in person can see the request list. Only the owner (or staff with the flag) can say yes or no. Yes locks the hour, turns overlapping asks into no, and writes a waitlist note. If two owners hit Approve at the same second, Postgres refuses the second and nothing half-saves.

---

## Chapter 38 — 2026-09-10 — SPEC-05 step 7: occupied on the public day

**When:** 2026-09-10

**What:** `getDayAvailability` takes `occupied?: { pitchId, start, end }[]` and passes per-pitch ranges into `generateSlotsForDay`. `page.tsx` loads APPROVED via Booking `listApprovedOccupied` (no Prisma on the page) and **omits** the Request form when `available === false` (time still shown). `requestPublicSlot` loads APPROVED for that pitch **inside** the existing `$transaction` and passes them as `occupied` to `resolveOfferedSlot`.

**Why:** SPEC-05 step 7 / BR-23. Occupied = APPROVED only. Venue still does not import Booking — the page (and Booking’s own request use case) assemble the ranges.

**Files:** `src/modules/venue/application/get-day-availability.ts`, `src/modules/booking/application/list-approved-occupied.ts`, `request-public-slot.ts`, `src/app/page.tsx`.

**Relation:** No `/owner` buttons (step 8). PENDING does not occupy.

**How to verify:** After step 8, approve 16:00 on Ahmad → `/?tenant=ahmad` that day lists 16:00 with no Request; posting the old hidden start/end fails. Until then: empty APPROVED → every offered hour still has Request (same as before).

### In plain language

The public clock still shows every hour. If that hour is already a confirmed game, there is no Request button, and sneaking the old form values into a POST also fails. The slot engine still does not know what a booking is — it only receives “this pitch is busy from A to B.”

---

## Chapter 39 — 2026-09-10 — Prisma 7 create types vs tenant stamp

**When:** 2026-09-10

**What:** `insertRequesterParticipant` still omits `tenantId` (guard stamps it). Prisma 7 `create` `data` is an Exact XOR: scalar FKs → UncheckedCreateInput (requires `tenantId`); nested `connect` → CreateInput (requires `tenant`). `$extends` does not rewrite those types. Assert the payload as the create `data` type.

**Why:** DR-001 — callers must not pass `tenantId`. Passing it would silence the error but hide whether the guard is doing its job.

**Files:** `src/modules/booking/infrastructure/bookings.ts`

**How to verify:** lints on `bookings.ts` — no `tenantId` missing error.

### In plain language

TypeScript wants us to write the stadium id on the participant row. The bouncer is supposed to write it for us. We keep omitting it and tell TypeScript “the bouncer will fill this in.”

---

## Chapter 40 — 2026-09-10 — SPEC-05 step 8: /owner pending inbox

**When:** 2026-09-10

**What:** `/owner` lists PENDING oldest first (pitch, Asia/Beirut time, requester name + phone, requested at). Approve / Reject are `<form action={Server Action}>`. `can(..., bookings.approve)` false → list, no buttons. Actions: Zod `bookingId` → `approveBooking` / `rejectBooking`; `redirect` outside try/catch to `/owner?tenant=`. Failure → `?error=1`.

**Why:** SPEC-05 step 8 / BR-17, BR-97. Next 16 local docs: [`forms.md`](../../node_modules/next/dist/docs/01-app/02-guides/forms.md) — FormData on `action`. [`redirect`](../../node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md) outside try/catch.

**Files:** `src/app/owner/page.tsx`, `src/app/owner/actions.ts`.

**Relation:** No Prisma / no `tenantId` on the page. Access still does not import Booking. Hidden `tenant` is only for `?tenant=` after POST.

**How to verify:** One `next dev` only (do not start a second — Next already on PID shown in the lock). `prisma dev` must be listening on `DATABASE_URL` (51214). `http://localhost:3000/login?tenant=ahmad` → `owner@ahmad` / `dev-owner` → Approve. `staff@ahmad` sees the row, no buttons. `?tenant=sami` `/owner` does not list Ahmad’s PENDING.

**Gotcha:** `npm run dev --port 3001` is parsed by npm as a project folder. Extra port is `npm run dev -- -p 3001`. `Server has closed the connection` on `tenant.findUnique` is the local Prisma Postgres proxy, not Next — restart `npx prisma dev`, then kill the stale Next PID and start a single `npm run dev`.

### In plain language

The owner’s inbox is on the same locked page as logout. Each ask is a line with Approve and Reject. Staff can look but get no buttons. The kitchen we already wrote does the real yes/no.

---

## Chapter 41 — 2026-09-10 — SPEC-05 click-proof

**When:** 2026-09-10

**What:** On the running app: two public PENDINGs, then `submitApproveBooking` for `19848641-4b37-43d5-909d-de1881cdc03d` (`Booking approved` in next-dev). Public day reload 200. Second session login after logout.

**Why:** SPEC-05 whole-slice acceptance, step 8 definition of done.

**Files:** none (no code change).

**Relation:** Closes the approve UI slice. Payment is next (SPEC not started).

**How to verify:** Studio: that id APPROVED; overlapping leftover PENDING REJECTED + one `slot_interests` if they shared the hour.

### In plain language

Ahmad’s owner tapped Approve in the browser and the kitchen ran. The slice is done.

---

## Chapter 42 — 2026-09-11 — Cursor/VS Code debugger

**When:** 2026-09-11

**What:** Replaced the dummy `.vscode/launch.json` (it launched `src/proxy.ts` as a Node script, so breakpoints never bound) with Next.js 16 debug configs: server-side (`next dev --inspect`), Chrome/Edge client, full stack, attach on 9229, and Jest. Workspace settings let breakpoints bind even when Turbopack source maps are messy. `npm run dev:debug` is the same inspect flag from a terminal.

**Why:** Next 16 local docs: `next/dist/docs` plus [Debugging](https://nextjs.org/docs/app/guides/debugging) — `npm run dev -- --inspect` is the supported way to inspect only the process that runs app code (not every child). Not a SPEC slice.

**Files:** `.vscode/launch.json`, `.vscode/settings.json`, `package.json` (`dev:debug`).

**Relation:** Tooling only. Does not import any module. Stop the existing `npm run dev` before F5 or port 3000 / the inspect port will collide.

**How to verify:** Stop the current `npm run dev`. Debug view → **Next.js: debug server-side** → F5. Click a gutter breakpoint in a Server Action or `src/modules/**/domain/*.ts`, hit that path in the browser (`/?tenant=ahmad`). Debugger must pause on that line. Jest: open a `test/**/*.test.ts` file → **Jest: current file** → F5.

### In plain language

Click in the left margin, press F5, use the app as usual. When that line runs, Cursor stops so you can see variables. The old debug button was starting the wrong file, which is why it never stopped.

---

## Chapter 43 — 2026-09-11 — SPEC-06 written (not started in code)

**When:** 2026-09-11

**What:** Merged `feature/spec-05-owner-approve` into `main` (fast-forward). Branched `feature/spec-06-collect-payment`. Wrote numbered collect-on-booking slice: Payment + tenders + append-only rate + ledger IN in the same `$transaction`. No per-player split, no expenses, no dashboard UI.

**Why:** [SPEC-06](./specs/SPEC-06-collect-payment.md) implements [DR-002](./decisions/DR-002-core-data-model.md) §2.14–2.21. Booking asks Payment; Payment writes Ledger; Payment never imports Booking. Q-2 pinned: `"payments.collect"` default deny for staff.

**Files:** `docs/specs/SPEC-06-collect-payment.md`; `docs/README.md`.

**Relation:** No Payment/Ledger folders yet (step 1 is schema). Access still only has `"bookings.approve"` until step 3.

**How to verify:** Read the spec. Confirm or correct the pins (partial, overpay, OWNER-only rate, no `booking_id`). Then OK step 1.

### In plain language

The owner can already lock an hour. Next we let him take cash for that hour: dollars, pounds, or both, at a rate he types. The notebook of “what the business took” is written in the same moment as the payment, so the two can never disagree. We have not built that yet — only the instruction sheet.

---

## Chapter 44 — 2026-09-11 — SPEC-06 step 1: Payment + ledger schema

**When:** 2026-09-11

**What:** Four tenant-owned tables: `ExchangeRate`, `Payment`, `PaymentTender`, `LedgerEntry`. Enums `PaymentSourceType` (`BOOKING` only), `Currency`, `LedgerDirection` (`IN | OUT`). No `booking_id` on Payment. Tender `amount` is `DECIMAL(18,2)` (domain will enforce USD cents vs integer LBP). Guard not updated (step 2). No Payment/Ledger modules.

**Why:** SPEC-06 step 1 / DR-002 §2.14–2.21. Polymorphic `sourceType + sourceId` keeps Payment closed when Expense/Shop arrive. `tenant_id` on the child tender table (DR-001). Prisma 7: `Decimal` + `@db.Decimal(p, s)` ([same as booking `priceUsd`](https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/models)). No `Unsupported` — Client `create` should exist for these models.

**Files:** `src/prisma/schema.prisma`; `src/prisma/migrations/20260911040000_collect_payment/migration.sql`.

**Relation:** Tenant gains reverse lists. Payment has tenders. Ledger has **no** FK to Payment or Booking. Booking model unchanged (no payment relation). `TENANT_SCOPED_MODELS` still omits these (step 2).

**How to verify:** Prisma Studio — four empty tables; Payment has `sourceId` text, no booking FK; `npx prisma migrate status --config prisma7.config.ts` → up to date.

```
npx prisma studio --config prisma7.config.ts
```

### In plain language

We added empty cash drawers: one for the exchange rate, one for “a payment happened,” one for the dollar/pound bits of that payment, and one for the notebook of money in/out. Nothing is collected yet. The payment row does not point at a booking column — it stores “this is for a booking” plus that booking’s id, so later a shop sale can use the same drawer without changing it.

---

## Chapter 45 — 2026-09-11 — SPEC-06 step 2: payment tables on the tenant guard

**When:** 2026-09-11

**What:** `ExchangeRate`, `Payment`, `PaymentTender`, `LedgerEntry` added to `TENANT_SCOPED_MODELS`. Prisma `findMany`/`create` on those models get `tenantId` injected. Callers still omit `tenantId`. No Payment/Ledger folders yet (step 3 is domain).

**Why:** SPEC-06 step 2 / DR-001 §1. Cash rows are Ahmad’s or Sami’s, never mixed. These models have normal `create` (no `Unsupported`), so the extension can stamp `data.tenantId` on Client create — unlike Booking inserts.

**Files:** `src/lib/db.ts`.

**Relation:** No app query against Payment yet. Proof that callers omit `tenantId` waits for step 5/6 repositories.

**How to verify:** Read the set in `src/lib/db.ts`. No Studio change (tables already empty).

### In plain language

The bouncer now knows the cash drawers. When we later list payments, we only get this stadium’s money, without writing `tenantId` in the kitchen.

---

## Chapter 46 — 2026-09-11 — SPEC-06 step 3: collect permission + money domain

**When:** 2026-09-11

**What:** `"payments.collect"` on Access `can`. LBP parse in `lib/money` (integer pounds). Payment `domain/collect.ts`: freeze tenders to USD (ROUND_HALF_UP), remaining, APPROVED-only, nothing-due. No Prisma, no `await`. Payment does not import Booking.

**Why:** SPEC-06 step 3 / DR-003 §5 (jsonb flags, BR-98), DR-002 §2.18, RULE-4/5. Q-2 default deny for staff.

**Files:** `src/modules/access/domain/can.ts`, `src/lib/money.ts`, `src/modules/payment/domain/collect.ts`, tests under `test/modules/access/domain/`, `test/lib/`, `test/modules/payment/domain/`.

**Relation:** No infrastructure yet (step 5). Zod is step 4. Access still does not import Payment.

**How to verify:** `npm test` — 69 passed (Access collect flags, 900000 LBP at 90000 → $10, 1 LBP → $0.00, PENDING cannot collect).

### In plain language

The owner is always allowed to take cash. Staff are not, unless we later tick a box. The kitchen can now turn “900,000 pounds at 90,000” into ten dollars without using a JavaScript number, and it refuses to collect on a request that is still waiting for yes.

---

## Chapter 47 — 2026-09-11 — SPEC-06 step 4: Zod collect + rate

**When:** 2026-09-11

**What:** Collect form: `bookingId` + optional USD (`30.00`) + optional LBP (integer). Empty fields omitted. At least one positive amount. Rate form: positive integer `lbpPerUsd`. Extra keys rejected. Hidden `tenant` is not in either schema.

**Why:** SPEC-06 step 4. Same two-gate idea as public request / login: Zod = form shape; domain (step 3) still decides remaining / rate / APPROVED.

**Files:** `src/modules/payment/schemas/collect-payment.ts`, `exchange-rate.ts`, `test/modules/payment/schemas/collect-payment.test.ts`.

**Relation:** Does not import domain `freezeTenders` (different question). Use cases (step 6) will parse first, then domain.

**How to verify:** `npm test` — 78 passed. `30` USD fails; `30.00` + `900000` passes; extra `tenant` fails.

### In plain language

The form is untrusted. We check the shape before the kitchen: a booking id, dollars that look like money, pounds as a whole number, or a rate the owner typed. A fake extra field is thrown away.

---

## Chapter 48 — 2026-09-11 — SPEC-06 step 5: Payment / Ledger infrastructure

**When:** 2026-09-11

**What:** Repositories: latest/insert exchange rate; insert payment + tenders; sum collected USD by source; insert ledger IN/OUT. Booking lists APPROVED (soonest first) and loads one booking’s status + price — no payment join. Callers omit `tenantId`; Prisma 7 create XOR asserted like participants (Chapter 39).

**Why:** SPEC-06 step 5 / DR-002 §2.14 (no booking_id), §2.21 (ledger in the same tx — use case will call both, step 6). Payment never lists bookings.

**Files:** `src/modules/payment/infrastructure/rates.ts`, `payments.ts`; `src/modules/ledger/infrastructure/entries.ts`; `src/modules/booking/infrastructure/bookings.ts`.

**Relation:** No `recordPayment` use case yet (step 6). Payment infra does not import Ledger or Booking. Access unchanged.

**How to verify:** Code review now. Click-proof waits for step 6–8. Studio: tables still empty until collect.

### In plain language

The cash drawers have clerks now: they can put a rate on the shelf, write a payment and its dollar/pound bits, add up what was already taken for a game, and write a notebook line. They still wait for the owner’s Collect tap before any of that runs.

---

## Chapter 49 — 2026-09-11 — SPEC-06 step 6: collect / rate use cases

**When:** 2026-09-11

**What:** `recordPayment` writes payment + tenders + ledger IN in the **given** `tx` (does not open its own). `collectBookingPayment` authorizes `payments.collect` **before** `$transaction`, then status/remaining/freeze, then `recordPayment`. `listDueBookings` attaches remaining via Payment sums (omit paid-off). `getCurrentRate` / `setExchangeRate` (OWNER only). No Server Actions yet (step 7).

**Why:** SPEC-06 step 6 / DR-001 §5 (starting use case owns tx) / DR-002 §2.21 (ledger same tx) / [guard guide](./guides/prisma-transaction-tenant-guard.md) (no `platformDb` inside tx).

**Files:** `src/modules/payment/application/record-payment.ts`, `get-current-rate.ts`, `set-exchange-rate.ts`; `src/modules/booking/application/collect-booking-payment.ts`, `list-due-bookings.ts`.

**Relation:** Booking asks Payment; Payment asks Ledger. Payment still does not import Booking. Pages unchanged.

**How to verify:** Code review now. Click-proof: step 7–8. `npm test` — 78 passed (no new unit tests this step).

### In plain language

The kitchen can now take cash: check the owner is allowed, lock the hour as approved, freeze pounds to dollars, write the payment and the notebook in one meeting so they cannot disagree. There is still no Collect button on the page.

---

## Chapter 50 — 2026-09-11 — SPEC-06 step 7: /owner collect + rate

**When:** 2026-09-11

**What:** `/owner` shows current rate (OWNER can set a new one). APPROVED-with-remaining list: two-tap Collect remaining USD, plus mixed USD/LBP fields. Staff see the list, no Collect, no Set rate. Actions: Zod → use case; `redirect` outside try/catch; `?error=1` on failure. Pending inbox unchanged.

**Why:** SPEC-06 step 7 / BR-36, BR-38/39. Next 16: FormData on `action`; `redirect` outside try/catch (same as SPEC-05).

**Files:** `src/app/owner/page.tsx`, `src/app/owner/actions.ts`.

**Relation:** No Prisma / no `tenantId` on the page. Payment still does not import Booking. Seed rate is step 8 — until then “No rate set”; USD collect still works.

**How to verify:** After step 8 (or Set rate 90000): approve a game → Collect remaining USD → Studio payment + tender + ledger IN. `staff@ahmad` sees due row, no buttons. `?tenant=sami` does not list Ahmad’s due booking.

### In plain language

The owner’s page now has a rate and a cash list. One button takes the rest in dollars. The mixed line is for $20 plus pounds. Staff can look; they cannot tap Collect.

---

## Chapter 51 — 2026-09-11 — SPEC-06 step 8: seed exchange rate

**When:** 2026-09-11

**What:** Seed Ahmad and Sami with `lbpPerUsd = 90000`. No seeded payments. Re-seed now also deletes ledger/tender/payment/rate rows before tenants.

**Why:** SPEC-06 step 8. LBP click-test needs a rate without a prior Set rate tap.

**Files:** `src/prisma/seed.ts`.

**Relation:** Does not import Payment module (seed uses unscoped `platformDb`, same as owners).

**How to verify:** `/owner?tenant=ahmad` after login shows 90000. Seed wipes bookings — request + approve again before Collect.

```
npm run db:seed
```

### In plain language

Both demo stadiums start with “90,000 pounds to the dollar” on the shelf, so the owner can take mixed cash on the first evening without typing a rate first.

---

## Correction — collect form threw on `"30"` (2026-09-11)

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

## Chapter 52 — 2026-09-11 — SPEC-06 click-proof

**When:** 2026-09-11

**What:** After the `"30"` form correction, Collect on `/owner` succeeded. The due row turned Collected (remaining ≤ 0, omitted from the unpaid list). Kitchen ran: payment + tender(s) + ledger IN in one `$transaction`.

**Why:** SPEC-06 whole-slice acceptance.

**Files:** none this chapter (code was the Correction above).

**Relation:** Closes collect. Payment still does not import Booking. Expenses next (ledger OUT).

**How to verify:** Studio: that booking’s payments, tenders with frozen `rateAtTime`, ledger IN matching USD equivalent. Second Collect on the same hour → `"Nothing due"`.

### In plain language

The owner took cash in the browser. The hour is paid. This slice is done.

---

## Note — overpay parked (2026-09-11)

**When:** After SPEC-06 click-proof, a second Collect with more than remaining.

**What:** Overpay is allowed (SPEC-06 / RULE-9 / RULE-10). Owner confirmed: skip warn / credit / cap for now.

**Why:** Do not invent a new money rule in chat. Park it; a later SPEC (or BRD change) if we ever cap or warn.

**Files:** `docs/specs/SPEC-06-collect-payment.md` (out of scope + pin). No code.

**How it connects:** Ledger still records cash in. Remaining may be negative. Second collect after `<= 0` still `"Nothing due"`.

**How to verify:** Read the SPEC pin. Do not build a warning until a numbered SPEC says so.

---

## Chapter 53 — 2026-09-11 — SPEC-07 written (not started in code)

**When:** 2026-09-11

**What:** Branched `feature/spec-07-expenses` from SPEC-06 HEAD. Wrote numbered record-expense slice: Expense row (no amount) + reuse `recordPayment` with `EXPENSE` + ledger OUT in the same `$transaction`. One submit = create and pay. No dashboard totals.

**Why:** [SPEC-07](./specs/SPEC-07-record-expense.md) implements [DR-002](./decisions/DR-002-core-data-model.md) §2.22–2.23. Expense asks Payment; Payment writes Ledger; Payment never imports Expense.

**Files:** `docs/specs/SPEC-07-record-expense.md`; `docs/README.md`.

**Relation:** Collect stays on `/owner`. Overpay warning stays parked.

**How to verify:** Read the spec. Confirm or correct the pins (no amount on expense, one submit pays it, `"expenses.record"` default deny, ledger `occurredAt` = expense date). Then OK step 1.

### In plain language

The next instruction sheet: the owner writes “electricity, this much cash, today” and the notebook records money going *out* the same way it recorded money coming *in*. We have not built that yet — only the sheet.

---

## Chapter 54 — 2026-09-11 — SPEC-07 step 1: Expense schema

**When:** 2026-09-11

**What:** `Expense` table: `tenantId`, `category` enum (ELECTRICITY / WATER / MAINTENANCE / SALARY / EQUIPMENT / OTHER), `description`, `occurredAt`, `createdAt`. **No amount columns.** `PaymentSourceType` gained `EXPENSE`. No FK from Payment to Expense. Guard not updated (step 2). No `expense/` module yet.

**Why:** SPEC-07 step 1 / DR-002 §2.22–2.23 / DR-001 (`tenant_id` on the table). Prisma 7: `DateTime` → `TIMESTAMP(3)`, `String` → `TEXT`, enums via `CREATE TYPE` / `ALTER TYPE ... ADD VALUE` (CLI `migrate diff --from-config-datasource --to-schema`). No `Unsupported` — Client `create` should exist (unlike Booking). Local DB is `template1` → handwritten SQL + `migrate deploy`.

**Files:** `src/prisma/schema.prisma`; `src/prisma/migrations/20260911050000_record_expense/migration.sql`.

**Relation:** Tenant gains `expenses`. Payment still has no expense relation. `TENANT_SCOPED_MODELS` still omits Expense (step 2). Collect code unchanged (`recordPayment` still types `sourceType: "BOOKING"` until later steps).

**How to verify:** Prisma Studio — `Expense` empty; Payment has `sourceId` text, no expense FK; `npx prisma migrate status --config prisma7.config.ts` → up to date.

```
npx prisma studio --config prisma7.config.ts
```

### In plain language

We added a drawer labelled “what I spent” (electricity, water, …) with a date and a note. There is no money column on that drawer — cash still goes through the payment drawer, with a new stamp that says “this was an expense.” The app cannot write expenses yet; the bouncer does not know this drawer.

---

## Chapter 55 — 2026-09-11 — SPEC-07 step 2: Expense on the tenant guard

**When:** 2026-09-11

**What:** `Expense` added to `TENANT_SCOPED_MODELS`. Prisma `findMany`/`create` on Expense get `tenantId` injected. Callers still omit `tenantId`. No `expense/` folders yet (step 3 is domain).

**Why:** SPEC-07 step 2 / DR-001 §1. Expense rows are Ahmad’s or Sami’s, never mixed. Expense has a normal Prisma `create` (no `Unsupported`), so the extension can stamp `data.tenantId` — same as Payment, unlike Booking inserts.

**Files:** `src/lib/db.ts`.

**Relation:** No app query against Expense yet. Proof that callers omit `tenantId` waits for step 5/6 repositories. Payment still does not import Expense.

**How to verify:** Read the set in `src/lib/db.ts`. No Studio change (table already empty). Prisma 7 extension is still `$allModels` + `$allOperations` (same comment in `db.ts`).

### In plain language

The bouncer now knows the “what I spent” drawer. When we later list expenses, we only get this stadium’s rows, without writing `tenantId` in the kitchen.

---

## Chapter 56 — 2026-09-11 — SPEC-07 step 3: record flag + expense date

**When:** 2026-09-11

**What:** `"expenses.record"` on Access `can` (`EXPENSES_RECORD`). Expense `domain/`: category const (no Prisma import), `occurredAtFromCivilDate` → 12:00 in the given zone via Intl offsets (not `Date#getHours`). No tender math here — Payment still owns freeze. No Zod yet (step 4).

**Why:** SPEC-07 step 3 / DR-003 §5 (jsonb flags, BR-98), DR-002 §2.22–2.23, SPEC-02 timezone idea without Expense importing Venue.

**Files:** `src/modules/access/domain/can.ts`; `src/modules/expense/domain/categories.ts`, `occurred-at.ts`; `test/modules/access/domain/can.test.ts`; `test/modules/expense/domain/occurred-at.test.ts`.

**Relation:** Access does not import Expense. Expense does not import Payment, Booking, or Venue. Pages unchanged.

**How to verify:** `npm test` — 15 suites / 84 passed. OWNER can record with `{}`; STAFF default cannot; Beirut July and January both noon on that civil day.

```
npm test
```

### In plain language

Staff cannot write an expense unless the owner later ticks a flag. The kitchen now knows how to turn “15 July” into a real clock time in Beirut (noon, including summer time) without asking the venue module.

---

## Chapter 57 — 2026-09-11 — SPEC-07 step 4: Zod record expense

**When:** 2026-09-11

**What:** `parseRecordExpense`: category enum, description 1–200, `occurredOn` `YYYY-MM-DD`, optional USD/LBP like collect (`"30"` → `"30.00"`). Hidden `tenant` rejected. Refine checks `isUsdString` / `isLbpString` before `parseUsd` / `parseLbp`. No use case yet (step 6).

**Why:** SPEC-07 step 4. Same two-gate idea as collect: Zod = form shape; domain still decides date instant / tenders / rate.

**Files:** `src/modules/expense/schemas/record-expense.ts`; `test/modules/expense/schemas/record-expense.test.ts`.

**Relation:** Schema lives in Expense, not Payment. Reuses `src/lib/money.ts`. Payment still does not import Expense. Pages unchanged.

**How to verify:** `npm test` — 16 suites / 90 passed.

```
npm test
```

### In plain language

The waiter for expenses now knows the ticket: what kind, a short note, a date, and at least some dollars or pounds. The kitchen still has not cooked it.

---

## Chapter 58 — 2026-09-11 — SPEC-07 step 5: Expense / Payment / Ledger infrastructure

**When:** 2026-09-11

**What:** Expense repositories: insert (no amount) + last 20 by `occurredAt` then `createdAt`. `recordPayment` accepts `sourceType` BOOKING | EXPENSE and optional `occurredAt`. `insertLedgerEntry` writes `occurredAt` when given; collect still omits it (DB `now()`). Reuse `sumCollectedUsdBySourceIds` for expense ids. No Server Actions yet (step 6).

**Why:** SPEC-07 step 5 / DR-002 §2.14, §2.22 / Chapter 39 (Prisma 7 create XOR — omit `tenantId`, assert as create `data`). Local Prisma 7 Client: `create` / `findMany` + `orderBy` / `take` ([model queries](https://www.prisma.io/docs/orm/v7/prisma-client/queries/crud)).

**Files:** `src/modules/expense/infrastructure/expenses.ts`; `src/modules/payment/application/record-payment.ts`; `src/modules/payment/infrastructure/payments.ts`; `src/modules/ledger/infrastructure/entries.ts`.

**Relation:** Expense infra does not import Payment. Payment / Ledger do not import Expense. Pages unchanged.

**How to verify:** Code review now. Studio can still insert Expense by hand. Click-proof: step 7–8. `npm test` — 90 passed (no new unit tests this step).

### In plain language

The drawers can store an expense note and list the last twenty. Cash-out can now be stamped “this was an expense” and dated the day the owner typed, not only “right now.” There is still no Record button on the page.

---

## Chapter 59 — 2026-09-11 — SPEC-07 step 6: record / list expense use cases

**When:** 2026-09-11

**What:** `recordExpense` authorizes `"expenses.record"` **before** `$transaction`, then date → insert Expense → freeze tenders → `recordPayment(OUT, EXPENSE, occurredAt)` in the **same** `tx`. `listRecentExpenses` requires membership only; attaches USD via Payment sums (no payment join). No Server Actions yet (step 7).

**Why:** SPEC-07 step 6 / DR-001 §5 (starting use case owns tx) / DR-002 §2.21–2.22 / [guard guide](./guides/prisma-transaction-tenant-guard.md) (no `platformDb` inside tx). Prisma 7 interactive `$transaction` ([Client `$transaction`](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions)).

**Files:** `src/modules/expense/application/record-expense.ts`, `list-recent-expenses.ts`.

**Relation:** Expense asks Payment; Payment asks Ledger. Payment still does not import Expense. Pages unchanged.

**How to verify:** Code review now. Click-proof: step 7–8. `npm test` — 90 passed (no new unit tests this step).

### In plain language

The kitchen can now write “electricity, this cash, that day”: check the owner is allowed, freeze pounds to dollars, write the note and the notebook out-row in one meeting. There is still no Record button on the page.

---

## Chapter 60 — 2026-09-11 — SPEC-07 step 7: /owner expense form

**When:** 2026-09-11

**What:** `/owner` Expenses: OWNER (and staff with the flag) get category, description, date (default today Beirut), USD + LBP, Record. Recent 20 listed for any logged-in member. Staff seed: list, no form. Pending / rate / collect unchanged. Action: Zod → use case; `redirect` outside try/catch; `?error=1` on failure.

**Why:** SPEC-07 step 7 / BR-50–52. Next 16 local docs: [`forms.md`](../../node_modules/next/dist/docs/01-app/02-guides/forms.md) — FormData on `action`. [`redirect`](../../node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md) outside try/catch (same as SPEC-05/06).

**Files:** `src/app/owner/page.tsx`, `src/app/owner/actions.ts`.

**Relation:** No Prisma / no `tenantId` on the page. Payment still does not import Expense. Seed wipe of Expense is step 8.

**How to verify:** `owner@ahmad` / `dev-owner` → Record electricity + `1800000` LBP → list shows ~$20.00. Studio: expense + payment EXPENSE + LBP tender + ledger OUT. `staff@ahmad` sees list, no Record. No browser tools in this session — click-proof is yours.

```
npm test
```

### In plain language

The owner’s page now has a spend form. Electricity + pounds today, tap Record, it should show on the list. Staff can look; they cannot tap Record.

---

## Chapter 61 — 2026-09-11 — SPEC-07 step 8: seed wipe Expense

**When:** 2026-09-11

**What:** Re-seed deletes Expense rows (after payments, before rates). Does **not** insert sample expenses. Rate 90000 unchanged.

**Why:** SPEC-07 step 8. Click-proof records a real expense; seed must not leave orphan money rows when tenants are wiped.

**Files:** `src/prisma/seed.ts`.

**Relation:** Seed still uses unscoped `platformDb`. Does not import Expense module.

**How to verify:** `/owner?tenant=ahmad` after login shows 90000 and “No expenses yet.” Seed wipes bookings — request + approve again before Collect.

```
npm run db:seed
```

### In plain language

A fresh seed still puts 90,000 on the shelf and leaves the spend list empty, so you can type the first electricity bill yourself.

---

## Correction — `/owner` `tx.expense` undefined (2026-09-11)

**When:** Click-proof SPEC-07, load `/owner`.

**What:** `listRecentExpenses` threw `Cannot read properties of undefined (reading 'findMany')` on `tx.expense`. The findMany call was fine.

**Why:** Same gotcha as Chapter 2 / 867. `prisma-base.ts` keeps one PrismaClient on `globalThis`. `next dev` started before `prisma generate` for Expense, so the cached client had no `expense` delegate. TypeScript used the new types; runtime was the old instance.

**Files:** `src/lib/prisma-base.ts` — if the cached client has no `expense.findMany`, disconnect and create a new one.

**How it connects:** Expense infra is unchanged. Restart `npm run dev` if HMR still holds an old `$extends` wrapper.

**How to verify:** Reload `/owner?tenant=ahmad` — “No expenses yet.”, not a TypeError.

---

## Chapter 62 — 2026-09-11 — SPEC-07 click-proof

**When:** 2026-09-11

**What:** After restarting `next dev`, Record on `/owner` succeeded (`Expense recorded cmtwa1lml000014l2y0jzpenh`, then `cmtwa2a30000414l2q36bgadm`). Kitchen ran: expense + payment `EXPENSE` + tender(s) + ledger OUT in one `$transaction`.

**Why:** SPEC-07 whole-slice acceptance.

**Files:** none this chapter (code was the Correction above).

**Relation:** Closes record-expense. Payment still does not import Expense. Dashboard next (SUM ledger).

**How to verify:** Studio: those expense ids, matching payments, tenders with frozen `rateAtTime`, ledger OUT equal to USD equivalent.

### In plain language

The owner typed a spend in the browser. Money left the notebook. This slice is done.

---

## Chapter 63 — 2026-09-11 — SPEC-08 written (not started in code)

**When:** 2026-09-11

**What:** Fast-forward merged `feature/spec-07-expenses` into local `main` (`6b59c8c` → `7af1854`). Branched `feature/spec-08-financial-dashboard`. Wrote numbered ledger-summary slice: IN / OUT / net for a civil-date period from `ledger_entries` only. Optional LBP display is a view transform. No Payment/Expense/Booking joins. No `/dashboard` route.

**Why:** [SPEC-08](./specs/SPEC-08-financial-dashboard.md) implements [DR-002](./decisions/DR-002-core-data-model.md) §2.20–2.21 / BR-54–56, BR-59. BR-57 (games/pitch) and BR-58 (outstanding as a fourth number) stay out — due list already exists.

**Files:** `docs/specs/SPEC-08-financial-dashboard.md`; `docs/README.md`.

**Relation:** Collect and expenses stay on `/owner`. Overpay warning stays parked. Did not push.

**How to verify:** Read the spec. Confirm or correct the pins (`"reports.view"` default deny, GET period, LBP never stored, hide the block for staff). Then OK step 1.

### In plain language

The next instruction sheet: three numbers at the top of the owner page — cash in, money out, what’s left — for this month or any dates he picks. The notebook is already being written; this sheet is only how to add those numbers up. We had not built that yet when this chapter was written.

---

## Chapter 64 — 2026-09-11 — SPEC-08 step 1: ledger period index

**When:** 2026-09-11

**What:** Additive `@@index([tenantId, occurredAt])` on `LedgerEntry`. No new columns, FKs, or tables. Existing `tenantId` index kept. Handwritten SQL + `migrate deploy` (`template1`).

**Why:** SPEC-08 step 1 / BR-59 / DR-002 §2.20. Period SUM filters `occurredAt`; a composite index keeps that query cheap on the droplet. Prisma 7 `migrate diff --from-config-datasource --to-schema` produced `CREATE INDEX "LedgerEntry_tenantId_occurredAt_idx"`.

**Files:** `src/prisma/schema.prisma`; `src/prisma/migrations/20260911060000_ledger_period_index/migration.sql`.

**Relation:** Guard still has `LedgerEntry` (SPEC-06). No `ledger/domain` yet (step 2). No SUM UI.

**How to verify:** `npx prisma migrate status --config prisma7.config.ts` → up to date. Prisma Studio — `LedgerEntry` columns unchanged.

```
npx prisma migrate status --config prisma7.config.ts
```

### In plain language

We told the database: when you add up money for a date range at one stadium, look at tenant plus when it happened. Nothing new is stored. The owner still cannot see the three numbers on the page.

---

## Chapter 65 — 2026-09-11 — SPEC-08 step 2: reports.view + period domain

**When:** 2026-09-11

**What:** `"reports.view"` (`REPORTS_VIEW`) on `can()`. Ledger domain: civil From/To → `[start, end)` at Beirut midnight; current calendar month; `netUsd`; LBP display multiply ROUND_HALF_UP to integer pounds. No Prisma. No Expense/Venue/Payment imports.

**Why:** SPEC-08 step 2 / DR-003 (OWNER always; STAFF default deny) / DR-002 §2.20–2.21 (period on `occurredAt`; LBP never stored). Inclusive start / exclusive next-day midnight so a July month does not pick up 1 Aug 00:00 Beirut.

**Files:** `src/modules/access/domain/can.ts`; `src/modules/ledger/domain/period.ts`; `src/modules/ledger/domain/totals.ts`; `test/modules/access/domain/can.test.ts`; `test/modules/ledger/domain/period.test.ts`; `test/modules/ledger/domain/totals.test.ts`.

**Relation:** Index exists (step 1). No Zod query yet (step 3). `/owner` still has no summary block.

**How to verify:** `npm test` — 18 suites / 103 tests. Summer July 2026 midnight Beirut; winter one-day range; `20.00 × 90000` → `1800000`; STAFF without the flag cannot view reports.

### In plain language

Staff still cannot see the money page unless we later tick a box. The rules for “this month in Beirut” and “in minus out” now exist as plain functions. The screen still does not add anything up.

---

## Chapter 66 — 2026-09-11 — SPEC-08 step 3: Zod period query

**When:** 2026-09-11

**What:** GET query schema: optional `from`/`to` (`YYYY-MM-DD`, real calendar days, `from <= to`, both together or both omitted), `view` `usd`|`lbp` (default usd), `displayRate` empty→omit else positive LBP integer. `strictObject` — `tenant` is not in this schema. `parseLbp` only after `isLbpString`.

**Why:** SPEC-08 step 3. Page will fall back to the default month on Zod failure (`?error=1` stays a write-failure flag).

**Files:** `src/modules/ledger/schemas/period-query.ts`; `test/modules/ledger/schemas/period-query.test.ts`.

**Relation:** Domain already owns midnight bounds. Infra SUM is step 4. Page still does not read these params.

**How to verify:** `npm test` — 19 suites / 110 tests. Happy July 2026; `from` after `to` throws; `2026-02-31` throws; `view=lbp` + `displayRate=90000`; empty rate omitted; extra `tenant` rejected.

### In plain language

The date form on the owner page now has a checklist for “this is a real from/to, and LBP view has a whole-pound rate.” Nothing is summed yet.

---

## Chapter 67 — 2026-09-11 — SPEC-08 step 4: SUM ledger by direction

**When:** 2026-09-11

**What:** `sumAmountUsdByDirection(tx, start, end)` — Prisma 7 `groupBy` `by: ["direction"]`, `_sum.amountUsd`, `occurredAt` in `[start, end)`. Missing direction → `0.00`. Convert Prisma Decimal via `.toString()` into decimal.js. No `tenantId` argument. No `sourceType` filter.

**Why:** SPEC-08 step 4 / DR-002 §2.20. Guard already injects `tenantId` on `groupBy` (`src/lib/db.ts`). Local generated client: `LedgerEntry.groupBy` + `_sum` (`src/app/generated/prisma/models/LedgerEntry.ts`).

**Files:** `src/modules/ledger/infrastructure/entries.ts`.

**Relation:** Insert path unchanged. Use case (step 5) will call this. Page still has no summary.

**How to verify:** Prisma Studio — pick two `LedgerEntry` rows (IN and OUT) in a known range; the function should return those sums for that tenant only. `npm test` still 19 / 110.

### In plain language

The notebook can now be asked: “how much came in and how much went out between these two instants?” The owner page still does not ask that question.

---

## Chapter 68 — 2026-09-11 — SPEC-08 step 5: summarizeLedgerPeriod

**When:** 2026-09-11

**What:** `summarizeLedgerPeriod({ from?, to? })` — membership + `"reports.view"` before any query; missing dates → current Beirut month; domain bounds; infra SUM; `netUsd`. Returns `{ inUsd, outUsd, netUsd, from, to }`. No `$transaction`. No Payment import (rate stays on the page).

**Why:** SPEC-08 step 5 / DR-003 (`can` before work) / DR-002 §2.20 (ledger is the read). Staff seed cannot (flag omitted).

**Files:** `src/modules/ledger/application/summarize-ledger-period.ts`.

**Relation:** `/owner` still has no summary block (step 6). Collect/expense unchanged.

**How to verify:** `npm test` — 19 / 110. Owner path is click-proof in step 6; staff without the flag get `"Not allowed"` if the use case is called.

### In plain language

The kitchen can now add up the notebook for a month. The owner page still does not show those three numbers.

---

## Chapter 69 — 2026-09-11 — SPEC-08 step 6: /owner This period

**When:** 2026-09-11

**What:** `/owner` shows In / Out / Difference for the resolved period (default current Beirut month). GET form: From, To, View USD/LBP, optional display rate, hidden `tenant`. Zod failure → default month + USD (not `?error=1`). LBP is `usdToDisplayLbp` using typed rate else current stored rate. Staff without `"reports.view"`: block omitted. No Prisma / no `tenantId` on the page. No Server Action.

**Why:** SPEC-08 step 6 / BR-54–56. Next 16 `searchParams` is a Promise (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`). Native `<form method="get" action="/owner">`.

**Files:** `src/app/owner/page.tsx`.

**Relation:** Collect / expenses / pending unchanged. Ledger still does not import Payment (page already loads rate).

**How to verify:** Log in `owner@ahmad` → `/owner?tenant=ahmad`. Top of page: This period with In/Out/Difference. Change dates; empty day → `$0.00`. View LBP at 90000. `staff@ahmad`: no This period. `npm test` — 19 / 110.

### In plain language

The owner page now shows three numbers: money in, money out, and the difference, for this month or any dates he picks. Staff do not see that block.

---

## Chapter 70 — 2026-09-11 — SPEC-08 click-proof

**When:** 2026-09-11

**What:** Owner confirmed This period on `/owner`: IN after collect (`Payment collected cmtwar7f2000f14l2gmks690g`), OUT after expense (`Expense recorded cmtwaqfcp000814l2afdyd4ej`), empty range zeros, LBP view, staff hide the block, collect/record still work.

**Why:** SPEC-08 whole-slice acceptance / DR-002 §2.20 (dashboard reads ledger only).

**Files:** none this chapter (code was step 6). SPEC acceptance checkmarks in [SPEC-08](./specs/SPEC-08-financial-dashboard.md).

**Relation:** Closes the financial summary. Ledger still does not import Payment/Expense/Booking. Next is owner-created bookings / cancel. Overpay warning stays parked. BR-57 games/pitch and BR-58 outstanding-as-a-fourth-number stay out.

**How to verify:** `/owner?tenant=ahmad` as owner — three numbers; `staff@ahmad` — no This period.

### In plain language

The owner can see this month’s cash in, money out, and the difference without opening Studio. This slice is done.

---

## Chapter 71 — 2026-09-11 — SPEC-09 written (not started in code)

**When:** 2026-09-11

**What:** Fast-forward `main` already had SPEC-08 (`40e3ece`). Branched `feature/spec-09-owner-create-booking`. Wrote numbered phone-call slice: owner picks a free computed slot, name + phone, insert **APPROVED** `source = OWNER` immediately. Overlapping public PENDING rejected + interests (same as Approve). No cancel this slice.

**Why:** [SPEC-09](./specs/SPEC-09-owner-create-booking.md) implements BR-13 / BR-14 / RULE-3. Collect stays a second tap (due list). `"bookings.create"` default deny, not reused from `"bookings.approve"`.

**Files:** `docs/specs/SPEC-09-owner-create-booking.md`; `docs/README.md`.

**Relation:** Dashboard stays on `/owner`. Cancel / no-show / BR-11 edit stay out. Overpay warning parked.

**How to verify:** Read the spec. Confirm or correct the pins (name+phone required, APPROVED immediately, separate create flag, no collect in the same submit, cancel next). Then OK step 1.

### In plain language

The next instruction sheet: the owner is on the phone, taps a free hour, types who called, and the hour is taken — he does not approve himself. We have not built that yet — only the sheet.

---

## Chapter 72 — 2026-09-11 — SPEC-09 step 1: bookings.create flag

**When:** 2026-09-11

**What:** `"bookings.create"` (`BOOKINGS_CREATE`) on `can()`. OWNER always yes. STAFF default deny. `"bookings.approve": true` does **not** imply create.

**Why:** SPEC-09 step 1 / DR-003. Taking a phone-call booking is not the same permission as deciding a public request.

**Files:** `src/modules/access/domain/can.ts`; `test/modules/access/domain/can.test.ts`.

**Relation:** No Booking schema/UI yet (step 2 is Zod). Approve / collect / expense / reports flags unchanged.

**How to verify:** `npm test` — 19 suites / 114 tests.

### In plain language

Staff still cannot book a caller’s hour unless we later tick a box. The owner page still has no Book button.

---

## Chapter 73 — 2026-09-11 — SPEC-09 step 2: Zod owner Book form

**When:** 2026-09-11

**What:** `parseOwnerCreateBooking`: name, phone (8–15 digits after normalize), pitchId, UTC `start`/`end`. `strictObject` — no price, no `tenant`. Same phone helper as public request.

**Why:** SPEC-09 step 2. Price stays a Venue snapshot at insert time (DR-002 §2.18). Hidden tenant is not isolation.

**Files:** `src/modules/booking/schemas/owner-create-booking.ts`; `test/modules/booking/schemas/owner-create-booking.test.ts`.

**Relation:** Access flag exists (step 1). No APPROVED OWNER insert yet (step 3).

**How to verify:** `npm test` — 20 suites / 118 tests. Happy `03 123 456` → `03123456`; `priceUsd` extra key throws.

### In plain language

The Book form now has a checklist for “who called and which hour.” Nothing is written to the database yet.

---

## Chapter 74 — 2026-09-11 — SPEC-09 step 3: insert APPROVED OWNER

**When:** 2026-09-11

**What:** `insertApprovedOwnerBooking` — `$executeRaw` `tstzrange` `[)`, `status = APPROVED`, `source = OWNER`. `tenantId` from ALS (extension does not stamp raw SQL). Reuse `insertRequesterParticipant` (no new participant helper). No Payment import.

**Why:** SPEC-09 step 3 / DR-002 §2.8. Client has no `booking.create` (Unsupported `during`). Exclusion applies immediately because the row is APPROVED.

**Files:** `src/modules/booking/infrastructure/bookings.ts`.

**Relation:** Public PENDING insert unchanged. Use case (step 4) will call this inside `$transaction`. `/owner` still has no Book form.

**How to verify:** `npm test` still 20 / 118. Click-proof in step 5: Studio OWNER + APPROVED; second overlapping APPROVED → exclusion.

### In plain language

We can now write “this hour is taken, the owner booked it” into the database the same way we write a public request — except it is already confirmed. The owner page still cannot do that.

---

## Chapter 75 — 2026-09-11 — SPEC-09 step 4: createOwnerBooking

**When:** 2026-09-11

**What:** `createOwnerBooking` — `"bookings.create"` before `$transaction`; `resolveOfferedSlot` + find-or-create person; insert APPROVED OWNER + requester; reject overlapping PENDING + interests. Exclusion → `"Slot no longer available"`. No Payment. Extracted `rejectOverlappingPending` and `isExclusionViolation` so Approve uses the same kitchen.

**Why:** SPEC-09 step 4 / BR-14 / DR-002 §2.8 / SPEC-03 transaction guide (auth before tx).

**Files:** `src/modules/booking/application/create-owner-booking.ts`; `src/modules/booking/application/reject-overlapping-pending.ts`; `src/modules/booking/domain/exclusion.ts`; `src/modules/booking/application/approve-booking.ts`.

**Relation:** `/owner` still has no Book form (step 5). Collect stays a separate use case.

**How to verify:** `npm test` — 20 / 118. Staff seed cannot create (`"Not allowed"`). Click-proof in step 5.

### In plain language

The kitchen can now take a name, a phone, and a free hour and lock it as a confirmed game. The owner page still has no button that calls that kitchen.

---

## Chapter 76 — 2026-09-11 — SPEC-09 step 5: /owner Book a slot

**When:** 2026-09-11

**What:** `/owner` Book a slot if `"bookings.create"`: GET `bookOn` (default today Beirut) lists computed slots via `getDayAvailability` + `listApprovedOccupied`. Available hours: name + phone → `submitCreateOwnerBooking`. Taken hours: time only. Staff: no section. No Prisma / no `tenantId`. No cancel buttons.

**Why:** SPEC-09 step 5 / BR-13–14. Next 16: `searchParams` Promise (`page.js`); `<form action={Server Action}>` + `redirect` outside try/catch. Occupied is an argument — Venue does not import Booking.

**Files:** `src/app/owner/page.tsx`; `src/app/owner/actions.ts`.

**Relation:** Collect stays a second tap on Due bookings. This period / pending / expenses unchanged.

**How to verify:** `npm test` — 20 / 118. Log in `owner@ahmad` → Book a free hour; Studio APPROVED OWNER; public that hour occupied; `staff@ahmad` no Book form.

### In plain language

The owner can now tap a free hour, type who called, and the hour is taken. Staff do not see that form. Please try it in the browser.

---

## Chapter 77 — 2026-09-11 — SPEC-09 click-proof

**When:** 2026-09-11

**What:** Owner confirmed Book on `/owner` (`Owner booking created 6f408d92-77f1-4a76-9edb-5790b42d9eb6`, then `705347a0-4282-43ea-a19e-6a6a789c978b`). Collect on the second (`Payment collected cmtwz2de5000l14l268dj876t`). Hour occupied; staff have no Book form.

**Why:** SPEC-09 whole-slice acceptance / BR-13–14.

**Files:** none this chapter (code was step 5). SPEC acceptance checkmarks in [SPEC-09](./specs/SPEC-09-owner-create-booking.md).

**Relation:** Closes owner-create. Cancel next (BR-26). Overpay warning parked.

**How to verify:** Studio those booking ids: `APPROVED`, `OWNER`, requester participant.

### In plain language

The owner booked a caller from the phone in the browser. The hour is taken. This slice is done.

---

## Chapter 78 — 2026-09-11 — SPEC-10 written (not started in code)

**When:** 2026-09-11

**What:** Fast-forward `main` `40e3ece` → `5d5c77b` (SPEC-09). Branched `feature/spec-10-cancel-booking`. Wrote numbered cancel slice: owner (or `"bookings.cancel"`) flips **APPROVED → CANCELLED**. No refund / ledger write. No hours-before-kickoff check (BR-26). Waitlist UI / WhatsApp / player cancel / no-show / `tenant.settings` out. Confirmed list shows **all** APPROVED (including paid) so Cancel is reachable after Collect.

**Why:** [SPEC-10](./specs/SPEC-10-cancel-booking.md) implements BR-26 / RULE-1. Exclusion already ignores non-APPROVED (DR-002 §2.8). Ledger stays append-only — cash IN is not reversed this slice (DR-002 §2.21). `"bookings.cancel"` default deny, not reused from create/approve.

**Files:** `docs/specs/SPEC-10-cancel-booking.md`; `docs/README.md`.

**Relation:** Book / collect / This period stay as they are. Refunds and waitlist are later SPECs.

**How to verify:** Read the spec. Confirm or correct the pins (APPROVED only, no refund, paid games still listed so they can be cancelled, no player cancel). Then OK step 1.

### In plain language

The next instruction sheet: the owner taps Cancel on a confirmed game and the hour is free again. Money already collected is left as-is until a later refund slice. We have not built that yet — only the sheet.

---

## Chapter 79 — 2026-09-11 — SPEC-10 step 1: bookings.cancel flag

**When:** 2026-09-11

**What:** `"bookings.cancel"` (`BOOKINGS_CANCEL`) on `can()`. OWNER always yes. STAFF default deny. `"bookings.approve": true` does **not** imply cancel.

**Why:** SPEC-10 step 1 / DR-003. Cancelling a confirmed game is not the same permission as approving a public request or booking a caller.

**Files:** `src/modules/access/domain/can.ts`; `test/modules/access/domain/can.test.ts`.

**Relation:** No cancel domain/use case/UI yet (step 2 is `assertApprovedForCancel`). Create / approve / collect / expense / reports flags unchanged.

**How to verify:** `npm test` — 20 suites / 122 tests.

### In plain language

Staff still cannot cancel a confirmed game unless we later tick a box. The owner page still has no Cancel button.

---

## Chapter 80 — 2026-09-12 — SPEC-10 step 2: assertApprovedForCancel

**When:** 2026-09-12

**What:** `assertApprovedForCancel` — only `APPROVED` may be cancelled. PENDING / REJECTED / CANCELLED / NO_SHOW → `"Only a confirmed booking can be cancelled"`. Pure domain, no Prisma.

**Why:** SPEC-10 step 2 / BR-26. Same kitchen as `assertPendingForDecision`: status gate lives in `domain/`, not the query.

**Files:** `src/modules/booking/domain/decision.ts`; `test/modules/booking/domain/decision.test.ts`.

**Relation:** No DB update yet (step 3 is `setApprovedCancelled`). Access flag exists (step 1). `/owner` still has no Cancel.

**How to verify:** `npm test` — 20 suites / 127 tests.

### In plain language

The kitchen now knows “you can only cancel a confirmed game.” Nothing is written to the database yet.

---

## Chapter 81 — 2026-09-12 — SPEC-10 step 3: setApprovedCancelled

**When:** 2026-09-12

**What:** `setApprovedCancelled` — `booking.updateMany` where `id` + `status = APPROVED` → `CANCELLED`. `count !== 1` → `"Booking not found"`. No `tenantId` argument (guard). Not raw SQL: generated Client still has `updateMany` on Booking; `during` is Unsupported, status is not (same as `setPendingStatus`).

**Why:** SPEC-10 step 3 / DR-002 §2.8. CANCELLED drops out of exclusion without touching Payment or Ledger.

**Files:** `src/modules/booking/infrastructure/bookings.ts`.

**Relation:** Use case (step 4) will call this inside `$transaction`. `/owner` still has no Cancel.

**How to verify:** `npm test` — 20 / 127. Click-proof in step 5: Studio CANCELLED; a PENDING id fails.

### In plain language

We can now flip a confirmed row to cancelled in the database. The owner page still has no button that does that.

---

## Chapter 82 — 2026-09-12 — SPEC-10 step 4: cancelBooking

**When:** 2026-09-12

**What:** `cancelBooking` — `"bookings.cancel"` **before** `$transaction`; load via `findBookingForDecision`; `assertApprovedForCancel`; `setApprovedCancelled`. Log after commit. No Payment / Ledger / WhatsApp.

**Why:** SPEC-10 step 4 / BR-26 / SPEC-03 transaction guide (auth before tx; session is `platformDb`).

**Files:** `src/modules/booking/application/cancel-booking.ts`.

**Relation:** `/owner` still has no Cancel (step 5). Collect stays a separate use case.

**How to verify:** `npm test` — 20 / 127. Staff seed cannot cancel (`"Not allowed"`). Click-proof in step 5.

### In plain language

The kitchen can now cancel a confirmed game. The owner page still has no button that calls that kitchen.

---

## Chapter 83 — 2026-09-12 — SPEC-10 step 5: /owner Cancel

**When:** 2026-09-12

**What:** `/owner` **Confirmed bookings** = all APPROVED (paid included). Collect only if remaining > 0 and `payments.collect`. Cancel if `bookings.cancel`. Server Action: reuse `parseBookingDecision` → `cancelBooking` → `redirect` outside try/catch (Next redirect.md). Preserve `tenant` + `bookOn`. No Prisma / no `tenantId`. No waitlist / refund fields.

Local Next docs: `forms.md` — `<form action>` receives FormData; `redirect.md` — `redirect` outside try/catch.

**Why:** SPEC-10 step 5 / BR-26. Paid games must stay on the list so Cancel is reachable after Collect.

**Files:** `src/app/owner/page.tsx`; `src/app/owner/actions.ts`; `src/modules/booking/application/list-due-bookings.ts`.

**Relation:** Book / pending / expenses / This period unchanged. No cancel on PENDING.

**How to verify:** `npm test` — 20 / 127. Log in `owner@ahmad` → Cancel a confirmed hour; Studio CANCELLED; public that hour requestable; `staff@ahmad` no Cancel. Could not click in a browser from this session (no browser tools); GET `/owner?tenant=ahmad` compiled (307 to login).

### In plain language

The owner page now lists confirmed games, including paid ones, with a Cancel button. Staff do not see that button. Please try it in the browser.

---

## Chapter 84 — 2026-09-12 — SPEC-10 click-proof

**When:** 2026-09-12

**What:** Owner cancelled the paid phone-call booking (`Booking cancelled 705347a0-4282-43ea-a19e-6a6a789c978b`, previously collected `cmtwz2de5000l14l268dj876t`) then the unpaid one (`Booking cancelled 6f408d92-77f1-4a76-9edb-5790b42d9eb6`). No Payment/Ledger write on cancel. Staff have no Cancel button.

**Why:** SPEC-10 whole-slice acceptance / BR-26.

**Files:** none this chapter (code was step 5). SPEC acceptance checkmarks in [SPEC-10](./specs/SPEC-10-cancel-booking.md).

**Relation:** Closes cancel. Waitlist UI next (BR-29). Refunds / no-show / overpay warning parked.

**How to verify:** Studio those booking ids: `CANCELLED`. Collect payment `cmtwz2de5000l14l268dj876t` still IN.

### In plain language

The owner cancelled a confirmed game in the browser. The hour is free again. Cash already collected was left as-is. This slice is done.

---

## Chapter 85 — 2026-09-12 — SPEC-11 written (not started in code)

**When:** 2026-09-12

**What:** Wrote numbered waitlist slice: `/owner` lists people with `slot_interests` on a **free, not-ended** window; **Notify** is `wa.me` + prefilled English “slot available” (BR-30 / BR-69). No Cloud API, no interest delete, no other BR-71 templates. Stayed on `feature/spec-10-cancel-booking` because SPEC-10 is still uncommitted (cannot FF-merge `main`).

**Why:** [SPEC-11](./specs/SPEC-11-waitlist.md) implements BR-29 / BR-30 / DR-002 §2.13. Interests already written on auto-reject (SPEC-05). Notification module owns `wa.me` (DR-001); Booking never formats WhatsApp. No new `can()` flag — listing is not a mutation.

**Files:** `docs/specs/SPEC-11-waitlist.md`; `docs/README.md`.

**Relation:** Cancel stays as SPEC-10. Public page has no waitlist. Refunds / no-show / Arabic parked.

**How to verify:** Read the spec. Confirm or correct the pins (show only free windows, `wa.me` not an API, staff may see the list, do not delete interests). Then OK step 1.

### In plain language

The next instruction sheet: after a game is cancelled, the owner sees who wanted that hour and can open WhatsApp with a ready-made message. We have not built that yet — only the sheet.

---

## Chapter 86 — 2026-09-12 — SPEC-11 step 1: WhatsApp link + message

**When:** 2026-09-12

**What:** `whatsAppHref` — Lebanon digits to `https://wa.me/<e164>?text=` (`03…` → `961…`; already-`961` unchanged). Empty/spaces/too-short → `"Phone cannot be used for WhatsApp"`. `slotAvailableMessage` English: stadium, pitch, local start–end. No send. Notification does not import Booking.

**Why:** SPEC-11 step 1 / BR-30 / BR-69 / DR-001 (Notification owns WhatsApp links).

**Files:** `src/modules/notification/domain/whatsapp-link.ts`; `test/modules/notification/domain/whatsapp-link.test.ts`.

**Relation:** No waitlist query/UI yet (step 2 is the open-window helper). `/owner` unchanged.

**How to verify:** `npm test` — 21 suites / 136 tests.

### In plain language

We can now turn a Lebanese phone and a sentence into a WhatsApp link. The owner page still has no Waitlist.

---

## Chapter 87 — 2026-09-12 — SPEC-11 step 2: isWaitlistWindowOpen

**When:** 2026-09-12

**What:** `isWaitlistWindowOpen` — window is open if `end > now` and no occupied range on that pitch overlaps (reuse `overlaps()`). Caller passes APPROVED only; CANCELLED is omitted so the hour is open.

**Why:** SPEC-11 step 2 / BR-29 / DR-002 §2.13. Occupied is an argument — domain does not read Prisma.

**Files:** `src/modules/booking/domain/waitlist.ts`; `test/modules/booking/domain/waitlist.test.ts`.

**Relation:** No DB list yet (step 3). WhatsApp helpers exist (step 1). `/owner` still has no Waitlist.

**How to verify:** `npm test` — 22 suites / 140 tests.

### In plain language

The kitchen now knows “this hour is free again and not in the past.” Nothing is loaded from the database yet.

---

## Chapter 88 — 2026-09-12 — SPEC-11 step 3: listSlotInterestsWithPeople

**When:** 2026-09-12

**What:** `listSlotInterestsWithPeople` — `$queryRaw` join Pitch + Person, `lower`/`upper(during)`, `tenantId` from ALS (extension does not stamp raw SQL). No `tenantId` argument. No `SlotInterest.create` (`during` still Unsupported). Open vs occupied stays domain.

**Why:** SPEC-11 step 3 / DR-002 §2.13. Same raw pattern as Booking lists.

**Files:** `src/modules/booking/infrastructure/bookings.ts`.

**Relation:** Use case (step 4) will filter open windows and attach `wa.me`. `/owner` still has no Waitlist.

**How to verify:** `npm test` — 22 / 140. Click-proof in step 5: Ahmad rows only when ALS is Ahmad.

### In plain language

We can now load “who wanted which hour” for this stadium. The owner page still has no Waitlist.

---

## Chapter 89 — 2026-09-12 — SPEC-11 step 4: listOpenWaitlist

**When:** 2026-09-12

**What:** `listOpenWaitlist` — membership else `"Not allowed"` (no extra `can()`); interests + `listApprovedRanges`; `isWaitlistWindowOpen`; dedupe person per window; group soonest first. `wa.me` from Notification + tenant name (`getCurrentTenant`). Bad phone → no href, still listed. No `$transaction`. No Payment. Does not log phones.

**Why:** SPEC-11 step 4 / BR-29 / BR-30 / DR-001 (Notification owns WhatsApp links).

**Files:** `src/modules/booking/application/list-open-waitlist.ts`.

**Relation:** `/owner` still has no Waitlist (step 5). Cancel unchanged.

**How to verify:** `npm test` — 22 / 140. Click-proof in step 5: after cancel of an hour with a loser, groups appear; still-APPROVED hours do not.

### In plain language

The kitchen can now assemble “these people wanted this free hour, here is the WhatsApp link.” The owner page still has no Waitlist.

---

## Chapter 90 — 2026-09-12 — SPEC-11 step 5: /owner Waitlist

**When:** 2026-09-12

**What:** `/owner` **Waitlist** from `listOpenWaitlist`. Group: pitch + local range; people name + phone; **Notify** is `<a href={wa.me}>` (`target="_blank"` `rel="noopener noreferrer"`), not a Server Action. Empty: “No waitlist.” No Prisma / no `tenantId`. Public page unchanged.

Local Next docs: `page.md` — Server Component, `searchParams` Promise. GET render; no `redirect` for Notify.

**Why:** SPEC-11 step 5 / BR-29 / BR-30 / BR-69.

**Files:** `src/app/owner/page.tsx`.

**Relation:** Book / cancel / collect / expenses / This period unchanged.

**How to verify:** `npm test` — 22 / 140. Two public requests same hour → approve one → cancel → Waitlist shows the loser; Notify is `wa.me`. Could not click from this session (no browser tools); GET `/owner?tenant=ahmad` compiled (307 to login).

### In plain language

The owner page now lists who wanted a freed hour, with a Notify link to WhatsApp. Please try it in the browser.

---

## Chapter 91 — 2026-09-12 — SPEC-11 click-proof

**When:** 2026-09-12

**What:** Three public requests same hour (`feda75a4-…`, `66c81d4a-…`, `7a491948-…`). Approve the first; the other two became REJECTED + SlotInterest (`p2` / `71234234`, `p3` / `71345345`). Waitlist empty while APPROVED. Cancel `feda75a4-07ed-46fc-a1c0-893dc05beb8e` → Waitlist showed those people. Notify is `wa.me` (no new DB row).

**Why:** SPEC-11 whole-slice acceptance / BR-29 / BR-30 / BR-69.

**Files:** none this chapter (code was step 5). SPEC acceptance checkmarks in [SPEC-11](./specs/SPEC-11-waitlist.md).

**Relation:** Closes waitlist UI. Arabic / no-show / other BR-71 templates next as product asks. Refunds / overpay warning parked.

**How to verify:** Studio those interest ids on pitch `cmtw9vxs80001cwl2ufvexnjy`, window 13:00–14:00Z; booking `feda75a4-…` is `CANCELLED`.

### In plain language

After a confirmed game was cancelled, the owner saw who had wanted that hour and could open WhatsApp with a ready-made message. This slice is done.

---

## Chapter 92 — 2026-09-12 — SPEC-12 written (not started in code)

**When:** 2026-09-12

**What:** Branched `feature/spec-12-error-handling` from `main`. Wrote DR-004 + numbered error-handling slice: `DomainError` / `UnexpectedError`, English dictionary by key, logger context, actions never throw uncaught (except `redirect`), `?error=<key>` banners, Next `error.tsx` (`retry`, not `reset`). Public request currently has no try/catch — that is the crash. No next-intl, no `useActionState` rewrite, no wrap-every-Prisma.

**Why:** [DR-004](./decisions/DR-004-error-handling.md), [SPEC-12](./specs/SPEC-12-error-handling.md), RULE-9 / RULE-10. Dev sees stacks in `logs/`; owner sees a short line or a retry screen.

**Files:** `docs/decisions/DR-004-error-handling.md`; `docs/specs/SPEC-12-error-handling.md`; `docs/README.md`.

**Relation:** Does not change cancel/waitlist/collect rules. Arabic later consumes the same keys.

**How to verify:** Read the spec. Confirm or correct the pins (keys not UI strings at throw sites; redirect + key instead of client forms this slice; `retry` from local Next docs). Then OK step 1.

### In plain language

The next instruction sheet: you still get everything in the log file; the owner gets “that hour has already ended,” not a broken screen. We have not built that yet — only the sheet.

---

## Chapter 93 — 2026-09-12 — SPEC-12 step 1: DomainError + dictionary

**When:** 2026-09-12

**What:** `DomainError` carries a message key. `UnexpectedError` wraps `unknown` as `cause`. English catalog + `errorMessage(key)` (unknown / legacy `1` → generic). No UI, no action changes.

**Why:** SPEC-12 step 1 / DR-004. Copy is not at the throw site so Arabic can reuse keys later.

**Files:** `src/lib/errors.ts`; `src/lib/error-messages.ts`; `test/lib/errors.test.ts`.

**Relation:** Existing `throw new Error("…")` still in place (step 4). Logger unchanged (step 2).

**How to verify:** `npm test` — 23 suites / 144 tests.

### In plain language

We now have two kinds of error in code: “this can happen” (a key) and “this is a bug” (keep the original). Nothing on the owner’s screen has changed yet.

---

## Chapter 94 — 2026-09-12 — SPEC-12 step 2: logger context

**When:** 2026-09-12

**What:** `logger.error` / `info` accept optional `{ useCase, tenantId }` appended on the line (`formatLogContext`). Existing two-argument calls unchanged. No secrets on the type.

**Why:** SPEC-12 step 2 / DR-004. A stack in `logs/` should name the use case and stadium.

**Files:** `src/lib/logger.ts`; `test/lib/logger.test.ts`.

**Relation:** Call sites still omit context (step 5). No error.tsx yet (step 3).

**How to verify:** `npm test` — 24 suites / 146 tests.

### In plain language

The log line can now say which kitchen and which stadium, next to the stack. Screens are still unchanged.

---

## Chapter 95 — 2026-09-12 — SPEC-12 step 3: error.tsx + global-error.tsx

**When:** 2026-09-12

**What:** `error.tsx` and `global-error.tsx` — Client Components. Local Next error.md: **`retry`**, not `reset`. `global-error` includes `<html>` + `<body>`. English + Arabic retry. Digest in `<code>` if present. No `error.message`, no logger, no Prisma.

**Why:** SPEC-12 step 3 / DR-004. Unexpected render must not be a blank Next crash page.

**Files:** `src/app/error.tsx`; `src/app/global-error.tsx`.

**Relation:** Domain still throws English strings (step 4). Public Request still has no try/catch (step 6).

**How to verify:** `npm test` — 24 / 146. JSX has no `error.message`.

### In plain language

If the page blows up, the owner now sees “try again” in English and Arabic, not a stack. Forms can still crash until later steps.

---

## Chapter 96 — 2026-09-12 — SPEC-12 step 4: DomainError at throw sites

**When:** 2026-09-12

**What:** Domain + known infra product throws now use `DomainError("…key")`. `.message` is the key, not English. `lib/money.ts` and `lib/db.ts` tenant-scope throws left as-is. Application use cases still match English `EXPECTED` sets (step 5).

**Why:** SPEC-12 step 4 / DR-004. Copy lives in `error-messages.ts` so throw sites stay keys.

**Files:** `src/modules/booking/domain/decision.ts`; `src/modules/booking/domain/offered-slot.ts`; `src/modules/payment/domain/collect.ts`; `src/modules/notification/domain/whatsapp-link.ts`; `src/modules/expense/domain/occurred-at.ts`; `src/modules/ledger/domain/period.ts`; `src/modules/booking/infrastructure/bookings.ts`; matching Jest under `test/modules/`.

**Relation:** Use cases still treat keys as unexpected until step 5. Public Request still has no try/catch (step 6). Payment still does not import Booking.

**How to verify:** `npm test` — 24 suites / 146 tests. Grep `src/modules/**/domain` and `infrastructure` for `throw new Error` — none.

### In plain language

The kitchen now throws a code like “that hour ended,” not a sentence. The owner still sees the old banners until we teach the front desk (use cases and forms) those codes.

---

## Chapter 97 — 2026-09-12 — SPEC-12 step 5: use cases wrap unexpected

**When:** 2026-09-12

**What:** Mutating use cases rethrow `DomainError` (no error log). Exclusion → `booking.slot_unavailable` (error-level collision log). Else `logger.error` with `useCase` + `safeTenantId()` (outside `$transaction`) and `UnexpectedError`. List/read `Not allowed` → `access.not_allowed`. Login invalid → `access.invalid_login`. Actions still match English (step 6).

**Why:** SPEC-12 step 5 / DR-004. Use-case catch-all is the boundary; do not wrap every Prisma call. Domain is not a bug.

**Files:** `src/lib/use-case-error.ts`; `src/lib/tenant-context.ts` (`safeTenantId`); approve/reject/create/cancel/collect/public-request/expense/login/set-rate; list/read `Not allowed`; `reject-overlapping-pending`; `get-day-availability`.

**Relation:** Does not import Booking from Payment. `error.tsx` still unused for form domain failures until step 6 wraps public Request. Actions still `?error=1`.

**How to verify:** `npm test` — 24 / 146. Grep `src/modules/**/application` for `throw error` / `throw new Error` — none. Catch-alls call `rethrowUnexpected`.

### In plain language

The kitchen now says “this is a normal no” vs “this is a bug — write it in the log with the stadium name.” The forms still show a generic “error=1” until the next step.

---

## Chapter 98 — 2026-09-12 — SPEC-12 step 6: action banners (`?error=<key>`)

**When:** 2026-09-12

**What:** Owner, login, and public Server Actions catch (except `redirect` — local redirect.md: redirect throws) → `?error=<key>`. `DomainError` → its key; Zod → `form.invalid`; unexpected → `error.generic` (already logged in the use case). Pages print `errorMessage(key)`. Public Request now has try/catch. Legacy `error=1` still maps to generic.

**Why:** SPEC-12 step 6 / DR-004 / RULE-9. Stay on the page with a dictionary line, not a Next crash. Keys stay for later Arabic / `useActionState`.

**Files:** `src/lib/use-case-error.ts` (`actionErrorKey`); `src/app/owner/actions.ts`; `src/app/login/actions.ts`; `src/app/request-slot.ts`; `src/app/owner/page.tsx`; `src/app/login/page.tsx`; `src/app/page.tsx`; `test/lib/use-case-error.test.ts`.

**Relation:** Pages still have no Prisma / no `tenantId`. Payment still does not import Booking. `error.tsx` is only for unexpected render.

**How to verify:** `npm test` — 25 / 149. Public Request on 2026-09-11 16:00 Ahmad Pitch A1 → 303 `/?tenant=ahmad&date=2026-09-11&error=booking.slot_ended` and the page shows “That hour has already ended.” Bad login → `error=access.invalid_login`. No crash overlay.

### In plain language

If the hour already ended, the public page stays up and says so in English. The log file is quiet for that. A real bug still goes to the retry screen and the log.

---

## Chapter 99 — 2026-09-12 — shadcn/ui + Tailwind v4 tooling layer

**When:** 2026-09-12

**What:** Added shadcn/ui on top of the existing Next.js 16 + Tailwind v4 app. Did **not** run `tailwindcss init -p` — v4 is already wired via `@tailwindcss/postcss` and `postcss.config.mjs` (no `tailwind.config.ts`). `npx shadcn@latest init` with New York / Neutral / CSS variables / TypeScript. `rtl: true` so later components use logical properties. Smoke-tested with `npx shadcn@latest add button`.

**Why:** UI tooling layer only. No SPEC. Do not mix this with booking/payment/Prisma.

**Files:** `components.json`; `src/app/globals.css`; `src/lib/utils.ts`; `src/components/ui/button.tsx`; `package.json` / `package-lock.json`. Layout, routes, and Prisma untouched.

**Relation:** `src/components/ui` must not import `src/modules/*`. Pages still do not import Prisma. Payment still does not import Booking.

**How to verify:** `components.json` has `"rsc": true` and `"cssVariables": true`. `src/components/ui/button.tsx` exists. `npm run build` compiles; typecheck still fails on pre-existing `create-owner-booking.ts` / `request-public-slot.ts` / `persons.ts` (not this slice).

### In plain language

The design kit is on the shelf. The kitchen (bookings, money, database) did not change. We can now drop in buttons and forms without rewriting Tailwind from scratch.

---

## Chapter 100 — 2026-09-12 — visual system tokens + owner Login

**When:** 2026-09-12

**What:** One shared shadcn token set: Carbon `#1a1d20`, Off-White `#f8f9fa`, Volt `#10b981` (primary + focus ring, sparse), Athletic Slate `#495057`. Modest radius `0.5rem`. No OS auto-dark content flip; `--sidebar` stays Carbon for later owner chrome. Fonts: Noto Kufi Arabic (headings), IBM Plex Sans Arabic (body), IBM Plex Mono (money/times). Button/Input default height `h-11` (44px). Added Card, Badge, Input, Label. Owner Login restyled with those pieces; Volt only on submit. `submitLogin` unchanged.

**Why:** Visual system plan (calm / utilitarian). Not a SPEC. RTL logical-property rules untouched.

**Files:** `src/app/globals.css`; `src/app/layout.tsx`; `src/components/ui/button.tsx`; `src/components/ui/input.tsx`; `src/components/ui/card.tsx`; `src/components/ui/badge.tsx`; `src/components/ui/label.tsx`; `src/app/login/page.tsx`.

**Relation:** `src/components/ui` must not import `src/modules/*`. Login still has no Prisma / no `tenantId`. Payment still does not import Booking.

**How to verify:** `http://localhost:3000/login?tenant=ahmad` — Card, Volt Log in button, Plex/Kufi/Mono on `<html>`. `?error=access.invalid_login` shows “Invalid login.” CSS `--primary: #10b981`. Owner schedule and public booking pages not restyled.

### In plain language

The paint is mixed once in the CSS file: dark carbon text, off-white paper, a little pitch-green for the main button. Login now looks like that. The rest of the stadium screens still wear the old clothes until we dress them the same way.

---

## Chapter 101 — 2026-09-12 — Login card actually centered

**When:** 2026-09-12

**What:** Login was a full-width strip stuck to the top (`min-h-full` never filled the viewport). Main is now `min-h-svh` + column + center. Card `max-w-sm`. Title is “Log in”; stadium name stays tenant-authored. Same tokens, same `submitLogin`.

**Why:** Follow-up to ch.100. Colors were right; layout was not.

**Files:** `src/app/login/page.tsx`; `src/app/layout.tsx` (`min-h-svh` on body).

**Relation:** No Prisma. No owner/public restyle.

**How to verify:** `/login?tenant=ahmad` — narrow card in the middle of the screen, not a banner at the top.

### In plain language

The login box now sits in the middle of the page like a form, not a stripe glued to the ceiling.

---

## Chapter 102 — 2026-09-12 — owner Today + restyle `/owner`

**When:** 2026-09-12

**What:** Owner page uses the Carbon/Volt tokens. **Today** (pending + confirmed) is first and glanceable: cards, `font-mono` for times/money/phones, 44px Approve/Collect. Other sections (book, waitlist, period, rate, expenses) same kit, stacked fields. Actions and hidden query fields unchanged.

**Why:** Visual system, owner outdoor density. Not a SPEC.

**Files:** `src/app/owner/page.tsx`

**Relation:** Page still has no Prisma / no `tenantId`. Payment still does not import Booking.

**How to verify:** `/owner?tenant=ahmad` after login. Today is at the top. Approve is Volt; Reject/Cancel outline. Public booking page still unstyled.

### In plain language

The owner phone screen now starts with “who is waiting” and “who is on the pitch,” in the same colors as login. The kitchen still does the same jobs; it just stopped looking like a notepad.

---

## Chapter 103 — 2026-09-12 — custom Select and Calendar on owner

**When:** 2026-09-12

**What:** Owner native `<select>` and `type="date"` are gone. shadcn Select, Popover, and Calendar are in `src/components/ui/`. Thin client **DateField** and **SelectField** keep a hidden `<input name>` so GET (`bookOn`, `from`, `to`) and Server Actions (`occurredOn`, `category`, `view`) still submit the same strings. Select trigger is `h-11`. Calendar uses `en-GB` + Latin numerals so the grid is Western digits. `button.tsx` stays `h-11` (do not re-run shadcn add with `--overwrite` on it). Public booking is unchanged this slice.

**Why:** Visual system — OS date pickers and dropdowns broke the Carbon/Volt look. Not a SPEC. Actions and Prisma stay put.

**Files:** `src/components/ui/select.tsx`; `src/components/ui/popover.tsx`; `src/components/ui/calendar.tsx`; `src/components/ui/date-field.tsx`; `src/components/ui/select-field.tsx`; `src/app/owner/page.tsx`; `package.json` / lockfile (`date-fns`, `react-day-picker`). `src/app/owner/actions.ts` untouched.

**Relation:** `src/components/ui` must not import `src/modules/*`. Owner page still has no Prisma / no `tenantId`. Payment still does not import Booking.

**How to verify:** `/owner?tenant=ahmad` after login. Day / From / To / When open a calendar popover (mono `yyyy-mm-dd`). View and Category are the custom dropdown. Show slots / Show / Record expense still post or GET the same field names. Public `?date=` is still the native control until the next public restyle.

### In plain language

The owner forms no longer pop up the phone’s own calendar and menu. They use our green-ring picker and list instead, but they still send the same dates and category codes to the kitchen.

---

## Chapter 104 — 2026-09-12 — public booking restyle

**When:** 2026-09-12

**What:** Public `/` uses the same Carbon/Volt kit as login/owner. Day is **DateField** (GET `name="date"`, `yyyy-mm-dd`), not a native date control. Slot cards are the same tokens, slightly tighter padding than owner. Name/tel stay Input; Request is Volt. Hidden fields for the Server Action are unchanged (`pitchId`, `start`, `end`, `date`, `tenant`).

**Why:** Visual system — public was still `system-ui`. Calendar plan said reuse DateField for `?date=`. Not a SPEC.

**Files:** `src/app/page.tsx`. `src/app/request-slot.ts` untouched.

**Relation:** Page still has no Prisma / no `tenantId`. Payment still does not import Booking. `src/components/ui` still does not import `src/modules/*`.

**How to verify:** `/?tenant=ahmad` — heading, calendar Day, Show slots, Request on a free hour. `?date=2026-09-13` still lists that civil day. Success still “Request received”; `?error=` still the dictionary line.

### In plain language

Walk-up booking now wears the same clothes as the owner phone: a green-ring day picker and stacked hour cards. Asking for an hour still sends the same name, phone, and times to the kitchen.

---

## Chapter 105 — 2026-09-12 — UX craft (states, hierarchy, toast)

**When:** 2026-09-12

**What:** One feedback pattern: Server Actions still redirect; success adds `ok=` (public `requested` replaces `received=1`); owner/public **FlashToast** + sonner, then strips `ok`/`error` from the URL. Login errors stay in-card. Empty lists use a titled **EmptyState** (text only, no new action icons). Submit buttons use `useFormStatus` (Next forms.md). Skeleton `loading.tsx` on `/` and `/owner` (login has its own so it does not inherit the hours skeleton). Today has counts and Due/Paid; later owner headings are quieter; period **Difference** reads first. Public date is a filter; hours + Request are the job. `error.tsx` / `global-error` use tokens. Document title is “Stadiums”.

**Why:** Craft pass after tokens/restyle (ch.99–104). Not a SPEC. Use cases and Prisma unchanged; thin actions only add `ok=` on the existing success redirect.

**Files:** `src/components/ui/sonner.tsx`, `skeleton.tsx`, `empty-state.tsx`, `submit-button.tsx`, `flash-toast.tsx`; `src/lib/success-messages.ts`; `test/lib/success-messages.test.ts`; `src/app/layout.tsx`; `src/app/loading.tsx`; `src/app/owner/loading.tsx`; `src/app/login/loading.tsx`; `src/app/login/page.tsx`; `src/app/owner/page.tsx`; `src/app/owner/actions.ts`; `src/app/page.tsx`; `src/app/request-slot.ts`; `src/app/error.tsx`; `src/app/global-error.tsx`; `package.json` (sonner).

**Relation:** `src/components/ui` must not import `src/modules/*`. Pages still have no Prisma / no `tenantId`. Payment still does not import Booking.

**How to verify:** `/?tenant=ahmad` — Hours, not a duplicate “Schedule for” line; Request then a toast “Request received.” `/login?tenant=ahmad` — in-card error, Log in pending. `/owner` after login — Pending · n, empty blocks, Approve toast, Collect still Volt, mixed secondary. Title “Stadiums”.

### In plain language

The screens now tell you when something worked (a small toast), when a list is empty on purpose, and which button matters. The kitchen still does the same jobs; the waiter just stopped going silent after you tap.

---

## Chapter 106 — 2026-09-12 — Scoped Suspense (keep GET, no full-page skeleton)

**When:** 2026-09-12

**What:** Route `loading.tsx` files on `/`, `/owner`, and `/login` are gone. Next `loading.md`: that file wraps the whole `page.js`, so header + date picker unmounted on every GET and Server Action. Pages now await only tenant / searchParams / membership, then return the shell (title, GET date form). Hours, Today, Book slots, and later owner lists are child RSCs inside `<Suspense>` with list skeletons. GET forms still submit `date` / `bookOn` as `yyyy-mm-dd`. Actions unchanged (`ok=` / `error=` only). No `router.push`, no client list state.

**Why:** Show hours / Show slots / Approve felt like a full reload. Keep Server Components and query params; stream lists. Local Next 16 `loading.md`: nested `<Suspense>` is the supported alternative to `loading.js`.

**Files:** deleted `src/app/loading.tsx`, `src/app/owner/loading.tsx`, `src/app/login/loading.tsx`; `src/app/page.tsx`; `src/app/public-hours.tsx`; `src/app/list-skeletons.tsx`; `src/app/owner/page.tsx`; `src/app/owner/today.tsx`; `src/app/owner/book-slots.tsx`; `src/app/owner/rest.tsx`; `src/app/owner/shared.tsx`.

**Relation:** Children live under `src/app/`. `src/components/ui` still must not import `src/modules/*`. No Prisma / use-case / module-boundary changes.

**How to verify:** `/?tenant=ahmad` — Day + Show hours stay; Hours list skeletons then slots. `/login?tenant=ahmad` — login card only (no hours skeleton). `/owner` after login — header + Book day stay; Today / slots skeleton then fill; Approve keeps the header.

### In plain language

Picking a day used to blank the whole screen because the waiter was waiting in the lobby. Now the date field stays on the counter while only the hours list walks to the kitchen.

---

## Chapter 107 — 2026-09-12 — SPEC-13 written (not started in code)

**When:** 2026-09-12

**What:** Product chose Arabic/RTL next. Wrote DR-005 + numbered SPEC-13: `dir="rtl"` `lang="ar"`, Arabic dictionaries for the existing error/success keys plus chrome `ui()`, WhatsApp “slot available” body in Arabic. No next-intl, no `/ar` URL, no language switch, no `tenant.settings`. Calendar stays `en-GB` (Western digits). Tenant-authored names stay as written.

**Why:** [DR-005](./decisions/DR-005-arabic-rtl.md), [SPEC-13](./specs/SPEC-13-arabic-rtl.md), BRD A-1 / A-2 / R-4 / RULE-11. Keys from DR-004 stay the seam.

**Files:** `docs/decisions/DR-005-arabic-rtl.md`; `docs/specs/SPEC-13-arabic-rtl.md`; `docs/README.md`.

**Relation:** Does not change booking/money/waitlist rules. English secondary / next-intl later.

**How to verify:** Read the spec. Confirm or correct the pins (Arabic-only, no locale URL, `en-GB` calendar, WhatsApp template). Then OK step 1.

### In plain language

The kitchen still speaks the same language. This slice is the waiter switching the menu to Arabic and serving from the right, without moving the restaurant to a new street address.

---

## Chapter 108 — 2026-09-12 — SPEC-13 step 1: Arabic dictionaries

**When:** 2026-09-12

**What:** Error and success dictionaries now return the SPEC-13 Arabic catalog (same keys). New `ui(key)` chrome map plus helpers for counts / Collect / due line / LBP-per-USD. Unknown `ui` key returns the key. Pages and `dir` unchanged. WhatsApp body still English until step 5.

**Why:** SPEC-13 step 1 / DR-005. Copy is not in JSX yet so step 3–4 only swap callers.

**Files:** `src/lib/error-messages.ts`; `src/lib/success-messages.ts`; `src/lib/ui-copy.ts`; `test/lib/errors.test.ts`; `test/lib/success-messages.test.ts`; `test/lib/ui-copy.test.ts`.

**Relation:** `src/lib` must not import `src/modules/*`. Pages still have no Prisma / no `tenantId`. next-intl still out.

**How to verify:** `npm test` — 27 suites, 154 passed. UI still English until later steps; toasts would already be Arabic if you trigger `ok=` / `error=`.

### In plain language

The menu cards are printed in Arabic, but they are still in the drawer. The waiter has not put them on the tables yet.

---

## Chapter 109 — 2026-09-12 — SPEC-13 step 2: dir + crash screens

**When:** 2026-09-12

**What:** Root `<html lang="ar" dir="rtl">`. Title `ملاعب` via `ui("doc.title")`. `error.tsx` / `global-error` are Arabic-first with English as a second `dir="ltr"` line; retry button `حاول مرة أخرى / Try again`. `global-error` does not import `ui-copy`. Grep of `src/` found no `pl-`/`pr-`/`ml-`/`mr-`/`text-left`/`text-right`/`left-0`/`right-0` (Radix `data-[side=left]` animations left as-is).

**Why:** SPEC-13 step 2 / DR-005. Local layout.md: root layout owns `<html>` / `<body>`. error.md: `retry`, Client Component.

**Files:** `src/app/layout.tsx`; `src/app/error.tsx`; `src/app/global-error.tsx`.

**Relation:** Chrome on pages still English until step 3. No Prisma / no `tenantId`. next-intl still out.

**How to verify:** View source of `/?tenant=ahmad` — `lang="ar"` `dir="rtl"` `<title>ملاعب</title>`. Login labels still English.

### In plain language

The restaurant flipped the tables so people sit on the right. The printed menu on the tables is still English until the next trip to the kitchen.

---

## Chapter 110 — 2026-09-12 — SPEC-13 step 3: public + login chrome

**When:** 2026-09-12

**What:** Public `/` and `/login` labels, empty states, Taken badge, and submit buttons use `ui(...)`. GET still posts `name="date"`. Request action and hidden fields unchanged. Stadium name and pitch names stay as stored. `errorMessage` on login was already Arabic from step 1.

**Why:** SPEC-13 step 3 / DR-005 / RULE-11.

**Files:** `src/app/page.tsx`; `src/app/public-hours.tsx`; `src/app/login/page.tsx`.

**Relation:** Owner chrome still English until step 4. Pages still have no Prisma / no `tenantId`.

**How to verify:** `/?tenant=ahmad` — اليوم / عرض الساعات / الساعات / اطلب; pitch names unchanged. `/login?tenant=ahmad` — تسجيل الدخول / دخول. Bad password still in-card via `access.invalid_login`.

### In plain language

The visitor and the lock on the door now speak Arabic. The owner’s kitchen list is still English until the next step.

---

## Chapter 111 — 2026-09-12 — SPEC-13 step 4: owner chrome

**When:** 2026-09-12

**What:** Owner header, Today, Book, Waitlist, period, rate, and expenses use `ui(...)` / count and money helpers. `categoryLabel` reads `cat.*`. Role is `role.OWNER` / `role.STAFF`. GET names (`bookOn`, `from`, `to`, `view`) unchanged. Added chrome key `owner.requested` (`طُلب`) — the catalog missed the “Requested {time}” line.

**Why:** SPEC-13 step 4 / DR-005 / RULE-11.

**Files:** `src/app/owner/page.tsx`; `today.tsx`; `book-slots.tsx`; `rest.tsx`; `shared.tsx`; `src/lib/ui-copy.ts`.

**Relation:** WhatsApp body still English until step 5. Pages still have no Prisma / no `tenantId`.

**How to verify:** `/owner` after login — اليوم / خروج / احجز ساعة / مالك; pitch and requester names as stored; Approve/Collect/Book still submit.

### In plain language

The owner’s list on the wall is Arabic now. The WhatsApp note he sends is still English until the last step.

---

## Chapter 112 — 2026-09-12 — SPEC-13 step 5: WhatsApp Arabic body

**When:** 2026-09-12

**What:** `slotAvailableMessage` uses the pinned Arabic sentence. Stadium/pitch stay as stored; times stay Latin `18:00–19:00`. Jest updated. No other BR-71 templates. SPEC-13 is done in code.

**Why:** SPEC-13 step 5 / DR-005 / A-8 / RULE-11.

**Files:** `src/modules/notification/domain/whatsapp-link.ts`; `test/modules/notification/domain/whatsapp-link.test.ts`; `docs/README.md`; `docs/decisions/DR-005-arabic-rtl.md`.

**Relation:** Notification still does not import Booking. Other WhatsApp templates stay out.

**How to verify:** `npm test`. Notify `wa.me` text: `Ahmad Stadium: Pitch 1 18:00–19:00 أصبحت متاحة مجدداً إذا ما زلت تريدها.`

### In plain language

The note the owner pastes into WhatsApp is Arabic now, with the same stadium name and Latin times. This Arabic slice is finished.

---

## Chapter 113 — 2026-09-12 — Public slot picker + RTL bidi isolate

**When:** 2026-09-12

**What:** Two UX fixes, same Server Action. (1) Latin runs inside `dir="rtl"` were painting backwards (`17:00–16:00`). Display of times, phones, money, and `yyyy-mm-dd` now goes through `LtrIsolate` (`<bdi dir="ltr">` + `font-mono`). (2) Public hours no longer stack a name+phone form on every free slot. `PublicHours` still fetches; `PublicSlotPicker` (one Client Component) is a 2-col grid of time+price blocks. Taken hours stay visible, muted, not tappable. Tapping an open slot expands **one** form under that pitch’s chips (same hidden fields + `submitPublicSlotRequest`). Tap again to collapse; picking another slot (including another pitch) closes the previous form.

**Why:** RTL bidi bug (RULE-11 / DR-005). Public request UX — no new SPEC; action contract unchanged.

**Files:** `src/components/ui/ltr-isolate.tsx` (new); `src/app/public-slot-picker.tsx` (new); `src/app/public-hours.tsx`; `src/components/ui/date-field.tsx`; `src/app/owner/today.tsx`; `src/app/owner/book-slots.tsx`; `src/app/owner/rest.tsx`; `src/app/owner/page.tsx`; `src/app/login/page.tsx`.

**Relation:** `app/` still has no Prisma / no `tenantId`. Picker holds selection only — it must not import domain or Prisma. `submitPublicSlotRequest` and hidden fields (`pitchId`, `start`, `end`, `date`, `tenant`) unchanged. Owner Book still has one form per available slot (bidi wrap only). Do not wrap Arabic chrome. Do not change `slotAvailableMessage` (WhatsApp URL, not RTL HTML).

**How to verify:** `npm test` (154). `/?tenant=ahmad` — HTML has `<bdi dir="ltr">16:00–17:00</bdi>` (start before end), 2-col grid, `محجوز` on muted taken cells, **no** name/phone form until a chip is selected; Request still lands `ok=requested`. `/owner` Today/Book/waitlist ranges and phones no longer reverse. `/login?tenant=ahmad` slug is isolated.

### In plain language

Times stopped flipping backwards in Arabic layout. Visitors now tap an hour to open one request form instead of scrolling past a stack of identical forms.

---

## Chapter 114 — 2026-09-12 — Public day chips (Link, not a date form)

**When:** 2026-09-12

**What:** Public `/` no longer uses DateField + **عرض الساعات**. Same-week dates are a horizontal row of seven chips: اليوم, غداً, the next four weekdays with a Western day number, then a calendar icon. The six day chips are Next.js `<Link href={{ pathname: "/", query: { tenant, date } }}>` (App Router client transition — not `<form method="get">`, not a raw `<a>`). The existing `<Suspense key={dateValue}>` around `PublicHours` is what should skeleton **only** the slot list. Window is always venue-today…today+5. A date outside that window rings the calendar chip (Popover + same `en-GB` Calendar); `router.push` with `tenant` + `date` only. `?date=` / `parseCivilDate` / `todayInTimeZone` unchanged.

**Why:** Same-day/this-week is the common path; a calendar-first field was two actions. No SPEC — UX, query contract unchanged.

**Files:** `src/app/public-day-chips.tsx` (new RSC); `src/app/public-date-calendar-chip.tsx` (new client, calendar overflow only); `src/app/page.tsx`; `src/lib/ui-copy.ts`; `test/lib/ui-copy.test.ts`.

**Relation:** `PublicHours` / slot picker / request action untouched. Owner DateField (`bookOn`, `from`, `to`, `occurredOn`) unchanged. Day numbers in `LtrIsolate`; do not wrap the Arabic weekday. No `loading.tsx` on `/` (that would white-flash the whole page).

**How to verify:** `npm test`. `/?tenant=ahmad` — six `/ ?tenant=ahmad&date=yyyy-mm-dd` Links, no DateField, no **عرض الساعات**; Today ringed; times still `16:00–17:00`. Tap غداً — `?date=` tomorrow, that chip rings; stadium name + chips stay, **only** the hours area shows the skeleton. `/?tenant=ahmad&date=2026-10-01` — calendar chip `aria-pressed="true"`. `/owner` DateField still there.

### In plain language

Picking a day this week is one tap on a chip. The hours list refreshes underneath; the rest of the page does not go white.

---

## Correction — 2026-09-12 — Day-chip selected ring was clipped

**When:** 2026-09-12

**What:** `overflow-x-auto` on the chip row clipped the Volt ring (CSS treats the other axis as `auto` too). Padding on the row is now `p-2.5` so the ring+offset has room, including on اليوم at the RTL start edge.

**Why:** Same selected treatment as the slot picker; the scroll row has to leave space for it.

**Files:** `src/app/public-day-chips.tsx`

**How to verify:** Select اليوم / غداً — the full green ring is visible on all four sides, not cut by the row.

---

## Correction — 2026-09-12 — Day chips: no horizontal scrollbar

**When:** 2026-09-12

**What:** Dropped `overflow-x-auto`. The seven chips share the row (`flex-1`, compact `text-xs`). Selected uses an **inset** Volt ring so it does not need extra padding and does not clip.

**Why:** A scrollbar under the chips is worse than slightly tighter labels.

**Files:** `src/app/public-day-chips.tsx`; `src/app/public-date-calendar-chip.tsx`

**How to verify:** `/?tenant=ahmad` — all seven chips visible, no scrollbar under the row; selected اليوم still has a full green outline.

---

## Correction — 2026-09-12 — Page scrollbar no longer shifts the layout

**When:** 2026-09-12

**What:** `html { scrollbar-gutter: stable; }` so the vertical gutter is always reserved. Switching days (or any page whose height crosses the viewport) no longer shows/hides the browser scrollbar and nudges `max-w-lg` content.

**Why:** Classic Windows scrollbars take width. Overlay/auto hide was shifting the whole site.

**Files:** `src/app/globals.css`

**How to verify:** Toggle a long day vs a short one (or resize until the page scrollbar appears). Chips and hours stay horizontally still.

---

## Chapter 115 — 2026-09-12 — Public hours skeleton matches the slot grid

**When:** 2026-09-12

**What:** Replaced the two tall gray blocks. Hours Suspense now falls back to `PublicHoursSkeleton`: pitch heading bars at **inline-start** + a 2-col grid of time/price chip shapes (same `min-h-16` / `rounded-xl` as live slots). Pieces are exported separately (`StartLine`, `SlotChipSkeleton`, `SlotGridSkeleton`, `PitchHoursSkeleton`, `DayChipsSkeleton`) so later public UI can compose them. No `pl`/`pr`/`ml`/`mr` — `self-start` / `items-start` follow `dir`.

**Why:** The old blocks did not look like the slot picker and would not survive a later English/LTR pass.

**Files:** `src/app/public-skeletons.tsx` (new); `src/app/page.tsx`; `src/app/list-skeletons.tsx` (dropped `HoursListSkeleton`).

**Relation:** Day chips stay mounted; only hours suspend. Owner skeletons unchanged.

**How to verify:** Tap غداً — stadium name and chips stay; hours area shows two pitch headings (start-aligned) and a 2-col chip grid, then real slots. Flip `dir` on `<html>` — heading bars and chip text stubs stay at inline-start.

---

## Chapter 116 — 2026-09-12 — Public EN/ع lang+dir toggle

**When:** 2026-09-12

**What:** Public header has a small outline button. Arabic → shows **EN**; English → shows **ع**. Click sets cookie `stadium_locale`, flips `<html lang>` / `dir` (`ar`+`rtl` / `en`+`ltr`), and `router.refresh()` so public chrome (Today/Hours/Taken/form) follows. Stadium and pitch names stay as stored. No next-intl, no `/en` routes. Owner/login still Arabic copy (fallback).

**Why:** Product asked for a public direction switch to exercise LTR. DR-005 still parks next-intl; this is a cookie + dictionary, not `[locale]`.

**Files:** `src/lib/locale.ts`; `src/lib/get-ui-locale.ts`; `src/app/locale-actions.ts`; `src/app/public-lang-toggle.tsx`; `src/app/layout.tsx`; `src/app/page.tsx`; `src/lib/ui-copy.ts`; public hours/chips/picker; `test/lib/locale.test.ts`.

**Relation:** `ui(key, locale?)` defaults `ar`. Cookie write is a Server Function (cookies.md). `app/` still has no Prisma / no `tenantId`.

**How to verify:** `/?tenant=ahmad` — EN at inline-end of the header. Tap — page goes LTR, Today/Hours/Request in English, chips at the left. Tap ع — back to RTL Arabic. `npm test` (157).

---

## Chapter 117 — 2026-09-12 — Colocate route UI; public form field errors

**When:** 2026-09-12

**What:** Public UI lives under `src/app/(public)/` (URL still `/`). Owner skeletons moved next to `/owner`. Shared primitives stay in `src/components/ui` (`LtrIsolate`, `FlashToast`). Public name/phone no longer use HTML `required` (browser bubble). `noValidate` + inline `role="alert"` under the field; same 8–15 digit phone rule as Zod. Server Action still parses with Zod.

**Why:** Scattered `public-*.tsx` at `app/` root were not routes. Native validation is ugly and ignores our Arabic/English copy.

**Files:** `src/app/(public)/*`; `src/app/owner/skeletons.tsx`; `src/lib/ui-copy.ts`; `test/app/public/request-fields.test.ts`.

**Relation:** `app/` still has no Prisma / no `tenantId`. `request-fields.ts` imports `normalizePhone` only (people domain).

**How to verify:** `npm test` (158). Open a slot, tap اطلب empty — red line under name and phone, no OS tooltip. Valid name + `03 123 456` still `ok=requested`.

---

## Chapter 118 — 2026-09-12 — Hide ended hours; three empty states

**When:** 2026-09-12

**What:** Public hours and Owner Book drop slots whose end is not after injected `now` (same cutoff as `booking.slot_ended`). `generateSlotsForDay` is unchanged. Empty list is `closed` (no windows), `past` (civil date before today), or `hoursEnded` (today, all games over). Public chip row stays today→today+4; a past `?date=` selects nothing (not Today, not the calendar). Calendar disables days before today. Owner Today lists are unchanged. A typed past Owner `bookOn` shows `past` — Book creates, it does not review history.

**Why:** Requesting or booking a game that already ended is noise. `now` is injected at the page/use-case so venue domain/application never call `Date.now()`.

**Files:** `src/modules/venue/domain/availability.ts`; `src/modules/venue/application/get-day-availability.ts`; `src/app/(public)/page.tsx`; `hours.tsx`; `slot-picker.tsx`; `day-chips.tsx`; `date-calendar-chip.tsx`; `src/app/owner/page.tsx`; `book-slots.tsx`; `src/lib/ui-copy.ts`; `test/modules/venue/domain/availability.test.ts`; `test/lib/ui-copy.test.ts`.

**Relation:** Pages construct `now` and `civilDateInTimeZone`. Venue still takes occupied UTC ranges from Booking. `components/ui` does not import `src/modules/*`. Owner Today / waitlist / `resolveOfferedSlot` unchanged.

**How to verify:** `npm test` (170). Public `/?tenant=ahmad&date=` yesterday — «هذا التاريخ مضى», no chip ringed. Open calendar — days before today disabled. After last slot tonight — «لم تبق ساعات اليوم». Closed weekday still «مغلق هذا اليوم.». Owner Book past `bookOn` — same past empty state; Owner Today still lists today's pending/confirmed.

---

## Chapter 119 — 2026-09-12 — Owner tabs: real routes + shared layout

**When:** 2026-09-12

**What:** `/owner` is no longer one scrolling page. Nested `layout.tsx` holds header + bottom tab bar; `/owner` redirects to `/owner/today`. Tabs are `/owner/today`, `/owner/book`, `/owner/waitlist`, `/owner/money`. Actions redirect to the owning tab. `FlashToast` lives in the layout and reads `ok`/`error` via `useSearchParams`. No `loading.tsx`. Login lands on `/owner/today`. Living map: `docs/owner-ia.md`.

**Why:** Shop/Academy cannot pile onto one page. Real routes give back-button and bookmarks (same pattern as public day chips). Layouts cannot take `searchParams` (local layout.md).

**Files:** `src/app/owner/layout.tsx`; `tab-bar.tsx`; `page.tsx`; `today/page.tsx`; `book/page.tsx`; `waitlist/page.tsx`; `money/page.tsx`; `today-lists.tsx`; `waitlist-list.tsx`; `money-panel.tsx`; `actions.ts`; `shared.tsx`; `skeletons.tsx`; `src/app/login/actions.ts`; `src/components/ui/flash-toast.tsx`; `src/modules/access/application/get-current-membership.ts` (`cache()`); `src/lib/ui-copy.ts`; `docs/owner-ia.md`; `docs/README.md`. Deleted `owner/rest.tsx`.

**Relation:** Use cases unchanged. `app/` still has no Prisma / no `tenantId`. Tab bar is the only new owner Client Component besides FlashToast. **No `loading.tsx`** on owner tabs (GET date fields must stay mounted). Proxy vs `middleware.ts` flagged in `docs/owner-ia.md`, not migrated here.

**How to verify:** `npm test`. Login → `/owner/today`. Header stays while tapping احجز / قائمة الانتظار / المال. Book GET stays on `/owner/book`. Approve toast on Today; create booking toast on Book; rate/expense on Money.

---

## Correction — 2026-09-12 — Today lists live under today/lists.tsx

**When:** 2026-09-12

**What:** `OwnerToday` is `src/app/owner/today/lists.tsx` (imported by `today/page.tsx` as `./lists`). Same for waitlist/`list.tsx` and money/`panel.tsx`. The old `owner/today.tsx` is gone; it still called `keepOwnerQuery` after that helper was removed, and Turbopack kept serving it.

**Why:** A sibling `today.tsx` next to `today/page.tsx` is a bad split (and the stale module threw `keepOwnerQuery is not defined`).

**Files:** `src/app/owner/today/lists.tsx`; `waitlist/list.tsx`; `money/panel.tsx`; `docs/owner-ia.md`. Deleted `today-lists.tsx`, `waitlist-list.tsx`, `money-panel.tsx`.

**How to verify:** Refresh `/owner/today` — pending/confirmed render; cancel form has no `keepOwnerQuery` error.

---

## Chapter 120 — 2026-09-12 — Owner tab bar icons + dock

**When:** 2026-09-12

**What:** Owner bottom nav is a floating rounded dock: Lucide icons (list / calendar-plus / bell / wallet) over the existing Arabic labels, Volt tint + slight scale on the active tab, CSS `transition` only. Still `<Link>` + `usePathname` — not a client tab switcher.

**Why:** Text-only chips were hard to scan on a phone; four Arabic labels needed a simple visual.

**Files:** `src/app/owner/tab-bar.tsx`; `src/app/owner/layout.tsx`.

**Relation:** Routes and IA in `docs/owner-ia.md` unchanged. Logical CSS; no `pl`/`pr`.

**How to verify:** Open `/owner/today` — dock at the bottom. Tap احجز — icon tints Volt, header stays. Waitlist label may truncate; icon still readable.

---

## Chapter 121 — 2026-09-12 — Colocate owner tab files; split actions

**When:** 2026-09-12

**What:** Each owner tab keeps its own page, UI, skeleton, and (when it has a form POST) `actions.ts`. Root `/owner` keeps only chrome that two or more tabs share: `layout.tsx`, `tab-bar.tsx`, `shared.tsx` (membership, tenant slug, `queryString`, `formatLocalRange`), and `form-query.ts` (`field` / `ownerQuery` / `redirectOwner` used by today+book+money). One-tab helpers are folded into that tab’s TSX (`keepTenantQuery` on Today, `keepBookQuery` on Book, period keep/format/labels on Money). `civilFromYyyyMmDd` / `parseOwnerBookOn` live in `book/date.ts`. Waitlist has no Server Action.

**Why:** A root `actions.ts` and `skeletons.tsx` mixed four products. Next tab (Shop) would dump more into the same files. Rule: used by exactly one tab → lives in that folder.

**Files:** `src/app/owner/form-query.ts`; `shared.tsx`; `today/{page,lists,actions,skeleton}.tsx`; `book/{page,slots,date,actions,skeleton}`; `waitlist/{page,list,skeleton}`; `money/{page,panel,actions,skeleton}`; `docs/owner-ia.md`. Deleted `owner/actions.ts`, `owner/skeletons.tsx`, `owner/book-slots.tsx`.

**Relation:** Use cases unchanged. Pages still have no Prisma / no `tenantId`. `"use server"` only on the three tab `actions.ts` files (plus login/public). Redirect map unchanged (today / book / money). No `loading.tsx`.

**How to verify:** `npm test`. Open `/owner/today` — approve still toasts on Today. Book a slot — stay on `/owner/book` with `bookOn`. Rate/expense still land on `/owner/money`. No import of `@/app/owner/actions`.

---

## Chapter 122 — 2026-09-12 — Owner chrome: waitlist cards, quieter header, Money heading

**When:** 2026-09-12

**What:** Waitlist people use the same card anatomy as Today (pitch + time + name/phone in `CardHeader`, إبلاغ full-width in `CardContent`). Shared owner header no longer uses a `text-2xl` stadium `h1`; stadium + role are muted, logout is ghost icon-only. Money has a page `h2` المال; period/rate/expenses are `h3` subsections like Today. Book/Waitlist page titles match Today’s `text-xl`.

**Why:** Waitlist looked unfinished vs Today. Stadium/logout were competing with the tab the owner opened (BR-9). Money was the only tab without a page heading.

**Files:** `src/app/owner/waitlist/list.tsx`; `layout.tsx`; `money/page.tsx`; `money/panel.tsx`; `waitlist/page.tsx`; `book/page.tsx`.

**Relation:** No Server Actions, use cases, or module boundaries. `LtrIsolate` on times/phones unchanged. Notify is still `wa.me` `<a>`, not an action.

**How to verify:** Waitlist card — name/phone stacked under the time, إبلاغ full-width like إلغاء. Header: stadium small, tab title (اليوم / المال) is the big type. Money opens with المال then هذه الفترة.

---

## Chapter 123 — 2026-09-12 — Shared SlotPicker for public hours and owner Book

**When:** 2026-09-12

**What:** Public and owner Book share one client `SlotPicker`: 2-col time+price grid, one expanded name/phone form. Props are `action`, `hiddenFields`, `submitLabel`, optional `locale`. Local pitch/slot view types — no `booking/`, access, or venue imports. Thin wrappers: `PublicSlotPicker` (`tenant`+`date`, اطلب) and `OwnerSlotPicker` (`tenant`+`bookOn`, احجز). Name/phone client checks moved to `src/lib/request-fields.ts`. Owner Book no longer stacks a form on every free slot. Auth stays on `/owner/book`.

**Why:** Owner booked more often than a visitor; N stacked forms was the public problem again. One picker, two wrappers, so the grids cannot drift.

**Files:** `src/components/slot-picker.tsx`; `src/lib/request-fields.ts`; `test/lib/request-fields.test.ts`; `src/app/(public)/slot-picker.tsx`; `hours.tsx`; `src/app/owner/book/picker.tsx`; `slots.tsx`; `skeleton.tsx`; `docs/owner-ia.md`. Deleted `(public)/request-fields.ts` and its old test path.

**Relation:** `submitPublicSlotRequest` / `submitCreateOwnerBooking` unchanged. `components/ui` still does not import `src/modules/*`. Pages still have no Prisma / no `tenantId`. No extra owner fields.

**How to verify:** `npm test`. Public — tap a free hour, one form, Taken muted, Request still `ok=requested`. Owner Book — same grid, one form, stays on `/owner/book` with `bookOn`. Staff without create still EmptyState. EN/ع still only public labels.

---

## Chapter 124 — 2026-09-12 — Owner Book uses public day chips

**When:** 2026-09-12

**What:** Owner Book date is the same five Link chips + calendar overflow as public hours. Shared `DayChips` / `DateCalendarChip` take `pathname` + `dateQueryKey` (`date` on `/`, `bookOn` on `/owner/book`). The GET date form and عرض الساعات button are gone. Chips sit outside `<Suspense>` so they stay mounted while slots load. Public `PublicDayChips` is a thin wrapper.

**Why:** Same interaction as public; owner books more often, so a submit-to-change-day form was extra friction.

**Files:** `src/components/day-chips.tsx`; `src/components/date-calendar-chip.tsx`; `src/app/(public)/day-chips.tsx`; `src/app/owner/book/page.tsx`; `docs/owner-ia.md`. Deleted `(public)/date-calendar-chip.tsx`.

**Relation:** `bookOn` query and create-booking redirect unchanged. `DateField` still used on Money. No use-case changes. Past `bookOn` still shows the past empty state.

**How to verify:** `npm test`. `/owner/book` — today/tomorrow chips, calendar for later days, slots update without a submit. Create booking still returns to the same `bookOn`. Public `?date=` chips unchanged.

---

## Chapter 125 — 2026-09-12 — SlotPicker v2: kickoff hierarchy, Volt duration, select motion

**When:** 2026-09-12

**What:** Slot tiles: start time is the hero; end is a smaller Slate line (`→ 17:00`); price + duration share the third line. Idle duration is the only Volt accent. Idle fill is `bg-card` plus a 1px `#dee2e6` hairline (`border-border` on these tiles only — `#ffffff` vs page `#f8f9fa` is ~1.02:1 and would vanish in sun). Selected is a 200ms ease-out fill-invert (no ring, no hover, no shadow). Taken is the same stack, muted, instant. No globals / `--border` change.

**Why:** Equal-weight `16:00–17:00` plus a snap invert read as a flat box. Kickoff is the number that matters; duration is real info (1h / 1.5h).

**Files:** `src/components/slot-picker.tsx`; `test/components/slot-duration.test.ts`.

**Relation:** Day chips unchanged. Request form still the expanded card; header uses the same type stack. No booking/access/venue types.

**How to verify:** `npm test`. Public/owner Book — idle tile: large 16:00, small → 17:00, `$30.00 · 1h` with Volt on `1h`. Tap — Volt fill over ~200ms. Taken: no Volt, محجوز. Day chips still have their own border.

---

## Chapter 126 — 2026-09-12 — Idle tile Slate hairline; light theme-color

**When:** 2026-09-12

**What:** Idle slot tiles use a 1px Slate hairline (`border-muted-foreground/40`, `#495057` at 40%) — not `#dee2e6`, not `shadow-sm`. Selected stays Volt invert (`border-primary`); taken stays the faint `border-border`. Root viewport is `themeColor: #f8f9fa` + `colorScheme: light` (local `generate-viewport.md`; Next default `themeColor` is null). `html` paints `--background` and `color-scheme: light` so OS-dark chrome / canvas does not show a black strip above the header.

**Why:** Chapter 125’s `#dee2e6` hairline was still invisible on-screen (sunlight risk confirmed). The black bar was not a tile style — missing theme-color on a light page.

**Files:** `src/components/slot-picker.tsx`; `src/app/layout.tsx`; `src/app/globals.css`.

**Relation:** `--border` / day chips unchanged. No use-case or route change.

**How to verify:** `npm test`. Idle tiles have a visible Slate line, no shadow. Selected invert unchanged. View source: `<meta name="theme-color" content="#f8f9fa">` and `<meta name="color-scheme" content="light">`. No black strip above the header.

---

## Chapter 127 — 2026-09-12 — Slot form is a dialog; ticket split on every tile

**When:** 2026-09-12

**What:** Name/phone is a compact Dialog over the grid (Carbon dim `bg-foreground/45` + `backdrop-blur-sm`, not `bg-black/80`). The 2-col board does not shift. Selected tile stays in place (Volt invert). Overlay / Esc / X dismisses. Ticket split (time | fare) is now idle, selected, and taken. Same Server Action and hidden fields.

**Why:** In-grid `col-span-2` was the smallest “one form” fix; it shoved stubs once tiles became tickets. Modal keeps the board still.

**Files:** `src/components/ui/dialog.tsx`; `src/components/slot-picker.tsx`; `src/lib/ui-copy.ts`; `src/app/(public)/skeletons.tsx`; `src/app/owner/book/skeleton.tsx`; `docs/owner-ia.md`.

**Relation:** `submitPublicSlotRequest` / `submitCreateOwnerBooking` unchanged. `components/ui` still does not import `src/modules/*`. No `--border` change.

**How to verify:** `npm test`. Public / owner Book — tap a free stub: grid stays put, tile inverts, dialog has the ticket face + name/phone. Overlay or Esc closes. Taken tiles use the same split. Request / احجز still `ok=`.

---

## Chapter 128 — 2026-09-12 — Scrollbar gutter both-edges; dialog does not open a white strip

**When:** 2026-09-12

**What:** `html { scrollbar-gutter: stable both-edges }` so `mx-auto` stays optically centered and the classic Windows bar never covers content. Dialog overlay is `left-0 w-screen` (covers the gutter). RemoveScroll’s extra `margin/padding-right` on `body[data-scroll-locked]` is zeroed — that gap was the white column beside the dim.

**Why:** `stable` alone reserved only the bar’s side, so the column sat off-center. Opening the dialog hid the bar and RemoveScroll added a second gap on top of the gutter.

**Files:** `src/app/globals.css`; `src/components/ui/dialog.tsx`.

**Relation:** Same Dialog / Server Action. Overlay still Carbon dim + light blur.

**How to verify:** Long Book page — column centered with or without a bar. Open a slot — dim covers the full viewport, no white strip, page behind does not jump.

---

## Chapter 129 — 2026-09-12 — Thin Volt scrollbar; drop both-edges gutter

**When:** 2026-09-12

**What:** Dropped `scrollbar-gutter: stable both-edges` (empty lanes on both sides). Page and nested overflow use a 6px Volt thumb (`--primary`) on a transparent track; Firefox `scrollbar-width: thin`. One-side `stable` gutter remains so the bar does not cover tiles. Dialog overlay / RemoveScroll zeroing from ch. 128 stays.

**Why:** Both-edges reserved matching empty space opposite the bar — the new white columns. A thin Volt bar matches the rest of the UI and needs only one thin lane.

**Files:** `src/app/globals.css`.

**Relation:** Dialog dim still `w-screen`. No token change.

**How to verify:** Book page — thin Volt bar, no empty strip on the other side. Open a slot — dim edge to edge.

---

## Chapter 130 — 2026-09-12 — Drop scrollbar-gutter; overlay spans 100vw

**When:** 2026-09-12

**What:** Removed `scrollbar-gutter` (the reserved lane stayed empty and white when the dialog hid the bar). Overlay is `100vw` with `margin-left: calc(50% - 50vw)` so the dim covers the visual viewport. Volt thumb is inset via a transparent border so it reads as a thin overlay, not a solid column.

**Why:** `stable` + `overflow: hidden` on `html` left an uncovered gutter. Padding-zero on RemoveScroll was not enough.

**Files:** `src/app/globals.css`; `src/components/ui/dialog.tsx`.

**How to verify:** Open a slot on Book — dim is edge to edge, no white column. Scrollbar is a thin Volt pill, not a reserved white lane.

---

## Chapter 131 — 2026-09-12 — Owner header EN/ع toggle

**When:** 2026-09-12

**What:** Owner header has the same EN/ع control as public (`LangToggle`, cookie `stadium_locale`, `html` lang/dir). Shared component; `setUiLocale` lives at `src/app/locale-actions.ts`. Owner chrome, tabs, and tab pages pass `locale` into `ui()`. English strings cover owner / empty / role / category keys. Stadium and pitch names stay as stored.

**Why:** Public already flipped dir; owner copy was hardcoded Arabic so a header button would only change layout.

**Files:** `src/components/lang-toggle.tsx`; `src/app/locale-actions.ts`; `src/app/owner/layout.tsx`; `tab-bar.tsx`; today/book/waitlist/money pages + lists/panel/picker; `src/lib/ui-copy.ts`; `test/lib/ui-copy.test.ts`; `docs/owner-ia.md`.

**Relation:** Same cookie as public. No next-intl. Login still defaults to Arabic until that screen gets the button.

**How to verify:** `npm test`. `/owner/today` — EN in the header; tabs and Today copy go English + LTR. ع returns Arabic + RTL. Public `/` still shares the cookie.

---

## Chapter 132 — 2026-09-13 — Home tab (replace Today inbox)

**When:** 2026-09-13

**What:** `/owner/today` is the Home tab (رئيسية / الرئيسية). Two sections, not a merged timeline. **طلبات:** all PENDING any date, soonest slot then BR-17 `requestedAt` inside a slot; competing requesters grouped on one card with approve/reject always visible. **القادم:** compact confirmed rows (time, pitch, name, قادم/مستحق/مدفوع); tap-in Collect / دفع بعملتين / Cancel. Today by default; **عرض الأيام القادمة** appends the next 7 Beirut civil days. **متأخر** prepends unpaid APPROVED before today (BR-49). URL stays `/owner/today`. Server Actions unchanged.

**Why:** Owner IA — ops inbox vs compact upcoming. BR-49 forbids dropping past unpaid with no collect path.

**Files:** `src/modules/booking/domain/home-inbox.ts`; `infrastructure/bookings.ts` (pending ORDER BY; approved in-range + starting-before); `application/list-due-bookings.ts`; `src/modules/venue/domain/availability.ts` (`civilDayUtcRange`); `src/app/owner/today/lists.tsx`, `upcoming-panel.tsx`, `date-label.ts`; `tab-bar.tsx`; `src/lib/ui-copy.ts`; `docs/owner-ia.md`.

**Relation:** Booking application still attaches remaining via Payment sums (no payment join in Booking SQL). `rejectOverlappingPending` still uses `listPendingBookings` (order unused). Home display sort is soonest slot; SPEC-05 approve semantics unchanged.

**How to verify:** `npm test`. `/owner/today` — tab House + رئيسية; pending any date with inline date; competing slot shows all requesters + buttons; today compact tags; tap row for collect/cancel; overdue unpaid above today; coming-days toggle. Staff without approve/collect: lists without those forms.

---

## Chapter 133 — 2026-09-13 — Home collect: due vs remaining figures

**When:** 2026-09-13

**What:** Tap-in collect detail shows due and remaining as two labeled tiles instead of one `Due $30 · remaining $30` sentence. Remaining uses Volt when still owed; both quiet when remaining is `$0.00`.

**Why:** Same number twice in one muted line was hard to scan on the phone.

**Files:** `src/app/owner/today/upcoming-panel.tsx`; `src/lib/ui-copy.ts` (`owner.remaining`).

**How to verify:** `/owner/today` — expand a confirmed row. Due is Slate tile; remaining is Volt if unpaid. Paid row: remaining muted.

---

## Chapter 134 — 2026-09-13 — Home cards: time hero, icons, real status pills

**When:** 2026-09-13

**What:** Home request and upcoming cards: time is the scan target (`text-lg semibold` + Clock). Pitch is MapPin + muted; phone is Phone + LTR (requests + expanded detail). Status tags are `Badge outline` in both locales — قادم/مدفوع were `ghost` (no pill). Paid includes a Volt `CircleCheck`. Dropped the extra “pending” pill on competing requesters (section is already طلبات). Weekday labels are short in both locales.

**Why:** Owner scans outdoors (G-1 / A-3). Ghost badges looked like plain text. Time was the same size as pitch and name.

**Files:** `src/app/owner/today/lists.tsx`; `upcoming-panel.tsx`; `date-label.ts`.

**How to verify:** `/owner/today` AR and EN. Time is the largest line. Upcoming/Due/Paid are pills. Expand a row: phone has a Phone icon, not a bare number.

---

## Chapter 135 — 2026-09-13 — Toast above the tab bar

**When:** 2026-09-13

**What:** Sonner Toaster is `top-center` (safe-area offset) instead of default bottom. Owner tab bar stays tappable after Approve/Collect.

**Why:** Bottom toasts sat on the Home tab strip on a phone.

**Files:** `src/components/ui/sonner.tsx`.

**How to verify:** Approve or collect on `/owner/today` — toast appears under the status bar, not over رئيسية / احجز.

---

## Chapter 136 — 2026-09-13 — No Cancel on past unpaid (BR-49)

**When:** 2026-09-13

**What:** Cancel is hidden on Home when `start <= now` and remaining > 0. `cancelBooking` uses the same `sumCollectedUsd` + `remainingDue` as collect, then `assertNotPastUnpaidCancel`. Future games and past paid still cancel. Collect unchanged.

**Why:** SPEC-10 allowed Cancel on any APPROVED; cancelling a past unpaid game dropped the debt with no ledger trace (BR-49).

**Files:** `src/modules/booking/domain/decision.ts`; `application/cancel-booking.ts`; `infrastructure/bookings.ts` (`priceUsd` on decision load); `src/app/owner/today/lists.tsx`, `upcoming-panel.tsx`; `src/lib/error-messages.ts`; tests.

**Relation:** No Payment write. Action stays thin. No-show still unused.

**How to verify:** `npm test`. Home — expand a due/overdue row after kickoff: Collect, no Cancel. Future unpaid: Cancel still there. Paid past: Cancel still there. Stale POST → toast `booking.cancel_past_unpaid`.

---

## Chapter 137 — 2026-09-13 — Toast follows locale; dismiss X

**When:** 2026-09-13

**What:** Flash toasts use the cookie locale (`errorMessage` / `successMessage` take `UiLocale`). English catalog for every existing key. Sonner `closeButton` with lucide X; aria-label from `dialog.close`. Toaster `dir` matches `html`.

**Why:** Banner stayed Arabic after EN. No way to dismiss besides waiting/swiping.

**Files:** `src/lib/error-messages.ts`; `success-messages.ts`; `src/components/ui/flash-toast.tsx`; `sonner.tsx`; `src/app/layout.tsx`; owner + public FlashToast callers; tests.

**How to verify:** `npm test`. Switch to English, approve/collect — toast is English. X dismisses it. Arabic still Arabic.

---

## Chapter 138 — 2026-09-13 — Reports tab + More / Settings

**When:** 2026-09-13

**What:** Bottom bar is five tabs: Home / Book / Waitlist / Reports / More. `/owner/money` stays (heading + tab = تقارير / Reports); period + expenses stay; exchange-rate **set** form moved to `/owner/more/settings`. More is a hub (Settings only for now). Waitlist tab label shortens to انتظار; page heading stays قائمة الانتظار.

**Why:** Rate is stadium config, not a report. More is the reserved home for Settings extras, Tournaments, Shop, Academy — the bar does not grow again.

**Files:** `src/app/owner/tab-bar.tsx`; `money/page.tsx`, `panel.tsx`, `actions.ts`; `more/page.tsx`; `more/settings/{page,panel,actions,skeleton}.tsx`; `src/lib/ui-copy.ts`; `docs/owner-ia.md`; tests.

**Relation:** `setExchangeRate` / `recordExpense` use cases unchanged. Reports still **reads** `getCurrentRate()` for LBP display. No pitch UI (known gap). No `loading.tsx` under `/owner`.

**How to verify:** `npm test`. Owner bar shows 5 labels including تقارير and المزيد. Reports has period + expenses, no rate form. More → Settings: OWNER can set rate; toast lands on Settings. Waitlist tab says انتظار; heading is still قائمة الانتظار.

---

## Chapter 139 — 2026-09-13 — Reports Pass 1: hero, disclosure, expense rows

**When:** 2026-09-13

**What:** Reports summary: difference is `text-2xl`; In tile Volt, Out tile due-muted; CSS In/Out bars from the two totals (no library). Period GET form behind “Change period”; record-expense form behind “Add expense”. Expense history is compact cards (lucide category icon, description, LTR date, mono amount). Default period remains this Beirut calendar month.

**Why:** Home-style priority disclosure. The form and raw em-dash list buried the number. SPEC-08 said no JS chart — this is two CSS bars, not a series.

**Files:** `src/app/owner/money/panel.tsx`, `reveal.tsx`, `bars.ts`; `src/lib/ui-copy.ts`; `docs/owner-ia.md`; `test/app/owner/money/bars.test.ts`.

**Relation:** `summarizeLedgerPeriod` / `recordExpense` / `listRecentExpenses` unchanged. No new query. Out color may still read as “needs action” (Home due) — revisit after live use, not a new token now.

**How to verify:** `npm test`. `/owner/money` — net is the largest figure; In/Out tiles; bars; “تغيير الفترة” / “إضافة مصروف” collapsed. Expense rows are cards, not an em-dash sentence.

---

## Chapter 140 — 2026-09-13 — Pitch MVP: daily window + flatten/pending confirm

**When:** 2026-09-13

**What:** Owner Settings lists pitches and (OWNER only) create/edit: name, one open/close copied to all 7 days, slot duration, default USD. Writes go through `parseScheduleConfig` with `gapMinutes: 0` and `priceRules: []`. Hours-cover (not generated-slot match) refuses live APPROVED in a removed window; PENDING in a removed window and flatten-of-mixed-days/`priceRules` use the same checkbox second-submit (`confirmPending` / `confirmFlatten`). Duration-only changes do not trip hours-cover. `approveBooking` re-checks `resolveOfferedSlot` against current hours before flipping PENDING → APPROVED.

**Why:** Seed was the only pitch writer. Flatten must not silently wipe Ahmad A1 Fri/Sat hours and weekend `priceRules`. DR-001: Venue does not import Booking — `listLiveWindowsOnPitch` feeds `{ start, end, status }[]` into `updatePitch`.

**Files:** `src/modules/venue/domain/{daily-schedule,hours-cover}.ts`, `availability.ts` (`bookingFitsOpenHours`); `schemas/pitch-draft.ts`; `application/{create-pitch,update-pitch,list-pitch-summaries,get-pitch-editor}.ts`; `infrastructure/pitches.ts`; `src/modules/booking/infrastructure/bookings.ts` (`listLiveWindowsOnPitch`); `application/{list-live-pitch-windows,approve-booking}.ts`; `src/app/owner/more/settings/panel.tsx`; `pitches/{new,[pitchId],form,actions}`; copy catalogs; `docs/owner-ia.md`; tests.

**Relation:** Booking/Payment writes unchanged except the live-window read and approve re-check. No `priceRules` editor, per-day grid, `pitch_blocks`, or pitch delete.

**How to verify:** `npm test`. More → Settings: pitch list (A1 = ساعات مختلفة). Edit A1 — flatten checkbox visible; save without it toasts `venue.confirm_flatten` and does not write. Check it, save — all 7 days match the form window, `priceRules` empty. Shrink hours over a live APPROVED → refuse. Over PENDING only → checkbox then save (request stays PENDING). Approve a request whose hour was closed → `booking.slot_not_offered`, still PENDING.

---

## Chapter 141 — 2026-09-13 — Day priceRules editor; flatten is hours-only

**When:** 2026-09-13

**What:** Pitch create/edit can add repeatable day-checkbox + USD `priceRules` (cap 10). Flatten retargeted to **hours mismatch only** — weekend prices no longer trip the confirm, and a duration/default-price save with unchanged hours keeps existing rules. `gapMinutes` stays hardcoded 0. Time-of-day rule clocks are not in the UI; stored `start`/`end` round-trip in the JSON draft if already present.

**Why:** BR-5 (weekend costs more). The MVP wrote `priceRules: []` and treated any rules as flatten, so A1 could not keep $40 Fri/Sat. Gap stays hidden because it moves the offered grid and hours-cover would not warn.

**Files:** `src/modules/venue/domain/daily-schedule.ts`; `schemas/pitch-draft.ts`; `application/{create-pitch,update-pitch,get-pitch-editor}.ts`; `src/app/owner/more/settings/pitches/{form,price-rules,actions,new,[pitchId]}`; copy catalogs; `docs/owner-ia.md`; tests.

**Relation:** No Booking/Payment write changes. Per-day hours grid, time-window rule editor, and `gapMinutes` UI stay out.

**How to verify:** `npm test` (includes duration+price-only save keeps weekend rules and `hoursSaveBlocker` is null). Edit a uniform-hours pitch with Fri/Sat $40 — no flatten checkbox; change duration or default USD; save; public/book still shows $40 on those days. Mixed-hours A1 still shows flatten for hours.

---

## Chapter 142 — 2026-09-13 — Price-rule checkbox ids must not use a module counter

**When:** 2026-09-13

**What:** `PriceRuleRows` used a module-level `rowSeq` for checkbox `id`/`htmlFor`. The Node module kept incrementing across SSR, so the client started at `r0` while the HTML was `r2` (hydration mismatch). Ids are now `useId()` + stable row index; new rows after click use a `useRef` (never during SSR).

**Why:** React hydrates against the server HTML. A process-wide counter is `Date.now()`/`Math.random()`-class input.

**Files:** `src/app/owner/more/settings/pitches/price-rules.tsx`

**How to verify:** Open `/owner/more/settings/pitches/[pitchId]` for A1 — no hydration warning in the console. Day checkboxes still toggle.

---

## Chapter 143 — 2026-09-13 — Hours groups; flatten retired

**When:** 2026-09-13

**What:** Pitch create/edit replaces the single Opens/Closes pair with repeatable hours groups (weekday checkboxes + one open/close per row). Collapse walks `WEEKDAYS`, skips `[]`, and groups identical window arrays — A1 is two rows (Mon–Thu 16:00–22:00, Fri–Sat 16:00–23:00) plus Sun closed. A day in two rows is disabled in the UI and rejected as `venue.hours_day_overlap`. Flatten (`confirmFlatten` / `needFlatten` / `venue.confirm_flatten`) is gone. Pending-in-removed-hours confirm stays. `gapMinutes` stays 0. Known limit: schema still allows several windows per day; the editor and collapse use `window[0]`.

**Why:** The schema already stored per-day hours; the form was writing one window onto all seven days and treating mixed days as a flatten confirm. That was a schema/form mismatch, not a copy problem. BR-3/4.

**Files:** `src/modules/venue/domain/{daily-schedule,hours-cover}.ts`; `schemas/pitch-draft.ts`; `application/{create-pitch,update-pitch,get-pitch-editor,list-pitch-summaries}.ts`; `src/app/owner/more/settings/{panel,pitches/form,hours-groups,actions,new,[pitchId]}`; copy catalogs; `docs/owner-ia.md`; tests.

**Relation:** Booking/Payment writes unchanged. Venue still does not import Booking. No time-window `priceRules` UI, no `gapMinutes` UI, no pitch delete, no `pitch_blocks`.

**How to verify:** `npm test`. Edit Ahmad A1 — two hours rows + Sun closed; Fri/Sat $40 still in Day Prices; no flatten checkbox. Duration-only save keeps hours groups and weekend prices. Duplicate day → `venue.hours_day_overlap`. Shrink hours over live APPROVED → refuse; PENDING-only → confirm then save.

---

## Chapter 144 — 2026-09-13 — SPEC-14 no-show (BR-22)

**When:** 2026-09-13

**What:** Fast-forwarded `main` to include Settings / hours groups, branched `feature/spec-14-no-show`. Owner (or `"bookings.no_show"`) records APPROVED → `NO_SHOW` after the hour has ended. Unpaid no-show stays on Home overdue/today so Collect still works (`assertCanCollect` allows `NO_SHOW`). Paid no-show leaves Home. Cancel, waitlist, exclusion, and ledger writes are unchanged. No confirm dialog.

**Why:** BR-22 wants “didn’t happen” distinct from cancel. Cancel already refuses past unpaid (BR-49 / ch.136); no-show is that close-out without dropping the debt. DR-002 §2.12: status, not a boolean. SPEC-14.

**Files:** `docs/specs/SPEC-14-no-show.md`; `src/modules/access/domain/can.ts`; `booking/domain/decision.ts`; `application/{record-no-show,list-due-bookings,collect-booking-payment}.ts`; `infrastructure/bookings.ts`; `payment/domain/collect.ts`; `src/app/owner/today/{actions,lists,upcoming-panel}`; copy catalogs; `docs/owner-ia.md`; tests.

**Relation:** Payment still does not import Booking. Waitlist / public occupancy unchanged (`NO_SHOW` does not occupy). Pitch Settings untouched.

**How to verify:** `npm test`. Home — after a finished unpaid APPROVED, expand: Collect + لم يحضر, no Cancel. Tap no-show; still Collect. Collect remaining → row leaves. Future row: no No-show. `staff@ahmad`: no button. Stale POST before end → `booking.no_show_not_ended`.

---

## Chapter 145 — 2026-09-14 — Confirm-notify WhatsApp on Home

**When:** 2026-09-14

**What:** After Approve, Home’s confirmed row can إبلاغ via `wa.me` with a “booking confirmed” Arabic body. Link is a static `<a>` (same as waitlist), not a Server Action. Expand groups إبلاغ above تحصيل. Successful Approve redirects `ok=approved&highlight=<id>`; FlashToast still strips only `ok`; the row keeps a primary ring (coming-days opens if that id is in `later`). No auto-expand. Owner Book and reject-notify out.

**Why:** BR-71 “booking confirmed”. Players have no login. Waitlist Notify is the losers’ hour-freed message; the winner’s confirm belongs on Home’s APPROVED expand. `approveBooking` is unchanged — notify is after the fact.

**Files:** `src/modules/notification/domain/whatsapp-link.ts` (`bookingConfirmedMessage`); `src/modules/booking/application/list-due-bookings.ts`; `src/app/owner/today/{actions,page,lists,upcoming-panel}`; `src/components/ui/flash-toast.tsx`; `src/lib/ui-copy.ts`; `docs/owner-ia.md`; tests.

**Relation:** Notification still does not import Booking. Booking builds the href. No Payment/Ledger write. `scrollIntoView` for a deep coming-days highlight is deferred on purpose (owner-ia Home deferred).

**How to verify:** `npm test`. Login `owner@ahmad` → pending Request → Approve → toast + ring on that القادم row (`highlight=` stays in the URL). Expand: إبلاغ then Collect/Cancel. Link opens WhatsApp; text is `{stadium}: {pitch} {start}–{end} تم تأكيد حجزك.` Unpaid NO_SHOW: no إبلاغ. Coming-days approve: that section is open, row may still be off-screen (no scrollIntoView yet).

---

## Chapter 146 — 2026-09-14 — Home confirmed details in a bottom sheet

**When:** 2026-09-14

**What:** Confirmed Home rows stay compact. Tap opens a shared bottom sheet (slide up, overlay, scroll inside) with إبلاغ + Collect/Cancel/No-show. Rows show a trailing chevron (`rtl:rotate-180`), hover/active wash, and `cursor-pointer` so they read as tappable. `BottomSheet` is a general Dialog-based component — same overlay/RemoveScroll rules as the centered dialog; no extra library.

**Why:** Inline expand made the list very tall. A sheet keeps the list scannable and the actions on one surface. Chevron is the affordance that was missing.

**Files:** `src/components/ui/bottom-sheet.tsx`; `src/app/owner/today/upcoming-panel.tsx`; `src/lib/ui-copy.ts`; `docs/owner-ia.md`; `test/lib/ui-copy.test.ts`.

**Relation:** No Booking/Payment write changes. Highlight ring still on the compact row. Sheet is not auto-opened after Approve.

**How to verify:** `npm test`. Home — compact confirmed rows with chevron. Tap: sheet slides up over the tab bar; overlay tap / Esc / close dismisses. Collect and إبلاغ still work in the sheet. RTL: chevron points toward the start edge.

---

## Chapter 147 — 2026-09-14 — Cancel booking is not “close the sheet”

**When:** 2026-09-14

**What:** Home sheet no longer has a full-width outline **إلغاء** that reads as dismiss. The sheet still closes with X / overlay / Esc (`إغلاق`). Booking cancel is a separate ghost **إلغاء الحجز**, then a red **تأكيد إلغاء الحجز** (hint: hour is freed) with **تراجع**. `cancelBooking` is unchanged.

**Why:** In a bottom sheet, “Cancel” is the usual name for go-back. One tap was flipping APPROVED → CANCELLED forever. The owner (and the person who built it) hit it by mistake.

**Files:** `src/app/owner/today/upcoming-panel.tsx` (`CancelBookingControl`); `src/lib/ui-copy.ts`; `docs/owner-ia.md`; `test/lib/ui-copy.test.ts`.

**Relation:** No domain/status-rule changes. No-show stays one tap (`لم يحضر` does not mean close).

**How to verify:** `npm test`. Open a confirmed row → X / dim / Esc close the sheet, booking stays APPROVED. إلغاء الحجز does not submit; تأكيد إلغاء الحجز does. تراجع returns to the quiet button.

---

## Chapter 148 — 2026-09-14 — Cancel confirm replaces the sheet, does not grow it

**When:** 2026-09-14

**What:** Tap إلغاء الحجز swaps the sheet to a short confirm view (title, which booking, hint, تأكيد / تراجع). Collect / إبلاغ go away until تراجع. Confirm buttons stay above the screen edge; no extra scroll. Close / open another row resets the step.

**Why:** Appending the red confirm under Collect made a already-tall sheet taller; تأكيد sat under the fold.

**Files:** `src/app/owner/today/upcoming-panel.tsx`; `docs/owner-ia.md`.

**Relation:** Still two taps, same `submitCancelBooking`. No domain change.

**How to verify:** Open a confirmed row with Collect visible → إلغاء الحجز → sheet shrinks; تأكيد and تراجع are on-screen without scrolling. تراجع restores Collect. X still only closes.

---

## Chapter 149 — 2026-09-14 — Smooth sheet height + close

**When:** 2026-09-14

**What:** Cancel confirm/back eases the sheet height (~320ms, same curve as the slide) and crossfades the two bodies. Closing X / overlay / Esc keeps the sheet mounted so it can slide down instead of vanishing. Opening the confirm step again does not replay that height anim during the slide-up.

**Why:** Instant swap felt hard. Unmounting `BottomSheetContent` on `openId = null` cancelled the exit animation.

**Files:** `src/components/ui/bottom-sheet.tsx` (`BottomSheetStage`); `src/app/owner/today/upcoming-panel.tsx`; `docs/owner-ia.md`.

**Relation:** Still two taps, same `submitCancelBooking`. No domain change.

**How to verify:** Open a confirmed row — sheet slides up. إلغاء الحجز — sheet shrinks, buttons fade in. تراجع — sheet grows back. X / dim — sheet slides down. Reduced-motion: instant swap, no height tween.

---

## Chapter 150 — 2026-09-14 — Cancel step: inert, not aria-hidden on focused button

**When:** 2026-09-14

**What:** Hidden sheet step uses `inert` only (no `aria-hidden`). Tap إلغاء الحجز blurs first, then focus moves to تأكيد إلغاء الحجز; تراجع returns focus to إلغاء الحجز.

**Why:** Chrome blocked `aria-hidden` on the details panel because إلغاء الحجز still had focus. Spec: don’t hide a focused descendant; `inert` also prevents focus.

**Files:** `src/app/owner/today/upcoming-panel.tsx`

**Relation:** Same two-step cancel. No domain change.

**How to verify:** Open a confirmed row → إلغاء الحجز. Console should not show the aria-hidden focus warning. Focus ring lands on تأكيد; تراجع lands on إلغاء الحجز.

---

## Chapter 151 — 2026-09-14 — Home sheet hierarchy and mixed-pay disclosure

**When:** 2026-09-14

**What:** Confirmed booking sheet: time is SlotFace-scale; pitch + name one muted line; phone is a small header icon+number. Due/remaining collapse to one remaining hero when they match; two tiles only after a partial. إبلاغ is ghost above a divider; Collect is the primary. USD/LBP hide behind دفع بعملتين (one-tap Collect unmounts while open). Mixed USD is remaining, labeled المتبقي بالدولار, not a $30 placeholder.

**Why:** Every field had the same weight. Slot picker and Home rows already had progressive disclosure; this sheet had not.

**Files:** `src/app/owner/today/upcoming-panel.tsx`; `src/lib/ui-copy.ts`; `test/lib/ui-copy.test.ts`; `docs/owner-ia.md`.

**Relation:** No `submitCollectPayment` / cancel / WhatsApp-href changes. Cancel-confirm step unchanged.

**How to verify:** `npm test`. Unpaid equal price/remaining: one hero, one Collect, no currency fields until دفع بعملتين. Open mixed: one-tap gone; USD prefilled remaining. Partial: two tiles. Paid: no Collect. RTL: no `pl`/`pr`.

---

## Chapter 152 — 2026-09-14 — Sheet start-edge, phone+إبلاغ, mixed outline

**When:** 2026-09-14

**What:** Booking sheet copy and amounts use `text-start`; remaining hero/tiles drop extra `px` so `$` sits on the same start edge as تحصيل. إبلاغ is a compact outline on the phone row (not its own section). دفع بعملتين is a full-width outline button; mixed disclosure (unmount one-tap, remaining USD) is unchanged.

**Why:** `$25.00` read as centered; إبلاغ did not belong to the number; ghost `self-start` دفع بعملتين looked like a label.

**Files:** `src/app/owner/today/upcoming-panel.tsx`; `docs/owner-ia.md`.

**Relation:** Same `wa.me` `<a>` and `submitCollectPayment`. No domain change.

**How to verify:** Open a confirmed APPROVED row. Phone and إبلاغ share a row. Time, remaining, Collect, دفع بعملتين, Cancel share the RTL start edge. دفع بعملتين has a border; tap still reveals USD/LBP and hides one-tap Collect.




























## Integration tests � dedicated prisma dev instance + Phase 1 cases

**When:** 2026-09-15

**What:** Priority-1 integration harness against real Postgres: smoke, `isExclusionViolation` (real `23P01`), `approveBooking` happy path, exclusion?`booking.slot_unavailable` mapping, deadlock guards A (elapsed < 5s) + B (`platformDb.tenant.findUnique` = 0 after warm-up).

**Why:** Prove exclusion + transactional approve without mocks of `23P01`. User confirmed dedicated test DB (not reuse-dev) and both A+B deadlock checks.

**Gotcha:** Local `prisma dev` **ignores the database name** in the URL and always serves `template1` for that named instance. `CREATE DATABASE stadiums_test` on the demo proxy does **not** isolate � early truncates wiped demo data (reseeded). Isolation = `prisma dev --name stadiums-test` on TCP **:51218**, never demo **:51214**. Local proxy is **single-connection**; truncate must use the app Prisma pool (no second `pg.Pool`); concurrent dual `` is not viable for the TOCTOU race � mapping test uses optional `deps.listApprovedRanges`.

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

**How to verify:** `/owner/money` with negative Difference shows `-$…`; Add expense opens sheet; list rows show tinted icons.

## Venue: atomic `updatePitch`

**When:** 2026-09-15

**What:** `updatePitch` wraps find → hours-cover classify → update in one `db.$transaction`. `findPitch` / `updatePitchRow` take `tx: TenantTx` (pass interactive `tx` or top-level `db`). `findPitchById` is a same-select alias for Booking call sites. Left `listPitches` / `insertPitch` / Access memberships on `db` (low near-term risk).

**Why:** Only realistic near-term mid-transaction Venue trigger from the engineering-audit footgun analysis — Settings hours save should be atomic.

**Files:** `src/modules/venue/infrastructure/pitches.ts`, `application/update-pitch.ts`, `application/get-pitch-editor.ts`.

**How to verify:** Edit pitch hours in Settings and save; approve/public booking still use `findPitchById(tx, …)`.

## Priority 3 dedup — starting

**When:** 2026-09-15

**What (planned):** (1) Shared internal booking insert helper; keep `insertPendingPublicBooking` / `insertApprovedOwnerBooking` exports. (2) One shared local HH:mm formatter. (3) Comments that `COMING_DAYS=7` vs `WINDOW_DAYS=5` are different concepts. (4) Delete dead `src/lib/db-with-comments.ts`.

**Why:** Engineering-audit Priority 3 — refactor/document only, no product behavior change.

## Priority 3 dedup — done

**When:** 2026-09-15

**What:** (1) `insertBookingDuring` shared helper; exports `insertPendingPublicBooking` / `insertApprovedOwnerBooking` unchanged. (2) `src/lib/format-local-hm.ts` — used by get-day-availability, list-due-bookings, list-open-waitlist, owner `formatLocalClock`. (3) Comments: `COMING_DAYS=7` = Home booking horizon; `WINDOW_DAYS=5` = day-chip strip (different concepts). (4) Deleted `src/lib/db-with-comments.ts` (zero imports).

**Why:** Engineering-audit Priority 3 — dedup/document only.

**Files:** `bookings.ts`, `format-local-hm.ts` + test, `get-day-availability.ts`, `list-due-bookings.ts`, `list-open-waitlist.ts`, `owner/shared.tsx`, `day-chips.tsx`; removed `db-with-comments.ts`.

**How to verify:** `npm test` — 224 passed.

## Docs: folder-structure.md matches the tree

**When:** 2026-09-15

**What:** Rewrote `docs/guides/folder-structure.md` from a stale target sketch (`[locale]`, `middleware.ts`, `lib/auth.ts`, `lib/i18n.ts`, `platform/`, module `ui/`) to the actual layout: `src/proxy.ts`, `(public)` / `login` / `owner/*`, `components/`, modules without `ui/`, access-owned auth, cookie locale helpers, `src/prisma/`.

**Why:** Engineering audit + owner-ia flagged this guide as describing files that are not in the repo.

**Files:** `docs/guides/folder-structure.md` only.

**How to verify:** Open the guide and walk the tree under `src/` — listed paths should exist; commented “no …” notes should stay absent.

## Audit: error handling + logging (read-only)

**When:** 2026-09-15

**What:** Full consistency audit of Server Actions + application use cases vs DR-004/SPEC-12, plus logger completeness vs business events. No code fixes.

**Why:** Need evidence before claiming “every error has an expected shape” / “we can debug production from logs.”

**Files:** `docs/guides/error-handling-logging-audit.md` (new).

**How to verify:** Open that guide — every claim cites file/line; ordered P0–P3 list at the end.

## P0: logout action wrap + WhatsApp soft-fail logs

**When:** 2026-09-15

**What:** (1) `submitLogout` try/catch + `actionErrorKey` → `?error=` on login (same shape as `submitLogin`). (2) Home confirm + waitlist WhatsApp catch blocks `logger.info` with useCase + tenantId, still return null (no phone in log).

**Why:** Error-handling audit P0 — DR-004 action boundary + “log side-effect failures”; RULE-9 soft-fail unchanged. `info` not `error`: bad phone is expected data, not a system bug.

**Files:** `src/app/login/actions.ts`, `list-due-bookings.ts`, `list-open-waitlist.ts`.

**How to verify:** `npm test` — 224 passed. Force logout DB failure → login `?error=`; bad phone on Home/waitlist → null href + line in `logs/`.

## P1: read-path wrap + business-log context

**When:** 2026-09-15

**What:** (1) `rethrowUnexpected` on every audited list/get/summarize use case (auth / `getCurrentTenant` stay outside try so `access.not_allowed` and `notFound` are unchanged). (2) Business `logger.info` lines pass `{ useCase, tenantId }` like error paths; message text unchanged.

**Why:** Error-handling audit P1 — Prisma failures on reads must hit the logger; success events must be greppable by tenant/useCase on the droplet.

**Files:** 11 read wraps + 12 info-context updates (23 unique application files).

**How to verify:** `npm test` — 224 passed. Approve/collect → `logs/` line includes `useCase=` + `tenantId=`.

## Audit: MVP readiness (read-only)

**When:** 2026-09-15

**What:** Full launch-readiness audit — BRD Phase 1 traceability, money integrity, isolation (unproven by automation), droplet performance, i18n/RTL, docs drift, deploy, fresh YAGNI/DRY. No code fixes. Isolation test not run (fixture needs parameterization).

**Why:** Need an honest “hand to a paying owner?” answer with file evidence, not architecture vibes.

**Files:** `docs/guides/mvp-readiness-audit.md` (new).

**How to verify:** Open that guide — eight sections + ordered P0–P3 must-close list; verdict is pilot-with-supervision, not production-ready.

## Isolation integration test (RULE-7) + tenant guard fix

**When:** 2026-09-15

**What:** Parameterized `seedMinimalFixture` + `seedTwoTenants`. New `test/integration/isolation.integration.test.ts` — under A’s context: findUnique null for B’s pitch, listPitches excludes B, update throws + B unchanged, `requestPublicSlot` → `booking.pitch_not_found` with no B booking. Guard fix in `db.ts`: inject `tenantId` into findUnique select when omitted; **pre-check** update/delete via `findFirst({ ...where, tenantId })` (post-check was too late — write already committed).

**Why:** MVP readiness P0 — prove RULE-7 in practice. First run exposed that `findPitch`/`updatePitchRow` selects without `tenantId` skipped the post-check, so cross-tenant update succeeded.

**Files:** `test/integration/fixtures.ts`, `isolation.integration.test.ts`, `src/lib/db.ts`.

**How to verify:** `npm run test:integration` — 11 passed (4 suites).

## Docs consolidation — NOW.md entry point

**When:** 2026-09-15

**What:** Added `docs/NOW.md` as the single living status entry. Rewrote root `README.md` and `docs/README.md` to point at it. Fixed living staleness (`owner-ia` proxy TODO, prisma-transaction-tenant-guard footer, progress **Where we are**). One-line superseded banners on SPEC-01, DR-001, DR-005, SPEC-13, and the three dated audits. No audit merges, no progress rollup.

**Why:** Docs had grown redundant/stale; agents need one clear start page.

**Files:** `docs/NOW.md`, `README.md`, `docs/README.md`, `docs/owner-ia.md`, `docs/guides/prisma-transaction-tenant-guard.md`, `docs/progress.md` (Where we are), banner lines on listed historical docs.

**How to verify:** Open `docs/NOW.md` — status, topic table, What’s next = backup + deploy docs.

## Owner time display 12h/24h (Tenant.settings)

**When:** 2026-09-15

**What:** Additive `Tenant.settings` jsonb (default `{}`). Zod `timeDisplay: h23|h12`. OWNER Settings card below Exchange rate. `getCurrentTenant` parses settings once per request. Owner Home / Book / Waitlist pass `hourCycle` into `formatLocalHm` / `getDayAvailability`; public + WhatsApp keep default h23. No SPEC-15 � Settings slice like pitch hours.

**Why:** Owners asked for 12h clocks; Arabic AM/PM on WhatsApp was a known risk, so customer-facing surfaces stay 24h. DR-002 �2.6 column finally exists for this knob only.

**Files:** `src/prisma/schema.prisma` + migration `20260915060000_tenant_settings`; `src/lib/tenant-settings.ts`; `src/lib/tenant-context.ts`; `src/lib/format-local-hm.ts`; `src/modules/access/{application/set-time-display,infrastructure/tenants}.ts`; `src/app/owner/{shared,today/lists,waitlist/list,book/slots}.tsx`; `src/modules/venue/application/get-day-availability.ts`; `src/app/owner/more/settings/{panel,actions}.tsx`; copy + success keys; `docs/owner-ia.md`; tests `test/lib/{tenant-settings,format-local-hm}.test.ts`.

**Relation:** ALS still only for tenant isolation � `timeDisplay` rides on the same `CurrentTenant` object already stored for id; UI reads via `getCurrentTenant()` in Server Components, not as a new ALS display bus. Access owns the OWNER write (platformDb Tenant row). Venue `getDayAvailability` takes optional `hourCycle`; public callers omit it. Must not import Booking from Access.

**How to verify:** `npm test`. Migrate applied on dev. Settings ? set 12-hour ? Home/Book/Waitlist show `4:00 PM`; public `/` and WhatsApp prepare links still `16:00`.

## Public clocks follow tenant timeDisplay

**When:** 2026-09-15

**What:** `PublicHours` passes `hourCycle: tenant.timeDisplay` into `getDayAvailability`. Owner + public share the setting; WhatsApp bodies still default h23.

**Why:** Product call after ship � stadium visitors should see the same clock format the owner chose.

**Files:** `src/app/(public)/hours.tsx`; comments in `get-day-availability.ts`, `tenant-settings.ts`; `docs/owner-ia.md`.

**How to verify:** Settings ? 12-hour ? reload public `/` for that tenant � slots show `4:00 PM`. WhatsApp prepare text still `16:00`.

## Slot picker: keep AM/PM on one line

**When:** 2026-09-15

**What:** `SlotFace` time column `whitespace-nowrap` + `shrink-0` so `5:00 PM` does not wrap under `text-xl` in the 2-col grid.

**Why:** 12h `timeDisplay` made start/end strings longer than the old `HH:mm` the card was sized for.

**Files:** `src/components/slot-picker.tsx`.

**How to verify:** Public or Book with 12h � PM stays beside the clock, not under it.

## GitHub Actions CI (tests + build, no deploy)

**When:** 2026-09-16

**What:** Workflow `.github/workflows/ci.yml` on every push/PR: `npm ci`, `prisma generate` (generated client is gitignored), `npm test`, `npm run test:integration` against a `postgres:16-alpine` service (`stadiums_test`), then `npm run build`. No deploy. Dummy DB creds only (same as `.env.example`).

**Why:** Catch unit/integration/build failures on the PR, not later. Backup/deploy still unsolved — out of scope.

**Files:** `.github/workflows/ci.yml`

**How it connects:** Invokes existing `test:integration` (`migrate-test-db.ts` + Jest). Does not change test files or scripts. ALS/tenant isolation unchanged.

**How to verify:** Push this branch or open a PR — Actions tab must go green. A red step fails the job (PR not "safe").

## CI build fixes (Prisma create types + Node 24)

**When:** 2026-09-16

**What:** First CI `next build` failed on two existing TS issues: `createPerson` data XOR (same cast as `insertRequesterParticipant` / `insertPitch`); `createOwnerBooking` catch did not `return await rethrowUnexpected` so the function looked like it could return `undefined`. Workflow actions bumped to checkout/setup-node `@v5` and Node 24 (Node 20 action runtime is deprecated on GH runners).

**Why:** Make the CI job green without changing test scripts.

**Files:** `src/modules/people/infrastructure/persons.ts`; `src/modules/booking/application/create-owner-booking.ts`; `.github/workflows/ci.yml`

**How to verify:** Push — CI build step passes. `npm test` still green.

## Remove ?tenant= (host-only tenant)

**When:** 2026-09-22

**What:** Deleted the half-finished `?tenant=` / `TenantHiddenField` / `tenant-query` WIP. Tenant slug is host-only (`ahmad.localhost` / `ahmad.lvh.me` / subdomain). Forms, links, redirects, and keep lists no longer carry `tenant`.

**Why:** Local already uses subdomain; query-param tenant was never isolation and the WIP imported a missing `@/lib/tenant-query`.

**Files:** `src/lib/tenant-slug.ts`, `src/proxy.ts`, owner/public login + tabs/forms/links; deleted `tenant-hidden-field.tsx` and `test/lib/tenant-query.test.ts`.

**How it connects:** `parseTenantSlug(host)` feeds proxy `x-tenant-slug`, then `getCurrentTenant`. Does not change Prisma, isolation, or business modules.

**How to verify:** `npm test`. Browse `ahmad.localhost:3000` — no `?tenant=` on links or after form POST.

## Fix 404 after Server Action redirect (collapsed Host)

**When:** 2026-09-22

**What:** After removing `?tenant=`, login/logout (and any Server Action `redirect()`) soft-nav showed Next 404 until hard refresh. Root cause: follow-up RSC request sends `Host: localhost:3000` while `x-forwarded-host` still has `ahmad.localhost:3000`. `resolveRequestHost` in `tenant-slug.ts` prefers forwarded / Origin / Referer when Host is bare localhost; proxy uses it.

**Why:** `?tenant=` used to mask this (query won over host). Host-only resolution exposed vercel/next.js#65893-class behavior. Not login-specific � any action redirect.

**Files:** `src/lib/tenant-slug.ts`, `src/proxy.ts`, `test/lib/tenant-slug.test.ts`.

**How to verify:** `npm test`. Login on `ahmad.localhost:3000` ? lands on Home without 404; logout ? login form without 404. Approve/collect redirects should stay clean too.

## Login page � tenant-first hierarchy + pinned Arabic RTL

**When:** 2026-09-22

**What:** Login card leads with tenant name, `????? ??????` as muted subtitle; removed slug line. Page forces `dir=rtl lang=ar` and Arabic `ui`/`errorMessage` so an EN cookie cannot left-align Arabic. Footer: muted `Powered by lebstads.com`. Identifier/password inputs `dir=ltr`. No locale toggle. No action/field changes.

**Why:** Slug `LtrIsolate block` sat on the left; cookie EN + Arabic copy risked LTR layout. Brand/tenant should own the card; platform credit below.

**Files:** `src/app/login/page.tsx`.

**How to verify:** `ahmad.localhost:3000/login` � Ahmad Stadium large, login title smaller, no `ahmad` slug, footer under card, labels right-aligned even after public EN toggle.

## Owner typography consistency pass

**When:** 2026-09-22

**What:** Codified the dominant owner type scale. Page titles stay `h2 font-heading text-xl`. Section labels stay muted `h3 text-sm font-medium`. Unified pitch/entity names to `text-sm font-medium` (waitlist, settings, slot picker). Fieldset legends match section muted. EmptyState title `text-sm font-medium`. Tab labels `text-xs`. `global-error` h1 uses `font-heading text-2xl` like `error.tsx`. Time emphasis (row `text-lg` / sheet `text-xl`) left as intentional exceptions.

**Why:** Walk after login redesign � headings and body felt uneven across tabs.

**Files:** `empty-state.tsx`, `slot-picker.tsx`, `waitlist/list.tsx`, `settings/panel.tsx`, `hours-groups.tsx`, `price-rules.tsx`, `tab-bar.tsx`, `global-error.tsx`, `globals.css`.

**How to verify:** Spot-check Home / Book / Waitlist / Settings � page titles same; section eyebrows muted sm; pitch names same weight/size.

## Owner sticky header

**When:** 2026-09-22

**What:** Extracted `OwnerHeader` client chrome: `sticky top-0` with backdrop blur, safe-area padding, scroll elevation (border + soft shadow). Tenant name is Kufi `text-base`; role + identifier muted on one line; lang toggle + logout with hover transitions. Layout stays RSC and passes labels in.

**Why:** Header scrolled away with content; wanted modern fixed chrome matching the sticky tab bar.

**Files:** `src/app/owner/header.tsx` (new), `layout.tsx`, `docs/owner-ia.md`.

**How to verify:** Login ? scroll Home � header stays; after a few px it gains a light border/shadow. Logout / EN still work.

## Owner header matches tab bar

**When:** 2026-09-22

**What:** Restyled `OwnerHeader` as a floating card like `OwnerTabBar`: `rounded-2xl border bg-card/95 shadow-lg backdrop-blur-md`, inset with `px-3` + safe-area. Scroll deepens shadow. Dropped full-bleed blur strip.

**Why:** Flat sticky strip did not read as chrome; user asked to match bottom nav.

**Files:** `src/app/owner/header.tsx`.

**How to verify:** `/owner/today` � top pill mirrors bottom tab bar; scroll strengthens shadow.

## Day chips: no Tomorrow label

**When:** 2026-09-22

**What:** `DayChips` no longer labels offset 1 as `public.tomorrow` (???? / Tomorrow). Tomorrow uses weekday + day number like the rest of the strip; only Today stays special.

**Why:** Tomorrow overflowed the chip box on public + Book date rows.

**Files:** `src/components/day-chips.tsx`.

**How to verify:** Public `/` and `/owner/book` � second chip shows e.g. Wed / 23, not Tomorrow.

## Drop in-progress slots from the grid

**When:** 2026-09-23

**What:** `dropEndedSlots` and `resolveOfferedSlot` now refuse slots whose **start** is `<= now` (was end-based). At 9:30 a 9:00�10:00 hour no longer appears or accepts Request/Book/Approve.

**Why:** In-progress games were still listed because end was still after now.

**Files:** `src/modules/venue/domain/availability.ts`, `src/modules/booking/domain/offered-slot.ts`, matching tests.

**How to verify:** `npm test -- --testPathPatterns=availability|offered-slot`. Public/Book today mid-hour � only starts still in the future show.

## Phase 1 � design-system token layer

**When:** 2026-09-23

**What:** Three-layer tokens in `globals.css` (primitives ? roles ? shadcn aliases), real light/dark (surfaces step up), `--brand` / `--success` split (volt vs emerald), `next-themes` toggle with no FOUC, Big Shoulders as `font-display`, `LtrIsolate` tabular display, palette page at `/dev/palette`, `MIGRATION.md` started.

**Why:** `docs/theme.md` + `ui-foundations.md` � components must stop reading hex; accent collision documented (shadcn `--accent` stays wash; action colour is `--brand` / `primary` / `accent-brand`).

**Files:** `src/app/globals.css`, `src/app/layout.tsx`, `src/components/theme-provider.tsx`, `src/components/theme-toggle.tsx`, `src/components/ui/sonner.tsx`, `src/components/ui/ltr-isolate.tsx`, `src/components/ui/button.tsx`, `src/components/ui/badge.tsx`, `src/lib/ui-copy.ts`, `src/app/dev/palette/page.tsx`, `docs/MIGRATION.md`.

**How it connects:** Layout owns ThemeProvider + fonts. Components still use shadcn class names; role utilities are available for Phase 2. Must not import modules from `app/`. Tenant `brandHex` injection not shipped yet.

**How to verify:** `http://ahmad.localhost:3000/dev/palette` � Light/Dark/System; selected is carbon in light, volt in dark; accent is volt both themes; success is emerald.

## Volt is a fill; action ink is carbon in light

**When:** 2026-09-23

**What:** `--action-ink` is `--ink` in light and `--brand` in dark. `--ring` matches. Primary-as-text/border/ring/wash call sites use `action-ink`. Money-in figures and the in-bar use `success` (emerald).

**Why:** `#D7FF3F` on `#F6F5EF` is ~1.3:1. `--primary` used to be emerald and was used as ink. `docs/theme.md` ink-safe action colour.

**Files:** `src/app/globals.css`, `docs/theme.md`, `docs/MIGRATION.md`, `src/components/ui/button.tsx`, `src/components/ui/badge.tsx`, `src/components/day-chips.tsx`, `src/components/slot-picker.tsx`, `src/app/owner/tab-bar.tsx`, `src/app/owner/money/panel.tsx`, `src/app/owner/today/upcoming-panel.tsx`.

**How it connects:** Solid `bg-primary` stays volt. Must not use `text-primary` for labels. Money-in must not import booking.

**How to verify:** Light `/dev/palette` — computed `--action-ink` and `--ring` are `#111412`, `--primary` stays `#d7ff3f`. System theme flips when the OS scheme changes without reload. Login stays Arabic RTL and follows `.dark`.

## Slot request opens a bottom sheet

**When:** 2026-09-23

**What:** Public and owner Book name/phone flow uses `BottomSheet` instead of `Dialog`. Same props, selection state, and form. Sheet visuals are the existing component, not restyled.

**Why:** `ui-components.md` — a flow with inputs is a sheet. Structural move before the slot restyle, while the diff is only the wrapper.

**Files:** `src/components/slot-picker.tsx`, `docs/MIGRATION.md`.

**How it connects:** `SlotPicker` is shared by `(public)/slot-picker` and `owner/book`. Must not import booking or venue modules. Sheet restyle comes later in Phase 2.

**How to verify:** Public `/` on a tenant host — tap an open hour. Name and phone slide up from the bottom; close clears the selection.

## Typography roles: Manrope, stacks, Arabic scale

**When:** 2026-09-23

**What:** Manrope (400–800, latin) is `--font-manrope`. `font-sans` is Manrope then Plex Arabic. `font-heading` and `font-display` are Big Shoulders, then Kufi, then Plex Arabic. `:lang(ar)` sets looser line-height, steps text-xs/sm/base, and forces `letter-spacing: normal`. Root font-size is unchanged.

**Why:** Latin UI needed its own face. Arabic must not be tracked (joining). Numbers stay in `dir=ltr` display islands.

**Files:** `src/app/layout.tsx`, `src/app/globals.css`, `docs/theme.md`, `docs/MIGRATION.md`.

**How it connects:** next/font variables on `html`. Must not branch on lang in components. Plex Mono stays for codes.

**How to verify:** `/owner/book` — body font Manrope; a slot time’s computed family is `\"Big Shoulders\"` and `document.fonts.check('700 16px \"Big Shoulders\"')` is true. English `tracking-tight` is negative; Arabic is `normal`.

## Slot tile: inverse fill, until-word, muted duration

**When:** 2026-09-23

**What:** Slot presentation only. Idle tile is inverse in light and surface in dark. Selected tile is an accent fill with carbon ink. End time uses `public.until` (حتى / until). Duration is a surface-2 micro pill with muted ink. Unavailable is a stripe and not a button.

**Why:** `ui-components.md` time slot. Volt duration was outranking the price. Arrow glyphs do not flip in RTL. Accent time stays on the dark tile only.

**Files:** `src/components/slot-picker.tsx`, `src/lib/ui-copy.ts`, `src/app/globals.css` (`.fill-stripe`), `docs/MIGRATION.md`.

**How it connects:** Shared by public hours and owner Book. No booking/venue imports. Passed state is not in the slot data. Sheet chrome is still unrestyled; the summary time uses ink because the sheet ground is surface.

**How to verify:** `/owner/book` light and dark, Arabic and English. Time is the largest volt figure on a dark tile; price is second; `1h` is a muted pill; the end line says حتى or until.

## Day picker selected state is a fill

**When:** 2026-09-23

**What:** Selected day is `bg-selected` / `text-selected-ink` (carbon in light, volt in dark). Unselected is surface + line. No ring, no shadow. Today shows its date number. The calendar chip icon inherits the cell ink.

**Why:** `ui-components.md` day picker. `42e555f` had moved the ring onto `action-ink`, which is still an outline, not a fill swap.

**Files:** `src/components/day-chips.tsx`, `src/components/date-calendar-chip.tsx`, `docs/MIGRATION.md`.

**How it connects:** Shared by public `/` and owner Book. Links and the date query key are unchanged. Activity dots are not in the data.

**How to verify:** `/owner/book` — light selected cell is carbon with off-white ink; dark selected cell is volt with carbon ink. No ring.
