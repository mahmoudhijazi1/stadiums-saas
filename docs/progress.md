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

## Where we are (2026-09-09)

**On `feature/spec-03-booking-public-request`.** SPEC-01 and SPEC-02 are on `main` and implemented. SPEC-03 steps **1–4** done: tables, exclusion, tenant extension, People find-or-create. No public request UI yet.

**What a visitor can do:** open `http://localhost:3000/?tenant=ahmad` (or `sami`) and see that stadium’s pitches and **today’s computed slots** in Asia/Beirut. `?date=YYYY-MM-DD` is a local proof, not a product date picker.

**What they cannot do yet:** log in, book, pay, block a pitch, Arabic UI, owner dashboard.

**Next:** SPEC-03 step 5 — Booking domain (pure slot rules). Auth still before owner-facing screens.

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

1. SPEC-03 **step 5** — Booking domain (pure). Do not start until you OK it.
2. Then remaining SPEC-03 steps (Zod, use case, thin UI).
3. Auth (email@domain + password) **before** owner UI.

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


