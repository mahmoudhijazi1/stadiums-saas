# SPEC-05 — Owner approve (exclusion fires)

**Type:** Build Spec — precise, boring instructions to hand to Cursor.
**Depends on:** DR-001 §4–5 (Booking owns the use case + `$transaction`; arrows down),
DR-002 §2.8 / §2.13 (exclusion; `slot_interests` window, not a rejected-booking id),
DR-003 §5–6 (Booking asks Access `can(...)`; Access never imports Booking),
BR-17–21, BR-23–25, BR-96–97, RULE-1, RULE-2, RULE-12.
**Builds on:** SPEC-01–04. Do not re-open login, public PENDING write, or Venue’s slot engine.
**Scope:** Logged-in owner (or staff with the flag) sees PENDING requests, **approves or rejects**.
Approve confirms the booking, auto-rejects overlapping PENDING on that pitch, writes
`slot_interests` for those losers, and the public page marks that window occupied.
**No** owner-created bookings, payments, cancel, no-show, waitlist UI, WhatsApp.

> **Framework note:** Next.js / Prisma in this repo differ from training data. Before Server
> Actions, `cookies()`, Prisma `update`/`$queryRaw` / `Unsupported`, read
> `node_modules/next/dist/docs/` and installed Prisma docs. This spec is WHAT and WHY.

> **Comments:** every exported function gets a short human comment — why it exists. No essays.

> **Transactions:** Authorize **before** `db.$transaction`. Session/User live on `platformDb`.
> Never call `platformDb` inside `db.$transaction`
> ([guides/prisma-transaction-tenant-guard.md](../guides/prisma-transaction-tenant-guard.md)).
> Notifications (none this slice) stay **after** commit.

---

## What this slice delivers

Ahmad’s owner logs in, opens `/owner`, sees PENDING public requests **oldest first** (BR-17).
He taps Approve on one. That row becomes **APPROVED**. Other PENDING on the **same pitch** whose
`during` overlaps it become **REJECTED**. Each auto-rejected requester gets a `slot_interests`
row for the **approved window** (BR-20, BR-21, DR-002 §2.13). The public day list still shows
the time, but **without** a Request form (`available: false`). A second overlapping APPROVED is
impossible: Postgres exclusion refuses it (BR-23, BR-24).

Staff `staff@ahmad` can log in and **see** the list. They cannot approve or reject (BR-97)
unless `can(..., "bookings.approve")` is true. OWNER always can.

Sami never sees Ahmad’s requests. Public name+phone still needs no login.

---

## Prerequisites

- SPEC-01–04 true: tenant guard, computed slots, public PENDING, login, seed owners.
- Exclusion `Booking_approved_during_excl` already in SQL (SPEC-03 step 2). Do not rewrite it.
- `npm test` green.
- next-intl still out. No payment, no dashboard calendar (BR-8 full board is later).

---

## Decisions this spec must not reopen

| Source | Decision |
|--------|----------|
| DR-002 §2.8 | Exclusion **is** the double-booking guard. App catches the DB error; it does not “check then insert” as the source of truth. |
| DR-002 §2.9–2.10 | Booking has no person column. Requester stays a participant with `is_requester`. |
| DR-002 §2.13 | `slot_interests` stores `pitch_id + during` (the filled window), not a rejected booking id. Waitlist UI (BR-29) is later; **writes happen now**. |
| DR-003 §5–6 | `can(membership, "bookings.approve")`. Same flag for **reject** this slice (do not invent `bookings.reject`). Access does not import Booking. |
| DR-001 §4 | Booking may import Access, Venue, People. Venue must not import Booking. |
| DR-001 §5 | The approve use case opens `$transaction` and passes `tx`. |
| SPEC-02 | Slots stay computed. Occupied ranges are generic `{ start, end }` passed **in**. |
| SPEC-03 | Public request stays unauthenticated. PENDING still may overlap other PENDING. |
| SPEC-04 | Cookie is not the tenant key. Hidden `?tenant=` is not isolation. |

---

## Pins this spec must make (BRD left them slightly loose)

**“Same slot” for BR-20:** other PENDING on the **same `pitchId`** whose `during` **overlaps**
the approved range (half-open `[start, end)`, existing `overlaps()` in Booking domain).
Not “string-equal slot labels.” Overlap is what exclusion uses; leftover overlapping PENDING
would only fail later.

**Interest `during`:** copy the **approved** booking’s window (the hour that filled), plus that
pitch, plus the auto-rejected row’s requester `personId`. Manual reject does **not** write
interest (BR-21 is automatic only).

**Occupied:** only `status = APPROVED`. REJECTED / PENDING / CANCELLED / NO_SHOW do not occupy.

