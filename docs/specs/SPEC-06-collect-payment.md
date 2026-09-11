# SPEC-06 — Collect payment on a booking

**Type:** Build Spec — precise, boring instructions to hand to Cursor.
**Depends on:** DR-001 §4–5 (arrows down; use case owns `$transaction`; Payment → Ledger),
DR-002 §2.11, §2.14–2.21 (polymorphic source; tenders freeze rate; Decimal; ledger same tx),
DR-003 §5–6 (`can(...)`; Access never imports Booking or Payment),
BR-31–40, BR-96–98, RULE-4, RULE-5, RULE-6, RULE-9, RULE-10, RULE-12.
**Builds on:** SPEC-01–05. Do not re-open approve, public PENDING, Venue’s slot engine, or login.
**Scope:** Logged-in owner (or staff with the flag) **collects cash** on an **APPROVED** booking:
mixed USD/LBP tenders, frozen rate, remaining, ledger IN in the **same** transaction.
Show and set the current LBP/USD rate (append-only).
**No** per-player split, expenses, dashboard totals, owner-created bookings, cancel, refunds.

> **Framework note:** Next.js / Prisma in this repo differ from training data. Before Server
> Actions, Prisma `Decimal` / enums / `create`, read `node_modules/next/dist/docs/` and
> installed Prisma docs. This spec is WHAT and WHY.

> **Comments:** every exported function gets a short human comment — why it exists. No essays.

> **Transactions:** Authorize **before** `db.$transaction`. Session/User live on `platformDb`.
> Never call `platformDb` inside `db.$transaction`
> ([guides/prisma-transaction-tenant-guard.md](../guides/prisma-transaction-tenant-guard.md)).
> Notifications (none this slice) stay **after** commit.
> **CODE-REVIEW RULE (DR-002 §2.21):** every path that writes a payment writes its ledger row
> in the **same** `$transaction`. No “ledger after commit.”

---



## What this slice delivers

Ahmad’s owner logs in, opens `/owner`, sees **APPROVED** games that still have money due.
He taps Collect for a $30 game: either **one USD tender for the remaining** (two taps, BR-39)
or USD + LBP amounts on one form (BR-33). Each LBP part uses the **current** rate and stores
`rate_at_time` + `usd_equivalent` on the tender (RULE-5). A ledger **IN** row is written in the
same transaction (USD only — LBP never reaches the ledger, RULE-4).

The current rate is visible on `/owner`. Owner sets a new rate in one submit (BR-35, BR-36).
Old tenders do not move (BR-37). No rate yet → USD collect still works; LBP collect fails with
a clear “Set exchange rate first.”

Staff `staff@ahmad` can see the due list. They cannot collect or change the rate unless
`can(..., "payments.collect")` is true (Q-2: **default deny**). OWNER always can collect.
**Only OWNER** may set the rate this slice (do not invent `rates.set`).

Sami never sees Ahmad’s payments or rates. Payment **never** imports Booking.

---



## Prerequisites

- SPEC-01–05 true: tenant guard, public PENDING, login, approve, occupied, seed owners.
- next-intl still out. No expense module, no financial dashboard query UI (BR-54).

---



## Decisions this spec must not reopen


| Source            | Decision                                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DR-002 §2.14      | Payment links by `source_type + source_id`. **No** `booking_id` on payments. No Prisma `payment.booking` relation.                                                             |
| DR-002 §2.15–2.16 | A payment is a **set of tenders**. Each freezes `rate_at_time` and `usd_equivalent`. Tender never re-reads `exchange_rates`.                                                   |
| DR-002 §2.17      | `exchange_rates` is append-only. New rate = new row. Current = latest row for this tenant.                                                                                     |
| DR-002 §2.18      | Money is `Decimal`, never a JS float. USD `Decimal(12,2)`, LBP `Decimal(18,0)`. Use decimal.js (already in `src/lib/money.ts`).                                                |
| DR-002 §2.20–2.21 | Ledger is the read layer, USD only, append-only. Same `$transaction` as the payment.                                                                                           |
| DR-001 §4         | Payment may import Ledger. Booking may import Payment and Access. Payment / Ledger must **not** import Booking. Venue / Access / People unchanged (no new imports of Payment). |
| DR-001 §5         | The use case that **starts** collect (`collectBookingPayment` in Booking `application/`) opens `$transaction` and passes `tx`.                                                 |
| DR-003 §5         | `can(membership, permission)`. Do not scatter `role === "STAFF"` inside Payment.                                                                                               |
| SPEC-05           | Occupied / approve / `slot_interests` stay as they are. Collect does **not** change booking status.                                                                            |


