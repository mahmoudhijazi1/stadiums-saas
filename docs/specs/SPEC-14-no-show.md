# SPEC-14 — Record a no-show

**Type:** Build Spec — precise, boring instructions to hand to Cursor.
**Depends on:** DR-001 §4–5 (Booking owns the status write; arrows down; Payment never
imports Booking), DR-002 §2.8 / §2.12 (exclusion is APPROVED-only; `NO_SHOW` is a status,
not a boolean; distinct from `CANCELLED`), DR-002 §2.21 (ledger append-only — **no**
silent edit of IN rows), DR-003 §5–6 (`can(...)`; Access never imports Booking),
DR-004 (keys, not English strings in domain), BR-22, BR-49, RULE-1.
**Builds on:** SPEC-01–13. Do not re-open cancel rules, waitlist UI, Book, approve,
expenses, Reports, or pitch Settings.
**Scope:** Logged-in owner (or staff with the flag) **records that an APPROVED booking
did not happen**. Status becomes `NO_SHOW`. Home still lets him collect if money remains.
**No** refund / ledger OUT, no waitlist/WhatsApp changes, no player self-no-show, no
`tenant.settings`, no games-played report (BR-57), no exclusion-constraint change.

> **Framework note:** Next.js / Prisma in this repo differ from training data. Before
> Server Actions, Prisma `updateMany`, read `node_modules/next/dist/docs/` and installed
> Prisma docs. This spec is WHAT and WHY.

> **Comments:** every exported function gets a short human comment — why it exists. No essays.

> **Transactions:** Authorize **before** `db.$transaction`. Never call `platformDb` inside
> `db.$transaction`
> ([guides/prisma-transaction-tenant-guard.md](../guides/prisma-transaction-tenant-guard.md)).
> Notifications (none this slice) stay **after** commit.

---

## What this slice delivers

Ahmad’s confirmed 18:00 game ended. The players did not come. Cancel is the wrong button
(SPEC-10 hides it when the hour has started **and** money is still owed — BR-49). He
opens Home, expands that row, taps **لم يحضر**. The row is `NO_SHOW`. If they still owe,
Collect stays. If they had already paid, the row leaves Home (same as a paid cancel).
The public page does not offer a past hour. Sami never sees Ahmad’s bookings.
`staff@ahmad` has no No-show button.

Ledger IN rows already collected stay. This slice does not write a refund.

---

## Prerequisites

- SPEC-01–13 click-proofed. `NO_SHOW` already exists on `BookingStatus`. Exclusion is
  `WHERE status = 'APPROVED'` only. Cancel already refuses past unpaid
  (`booking.cancel_past_unpaid`). Collect is APPROVED-only today (`payment.collect_unapproved`).
- Hours groups / Settings are on `main`. Do not touch pitch forms.
- `npm test` green.

---

## Pins this spec must make (BRD / DRs left them loose)

**Who may record it:** permission `"bookings.no_show"` (export `BOOKINGS_NO_SHOW`). OWNER
always yes. STAFF only if that jsonb key is strictly `true`. Seed `staff@ahmad` omits it.
Do **not** reuse `"bookings.cancel"` / `"bookings.approve"` / `"bookings.create"`.

**Status gate:** only `APPROVED` → `NO_SHOW`. PENDING / REJECTED / CANCELLED / NO_SHOW →
`booking.no_show_only_approved`. Domain function, not Prisma.

**When (kickoff is not enough):** `end <= now`. The hour must have **finished**.
`start <= now` but `end > now` (game in progress) → `booking.no_show_not_ended`.
Cancel’s past-unpaid clock stays `start` (SPEC-10 / ch.136). No-show waits until the
window is over so an in-progress APPROVED row still occupies (exclusion) and waitlist /
public do not treat it as freed mid-game.

**Occupied:** `NO_SHOW` still does not occupy (SPEC-05 / DR-002 §2.8). Do **not** change
the exclusion constraint. After the hour has ended, public Request already refuses
`booking.slot_ended`. Waitlist (SPEC-11) already hides `end <= now`. This slice does not
edit waitlist code.

