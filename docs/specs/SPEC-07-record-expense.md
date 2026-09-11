# SPEC-07 — Record an expense

**Type:** Build Spec — precise, boring instructions to hand to Cursor.
**Depends on:** DR-001 §4–5 (arrows down; use case owns `$transaction`; Expense → Payment → Ledger),
DR-002 §2.14–2.18, §2.20–2.23 (expense has **no** amount; polymorphic payment; Decimal; ledger same tx),
DR-003 §5–6 (`can(...)`; Access never imports Expense or Payment),
BR-50–53, BR-96–98, RULE-4, RULE-5, RULE-6, RULE-12.
**Builds on:** SPEC-01–06. Do not re-open collect-on-booking, approve, public PENDING, rate-setting, or login.
**Scope:** Logged-in owner (or staff with the flag) **records an expense** in seconds: category,
description, when, mixed USD/LBP tenders. One submit writes Expense + Payment + tenders +
ledger **OUT** in the **same** `$transaction`. Recent expenses list on `/owner`.
**No** dashboard SUM UI (BR-54), no edit/delete, no unpaid-expense inbox, no shop, no refunds.

> **Framework note:** Next.js / Prisma in this repo differ from training data. Before Server
> Actions, Prisma `Decimal` / enums / `create`, read `node_modules/next/dist/docs/` and
> installed Prisma docs. This spec is WHAT and WHY.

> **Comments:** every exported function gets a short human comment — why it exists. No essays.

> **Transactions:** Authorize **before** `db.$transaction`. Session/User live on `platformDb`.
> Never call `platformDb` inside `db.$transaction`
> ([guides/prisma-transaction-tenant-guard.md](../guides/prisma-transaction-tenant-guard.md)).
> Notifications (none this slice) stay **after** commit.
> **CODE-REVIEW RULE (DR-002 §2.21):** every path that writes a payment writes its ledger row
> in the **same** `$transaction`. Expense is a *cause*; the money is still a Payment.

---



## What this slice delivers

Ahmad’s owner logs in, opens `/owner`, and records “electricity, 1,800,000 LBP, today” (or
USD, or mixed) in one submit (BR-50, BR-52). The kitchen inserts an **Expense** row (what /
category / when), then reuses SPEC-06 `recordPayment` with `sourceType = EXPENSE` and
`direction = OUT`. Tenders freeze the current rate (RULE-5). Ledger **OUT** is USD only
(RULE-4). The spend appears on a short recent list so he can see it stuck.

Staff `staff@ahmad` can see the recent list. They cannot record unless
`can(..., "expenses.record")` is true. OWNER always can. Rate-setting stays OWNER-only
(SPEC-06). Collect-on-booking stays as it is.

Sami never sees Ahmad’s expenses. Expense **never** imports Booking. Payment **never**
imports Expense (same as it never imports Booking).

---



## Prerequisites

- SPEC-01–06 true: tenant guard, collect, `recordPayment`, seed rate 90000, `/owner` collect UI.
- `LedgerDirection.OUT` already exists (SPEC-06). `PaymentSourceType` is `BOOKING` only until
  this slice adds `EXPENSE`.
- next-intl still out. No financial dashboard query UI (BR-54).

---



## Decisions this spec must not reopen


| Source            | Decision                                                                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DR-002 §2.14      | Payment links by `source_type + source_id`. **No** `expense_id` on payments. No Prisma `payment.expense` relation.                                             |
| DR-002 §2.22      | **Expense has no amount column.** Category + description + when. Money is a Payment.                                                                            |
| DR-002 §2.23      | `category` is a **fixed enum**, not a categories table, not free text.                                                                                           |
| DR-002 §2.15–2.18 | Same tenders, frozen rate, Decimal, `src/lib/money.ts` (including `normalizeUsdForm` for `"30"` → `"30.00"`).                                                    |
| DR-002 §2.20–2.21 | Ledger is the read layer, USD only, append-only. Same `$transaction` as the payment.                                                                              |
| DR-001 §4         | Expense may import Payment and Access. Payment may import Ledger. Payment / Ledger / Booking must **not** import Expense.                                        |
| DR-001 §5         | `recordExpense` in Expense `application/` **starts** `$transaction` and passes `tx`. It calls `recordPayment(tx, …)`. `recordPayment` does not open its own tx. |
| DR-003 §5         | `can(membership, permission)`. Do not scatter `role === "STAFF"` inside Expense.                                                                               |
| SPEC-06           | Collect, remaining, overpay, rate UI, `"payments.collect"` stay. Do not cap overpay. Do not add `booking_id` on payments.                                       |