---



## Pins this spec must make (BRD / DRs left them loose)

**Who collects (Q-2):** permission string `"payments.collect"`. OWNER always yes. STAFF only if
that jsonb key is strictly `true`. Seed `staff@ahmad` omits it (false). Same pattern as
`"bookings.approve"` (SPEC-04).

**Who set the rate:** **OWNER only** (`membership.role === "OWNER"`). Staff with collect still
cannot change the rate. No new permission string.

**Collected-by staff (Q-7):** not this slice. No `collected_by` column.

**Partial (Q-3, assumed yes):** several payments on the same booking are allowed. Remaining =
`booking.priceUsd` minus **sum of all tenders’** `usd_equivalent` for `source_type = BOOKING` and
that booking’s id. A new collection may leave remaining > 0.

**Nothing due:** if remaining is `<= 0` before this collection → refuse (`"Nothing due"`). Stops
double-submit after a full pay. This is not RULE-9 (that rule is about not blocking a real
collection).

**Overpay on a form that still has remaining:** **allow** (RULE-9 / RULE-10). Do not throw.
Ledger IN = sum of **this** payment’s tender equivalents (what actually came in), not “due.”
No warning UI this slice (warning is later).

**What we collect against:** the **booking** (`source_type = BOOKING`, `source_id = booking.id`),
not a participant. `payments.amount_due_usd` = `booking.priceUsd` (the game snapshot), not
the remaining. Participant `paid_at` / `amount_due_usd` **unchanged** (BR-41–43 later).

**Status gate:** only `status = APPROVED` may be collected. PENDING / REJECTED / CANCELLED /
NO_SHOW → refuse (`"Only an approved booking can be collected"`).

**Tenders on one submit:** 1–2 parts from the form: optional USD amount, optional LBP amount.
At least one must be **> 0**. Skip a zero/empty field (do not insert a $0 tender).

**USD with no rate:** allowed. `usd_equivalent` = the USD amount. `rate_at_time` = current
rate if a row exists, else `null`.

**LBP with no rate:** refuse (`"Set exchange rate first"`).

**LBP → USD:** `usd_equivalent = lbp_amount / lbp_per_usd`, rounded to 2 decimal places,
**ROUND_HALF_UP**. Store that frozen equivalent on the tender. Never divide with a JS number.

**Rate shape:** `lbp_per_usd` is a positive integer ≥ 1 (e.g. `90000`). No fractional pounds
(DR-002 §2.18). Owner types the rounded real-world number (BR-35).

**Two-tap path (BR-39):** a Collect button that posts **one USD tender equal to remaining**
(hidden amount). No extra fields. Mixed path: visible USD + LBP inputs, one submit.

**Live remaining (BR-38):** **not** a client-side tender builder this slice. Remaining is
computed on the server and shown on the list; after submit the page reloads with the new
remaining. A JS remaining widget is a later polish.

**Ledger row:** `direction = IN`, `amount_usd` = sum of this payment’s `usd_equivalent`s,
`occurred_at` = now, `source_type` + `source_id` **the same as the payment** (`BOOKING` +
booking id). Payment application writes this row; Booking does not call Ledger directly.

`recordPayment` **lives in Payment** `application/`**.** It writes `payments` + `payment_tenders` +
`ledger_entries` inside the `tx` it is given. It does not open its own transaction. It does
not load a Booking. It receives: `sourceType`, `sourceId`, `amountDueUsd`, `tenders` (already
domain-checked, including frozen rate + equivalent per tender), `direction` (this slice
always `IN`).

**Enum this slice:** `PaymentSourceType` / ledger source: `BOOKING` **only**. Adding `EXPENSE`
later is an additive enum value — do not scaffold expense tables.

**Currency enum:** `USD | LBP`. Ledger direction: `IN | OUT` (OUT unused this slice; still
create the enum so expense does not redesign Ledger).