**Collect (BR-49):** `assertCanCollect` must allow `APPROVED` **or** `NO_SHOW`. Unpaid
no-show is how the owner records “didn’t happen” **without** dropping the debt. PENDING /
REJECTED / CANCELLED still refuse (`payment.collect_unapproved`). Payment still does not
import Booking — the use case passes the status string it already loaded.

**Money:** do **not** call Ledger to insert, edit, or reverse. Already-collected tenders
stay. Remaining is still `priceUsd − sum(usd_equivalent)` on `source_type = BOOKING`.

**Home lists (BR-49):**

- `APPROVED` rows: same as today (today + next 7 days, including paid so Cancel still
  works; unpaid-before-today is overdue).
- `NO_SHOW` rows: include **only when remaining > 0** (Collect still needed). Paid
  no-show is omitted (history / BR-57 later).
- Partition stays `partitionHomeConfirmed`. An unpaid no-show whose `start` is before
  today’s Beirut midnight is overdue; one that started today stays in today.

**UI:** stay on `/owner/today`. One tap, no confirm dialog (same as Cancel). Show
No-show when `can(..., BOOKINGS_NO_SHOW)` **and** `end <= now` **and** status is still
the confirmed row (APPROVED, or unpaid NO_SHOW does not show the button again). Do not
show No-show on future rows. Cancel rules unchanged (hidden on past unpaid APPROVED).
After a successful no-show, `ok=no_show`.

**Zod:** reuse `parseBookingDecision` (`bookingId` only).

**WhatsApp / waitlist / Reports:** out. No new BR-71 template. No games-played count.

**Seed:** no sample no-shows. Wipe already deletes bookings.

**Copy (do not invent parallel lines):**

| Surface | Key | Arabic | English |
|---|---|---|---|
| Button | `owner.noShow` | لم يحضر | No-show |
| Toast | `no_show` | سُجّل عدم الحضور. | Marked as no-show. |
| Error | `booking.no_show_only_approved` | يمكن تسجيل عدم الحضور لحجز مؤكد فقط. | Only a confirmed booking can be marked no-show. |
| Error | `booking.no_show_not_ended` | يمكن تسجيل عدم الحضور بعد انتهاء الساعة فقط. | A no-show can be recorded only after the hour has ended. |

Do **not** reuse `booking.confirmed_only` (that Arabic line is cancel-only).

---

## Step 1 — Access flag

Extend `Permission` with `"bookings.no_show"` (`BOOKINGS_NO_SHOW`). Jest: OWNER can with
`{}`; STAFF default cannot; STAFF with `"bookings.no_show": true` can;
`"bookings.cancel": true` does not imply no-show.

**Definition of done:** `npm test` includes the new `can()` cases.

---

## Step 2 — Domain (booking)

In `src/modules/booking/domain/decision.ts` (or sibling):

- `assertApprovedForNoShow(status)` — not APPROVED → `booking.no_show_only_approved`.
- `assertEndedForNoShow({ end, now })` — `end.getTime() > now.getTime()` →
  `booking.no_show_not_ended`.

Jest: APPROVED + ended ok; PENDING / CANCELLED / NO_SHOW throw; future `end` throws;
`end == now` ok.

**Definition of done:** `npm test` includes those cases.

---

## Step 3 — Collect gate (payment domain)

`assertCanCollect`: `APPROVED` or `NO_SHOW` ok; other statuses still
`payment.collect_unapproved`. Update the comment (SPEC-06 said APPROVED-only; this spec
amends it). Jest: extend `test/modules/payment/domain/` (or the existing collect test).

Do **not** add a Booking import under `payment/`.

**Definition of done:** `npm test` includes NO_SHOW collect allowed; CANCELLED still refused.

---

## Step 4 — Infrastructure

`setApprovedNoShow(tx, bookingId)`: `updateMany` where `id` + `status = APPROVED` →
`NO_SHOW`. `count !== 1` → `booking.not_found`. No `tenantId` argument (guard). Same
Prisma shape as `setApprovedCancelled`.

Home reads: whatever lists APPROVED for `/owner/today` must also return `NO_SHOW` rows
that still have remaining (join/sum stays in the use case — infra may return NO_SHOW
alongside APPROVED in the same window/past queries, and the application drops paid
no-shows after remaining is computed). Prefer **one query that accepts both statuses**
over a second round-trip if Client can `status IN (...)`.

