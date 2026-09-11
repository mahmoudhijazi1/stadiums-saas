# SPEC-08 — Financial dashboard (ledger period summary)

**Type:** Build Spec — precise, boring instructions to hand to Cursor.
**Depends on:** DR-001 §4–5 (Ledger is the stable read layer; arrows down),
DR-002 §2.20–2.21 (dashboard = SUM ledger by direction; USD only; LBP display is a view
transform, never stored), DR-003 §5–6 (`can(...)`; Access never imports Ledger),
BR-54, BR-55, BR-56, BR-59, RULE-4.
**Builds on:** SPEC-01–07. Do not re-open collect, expenses, approve, public PENDING,
rate-setting, login, or the parked overpay warning.
**Scope:** Logged-in owner (or staff with the flag) sees **money in, money out, and the
difference** for a **chosen civil-date period**, as three USD figures (BR-54, BR-55).
Optional LBP *display* using a rate he types or the current stored rate (BR-56).
Query is **only** `ledger_entries` grouped by `direction`. No Payment / Expense / Booking
joins. No new money tables. No charts.
**No** games-played / pitch-busy counts (BR-57), no outstanding-due total (BR-58 — the
due list on `/owner` already exists), no shop profitability (BR-60), no category
breakdown.

> **Framework note:** Next.js / Prisma in this repo differ from training data. Before
> `searchParams`, Prisma `groupBy` / `aggregate` / `Decimal`, read
> `node_modules/next/dist/docs/` and installed Prisma docs. This spec is WHAT and WHY.

> **Comments:** every exported function gets a short human comment — why it exists. No essays.

> **Transactions:** this slice is a **read**. Authorize **before** the query. Do not open
> `$transaction` just to SUM. Never call `platformDb` on the tenant client.
> Do **not** write ledger rows here.

---



## What this slice delivers

Ahmad’s owner logs in, opens `/owner`, and sees **this month** (Asia/Beirut): money **in**,
money **out**, and **net** (in minus out). He can change From / To and submit (GET). Figures
are USD. He can switch the *view* to LBP; the page multiplies the same USD totals by a
display rate. That rate is not stored and is never summed as LBP (RULE-4, DR-002 §2.21).

Staff `staff@ahmad` do **not** see the summary unless `can(..., "reports.view")` is true.
OWNER always can. Collect, expenses, pending inbox, and rate stay as they are.

Sami never sees Ahmad’s totals. Ledger **never** imports Payment, Expense, or Booking.
The page still has no Prisma and no `tenantId`.

A collect (IN) and an expense (OUT) already written in SPEC-06/07 must show up in the
sums for the period that contains their `occurredAt`. Shop/academy later write more ledger
rows and appear **without** editing this query (DR-002 §2.20).

---



## Prerequisites

- SPEC-06/07 implemented: `LedgerEntry` exists, tenant-scoped, append-only USD,
  `direction` IN | OUT, `occurredAt` set (collect ≈ now; expense = expense civil day noon
  Beirut).
- `/owner` already loads membership, rate, due list, expenses.
- Jest: `npm test` green on SPEC-01–07 suites.

---



## Pins this spec must make (BRD / DRs left them loose)

**Who sees the numbers:** permission string `"reports.view"`. OWNER always yes. STAFF only
if that jsonb key is strictly `true`. Seed `staff@ahmad` omits it (false). Same pattern as
`"payments.collect"`. If `can` is false: **hide the whole summary block** (not zeros). Staff
may still see pending / due / expenses as today.

**One query, closed to modification:** infrastructure SUMs `amount_usd` grouped by
`direction` for the URL tenant and the period. **Do not** filter by `sourceType`. **Do not**
join Payment, Expense, Booking, or tenders. Adding shop later must not require editing this
function’s WHERE clause.

**Period:** form fields `from` and `to` = `YYYY-MM-DD` (HTML date). Interpret in
**Asia/Beirut**. Inclusive start = `00:00:00.000` on `from` in that zone. Exclusive end =
`00:00:00.000` on the **calendar day after** `to` in that zone. Filter
`occurredAt >= start AND occurredAt < end`. Timezone is an argument (do not import Venue or
Expense). Duplicating the small Intl offset helper in Ledger domain is acceptable this
slice, same as Expense vs Venue.

**Default period:** current **calendar month** in Asia/Beirut (first day of this month
through last day of this month inclusive). If `from`/`to` are missing, invalid, or `from`
is after `to`, use that default. Do not crash the page. Do not use `?error=1` for a bad
range (that flag means a failed *write*).

**Which clock:** `LedgerEntry.occurredAt` is the filter. Collect rows use payment time
(DB `now()` unless a later SPEC changes that). Expense rows use the expense date. Do not
re-derive dates from Payment or Expense.

