# SPEC-09 — Owner-created booking (phone-call, confirmed immediately)

**Type:** Build Spec — precise, boring instructions to hand to Cursor.
**Depends on:** DR-001 §4–5 (Booking owns `$transaction`; arrows down),
DR-002 §2.8–2.10 (exclusion on APPROVED; no person column; requester is a participant),
DR-003 §5–6 (`can(...)`; Access never imports Booking),
BR-13, BR-14, RULE-1, RULE-2, RULE-3, BR-20, BR-21, BR-23–25.
**Builds on:** SPEC-01–08. Do not re-open public PENDING, approve, collect, expenses, or the
ledger summary.
**Scope:** Logged-in owner (or staff with the flag) **creates a booking from a phone call**:
picks an available computed slot, types name + phone, submits. Row is **APPROVED**
immediately (`source = OWNER`). No self-approve. Overlapping PUBLIC PENDING on that pitch
become REJECTED + `slot_interests` (same as SPEC-05). Public page marks the hour occupied.
**No** cancel, no-show, edit/move/price change, waitlist UI, WhatsApp, collect-in-the-same-
submit.

> **Framework note:** Next.js / Prisma in this repo differ from training data. Before Server
> Actions, `$executeRaw` / `Unsupported` `tstzrange`, `searchParams`, read
> `node_modules/next/dist/docs/` and installed Prisma docs. This spec is WHAT and WHY.

> **Comments:** every exported function gets a short human comment — why it exists. No essays.

> **Transactions:** Authorize **before** `db.$transaction`. Session/User live on `platformDb`.
> Never call `platformDb` inside `db.$transaction`
> ([guides/prisma-transaction-tenant-guard.md](../guides/prisma-transaction-tenant-guard.md)).
> Notifications (none this slice) stay **after** commit.

---



## What this slice delivers

Ahmad’s owner is on the phone. He opens `/owner`, picks **today** (or another civil day),
sees free hours (same engine as the public page), types the caller’s **name and phone**, and
taps Book. That writes an **APPROVED** booking with `source = OWNER`, a requester participant,
and the hour is taken. He does **not** approve his own booking (BR-14 / RULE-3).

If two people had already requested that hour on the public page, those PENDING rows become
REJECTED and each loser gets a `slot_interests` row for the filled window (BR-20 / BR-21) —
same kitchen as Approve.

The game appears on **Due bookings** so he can Collect next (SPEC-06), in a second action.
Staff `staff@ahmad` do not see the Book form unless `can(..., "bookings.create")` is true.
OWNER always can.

Sami never sees Ahmad’s bookings. Venue still does not import Booking. Payment is not in this
submit.

---



## Prerequisites

- SPEC-01–08 click-proofed: computed slots, public PENDING, login, approve/exclusion,
  collect, expenses, ledger summary.
- `BookingSource.OWNER` and `BookingStatus.APPROVED` already exist. Exclusion already
  `WHERE status = 'APPROVED'`.
- `npm test` green.

---



## Pins this spec must make (BRD / DRs left them loose)

**Name + phone required:** the phone-call case is a person on the line (BR-13). This slice
always find-or-creates a Person and writes `isRequester` (same as public). **Do not** insert
an owner booking with zero participants (DR-002 §2.9’s “nobody named yet” waits until a later
slice — the due-list SQL joins the requester). Reuse the existing person if the phone already
exists for this tenant; do **not** overwrite the stored name (SPEC-03).

**Confirmed immediately:** `status = APPROVED`, `source = OWNER`. There is **no** PENDING
owner row and **no** Approve tap on it (BR-14).

**Who may create:** permission string `"bookings.create"` (export `BOOKINGS_CREATE`). OWNER
always yes. STAFF only if that jsonb key is strictly `true`. Seed `staff@ahmad` omits it.
Do **not** reuse `"bookings.approve"` for this (taking a call is not deciding a public
request). Approve/reject flags stay as they are.

**Slot truth:** `resolveOfferedSlot` with occupied = APPROVED ranges for that pitch (same as
`requestPublicSlot`). Price is the engine snapshot, never a form field (DR-002 §2.18). Owner
cannot type a different price this slice (BR-11 is later).

**Overlap with public PENDING:** after the APPROVED insert succeeds, reject overlapping
PENDING on that pitch and write `slot_interests` — **same rules as SPEC-05**. Extract the
loop from `approveBooking` into a small Booking helper (application or infrastructure) so
Approve and owner-create do not diverge. Manual reject still does not write interest.

**Exclusion:** two APPROVED on the same pitch/window → Postgres `23P01`. Catch like approve →
`"Slot no longer available"`. Share the walker; do not paste a second copy of the 8-level
cause walk.

**Occupied:** APPROVED only (already true). Owner-created rows occupy at once.

**UI home:** stay on `/owner`. Do **not** add `/bookings` or a calendar board (BR-8 later).
Section **Book a slot**: GET `bookOn=YYYY-MM-DD` (default today Asia/Beirut) to list free
slots via `getDayAvailability` + `listApprovedOccupied`. Each **available** slot: name, phone,
submit (Server Action). Preserve hidden `tenant`. Period GET fields (`from`/`to`/`view`/
`displayRate`) may drop when changing `bookOn` — defaulting the ledger month is acceptable.
This period / pending / collect / expenses stay.

**Not this submit:** no tenders, no Payment, no ledger write. After success, redirect to
`/owner?tenant=` (and `bookOn` if you have it). The new row should show on Due bookings.

**Cancel / no-show / policy / waitlist UI:** out of scope (next slice). `CANCELLED` already
exists on the enum; do not start writing it.

