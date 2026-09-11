# SPEC-10 — Cancel a confirmed booking

**Type:** Build Spec — precise, boring instructions to hand to Cursor.
**Depends on:** DR-001 §4–5 (Booking owns `$transaction`; arrows down),
DR-002 §2.8 / §2.12–2.13 (exclusion only on APPROVED; CANCELLED ≠ NO_SHOW; interests outlive
the booking), DR-002 §2.21 (ledger append-only — **no** silent edit of IN rows),
DR-003 §5–6 (`can(...)`; Access never imports Booking),
BR-26, RULE-1.
**Builds on:** SPEC-01–09. Do not re-open Book, approve, collect, expenses, or This period.
**Scope:** Logged-in owner (or staff with the flag) **cancels an APPROVED booking**. Status
becomes `CANCELLED`. The hour is free again (exclusion ignores it). Public Request returns.
**No** refund / ledger OUT, no-show, player self-cancel, cancellation-hours policy,
`tenant.settings`, waitlist UI / WhatsApp (BR-27–30).

> **Framework note:** Next.js / Prisma in this repo differ from training data. Before Server
> Actions, Prisma `updateMany`, read `node_modules/next/dist/docs/` and installed Prisma docs.
> This spec is WHAT and WHY.

> **Comments:** every exported function gets a short human comment — why it exists. No essays.

> **Transactions:** Authorize **before** `db.$transaction`. Never call `platformDb` inside
> `db.$transaction`
> ([guides/prisma-transaction-tenant-guard.md](../guides/prisma-transaction-tenant-guard.md)).
> Notifications (none this slice) stay **after** commit.

---



## What this slice delivers

Ahmad’s owner opens `/owner`, sees a confirmed game (phone-call or approved public request),
taps **Cancel**. That row is `CANCELLED`. The public page offers the hour again. Due/collect
no longer lists it. Staff `staff@ahmad` cannot cancel unless `can(..., "bookings.cancel")`.
OWNER always can.

If he had already collected cash, **the ledger IN rows stay**. This slice does not write a
refund. Sami never sees Ahmad’s bookings.

---



## Prerequisites

- SPEC-01–09 click-proofed. `CANCELLED` already exists on `BookingStatus`. Exclusion is
  `WHERE status = 'APPROVED'` only.
- `npm test` green.

---



## Pins this spec must make (BRD / DRs left them loose)

**Who may cancel:** permission `"bookings.cancel"` (export `BOOKINGS_CANCEL`). OWNER always
yes. STAFF only if that jsonb key is strictly `true`. Seed `staff@ahmad` omits it. Do **not**
reuse `"bookings.approve"` or `"bookings.create"`.

**Owner, any time (BR-26):** no “hours before kickoff” check. BR-27/28 (player policy +
`tenant.settings`) are **not** this slice.

**Status gate:** only `APPROVED` → `CANCELLED`. PENDING / REJECTED / CANCELLED / NO_SHOW →
`"Only a confirmed booking can be cancelled"`. Domain function, not Prisma.

**Occupied:** CANCELLED does not occupy (already true in SPEC-05). No change to
`listApprovedRanges`.

**Collect:** still APPROVED-only (SPEC-06). After cancel, Collect on that id → existing
`"Only an approved booking can be collected"`.

**Money:** do **not** call Payment or Ledger. Already-collected tenders stay. Dashboard This
period still shows that IN. A later refund SPEC may append ledger OUT (DR-002 §2.21). Do not
invent a refund this slice.

**Waitlist (BR-29):** `slot_interests` rows already exist for that window. **Do not** list or
notify them here. Waitlist UI is the next product slice.

**Player cancel (Q-5):** still unanswered. No public Cancel.

**UI:** stay on `/owner`. **Confirmed bookings** = all `APPROVED` (soonest first), including
fully paid. Collect forms only if remaining > 0 and `payments.collect`. **Cancel** if
`bookings.cancel`. Today’s Due list hides remaining ≤ 0 — **stop skipping those rows** so a
paid game can still be cancelled. Heading may stay “Due bookings” or become “Confirmed
bookings” (prefer **Confirmed bookings**). Empty: “No confirmed bookings.” Book a slot /
This period / pending / expenses unchanged. No cancel on PENDING.