**Empty ledger / empty period:** IN `0.00`, OUT `0.00`, net `0.00`. Not an error.

**Net:** `IN − OUT` as `Decimal`. Negative is allowed (spent more than collected). Show it.

**USD display (BR-55):** default view. Two fractional digits via existing `formatUsd`.

**LBP display (BR-56):** GET `view=lbp` (anything else, including omitted = USD). Multiply
each of IN, OUT, net by the display rate (LBP per 1 USD). `ROUND_HALF_UP` to **integer
pounds** (`Decimal` only; never `Number` / `parseFloat`). Display rate, in order:

1. GET `displayRate` if it is a valid positive LBP integer string (`isLbpString` and `> 0`).
2. Else the current stored exchange rate (page already loads this via Payment
   `getCurrentRate` — **page** passes the number into a Ledger **domain** helper; Ledger
   application must **not** import Payment).
3. If still no rate: keep showing **USD** and a one-line note “Set a display rate (or set
   exchange rate first)”. Do not invent 90000.

Never write `exchange_rates` or ledger rows for a display toggle. Never store LBP totals.

**UI home:** stay on `/owner`. Do **not** add `/dashboard` or `src/modules/dashboard`.
Section **above** Exchange rate: heading “This period”, three figures, GET form (From, To,
View USD/LBP, optional display-rate number, submit). Preserve hidden `tenant` for
`?tenant=`. Pending / rate / collect / expenses unchanged below.

**No mutation:** no Server Action. Period change is GET `searchParams`. Validate query with
Zod; on failure use the default month (same as missing dates).

**Index (BR-59):** add `@@index([tenantId, occurredAt])` on `LedgerEntry`. Keep the existing
`@@index([tenantId])`. Handwritten SQL + `migrate deploy` if `template1` still blocks
`migrate dev`.

**Seed:** no sample dashboard data. Do not change wipe order unless a new table appears
(it must not).

---



## Step 1 — Schema (index only)

In `src/prisma/schema.prisma` (Prisma 7 syntax from installed docs).

On `LedgerEntry`, add `@@index([tenantId, occurredAt])`. Do **not** add columns, FKs, or
tables. Do not touch Payment or Expense.

Handwritten migration + `migrate deploy` if needed (same as SPEC-03–07).

**Definition of done:** Studio still opens `LedgerEntry` with the same columns; the new
composite index exists; no new models.

---



## Step 2 — Access flag + ledger domain (pure)

**Access:** extend `Permission` with `"reports.view"` (export `REPORTS_VIEW`). OWNER still
always `true`. Jest: OWNER can with `{}`; STAFF default cannot; STAFF with
`"reports.view": true` can. Collect / approve / expense tests stay green.

**Ledger** `domain/` — no Prisma, no `await`. At least:

- `periodBoundsFromCivilRange(from, to, timeZone)` → `{ startInclusive: Date, endExclusive: Date }`.
  Invalid `YYYY-MM-DD` throws. `from` after `to` throws. Bounds must land on those Beirut
  midnights (Intl offsets, not `Date#getHours`).
- `currentMonthCivilRange(now, timeZone)` → `{ from, to }` as `YYYY-MM-DD` (first and last
  civil day of the month containing `now` in that zone).
- `netUsd(inUsd, outUsd)` → `inUsd.minus(outUsd)` (`Decimal`).
- `usdToDisplayLbp(amountUsd, lbpPerUsd)` → integer-pound `Decimal` (ROUND_HALF_UP, 0 dp).

Do **not** import Expense, Venue, Payment, or Booking.

Jest: a Beirut summer range and a winter date; bad date throws; `from` after `to` throws;
net positive and negative; `20.00` × `90000` → `1800000`.

**Definition of done:** `npm test` includes the new Access + ledger domain tests.

---



## Step 3 — Zod (query string)

`src/modules/ledger/schemas/` — GET fields only. `strictObject` (or equivalent that rejects
extra **money** keys; `tenant` is **not** in this schema — the page already reads it).

- `from` optional `YYYY-MM-DD`
- `to` optional `YYYY-MM-DD`
- `view` optional `"usd"` | `"lbp"` (default usd if omitted)
- `displayRate` optional string (empty = omit); if present, `isLbpString` and parsed `> 0`

If `from`/`to` are present, both must be valid and `from <= to`. Invalid → parse failure
(the page then uses the default month). Extra unknown keys: reject the parse (page falls
back to default + USD). Do not call `parseLbp` unless `isLbpString` already matches.

**Definition of done:** tests for happy month, `from` after `to`, bad date, `view=lbp` with
`displayRate=90000`, empty `displayRate`, extra key.

---



## Step 4 — Infrastructure