**Seed:** do not seed sample OWNER bookings. Wipe already deletes bookings.

---



## Step 1 — Access flag

Extend `Permission` with `"bookings.create"` (export `BOOKINGS_CREATE`). OWNER still always
`true`. Jest: OWNER can with `{}`; STAFF default cannot; STAFF with `"bookings.create": true`
can. Approve / collect / expense / reports tests stay green.

No schema. No Booking folders change yet.

**Definition of done:** `npm test` includes the new `can()` cases.

---



## Step 2 — Zod

`src/modules/booking/schemas/` — owner form. Reuse `normalizePhone` / the same 8–15 digit
refine as public. `strictObject`. Hidden `tenant` is **not** in this schema.

- `name` — trim, min 1
- `phone` — same as public
- `pitchId` — non-empty string
- `start`, `end` — Zod 4 UTC ISO with `Z` (same as public `z.iso.datetime()`)

Extra keys rejected. Do not accept a price field.

**Definition of done:** tests for happy name+phone, bad phone, extra key, missing pitchId.

---



## Step 3 — Infrastructure

Extend `src/modules/booking/infrastructure/bookings.ts`.

Insert **APPROVED** + `OWNER` with `tstzrange` via `$executeRaw` (same pattern as
`insertPendingPublicBooking`: Prisma Client has no `booking.create` because of Unsupported
`during`). Stamp `tenantId` from ALS in that SQL (extension does not stamp `$executeRaw`).

Reuse `insertRequesterParticipant`. Do not add Payment imports.

**Definition of done:** Studio can show an OWNER / APPROVED row inserted by app code (use case
in step 4); exclusion still blocks a second overlapping APPROVED.

---



## Step 4 — Use case

`createOwnerBooking({ name, phone, pitchId, start, end })` in Booking `application/`:

1. **Outside** `$transaction`: `getCurrentMembership()`; if null → fail;
   `can(..., BOOKINGS_CREATE)` false → `"Not allowed"`.
2. `$transaction`: load pitch; `resolveOfferedSlot` with that pitch’s APPROVED ranges;
   find-or-create person; insert APPROVED OWNER; insert requester; **then** reject overlapping
   PENDING + interests (extracted helper). Catch exclusion → `"Slot no longer available"`.
3. After commit: `logger.info` booking id. No WhatsApp.

Do not call `recordPayment`. Do not import Payment.

Approve still works; it should call the same overlap helper.

**Definition of done:** one Server Action can create; Studio: APPROVED + OWNER + participant;
overlapping PENDING rejected; staff seed cannot create.

---



## Step 5 — Thin `/owner` UI

Keep `src/app/owner/page.tsx` a Server Component. Still: no membership → `/login`. No Prisma,
no `tenantId`. This period, pending, rate, collect, expenses stay.

Add **Book a slot** if `can` create:

1. GET date `bookOn` (HTML date, default today Beirut). Submit “Show slots”.
2. For each pitch, list slots for that day (`getDayAvailability` + occupied from
   `listApprovedOccupied`). Taken hours: show the time, **no** Book form.
3. Available hours: name + phone + hidden pitch/start/end/`tenant`/`bookOn`, submit Book.

Server Action: Zod → `createOwnerBooking` → `redirect` **outside** try/catch. Stay on
`/owner?tenant=` (keep `bookOn` if present). Failure → existing `?error=1`.

Do not add a JS calendar. Do not add cancel buttons.

**Definition of done:** Ahmad owner books a free hour in the browser; public page that hour has
no Request; due list shows the caller; `staff@ahmad` has no Book form; `?tenant=sami` does not
list Ahmad’s new row.

---



## Tests (Jest)

| Step | Jest |
| --- | --- |
| 1 Access | `test/modules/access/domain/can.test.ts` (extend) |
| 2 Zod | `test/modules/booking/schemas/` (new owner-create file) |
| 3–5 Infra / use case / UI | No mandatory unit tests. Click + Studio. |

**Definition of done (Jest):** `npm test` includes SPEC-01–08 suites plus the new tests.

---



## Whole-slice acceptance

1. `npm test` green. ✅
2. Ahmad owner books a free hour with name+phone → Studio: `APPROVED`, `OWNER`, one requester
   participant, price matches the slot. Public: that hour occupied. Due list: that caller. ✅
3. Two PUBLIC PENDING on that hour, then owner books it → both PENDING become REJECTED, two
   interest rows on the filled window; owner row APPROVED. ✅
4. Booking an already APPROVED hour → `"Slot no longer available"` / taken (no second APPROVED). ✅
5. `staff@ahmad`: no Book form. Pending/collect/expense visibility unchanged. ✅
6. `?tenant=sami` `/owner` does not show Ahmad’s OWNER booking. ✅
7. Collect on the new APPROVED booking still works (regression). This period still loads. ✅
8. Pages have no Prisma / no `tenantId`. Venue does not import Booking. Payment not in the
   create use case. ✅

---



## Out of scope (do not build)

- Cancel, no-show, cancellation policy hours, `tenant.settings` (BR-22, BR-26–28)
- Waitlist UI / notify interested people (BR-29–30)
- Owner booking with **no** person
- Edit time / pitch / price (BR-11)
- Collect or ledger write in the same submit
- Full daily schedule board (BR-8)
- Per-player split, Arabic/RTL, overpay warning (parked SPEC-06)
- Shop, academy

---



## After this slice

Cancel a confirmed booking (BR-26). Then waitlist UI / Arabic as product asks.

---



## Step order for the agent

One numbered step at a time. Wait for OK. Do not scaffold `shop/` or `academy/`.
Do not insert PENDING owner rows “just for now.”
Do not add cancel buttons while building Book.