---



## Step 1 — Schema

In `src/prisma/schema.prisma` (Prisma 7 syntax from installed docs). **No** `tstzrange` on these
tables — normal Prisma `create` is expected (unlike Booking).

**ExchangeRate** (`tenantId` required): `id`, `tenantId`, `lbpPerUsd` `Decimal(18,0)`,
`createdAt`. FK Tenant. `@@index([tenantId])`. Append-only in app code (no update/delete use
case).

**Payment** (`tenantId` required): `id`, `tenantId`, `sourceType` enum (`BOOKING`),
`sourceId` string, `amountDueUsd` `Decimal(12,2)`, `createdAt`. **No FK** to Booking.
`@@index([tenantId])`. `@@index([sourceType, sourceId])` for remaining lookups.

**PaymentTender** (`tenantId` required — child table, DR-001 §1): `id`, `tenantId`,
`paymentId`, `currency` enum `USD | LBP`, `amount` (USD → `Decimal(12,2)`; LBP → `Decimal(18,0)`
— **one column**: use `Decimal(18,2)` only if installed Prisma cannot split; prefer two checked
shapes in domain, one Decimal column `Decimal(18,2)` **or** store both as Decimal and let
domain enforce 0 vs 2 places). **Pin:** one `amount Decimal(18,2)` column is acceptable if the
docs make two scales painful; domain still refuses fractional LBP and requires two USD cents.
`rateAtTime` `Decimal(18,0)` **optional** (null on USD when no rate). `usdEquivalent`
`Decimal(12,2)` required. FK Payment + Tenant. `@@index([tenantId])`.

**LedgerEntry** (`tenantId` required): `id`, `tenantId`, `direction` enum `IN | OUT`,
`amountUsd` `Decimal(12,2)`, `occurredAt`, `sourceType` (same enum as payment or a shared enum),
`sourceId` string, `createdAt`. No FK to Payment or Booking. `@@index([tenantId])`.

Add reverse lists on `Tenant`. Do **not** add `payments` on `Booking`.

Migrate. If `template1` blocks `migrate dev`, handwritten SQL + `migrate deploy` (same as
SPEC-03–05). Callers still omit `tenantId` on Prisma `create`; the guard stamps it.

**Definition of done:** four tables exist with `tenant_id`; Prisma Studio opens them empty;
Booking model has **no** payment relation.

---



## Step 2 — Guard

Add `ExchangeRate`, `Payment`, `PaymentTender`, `LedgerEntry` to `TENANT_SCOPED_MODELS` in
`src/lib/db.ts`. Callers still do not pass `tenantId` on Prisma `create`.

**Definition of done:** a Payment Prisma read from app code has no hand-written `tenantId` in
`where`.

---



## Step 3 — Access flag + money domain (pure)

**Access:** extend `Permission` so `"payments.collect"` is a known string (export
`PAYMENTS_COLLECT` next to `BOOKINGS_APPROVE`). OWNER still always `true`. Jest: OWNER can
collect with `{}`; STAFF default cannot; STAFF with `"payments.collect": true` can.

`src/lib/money.ts`**:** add LBP helpers next to USD: digits-only integer string ≥ 1 (or `0`
only if a helper needs it — collect will not pass 0). Never `parseFloat`.

**Payment** `domain/` — no Prisma, no `await`. At least:

- `usdEquivalent({ currency, amount, rate })` — USD: equivalent = amount; LBP: requires rate,
divide, ROUND_HALF_UP to 2 places.
- `remainingDue(priceUsd, collectedUsd)` — `price - collected`, never a float.
- `assertCanCollect(status)` — only APPROVED.
- `assertHasDue(remaining)` — remaining > 0.
- Build/check a tender list: at least one positive part; LBP without rate fails; skip zeros.

Jest: $20 USD → equivalent 20.00; 900_000 LBP at 90_000 → 10.00; 1 LBP at 90_000 → 0.00
(ROUND_HALF_UP); remaining 30 − 20 = 10; remaining 0 refuses; PENDING cannot collect;
USD without rate still equivalents.

**Definition of done:** `npm test` includes the new Access + money + payment domain tests.

---



## Step 4 — Zod