---



## Pins this spec must make (BRD / DRs left them loose)

**Who records (staff flag):** permission string `"expenses.record"`. OWNER always yes. STAFF
only if that jsonb key is strictly `true`. Seed `staff@ahmad` omits it (false). Same pattern as
`"bookings.approve"` / `"payments.collect"`.

**One submit = create + pay:** this slice does **not** leave unpaid expenses. One form writes
Expense + exactly one Payment (with 1–2 tenders) + ledger OUT. No second payment on the same
expense. No “remaining” on expenses. No expense inbox of unpaid rows.

**What `payments.amount_due_usd` is for an expense:** there is no game price. Set it to the
**sum of this payment’s `usd_equivalent`s** (what actually left the drawer). Do not invent a
separate “expense total” column.

**Tenders:** same as collect: optional USD, optional LBP, at least one **> 0**. Skip empty/zero.
USD with no rate: allowed. LBP with no rate: `"Set exchange rate first"`. LBP → USD:
ROUND_HALF_UP, two places. Reuse `freezeTenders` / `usdEquivalent` — do not copy the math.

**Ledger row:** `direction = OUT`, `amount_usd` = that same tender-equivalent sum,
`source_type + source_id` = `EXPENSE` + expense id (the same pair as the payment).
`occurred_at` = the expense’s `occurredAt` (**not** “now” if the owner backdated). Collect
path may keep DB default `now()` when it omits `occurredAt`.

**When (BR-50):** form field `occurredOn` = `YYYY-MM-DD` (HTML date). Interpret as that civil
day in **Asia/Beirut**. Store `occurredAt` as **12:00** on that day in Asia/Beirut (noon avoids
DST midnight edges). Timezone is an argument, same idea as Venue — implement a **small pure
helper in Expense domain** (or `src/lib/` if you extract). Expense must **not** import Venue.
Past dates allowed. Future dates allowed (do not invent a “cannot be future” block). Default
the input to **today** in Asia/Beirut.

**Category enum (DR-002 §2.23, BR-51):** `ELECTRICITY`, `WATER`, `MAINTENANCE`, `SALARY`,
`EQUIPMENT`, `OTHER`. No extra values this slice. Form: English labels (next-intl still out).
`OTHER` still requires a description.

**Description:** required after trim, 1–200 characters. Owner-authored; show as written
(RULE-11). Do not translate.

**Edit / delete / refund:** not this slice. Ledger stays append-only.

**Recent list:** last **20** expenses for the URL tenant, newest `occurredAt` first (then
`createdAt`). Columns: category, description, civil date Asia/Beirut, USD spent (from
Payment tender sums). Expense infrastructure lists expense rows only. Expense **application**
asks Payment for collected/spent sums by `(EXPENSE, ids)` — Payment never lists expenses.
Staff may see the list without the record form.

**UI home:** stay on `/owner`. Do not add `/expenses`. Pending inbox, rate, and collect list
unchanged. Add an “Expense” form + recent list.

**Overpay parked (SPEC-06):** irrelevant here (no remaining). Do not add a warning UI.

**Seed:** do **not** seed sample expenses. Re-seed **must** `deleteMany` Expense rows (after
payments, before tenants). Rate 90000 stays.

---



## Step 1 — Schema

In `src/prisma/schema.prisma` (Prisma 7 syntax from installed docs).

**ExpenseCategory** enum: `ELECTRICITY | WATER | MAINTENANCE | SALARY | EQUIPMENT | OTHER`.

**Expense** (`tenantId` required): `id`, `tenantId`, `category` (enum), `description` (string),
`occurredAt` `DateTime`, `createdAt`. **No amount columns.** FK Tenant. `@@index([tenantId])`.
`@@index([tenantId, occurredAt])` for the recent list.

Add reverse `expenses` on `Tenant`. Do **not** add a relation from Payment to Expense.

