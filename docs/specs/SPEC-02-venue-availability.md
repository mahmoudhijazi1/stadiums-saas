# SPEC-02 — Venue availability

**Type:** Build Spec — precise, boring instructions to hand to Cursor.
**Depends on:** DR-001 (modules + tenant guard), DR-002 §2.4–2.5 (jsonb rules, no slots table),
BRD BR-3, BR-4, BR-5, BR-7, BR-10, BR-12, RULE-7, R-5.
**Builds on:** SPEC-01 (tenant isolation + `listPitches` proof). Do not re-open tenancy.
**Goal of this slice:** a pitch carries a Zod-validated `schedule_config`; a **pure** function
turns that rule plus a civil date into the day's slots (times + price). No slot rows are stored.

> **Framework note for the agent:** this project's Next.js / Prisma versions differ from training
> data. Before writing schema, Json defaults, or Server Component APIs, read
> `node_modules/next/dist/docs/` and the installed Prisma docs. This spec tells you WHAT and WHY;
> the exact API comes from the installed docs.

---

## What this slice delivers

A visitor hits `ahmad.<dev-host>`. For each of Ahmad's pitches, the page shows **today's computed
slots** in Asia/Beirut (start–end and USD price) — generated from `schedule_config`, not from a
slots table. A closed day shows no slots. A different pitch (or Sami's tenant) can have different
hours, game length, and prices. Invalid jsonb never reaches the engine.

This is still a proof, not the owner schedule UI (BR-8/BR-9 need auth later).

---

## Prerequisites (SPEC-01 must already be true)

- Tenant + Pitch tables; Prisma tenant extension; `listPitches()` with no hand-written `tenantId`.
- Seeded `ahmad` / `sami`. Unknown subdomain 404s.
- Jest installed; `test/lib/tenant-slug.test.ts` passes.
- next-intl still NOT required. Do not start i18n/RTL in this slice.

---

## Decisions this spec must not reopen

Already settled — implement them, do not re-argue:

| Source | Decision |
|--------|----------|
| DR-002 §2.4 | Opening hours, slot length, gaps, day/time pricing are **`schedule_config` jsonb**, not columns. Prisma types Json as `unknown`. **Zod-validate on every read and write.** |
| DR-002 §2.5 | **No slots table.** Venue holds the rule; the engine generates the day's slots on demand. |
| DR-002 §2.6 | Location / WhatsApp / cancellation / locale / **timezone** live on `tenant.settings`, not on Pitch. **Do not add `tenant.settings` in this slice.** Pass timezone into the engine as an argument. |
| DR-002 §2.7 | `pitch_blocks` is Venue-owned. **Deferred** — see Out of scope. The engine still accepts occupied ranges so blocks and bookings plug in later without an upward import. |
| DR-002 §2.18 / BR-40 | Money is Decimal, never a JS float. Prices inside jsonb are **decimal strings**, not JSON numbers. |
| DR-001 §4 | Domain = pure (no DB, no `await`). Application orchestrates. All Prisma stays in `infrastructure/`. `app/` stays thin. Domain takes a config/interfaces, **not** Prisma `Pitch`. |
| BR-12 / R-5 | Times stored UTC, shown Asia/Beirut. Midnight-crossing windows are a first-class test, not a later fix. |

---

## MVP `schedule_config` shape (this spec pins it)

DR-002 did not pin keys — only "jsonb, Zod at the edge." This slice's contract is:

```ts
// Conceptual — implement with Zod, not as a Prisma type.
{
  slotDurationMinutes: number;  // integer > 0 (BR-4). Typical 60 or 90.
  gapMinutes: number;          // integer >= 0. Idle time after a slot before the next may start.
  hours: {
    mon: TimeWindow[];
    tue: TimeWindow[];
    wed: TimeWindow[];
    thu: TimeWindow[];
    fri: TimeWindow[];
    sat: TimeWindow[];
    sun: TimeWindow[];
  };
  defaultPriceUsd: string;      // BR-5. Exactly 2 fractional digits, e.g. "30.00". Never a JSON number.
  priceRules: PriceRule[];     // may be empty. Last matching rule wins.
}

type TimeWindow = {
  start: string; // "HH:mm" 24h local clock (Asia/Beirut when generating)
  end: string;   // "HH:mm". If end is later than start, same civil day.
                 // If end is earlier than or equal to start, the window crosses midnight (BR-7):
                 // it runs from start on this weekday through end on the next civil day.
};

type PriceRule = {
  days: Array<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun">; // at least one
  start?: string; // "HH:mm" — if either start or end is set, both are required
  end?: string;
  priceUsd: string; // same decimal-string rule as defaultPriceUsd
};
```

**Closed day:** that weekday's array is `[]`. All seven keys are required so "missing day" cannot mean "open."

**Price of a slot:** start from `defaultPriceUsd`. Then walk `priceRules` in order. A rule matches if the slot's **local weekday** is in `days`, and (if `start`/`end` are present) the slot's **local start clock time** lies in that window (same midnight rule as hours). Last match wins.

**Do not** invent extra keys (buffers, capacity, per-slot labels). Additive later if a real owner needs them.

---

## Step 1 — Schema: `schedule_config` on Pitch

In `src/prisma/schema.prisma`, add `scheduleConfig` (`Json`) on `Pitch`, mapped to `schedule_config` if you use `@map`.

- Required, not optional. Existing rows need a **valid** default (closed week is fine — see shape above) so migrate does not leave unparseable json.
- Do NOT add `pitch_blocks`, bookings, or `tenant.settings`.
- `tenantId` stays mandatory (DR-001 §1).
- Migrate.

**Definition of done:** migrate succeeds; Pitch has `schedule_config`; Prisma client generates.

---

## Step 2 — Zod schema at the Venue edge

Add Zod to the project if it is not already a dependency.

Create `src/modules/venue/schemas/schedule-config.ts` (name may vary; keep it under `venue/schemas/`):

- Zod schema matching the MVP shape above.
- `parseScheduleConfig(unknown) → ScheduleConfig` (inferred type). Throws / returns a result type on invalid input — pick one style and use it on **every** read and every write (DR-002 §2.4). Seed and any future writer must parse before Prisma `create`/`update`.
- Reject JSON numbers for prices. Reject unknown keys if your Zod version can (`.strict()`), so leftover junk cannot silently mean a new feature.
- `"HH:mm"` validation: 00:00–23:59.

USD strings: exact two fractional digits, non-negative. Parse them with a **Decimal** helper — never `parseFloat`. If the repo has no money helper yet, add a small `src/lib/money.ts` (USD parse/format only). Domain must not use JS `number` for money.

**Definition of done:** invalid fixtures fail the parser; a valid fixture round-trips; no `number` prices.

---

## Step 3 — Pure availability engine

Create `src/modules/venue/domain/availability.ts`.

One main function (name may vary), conceptually:

```ts
generateSlotsForDay(input: {
  config: ScheduleConfig;       // already parsed — not Json, not Prisma Pitch
  localDate: { year: number; month: number; day: number }; // civil date, not a JS Date-as-local
  timeZone: string;            // this slice: always "Asia/Beirut" at the caller
  occupied: Array<{ start: Date; end: Date }>; // UTC instants. Empty in the page until blocks/bookings exist.
}): Slot[];

type Slot = {
  start: Date;       // UTC
  end: Date;         // UTC. end = start + slotDurationMinutes. Do not emit a truncated last slot.
  priceUsd: Decimal; // Decimal, not number
  available: boolean; // false if [start, end) overlaps any occupied range
};
```

Rules the function must implement:

1. **No database. No `await`. No Prisma types.** (DR-001 domain layer.)
2. Use `hours[weekday]` for that civil date in `timeZone`.
3. Walk each window: emit consecutive slots of `slotDurationMinutes` that **fully fit** in the window; after each slot, skip `gapMinutes` before the next start. A remainder shorter than a full game is discarded (BR-4 — games have a length; do not invent a shorter last game).
4. Midnight windows (BR-7 / R-5): a Friday `22:00`–`02:00` produces slots that start Friday evening and end Saturday morning, still belonging to **Friday's** generated day (the date you asked for). Test this explicitly.
5. Convert local clock times to UTC `Date` instants. Do not treat `Date#getHours()` as Beirut.
6. `available === false` when the slot overlaps an occupied range (`start < occupied.end && end > occupied.start`). Generate the slot anyway — later BR-8 needs booked *and* free on one board. The public page will filter later; this slice may show all slots and mark unavailable if occupied is non-empty (tests will pass occupied; the page may pass `[]`).
7. Occupied ranges are a generic interval. **Venue must not import booking.** Booking (SPEC-03) will pass approved `during` values in. Blocks will too.

Do **not** use a slots table, cache table, or "materialize the next 30 days" job.

**Definition of done:** the function is importable without a database; it returns UTC slots + Decimal prices.

---

## Step 4 — Jest (this slice's real tests)

See `docs/guides/testing-jest.md`. Mirror path:

`src/modules/venue/domain/availability.ts` → `test/modules/venue/domain/availability.test.ts`

Also test the Zod parser:

`src/modules/venue/schemas/schedule-config.ts` → `test/modules/venue/schemas/schedule-config.test.ts`

Minimum cases (name them so a failure is readable):

| Case | Why |
|------|------|
| Closed weekday → `[]` | BR-10 / empty hours |
| 16:00–22:00, 60 min, gap 0 → four slots | BR-3, BR-4, BR-10 |
| Same window, 90 min → fewer slots; leftover 30 min not emitted | BR-4 |
| `gapMinutes: 15` shifts the next start | DR-002 "gaps" |
| Weekend `priceRules` last-match vs `defaultPriceUsd` | BR-5 |
| Time-window price rule (e.g. after 20:00) | BR-5 |
| Window `22:00`–`02:00` produces a slot whose UTC end is the next civil day | BR-7, R-5 |
| Occupied range overlapping one slot → that slot `available: false`, others true | seam for BR-6 / SPEC-03 |
| Adjacent occupied (end == next start) does **not** mark the next slot unavailable | half-open `[start, end)` |
| Reject config with a JSON number price | BR-40 |

Parser tests: happy path; missing weekday key; bad `HH:mm`; price `"30"` without cents; extra unknown key if using strict.

**Definition of done (Jest):** `npm test` includes the suites above and still includes the SPEC-01 slug tests.

---

## Step 5 — Application + infrastructure (orchestration, still no `tenantId`)

**Infrastructure** (`src/modules/venue/infrastructure/`): extend pitch reads so the application can get `id`, `name`, and `scheduleConfig`. Still **no** `tenantId` in the query — the SPEC-01 extension injects it. If you add a new function rather than overloading `listPitches`, keep `listPitches` from lying (don't silently drop fields callers need). Prefer one list function used by this page.

**Application** (`src/modules/venue/application/`): a use case e.g. `getDayAvailability({ localDate, timeZone })`:

1. Load pitches (infrastructure).
2. `parseScheduleConfig` each `scheduleConfig` (invalid json = fail the request; do not skip quietly — seed is under our control).
3. `generateSlotsForDay` with `occupied: []` (no blocks table yet).
4. Return a plain DTO the page can render (pitch name + slots with ISO strings or formatted Beirut times). Decimal → string for the view is fine here.

`timeZone` for this slice is `"Asia/Beirut"` passed by the use case or the page. Do not read `process.env` inside domain.

**Definition of done:** application has `await`; domain does not. Page will not import Prisma or call `generateSlotsForDay` on raw Json.

---

## Step 6 — Thin page proof

`src/app/page.tsx` stays a Server Component: resolve tenant (404 unknown) → call the use case → render.

Show:

- Tenant name (already there).
- Per pitch: name, then today's slots as plain text, e.g. `18:00–19:00 · $30.00` in **Asia/Beirut** (BR-12). If none: "Closed" / "No slots."
- No client JS, no styling system, no owner editor.

**Local proof aid:** allow `?date=YYYY-MM-DD` (civil date) so you can verify a weekend price and a closed day without waiting for the calendar. If absent, use **today in Asia/Beirut**, not the server's UTC date (a UTC "today" around midnight will show the wrong Lebanese day — that is R-5 in disguise).

Do not remove the tenant isolation properties from SPEC-01: Ahmad still never sees Sami's pitches.

**Definition of done:** Ahmad's pitches show Ahmad's slots/prices; Sami's differ; page code has no `tenantId` and no Prisma.

---

## Step 7 — Seed configs

Update `src/prisma/seed.ts` (still `platformDb` / unscoped — seeding crosses tenants). Parse configs with the same Zod helper before write.

Give **different** rules so the proof is visible:

- Ahmad Pitch A1: weekday evenings (e.g. 16:00–22:00), 60 min, `$30.00`; Fri/Sat default or rule `$40.00`.
- Ahmad Pitch A2: different hours and/or 90 min.
- Ahmad Pitch A3: closed most days, open one weekday — so "Closed" is visible depending on `?date=`.
- Sami pitches: different prices/hours than Ahmad.

Re-seed after migrate.

**Definition of done:** `npm run db:seed` succeeds; two tenants still isolated; slot lists match the seeded rules for a known `?date=`.

---

## Tests (Jest) — summary

| Step | Jest expectation |
|------|------------------|
| 1 Schema | None (migrate + inspect). |
| 2 Zod | `test/modules/venue/schemas/schedule-config.test.ts` |
| 3–4 Engine | `test/modules/venue/domain/availability.test.ts` (table in step 4). |
| 5–7 App / page / seed | No mandatory unit tests; covered by acceptance below. |

**Definition of done (Jest):** `npm test` passes, including SPEC-01 slug tests + the two new suites.

---

## The whole-slice acceptance test

1. Migrate + seed. ✅
2. `ahmad.<dev-host>` shows Ahmad's pitches with **computed** slots for today (Beirut), not a hardcoded list. ✅
3. `sami.<dev-host>` shows different pitches/slots; no Ahmad rows. ✅
4. `?date=` to a closed weekday for Pitch A3 shows no slots for that pitch. ✅
5. `?date=` to a weekend shows the weekend price where seeded. ✅
6. No `slots` (or similar) table exists. ✅
7. Page / infrastructure still contain **no** hand-written `tenantId` filter. ✅
8. `npm test` includes slug + schedule-config + availability suites. ✅

If all eight pass, SPEC-03 (Booking: request/approve + exclusion constraint) can ask Venue for a day's slots and pass occupied approved ranges into the same engine.

---

## Out of scope for this slice (do not build)

- **`pitch_blocks` table and owner "block this time" UI** (BR-6). Engine `occupied` is the seam; persistence waits.
- **Owner schedule editor** (needs auth — email@domain + password before owner-facing slices).
- **Bookings**, exclusion constraint, people, payments, ledger, expenses.
- **`tenant.settings` jsonb** (timezone stays a function argument; default Asia/Beirut).
- Auth / sessions, i18n / RTL / next-intl.
- RLS (still deferred, DR-001 §3).
- Public "request this slot" (BR-15) — public page slice later.
- Styling system beyond readable HTML.
- Materializing or caching slots in the database.
