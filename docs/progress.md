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

## Where we are (2026-09-11)

**On `feature/spec-06-collect-payment`.** SPEC-01–05 implemented. SPEC-06 written, not started in code.

**What a visitor can do:** public PENDING request (no login). After an hour is **APPROVED**, that row still lists but has no Request form. Owner logs in and Approves/Rejects on `/owner`. Staff see the list with no buttons.

**What they cannot do yet:** pay, Arabic UI, dashboard board, owner-created bookings.

**Local logins (seed only):** password `dev-owner`. Identifiers `owner@ahmad`, `owner@sami`, `staff@ahmad` (STAFF, cannot approve or collect).

**Next:** SPEC-06 step 1 (schema). Wait for OK.

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