**PaymentSourceType:** add `EXPENSE` (keep `BOOKING`). Additive enum value. Handwritten SQL +
`migrate deploy` if `template1` blocks `migrate dev` (same as SPEC-03–06).

Callers still omit `tenantId` on Prisma `create`; the guard stamps it (step 2).

**Definition of done:** `expenses` exists with `tenant_id` and no money columns; Studio opens
it empty; `PaymentSourceType` includes `EXPENSE`; Payment model still has **no** expense FK.

---



## Step 2 — Guard

Add `Expense` to `TENANT_SCOPED_MODELS` in `src/lib/db.ts`. Callers still do not pass
`tenantId` on Prisma `create`.

**Definition of done:** an Expense Prisma read from app code has no hand-written `tenantId` in
`where`.

---



## Step 3 — Access flag + expense domain (pure)

**Access:** extend `Permission` with `"expenses.record"` (export `EXPENSES_RECORD`). OWNER
still always `true`. Jest: OWNER can with `{}`; STAFF default cannot; STAFF with
`"expenses.record": true` can. Collect / approve tests stay green.

**Expense** `domain/` — no Prisma, no `await`. At least:

- `occurredAtFromCivilDate(yyyyMmDd, timeZone)` → `Date` at 12:00 in that zone (Intl offsets,
  not `Date#getHours`). Invalid `YYYY-MM-DD` throws.
- Category is the Prisma/enum union; domain may export the allowed list as a const for Zod.

Do **not** reimplement tender freeze here. Payment domain already owns that.

Jest: a Beirut summer date and a winter date both land on that civil day at noon Beirut;
bad date string throws.

**Definition of done:** `npm test` includes the new Access + expense domain tests.

---



## Step 4 — Zod

`src/modules/expense/schemas/` — the **form** is Expense-owned (category / description / date)
plus tender amount strings (same money shapes as collect). Do not put this schema in Payment
just to reuse a file; do reuse `normalizeUsdForm` / `isUsdString` / `isLbpString`.

Body (`strictObject`):

- `category` — one of the six enum strings
- `description` — trim, min 1, max 200
- `occurredOn` — `YYYY-MM-DD` (regex or Zod date string)
- `usdAmount` optional string (empty = omit); if present, whole dollars normalize to cents
  (`"30"` → `"30.00"`); `"30.0"` still invalid
- `lbpAmount` optional string (empty = omit); if present, LBP integer digits
- Hidden `tenant` slug is **not** in this schema

At least one of usd/lbp must parse to a positive amount (refine). Extra keys rejected.
Refine must **not** call `parseUsd` / `parseLbp` unless `isUsdString` / `isLbpString` already
match (SPEC-06 correction: those helpers throw `Error`, not `ZodError`).

**Definition of done:** tests for missing category, empty description, extra field, both
amounts empty, happy LBP, happy USD `"30"` → `"30.00"`.

---



## Step 5 — Infrastructure

Create `src/modules/expense/infrastructure/`. Every function takes `tx` (or the scoped
client) as the first argument. No `tenantId` argument. Prisma 7 create XOR: omit `tenantId`,
assert as create `data` (same as Payment / participants).

Needed:

- Insert expense (`category`, `description`, `occurredAt`).
- List recent expenses for this tenant (limit 20, order above).

**Payment:** widen `recordPayment` / insert types so `sourceType` is `BOOKING | EXPENSE`
(Prisma enum). Do not add Expense imports.

**Ledger:** `insertLedgerEntry` accepts optional `occurredAt`. If provided, set it. If omitted,
leave DB default (collect stays “now”).

Batch sum of tender `usdEquivalent` for many `(sourceType, sourceId)` may already exist for
due bookings — reuse or add a sibling that Expense application can call with `EXPENSE` + ids.
Payment still does not know what an expense is.

**Definition of done:** Studio can insert an Expense row by hand; app code can list Ahmad’s
without a Sami row.

---



## Step 6 — Use cases

`recordExpense({ category, description, occurredOn, tenders })` (Expense `application/`):

1. **Outside** `$transaction`: `getCurrentMembership()`; if null → fail;
  `can(..., EXPENSES_RECORD)` false → `"Not allowed"`. Do **not** open `platformDb` inside `tx`.