**Definition of done:** app code can flip one APPROVED row; a PENDING id fails.

---

## Step 5 — Use case

`recordNoShow(bookingId)` in Booking `application/`:

1. **Outside** `$transaction`: membership; `can(..., BOOKINGS_NO_SHOW)` else
   `access.not_allowed`.
2. `$transaction`: load booking (`findBookingForDecision`); missing →
   `booking.not_found`; `assertApprovedForNoShow`; `assertEndedForNoShow` with `new Date()`;
   `setApprovedNoShow`.
3. After commit: `logger.info` booking id. No WhatsApp. No Payment write. No remaining
   check (unpaid is allowed).

**Definition of done:** owner can mark no-show after end; staff seed cannot; Studio
status `NO_SHOW`; hour no longer in `listApprovedRanges`.

---

## Step 6 — Thin `/owner/today` UI

Keep the page a Server Component. No Prisma, no `tenantId`.

- Upcoming tap-in: No-show submit next to Collect / Cancel when the pins allow.
- Server Action: same `submitDecision` helper as cancel (Zod → `recordNoShow` →
  `redirect` outside try/catch). Failure → `?error=<key>`. Preserve `tenant`.
- `showNoShow` on the view: `mayNoShow && end <= now` for APPROVED rows. Unpaid NO_SHOW
  rows still show Collect, not a second No-show.
- Copy from the table above. EN/ع already exists — add both catalog sides.

Do not add a confirm checkbox. Do not add waitlist names. Do not add refund fields.

**Definition of done:** Ahmad marks a finished unpaid APPROVED as no-show in the
browser; Collect still works on that id; `staff@ahmad` has no button; future rows have
no No-show.

---

## Tests (Jest)

| Step | Jest |
| --- | --- |
| 1 Access | `test/modules/access/domain/can.test.ts` (extend) |
| 2 Domain | `test/modules/booking/domain/decision.test.ts` (extend) |
| 3 Collect | existing payment collect domain test (extend) |
| 4–6 Infra / use case / UI | No mandatory unit tests. Click + Studio. |

**Definition of done (Jest):** `npm test` includes SPEC-01–13 suites plus the new tests.

---

## Whole-slice acceptance

1. `npm test` green.
2. After end, unpaid APPROVED → `NO_SHOW`; still on overdue/today with Collect; not
   Cancel. Collect USD remaining → ledger IN appends; remaining 0 → row leaves Home.
3. After end, paid APPROVED → `NO_SHOW`; leaves Home; ledger IN **unchanged**; no new OUT.
4. Before end (future or in progress) → toast `booking.no_show_not_ended`; status stays
   APPROVED.
5. PENDING / already `NO_SHOW` / `CANCELLED` → `booking.no_show_only_approved`.
6. `staff@ahmad`: no No-show button. STAFF with only `bookings.cancel` still cannot.
7. `?tenant=sami` cannot no-show Ahmad’s booking.
8. Cancel / waitlist / Book / approve / pitch Settings still work.
9. Pages have no Prisma / no `tenantId`. Payment/Ledger not imported from `recordNoShow`.
   `assertCanCollect` stays in Payment domain.

---

## Out of scope (do not build)

- Refund / ledger OUT / reversing tenders
- Changing exclusion to treat `NO_SHOW` as occupied
- Waitlist list + WhatsApp (SPEC-11 unchanged)
- Player self-no-show
- Cancellation policy hours / `tenant.settings` (BR-27–28)
- Games-played / pitch-busy (BR-57) — do not count `NO_SHOW` as a played game; do not
  add the report this slice
- Edit/move/price (BR-11)
- Overpay warning (parked SPEC-06)
- Confirm dialog / second submit

---

## After this slice

BR-57 games-played (and whether `NO_SHOW` is excluded from “played”) as product asks.
Refunds / overpay warning / remaining BR-71 templates still parked.

---

## Step order for the agent

One numbered step at a time. Wait for OK. Do not scaffold `shop/` or `academy/`.
Do not write a refund “just in case.”
Do not change `gapMinutes` or hours groups.