**Public request after approve:** `requestPublicSlot` must fail if that window overlaps an
APPROVED range on the pitch (pass occupied into `generateSlotsForDay` / `resolveOfferedSlot`).
A stale form must not create a new PENDING on a taken hour.

---

## Step 1 — Schema: `slot_interests`

In `src/prisma/schema.prisma` (Prisma 7 syntax from installed docs):

**SlotInterest** (`tenantId` required — child table, DR-001 §1): `id`, `tenantId`, `pitchId`,
`during` as Postgres `tstzrange` (same `Unsupported("tstzrange")` pattern as Booking),
`personId`, `createdAt`. FKs to Tenant, Pitch, Person. `@@index([tenantId])`.

No unique on (pitch, during, person) unless installed docs + DR demand it — DR-002 does not.
Do **not** add payments, `pitch_blocks`, owner-source writes, or a slots table.

Migrate. If `template1` blocks `migrate dev`, handwritten SQL + `migrate deploy` (same as SPEC-03).
`$executeRaw` for `during` writes — the query extension does **not** stamp raw SQL; read
`tenantId` from ALS (`getCurrentTenantId`) inside the wrapped transaction, never a nested
Tenant lookup.

**Definition of done:** table exists; `tenant_id` on it; Prisma Studio can open the empty table.

---

## Step 2 — Guard

Add `SlotInterest` to `TENANT_SCOPED_MODELS` in `src/lib/db.ts`. Callers still do not pass
`tenantId` on Prisma `create`. Raw inserts still include `tenantId` from ALS (existing Booking
insert pattern).

**Definition of done:** a SlotInterest Prisma read from app code has no hand-written `tenantId`.

---

## Step 3 — Booking domain (pure)

`src/modules/booking/domain/` — no Prisma, no `await`.

At least:

- Reuse `overlaps`. Add a tiny helper: given an approved range and a list of PENDING ranges,
  which ids overlap on the same pitch (tests pass pitch separately or include it in the shape).
- Status gate: only `PENDING` may become APPROVED or REJECTED. Already APPROVED / REJECTED /
  CANCELLED / NO_SHOW → throw a clear error (string is fine; no HTTP in domain).
- `resolveOfferedSlot`: accept `occupied: UtcRange[]` (default `[]` for tests that don’t care).
  Pass it through to `generateSlotsForDay`. If the matching slot exists but `available === false`,
  throw (taken). Update the SPEC-03 comment that said occupied is always `[]`.

Jest: overlap auto-reject ids; adjacent `[16:00,17:00)` and `[17:00,18:00)` do **not** overlap;
non-PENDING cannot approve; offered slot with occupied covering it fails.

**Definition of done:** Jest in `test/modules/booking/domain/`.

---

## Step 4 — Zod

`src/modules/booking/schemas/` — approve/reject body: `bookingId` (non-empty string).
`strictObject` if Zod 4 allows. Reject extra keys. Hidden `tenant` slug stays on the form for
`?tenant=` after redirect only — **not** in this schema (same as login / public request).

**Definition of done:** tests for missing id, extra field, happy id.

---

## Step 5 — Infrastructure

Keep `during` mapping in infrastructure. Prisma Client has no Booking `create` because of
`Unsupported`; **verify** whether `findMany`/`update` exist in the generated client. If not,
`$queryRaw` / `$executeRaw` like `insertPendingPublicBooking`.

Needed (names yours; jobs fixed):

- List PENDING for this tenant, oldest `requestedAt` first, with pitch name, `during` as
  `{ start, end }`, requester name + phone (join participant `isRequester` + person).
- Load one booking by id for this tenant (range + status + pitchId). Missing → fail.
- List APPROVED ranges for a pitch (or all pitches this tenant) as `{ pitchId, start, end }[]`.
- Set status PENDING → APPROVED or REJECTED (WHERE id AND status = PENDING; 0 rows → fail).
- Insert `slot_interests` rows (raw, ALS `tenantId`).

No `tenantId` in function arguments except the ALS read inside raw SQL.

**Definition of done:** Studio / later use case can list Ahmad PENDING without a Sami row.

---

## Step 6 — Use cases

`src/modules/booking/application/`

**`listPendingRequests`:** membership required (caller already logged in). Returns the list
for the **URL** tenant (guard). Does not require `can` (staff may look).

**`approveBooking(bookingId)`:**

1. **Outside** `$transaction`: `getCurrentMembership()`; if null → fail; `can(..., BOOKINGS_APPROVE)`
   false → fail (same boring message, e.g. `"Not allowed"`). Do **not** open `platformDb` inside `tx`.