`src/modules/payment/schemas/` (and Booking collect body may live next to it or in
`booking/schemas/` — **pin:** collect **form** schema in `payment/schemas/` because it is
tenders + rate-less amounts; `bookingId` is a string on that same object so the Server Action
parses once).

Collect body (`strictObject`):

- `bookingId` non-empty string
- `usdAmount` optional string (empty = omit). If present, USD shape (`30.00`)
- `lbpAmount` optional string (empty = omit). If present, LBP integer digits
- Hidden `tenant` slug is **not** in this schema (redirect only, same as SPEC-04/05)

At least one of usd/lbp must parse to a positive amount (refine). Extra keys rejected.

Rate body: `lbpPerUsd` positive integer string (no extra keys).

Two-tap Collect may send `usdAmount` = remaining formatted with two decimals (hidden input).
That is still this schema.

**Definition of done:** tests for missing bookingId, extra field, both amounts empty, happy
USD, happy mixed, bad `30` USD (need `30.00`).

---



## Step 5 — Infrastructure

Create `src/modules/payment/infrastructure/` and `src/modules/ledger/infrastructure/`.
Every function takes `tx` (or the scoped client) as the first argument. No `tenantId`
argument except ALS inside raw SQL — **raw SQL should not be needed** if Client `create` works.

Needed (names yours; jobs fixed):

- Latest exchange rate for this tenant (or null).
- Insert exchange rate row.
- Insert payment + its tenders (same `tx`).
- Sum `usdEquivalent` of all tenders for (`sourceType`, `sourceId`).
- Insert ledger row.

Ledger insert may live in `ledger/infrastructure/` and be called **only** from Payment
`recordPayment` (Payment may import Ledger). Booking infrastructure stays booking-only.

Load APPROVED bookings for the collect list: **Booking** infrastructure (pitch name, range,
priceUsd, requester name/phone). Remaining is **not** computed in SQL if that forces a Payment
join from Booking infra — Booking application asks Payment for collected sums (or one
`sumCollectedUsd(tx, "BOOKING", id)` per row / a batch by ids). **Payment never lists
bookings.**

**Definition of done:** Studio can insert a rate; app code can read Ahmad’s latest rate without
a Sami row.

---



## Step 6 — Use cases

`getCurrentRate` (Payment): membership required to *see* `/owner` already; returning the
latest rate for the URL tenant is enough. No special `can`.

`setExchangeRate(lbpPerUsd)` (Payment): **outside** `$transaction`: membership; if null →
fail; `role !== "OWNER"` → `"Not allowed"`. Then insert a new row (no `platformDb` inside `tx`;
a single `create` does not need an interactive transaction unless you wrap it — either is fine).

`listDueBookings` (Booking `application/`): membership required (staff may look). List
APPROVED for the URL tenant, **soonest start first**. Attach `remaining` via Payment sums.
Omit remaining `<= 0` from this list (fully paid games drop off the collect inbox).

`collectBookingPayment({ bookingId, tenders })` (Booking `application/`):

1. **Outside** `$transaction`: `getCurrentMembership()`; if null → fail;
  `can(..., PAYMENTS_COLLECT)` false → `"Not allowed"`. Do **not** open `platformDb` inside `tx`.
2. `$transaction`: load booking (this tenant); domain status gate; load current rate; load
  collected sum; domain remaining / tenders (freeze equivalents here); if LBP and no rate →
   fail; call **Payment** `recordPayment(tx, { direction: IN, sourceType: BOOKING, sourceId,  amountDueUsd: booking.priceUsd, tenders })`.
3. After commit: `logger.info` payment/booking id. No WhatsApp.

If `recordPayment` is not in the same `tx`, the slice has failed the code-review rule.

Do not set booking status. Do not set participant `paidAt`.

**Definition of done:** one Server Action can collect; Studio shows payment + tenders +
ledger IN; a second full collect on remaining 0 fails; staff seed cannot collect.

---



## Step 7 — Thin `/owner` UI

Keep `src/app/owner/page.tsx` a Server Component. Still: no membership → `/login`. No Prisma,
no `tenantId`. Pending inbox from SPEC-05 stays.

Add:

1. **Rate:** show current `lbpPerUsd` or “No rate set.” If role is OWNER, a small form to set a
  new rate (`<form action>`). Staff: text only, no form.
