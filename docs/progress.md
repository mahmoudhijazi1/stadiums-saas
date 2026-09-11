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

**On `feature/spec-09-owner-create-booking`.** SPEC-01–09 click-proofed. Owner can Book a slot on `/owner` (APPROVED immediately).

**What a visitor can do:** public PENDING request. Owner approves, Books a caller’s hour, Collects, records expenses, and sees This period.

**What they cannot do yet:** cancel, no-show, per-player split, Arabic UI, games-played / pitch-busy (BR-57).

**Local logins (seed only):** password `dev-owner`. Identifiers `owner@ahmad`, `owner@sami`, `staff@ahmad` (STAFF, cannot approve, collect, record expenses, view reports, or Book).

**Next:** cancel a confirmed booking (BR-26). Overpay warning parked.

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