**Zod:** reuse `parseBookingDecision` (`bookingId` only). Do not add a refund amount field.

**Seed:** no sample cancels. Wipe already deletes bookings.

---



## Step 1 — Access flag

Extend `Permission` with `"bookings.cancel"` (`BOOKINGS_CANCEL`). Jest: OWNER can with `{}`;
STAFF default cannot; STAFF with `"bookings.cancel": true` can; `"bookings.approve": true`
does not imply cancel.

**Definition of done:** `npm test` includes the new `can()` cases.

---



## Step 2 — Domain

`assertApprovedForCancel(status)` in `src/modules/booking/domain/decision.ts` (or sibling).
Not APPROVED → `"Only a confirmed booking can be cancelled"`. Jest: APPROVED ok; PENDING /
CANCELLED / NO_SHOW throw.

**Definition of done:** `npm test` includes those cases.

---



## Step 3 — Infrastructure

`setApprovedCancelled(tx, bookingId)`: `updateMany` where `id` + `status = APPROVED` →
`CANCELLED`. `count !== 1` → `"Booking not found"`. No `tenantId` argument (guard). No raw
SQL unless Client cannot update Booking status (verify installed Prisma — `during` is
Unsupported; `updateMany` on status should still exist).

**Definition of done:** app code can flip one APPROVED row; a PENDING id fails.

---



## Step 4 — Use case

`cancelBooking(bookingId)`:

1. **Outside** `$transaction`: membership; `can(..., BOOKINGS_CANCEL)` else `"Not allowed"`.
2. `$transaction`: load booking (existing `findBookingForDecision`); missing →
   `"Booking not found"`; `assertApprovedForCancel`; `setApprovedCancelled`.
3. After commit: `logger.info` booking id. No WhatsApp. No Payment.

**Definition of done:** owner can cancel; staff seed cannot; Studio status CANCELLED;
hour no longer in `listApprovedRanges`.

---



## Step 5 — Thin `/owner` UI

Keep the page a Server Component. No Prisma, no `tenantId`.

Change the Due list to **all APPROVED** (paid included). Collect only when remaining > 0 and
mayCollect. Cancel button when `can` cancel. Server Action: Zod → `cancelBooking` →
`redirect` outside try/catch. Failure → `?error=1`. Preserve `tenant` (and `bookOn` if easy).

Do not add waitlist names. Do not add refund fields.

**Definition of done:** Ahmad cancels an APPROVED hour in the browser; public Request is back;
due/confirmed list drops it; `staff@ahmad` has no Cancel; collect/book still work.

---



## Tests (Jest)

| Step | Jest |
| --- | --- |
| 1 Access | `test/modules/access/domain/can.test.ts` (extend) |
| 2 Domain | `test/modules/booking/domain/` |
| 3–5 Infra / use case / UI | No mandatory unit tests. Click + Studio. |

**Definition of done (Jest):** `npm test` includes SPEC-01–09 suites plus the new tests.

---



## Whole-slice acceptance

1. `npm test` green. ✅
2. Cancel unpaid APPROVED → `CANCELLED`; public hour free; not on confirmed list. ✅
3. Cancel paid APPROVED → `CANCELLED`; ledger IN rows **unchanged**; no new OUT. ✅
4. Cancel PENDING / already CANCELLED → error, not a status flip. ✅
5. `staff@ahmad`: no Cancel button. ✅
6. `?tenant=sami` cannot cancel Ahmad’s booking. ✅
7. Book / approve / collect / This period still work. ✅
8. Pages have no Prisma / no `tenantId`. Payment/Ledger not imported from cancel. ✅

---



## Out of scope (do not build)

- Refund / ledger OUT / reversing tenders
- No-show (BR-22)
- Player self-cancel (Q-5)
- Cancellation policy hours / `tenant.settings` (BR-27–28)
- Waitlist list + WhatsApp notify (BR-29–30)
- Edit/move/price (BR-11)
- Overpay warning (parked SPEC-06)

---



## After this slice

Waitlist UI on a freed slot (BR-29). Then Arabic / no-show as product asks.

---



## Step order for the agent

One numbered step at a time. Wait for OK. Do not scaffold `shop/` or `academy/`.
Do not write a refund “just in case.”
Do not add `tenant.settings` for hours.