2. **Due list:** each APPROVED-with-remaining row: pitch, Asia/Beirut time, requester name +
  phone, `priceUsd`, `remaining`. If `can` collect: two-tap Collect (hidden remaining USD) **and**
   optional mixed USD + LBP fields + submit. If `can` is false: list, **no** buttons.

Server Actions in `src/app/`: Zod → use case → `redirect` **outside** try/catch (Next redirect
docs). Stay on `/owner?tenant=`. Failure → `?error=1` (or a small distinct `?pay=1` /
`?rate=1` if one flag is too blunt — pin **one** `error=1` unless you already have a pattern).

Do not build BR-8’s full day board. Do not add a JS remaining calculator.

**Definition of done:** Ahmad owner collects $30 USD in the browser; Studio: one payment, one
USD tender, one ledger IN $30.00; `staff@ahmad` sees the row, no Collect; `?tenant=sami` does
not list Ahmad’s due booking.

---



## Step 8 — Seed rate

Seed **Ahmad and Sami** with `lbpPerUsd = 90000` so LBP can be click-tested without a prior
set-rate. Do not seed payments.

**Definition of done:** fresh seed → `/owner?tenant=ahmad` shows 90000; collect LBP works.

---



## Tests (Jest)


| Step                         | Jest                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1–2 Schema / guard           | None (migrate + Studio).                                                                                          |
| 3 Access + domain + money    | `test/modules/access/domain/can.test.ts` (extend), `test/lib/money.test.ts` (LBP), `test/modules/payment/domain/` |
| 4 Zod                        | `test/modules/payment/schemas/`                                                                                   |
| 5–8 Infra / use case / pages | No mandatory unit tests. Click + Studio.                                                                          |


**Definition of done (Jest):** `npm test` includes SPEC-01–05 suites plus the new tests.

---



## Whole-slice acceptance

1. Tables migrated; `tenant_id` on payment, tender, rate, ledger. No `booking_id` on Payment. ✅
2. Approve a $30 Ahmad hour → Collect remaining as USD → payment + 1 tender + ledger IN 30.00. ✅
3. Mixed: $20 + 900,000 LBP at 90,000 → two tenders, equivalents 20.00 and 10.00, ledger IN 30.00. ✅
4. Change rate to 100000 → old tenders still 10.00; new LBP uses 100000. ✅
5. Partial then rest: first $10 USD, remaining 20.00; second collect clears it. Third collect → `"Nothing due"`. ✅
6. LBP with rate deleted/missing (or a tenant with no row): USD still works; LBP → `"Set exchange rate first"`. (Seed has a rate — click-test by using a fresh tenant **or** by not seeding Sami if you prefer Sami as the no-rate proof; **pin:** Sami **is** seeded with a rate; “no rate” is domain Jest + optional delete-in-Studio.) ✅
7. `staff@ahmad`: due list visible, no Collect, cannot set rate. ✅
8. `?tenant=sami` `/owner` does not show Ahmad’s due booking or Ahmad’s payments in Studio under Sami. ✅
9. Payment / Ledger have **no** import of Booking. Access does not import Payment. Pages have no Prisma / no `tenantId`. ✅
10. `npm test` passes. ✅

---



## Out of scope (do not build)

- Per-player split, add players, teams, mark `paidAt` (BR-41–45)
- Outstanding-across-games screen (BR-49)
- Expenses (BR-50–53)
- Dashboard SUM query UI (BR-54–58) — **writing** the ledger row is in scope; a totals page is not
- Refunds / ledger OUT
- Owner-created bookings, cancel, no-show, waitlist UI
- `pitch_blocks`, WhatsApp, i18n/RTL, RLS
- Client-side live remaining widget
- `collected_by` / which staff (Q-7)
- Filling `user_person_links`

---



## After this slice

Expenses (reuse `recordPayment` with `OUT` + `EXPENSE`). Then dashboard (SUM ledger). Then
owner-created bookings / cancel. Per-player collect is a later booking+payment SPEC.

---



## Step order for the agent

One numbered step at a time. Wait for OK. Do not scaffold `expense/`, `shop/`, or Payment `ui/`.
Do not add `booking_id` on payments even “just for now.”