Extend `src/modules/ledger/infrastructure/` (existing `entries.ts` or a sibling). Every
function takes `tx` **or** the scoped client as the first argument. No `tenantId` argument
(the guard stamps `where`).

Needed:

- `sumAmountUsdByDirection(client, startInclusive, endExclusive)` → `{ IN: Decimal, OUT: Decimal }`
  (missing direction = `0.00`). Use Prisma 7 `groupBy` / `aggregate` as the **installed**
  docs show. Convert Prisma `Decimal` to `decimal.js` before returning. Never `Number(amount)`.

Read-only. No `create`.

**Definition of done:** with two Studio rows (one IN, one OUT) in range, the function
returns those sums; a Sami row is not included when the request tenant is Ahmad (guard).

---



## Step 5 — Use case

`summarizeLedgerPeriod({ from?, to? })` in Ledger `application/`:

1. `getCurrentMembership()`; if null → fail (page already redirects; use case still
   checks). `can(..., REPORTS_VIEW)` false → `"Not allowed"` (page hides; do not query).
2. Resolve civil `from`/`to` (caller passes parsed dates, or use case receives already-
   defaulted strings). Domain → bounds. Query infra. `netUsd`. Return
   `{ inUsd, outUsd, netUsd, from, to }`.

No `$transaction`. Do not load rate here. Do not import Payment.

**Definition of done:** owner can get three Decimals; staff seed cannot.

---



## Step 6 — Thin `/owner` UI

Keep `src/app/owner/page.tsx` a Server Component. Still: no membership → `/login`. No Prisma,
no `tenantId`. Rate, pending, collect, expenses stay.

Add **above** Exchange rate:

1. If `can` reports: show In / Out / Difference for the resolved period.
2. GET `<form method="get">`: From, To (defaults = resolved `from`/`to`), view select or
   radios (USD / LBP), optional display-rate field, hidden `tenant`, submit “Show”.
3. If `view=lbp` and a rate is available, show the three figures as integer LBP (Western
   digits). Otherwise USD as today (`formatUsd`).
4. If `can` is false: omit the block entirely.

Parse `searchParams` with the Zod schema. On failure, default month + USD. Do not use
`?error=1`.

Do not add a JS chart. Do not add remaining-due as a fourth number.

**Definition of done:** Ahmad owner sees IN after a collect and OUT after an expense in the
same month; changing From/To to a day with no rows shows zeros; `staff@ahmad` does not see
the block; `?tenant=sami` does not show Ahmad’s sums; collect and expense forms still work.

---



## Tests (Jest)

| Step | Jest |
| --- | --- |
| 1 Schema index | None (migrate + Studio). |
| 2 Access + domain | `test/modules/access/domain/can.test.ts` (extend), `test/modules/ledger/domain/` |
| 3 Zod | `test/modules/ledger/schemas/` |
| 4–6 Infra / use case / UI | No mandatory unit tests. Click + Studio. |

**Definition of done (Jest):** `npm test` includes SPEC-01–07 suites plus the new tests.

---



## Whole-slice acceptance

1. `npm test` green. ✅
2. Ahmad owner, current month: after a known collect IN and expense OUT, In / Out / Net
   match those ledger rows (Studio SUM). ✅
3. Period with no rows → `0.00` / `0.00` / `0.00`. ✅
4. View LBP at 90000: `$20.00` shows `1800000` (or the matching integer for the USD total). ✅
5. Typed display rate differs from stored rate → figures follow the **typed** rate; no new
   `exchange_rates` row. ✅
6. `staff@ahmad`: no summary block. Collect/expense visibility unchanged. ✅
7. `?tenant=sami` `/owner` does not show Ahmad’s IN/OUT. ✅
8. Ledger has **no** import of Payment, Expense, or Booking. Pages have no Prisma / no
   `tenantId`. ✅
9. Collect and Record expense still work (regression). ✅

---



## Out of scope (do not build)

- Games played / pitch busy (BR-57)
- Outstanding uncollected as a dashboard figure (BR-58) — due list stays as SPEC-06
- Shop profitability (BR-60), academy
- Breakdown by category / by pitch / by sourceType (would join or filter; breaks Open/Closed)
- Charts, CSV export, printable report
- Editing or deleting ledger rows
- Overpay warning (parked SPEC-06)
- Owner-created bookings, cancel, Arabic/RTL
- A new `/dashboard` route or `dashboard/` module

---



## After this slice

Owner-created bookings / cancel. Then waitlist UI / Arabic as product asks.

---



## Step order for the agent

One numbered step at a time. Wait for OK. Do not scaffold `shop/` or `academy/`.
Do not join Payment or Expense “just to show category.”
Do not put LBP on the ledger.