2. `$transaction`: load booking; domain status gate; set APPROVED; find overlapping PENDING on
   that pitch; set those REJECTED; insert interest per auto-rejected requester.
3. After commit: `logger.info` booking id. No WhatsApp.
4. If Postgres exclusion fires (two approvals at once, BR-24): catch, `logger.error`, rethrow a
   clear `"Slot no longer available"` (or equivalent). Whole tx rolls back — no half-APPROVED.

**`rejectBooking(bookingId)`:** same `can` gate. Only that row PENDING → REJECTED. No interests.
No exclusion.

Do not notify inside the transaction.

**Definition of done:** one Server Action can approve; overlapping second PENDING becomes REJECTED
+ interest; staff seed cannot approve.

---

## Step 7 — Occupied on the public day

`getDayAvailability` today passes `occupied: []`. Change it to accept occupied ranges **per pitch**
(or a list the page supplies). **Venue still does not import Booking.**

Thin `src/app/page.tsx`: call a Booking use case (e.g. `listApprovedRanges`) then Venue
`getDayAvailability` with those ranges. No Prisma on the page.

For `available === false`: **show** the time, **omit** the Request form (SPEC-02: generate anyway;
public filters the action, not the clock).

`requestPublicSlot` (SPEC-03 file): load APPROVED ranges for that pitch (inside or just before the
existing tx — **no** `platformDb`) and pass them as `occupied` into `resolveOfferedSlot`.

**Definition of done:** after Ahmad approves 16:00, `/?tenant=ahmad` that day has no Request on
that row; a POST of the old hidden start/end fails.

---

## Step 8 — Thin `/owner` UI

Keep `src/app/owner/page.tsx` a Server Component. Still: no membership → `/login`. No Prisma,
no `tenantId`.

Add the pending list: pitch, local time (Asia/Beirut), requester name, phone, requested time.
Approve and Reject as `<form action={...}>` like public request. Hidden booking id + tenant slug.

If `can` is false: show the list, **no** buttons (or disabled — prefer no buttons so staff do not
get a fake click). Logout stays.

Server Actions in `src/app/`: Zod → `getCurrentMembership` / `can` is inside the use case →
delegate. `redirect` **outside** try/catch (Next redirect docs). Stay on `/owner?tenant=`.

Do not build a full day schedule board (BR-8). This page is the pending inbox.

**Definition of done:** Ahmad owner approves in the browser; Sami’s `/owner` does not show that
row; staff@ahmad sees the row and cannot approve.

---

## Tests (Jest)

| Step | Jest |
|------|------|
| 1–2 Schema / guard | None (migrate + Studio). |
| 3 Domain | `test/modules/booking/domain/` (extend offered-slot / new file). |
| 4 Zod | `test/modules/booking/schemas/` |
| 5–8 Infra / use case / pages | No mandatory unit tests. Click + Studio. |

**Definition of done (Jest):** `npm test` includes SPEC-01–04 suites plus the new domain/Zod tests.

---

## Whole-slice acceptance

1. `slot_interests` migrated; `tenant_id` present. ✅
2. Two PUBLIC PENDING on the same Ahmad slot → owner approves one → that row APPROVED, the
   other REJECTED, one interest row (approved window + loser requester). ✅
3. Public page: that window listed, no Request form; overlapping APPROVED cannot be inserted
   (Studio: second APPROVED → exclusion). ✅
4. Manual reject: only that row REJECTED; no interest; slot still requestable. ✅
5. `staff@ahmad` / `dev-owner` on `?tenant=ahmad`: list visible, approve fails / no buttons. ✅
6. `?tenant=sami` `/owner` does not show Ahmad’s PENDING. ✅
7. Simultaneous-approve story: exclusion error is caught; no half-written status (tx). ✅
8. No `tenantId` on pages; Access does not import Booking; Venue does not import Booking. ✅
9. `npm test` passes. ✅

---

## Out of scope (do not build)

- Owner-created bookings (source OWNER, confirmed immediately — BR-14 / RULE-3)
- Payments, ledger, expenses
- Cancel, no-show, cancellation policy (BR-22, BR-26–28)
- Waitlist UI / notify interested people (BR-29–30)
- `pitch_blocks`
- WhatsApp / in-app owner ping (BR-70)
- Full daily schedule board (BR-8) beyond this pending inbox + public occupied
- i18n/RTL, RLS
- Filling `user_person_links`

---

## After this slice

Payment (collect on a booking). Then dashboard polish (BR-8 board). Cancel/no-show later.

---

## Step order for the agent

One numbered step at a time. Wait for OK. Do not scaffold unused Booking `ui/` folders.