2. `$transaction`: domain date → `occurredAt`; insert Expense; load current rate; `freezeTenders`;
  `amountDueUsd` = sum of frozen equivalents; call
  `recordPayment(tx, { direction: OUT, sourceType: EXPENSE, sourceId: expense.id, amountDueUsd, tenders })`.
3. After commit: `logger.info` expense id. No WhatsApp.

If `recordPayment` is not in the same `tx`, the slice has failed the code-review rule.

`listRecentExpenses` (Expense `application/`): membership required (staff may look). Attach USD
spent via Payment sums. Do not require `expenses.record` to see the list.

**Definition of done:** one Server Action can record; Studio shows expense + payment +
tender(s) + ledger OUT; staff seed cannot record.

---



## Step 7 — Thin `/owner` UI

Keep `src/app/owner/page.tsx` a Server Component. Still: no membership → `/login`. No Prisma,
no `tenantId`. Pending, rate, collect stay.

Add:

1. **Record expense** if `can` record: category `<select>`, description, date (default today
  Beirut), USD + LBP fields, submit. Same money placeholders as collect (`30.00`, LBP integer).
2. **Recent list:** 20 rows as pinned. If `can` is false: list, **no** form.

Server Actions in `src/app/`: Zod → use case → `redirect` **outside** try/catch. Stay on
`/owner?tenant=`. Failure → `?error=1` (existing flag).

Do not build BR-54 totals. Do not add a JS remaining widget.

**Definition of done:** Ahmad owner records LBP electricity in the browser; Studio: one
expense, one payment `EXPENSE`, one LBP tender with frozen equivalent, one ledger OUT equal
to that equivalent; `staff@ahmad` sees the row, no Record button; `?tenant=sami` does not
list Ahmad’s expense.

---



## Step 8 — Seed wipe

Seed **does not** insert expenses. Add `expense.deleteMany()` to the wipe (after payments /
tenders / ledger; expense has no FK from payment so order is: ledger, tenders, payments,
**expenses**, rates, …).

**Definition of done:** `npm run db:seed` still leaves `/owner` rate at 90000 and no expense
rows.

---



## Tests (Jest)


| Step                      | Jest                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| 1–2 Schema / guard        | None (migrate + Studio).                                                                     |
| 3 Access + domain          | `test/modules/access/domain/can.test.ts` (extend), `test/modules/expense/domain/`              |
| 4 Zod                     | `test/modules/expense/schemas/`                                                                |
| 5–8 Infra / use case / UI | No mandatory unit tests. Click + Studio.                                                     |


**Definition of done (Jest):** `npm test` includes SPEC-01–06 suites plus the new tests.

---



## Whole-slice acceptance

1. `npm test` green. ✅
2. Ahmad owner: electricity + `1800000` LBP at seeded 90000 → expense + 1 LBP tender
   `usdEquivalent` 20.00 + ledger OUT 20.00. ✅
3. Mixed: `$10` + `900000` LBP → two tenders, ledger OUT 20.00. ✅
4. USD `"30"` (no cents typed) still records 30.00. ✅
5. LBP with rate deleted in Studio → `"Set exchange rate first"`; USD still works. ✅
6. `staff@ahmad`: recent list visible, no Record form. ✅
7. `?tenant=sami` `/owner` does not show Ahmad’s expense. ✅
8. Payment / Ledger have **no** import of Expense. Expense does not import Booking. Pages have
   no Prisma / no `tenantId`. ✅
9. Collect on an APPROVED booking still works (regression). ✅

---



## Out of scope (do not build)

- Dashboard IN / OUT / net (BR-54–59) — **writing** the OUT row is in scope; a totals page is not
- Unpaid expenses, partial pay later, second payment on the same expense
- Edit / delete expense, refunds
- Managed categories table or Arabic category labels (i18n later)
- Shop, academy, owner-created bookings, cancel, overpay warning (parked SPEC-06)
- `collected_by` / which staff (Q-7)

---



## After this slice

Dashboard (SUM ledger by direction for a period). Then owner-created bookings / cancel.

---



## Step order for the agent

One numbered step at a time. Wait for OK. Do not scaffold `shop/` or `academy/`.
Do not add `expense_id` on payments even “just for now.”
Do not put an amount on `expenses`.
