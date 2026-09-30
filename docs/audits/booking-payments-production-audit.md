# Booking & Payments: Production Readiness Audit

**Scope:** booking lifecycle, money core, per-player (SPEC-15), permissions, data integrity, test coverage.
**Code audited:** `origin/main` at `325c691` ("enforce cancel policy to allow cancellation only before the game starts"). This includes SPEC-15 slice 2 and the per-player collapse on cancel and no-show.
**Mode:** read-only. No production code changed. Every probe script and SQL check ran from outside the repo and was deleted afterwards.
**Sources of "expected":** BRD (RULE-1…12, BR-13…49), DR-002, SPEC-05/06/09/10/14/15/16, `docs/per-player-payments.md`, `docs/guides/mvp-readiness-audit.md`.

## How this was verified

| Method | What |
|---|---|
| Read | Every booking/payment/ledger use case, repository, domain rule, migration, server action, and the relevant UI gating (`today/lists.tsx`, `upcoming-panel.tsx`, `fee-forms.tsx`, `per-player-collect.tsx`). |
| Existing suites | Ran against local Postgres 16 (`stadiums_test`): **unit 58 suites / 402 tests pass**; **integration 6 suites / 41 tests pass**. |
| Coverage map | Jest v8 coverage from both suites. Statement hits were mapped onto every function in `modules/{booking,payment,ledger,expense}` (section 6). |
| Throwaway probe | A temporary Jest file used the real use cases to fill `stadiums_test` with realistic flows, then ran **10 races per scenario** on a 10-connection pool. It was deleted after the run. |
| Throwaway SQL | Integrity checks (section 5) against the probe data in `stadiums_test`. Also run against a freshly seeded `stadiums_dev`, but the seed has **no bookings**, so that run is vacuous and proves nothing. |

---

## Summary

| # | Area | Verdict | One-line note |
|---|---|---|---|
| 1.1 | Request → approve → confirmed | ✅ DONE | Pitch lock + re-read under lock. Approve-vs-approve race tested ×10. |
| 1.2 | Simultaneous requests / ordering / auto-reject / interest | ⚠️ PARTIAL | Works and is tested. A public request racing an approve can leave a stranded PENDING on a taken hour (10/10 in probe). |
| 1.3 | Owner-created booking (instant confirm) | ✅ DONE | APPROVED on insert, siblings rejected. Concurrency correct in probe, but no repo test since the owner-create collision test was removed. |
| 1.4 | No-overlap guarantee (exclusion + pitch lock) | ✅ DONE (DB) / ⚠️ tests | The DB exclusion makes overlap impossible. Concurrency tests cover approve×approve only. Owner-create races are untested in the repo. |
| 1.5 | Cancel (window, fee, slot freed, interested list) | ⚠️ PARTIAL | Window rule is enforced. **Staff can zero a late fee by choosing "I cancelled".** **Cancel racing a collect leaves due < collected.** |
| 1.6 | No-show (window, fee, per-player collapse) | ⚠️ PARTIAL | Rules correct. **No-show waive racing a collect leaves due < collected.** Slot-pay race is serialized but untested in the repo. |
| 1.7 | Midnight-crossing games | ⚠️ PARTIAL | A game starting before midnight is consistent everywhere. **Slots starting after midnight inside a window that crosses midnight are listed but cannot be booked (`slot_not_offered`).** |
| 2.1 | USD accounting / LBP tender only | ✅ DONE | No code path sums LBP. Every sum goes through `usdEquivalent`. |
| 2.2 | Owner rate, frozen per tender, never retroactive | ✅ DONE | Concrete trace in section 2.2. Tenders were unchanged by a rate change; new tenders use the new rate. |
| 2.3 | Ledger append-only, 1 payment ↔ 1 ledger entry, reconcilable | ⚠️ PARTIAL | Reconciles per booking (0 mismatches). Append-only is convention only. Ledger has no `paymentId`, so 1:1 is not provable. |
| 2.4 | Decimal-only money | ✅ DONE | No float/`Number` arithmetic on money. The only `Number()` calls are on fee *percent* integers. |
| 2.5 | Every `amountDueUsd` change writes `BookingDueChange` | ✅ DONE | Single write path (`writeDueIfChanged`). The only exception is the documented migration backfill. |
| 2.6 | "Never below collected" at every entry point | ⚠️ PARTIAL | All 5 entry points guard sequentially. **None hold off a concurrent collect: 30/30 race probes ended with due < collected.** |
| 3.1 | `splitEvenly` exact for n = 1…30 | ✅ DONE | 600,120 cases, 0 failures. The repo test covers only 4 examples. |
| 3.2 | Collect actions atomic | ✅ DONE | Slot pay and pay-all write payment + tender + ledger + allocation in one tx, and a test asserts the rows. |
| 3.3 | Slot double-tap protection | ✅ DONE | Booking row `FOR UPDATE` + recompute. Real concurrent test in the repo. Pay-all vs slot ×10 also correct. |
| 3.4 | Cancel / no-show collapse | ✅ DONE / ⚠️ | Money preserved, 0 orphans. Cancel collapse is unreachable in the UI (documented). Collapse vs slot-pay race is untested in the repo. |
| 3.5 | PaymentAllocation tenant isolation | ⚠️ PARTIAL | Fixed (added to `TENANT_SCOPED_MODELS`). The test only proves read scoping + stamping, not write paths or cross-tenant ids. |
| 3.6 | Per-player vs whole-mode features | ❌ **bug** | **"Booker pays all remaining" ignores Unassigned and overcharges** (probe: $24 taken where $14 was owed). Person stats lose Unassigned money. |
| 4 | Permission matrix | ⚠️ PARTIAL | Every mutation has a check. There is one bypass (initiator = OWNER), and no use-case test ever exercises a denial. |
| 5 | Data integrity (SQL) | ⚠️ | Clean except rows produced by the races: 30 lowered dues < collected, 10 stranded PENDING, 1 per-player overcharge. |
| 6 | Test coverage | ⚠️ | 20+ money/booking functions have zero coverage, including **record expense**, **ledger period totals** and the **To collect** SQL. |

---

## 1. Booking lifecycle

### 1.1 Request → approve → confirmed — ✅ DONE

- **Expected (BR-15, BR-18, SPEC-05):** a public request is PENDING. Only approval confirms it. Auth runs before the tx.
- **Implemented:**
  - `requestPublicSlot` (`request-public-slot.ts:25-68`) inserts PENDING + a requester participant. The price comes from the engine (`resolveOfferedSlot`), not the form.
  - `approveBooking` (`approve-booking.ts:52-121`) checks `bookings.approve`. It then locks the pitch (`lockPitchForUpdate`, `bookings.ts:70`), **re-reads under the lock**, throws `booking.no_longer_pending` if the request was already decided, re-validates the slot against APPROVED ranges, flips the status, and rejects the siblings.
  - `23P01` maps to `booking.slot_unavailable`.
- **Evidence:** `booking-money.integration.test.ts` "approves one of two concurrent requests, ten times" is a real race on a 10-connection pool (exactly one APPROVED, loser `no_longer_pending`, no P2034). `approve-booking.integration.test.ts` maps a real 23P01.

### 1.2 Simultaneous requests, ordering, auto-reject, interest — ⚠️ PARTIAL

- **Expected (BR-17, BR-19, BR-20, BR-21):**
  - Many PENDING may overlap.
  - The owner sees requests in received order.
  - Approving one rejects the other PENDING requests on that slot, and each rejection becomes a `SlotInterest`.
- **Implemented:**
  - `listPendingBookings` orders by `lower(during), requestedAt` (`bookings.ts:167`).
  - `rejectOverlappingPending` (`reject-overlapping-pending.ts:22-62`) rejects every overlapping PENDING on the same pitch and writes one `SlotInterest` on the *approved* window, in the approve tx.
- **Gaps:**
  1. **Stranded PENDING on a taken hour.** `requestPublicSlot` takes no pitch lock. If it runs while an approve is in flight, it reads "no APPROVED range", commits a new PENDING after the approve has already rejected the siblings, and nothing rejects it.
     - **Probe R10:** 10/10 runs left one stranded PENDING.
     - **SQL X2:** `pending_on_approved_window = 10`.
     - Impact is low: it sits in the inbox until the owner rejects it, and approving it fails with `slot_taken`. The requester gets no auto-reject message and no interest row.
  2. `SlotInterest` has no uniqueness. The same person can accumulate duplicate interests on one window (cosmetic).
- Ordering is "who asked first" *within* a slot group. The owner may still approve a later requester, which BR-17/18 allow.

### 1.3 Owner-created booking — ✅ DONE

- **Expected (BR-13, BR-14, RULE-3):** confirmed immediately, no approval.
- **Implemented:** `createOwnerBooking` (`create-owner-booking.ts:30-107`) checks `bookings.create`, locks the pitch, validates the offered slot, and inserts `APPROVED/OWNER` (`insertApprovedOwnerBooking`) + requester + `rejectOverlappingPending`.
- **Evidence:** integration "creates an owner booking approved at the pitch price".
  - **Probe R6** (two owner-creates, same slot, ×10): always `ok` + `slot_taken`.
  - **Probe R7** (approve vs owner-create, ×10): always one winner, loser `no_longer_pending`.
  - These races are **not in the repo tests**: progress.md notes the owner-create collision test was removed when the pitch lock landed.

### 1.4 No-overlap guarantee — ✅ DONE at the DB, ⚠️ test depth

- **Expected (BR-23, BR-24, RULE-1):** two APPROVED never overlap, even when approvals happen at the same moment.
- **Implemented:**
  - `EXCLUDE USING gist ("pitchId" WITH =, during WITH &&) WHERE status = 'APPROVED'` (migration `20260909080800`). This is a database constraint, so no application path can bypass it. There is no code path that updates `during` or moves a row back into APPROVED from another status.
  - The pitch `FOR UPDATE` lock (approve / owner-create / cancel / no-show) serializes approved writes, so the losing request normally gets a friendly `slot_taken` / `no_longer_pending` instead of 23P01.
- **Airtight?** Yes, for overlap: that is guaranteed by the DB, not by the lock. SQL X2 `approved_overlap = 0` after all race probes (R6/R7/R10: 30 concurrent pairs).
- **Tested beyond the happy path?** Partly:

  | Scenario | Tested in repo? |
  |---|---|
  | Raw overlapping insert → 23P01 | ✅ |
  | approve × approve ×10 | ✅ |
  | approve 23P01 mapping via seam | ✅ |
  | owner-create × owner-create | ❌ (removed) |
  | approve × owner-create | ❌ |
  | public request × approve (stranded PENDING) | ❌ |

### 1.5 Cancel — ⚠️ PARTIAL

- **Expected:**
  - BR-26 as amended 2026-09-30: cancel only before start.
  - SPEC-16 §4.2/§5.1: fee suggestion from policy, Edit/Waive need `bookings.adjust_due`, the slot is freed, the debt stays.
  - BR-29/30: interested people are listed and notifiable.
- **Implemented (`cancel-booking.ts:44-155`):**
  - Auth `bookings.cancel`, then pitch lock + booking row lock (`findBookingForUpdate`).
  - `assertApprovedForCancel` and `assertCancelWindowOpen` (`decision.ts:34-42`, `start <= now` refused).
  - `suggestFee` → `confirmedFee` (clamped to collected).
  - Per-player collapse, then the due change log, then `setApprovedCancelled`.
  - UI hides Cancel via the same `isCancelWindowClosed` (`today/lists.tsx:265-267`).
  - After a cancel, `submitCancelBooking` lists open interests (`peopleWaitingOn`), and WhatsApp is built after commit (`load-outcome-notify.ts`).
- **What works (tested):**
  - Late player fee (50% → $15).
  - Owner cancel of a paid game (due = collected).
  - Started paid/unpaid refused (`booking.cancel_started`).
  - Interest opens and closes after rebooking.
  - Per-player collapse variants.
- **Gaps:**
  1. **Staff fee bypass.** The fee-edit permission check (`cancel-booking.ts:84-90`) only compares `feeUsd` against the suggestion for the *chosen* initiator, and the initiator is caller-controlled (`actions.ts:145-148`, radio in `fee-forms.tsx:79-92`). Staff with only `bookings.cancel` can pick **"I cancelled" (OWNER)**, which makes the suggestion $0, and so waive a late-cancellation fee without `bookings.adjust_due`.
     - **Probe:** STAFF `{bookings.cancel}` on a booking inside the late window → `ok`, due $0.00. The same staff posting `feeUsd = 0` as PLAYER → `access.not_allowed`.
     - This contradicts SPEC-16 §6 ("Staff … can accept the suggested fee but cannot Edit or Waive").
  2. **Cancel racing a collect breaks "never below collected".** Cancel locks the booking row, but `collectBookingPayment` reads the booking with a plain `SELECT` (`findBookingForCollect`, `bookings.ts:825`) and never waits for that lock. Cancel reads `collected = 0`, sets due $0, and the collect commits $30 after.
     - **Probe R2:** 10/10 runs ended CANCELLED, due $0.00, collected $30.00, reason `CANCELLATION_NO_FEE` (SQL C3/C3b).
  3. `feeUsd` has no upper bound. A fee above the booking due (e.g. $100 on $30) is accepted.
  4. When the confirmed fee equals the current due, a `BookingDueChange` with `from = to` is written on purpose, to carry the initiator note (`cancel-booking.ts:109-121`). This deviates from SPEC-16 §4.3 "no-op → no log row" (documented in progress.md, harmless).
  5. **Documented, out of scope:** no clean "rain, refund/waive a prepaid game" path after the start (NOW.md).

### 1.6 No-show — ⚠️ PARTIAL

- **Expected (BR-22, SPEC-14, SPEC-16 §5.2):**
  - Only an APPROVED game that has ended.
  - The fee is `noShowFeePercent` of due. Edit/Waive need `adjust_due`.
  - A per-player booking collapses to whole first.
- **Implemented (`record-no-show.ts:30-108`):**
  - Auth `bookings.no_show`, then pitch + booking row locks.
  - `assertApprovedForNoShow` and `assertEndedForNoShow` (`decision.ts:47-62`).
  - `suggestFee(NO_SHOW)` → `confirmedFee` → `collapseToWhole` if per-player → `writeDueIfChanged` → `setApprovedNoShow`.
  - The UI shows No-show only when `isNoShowWindowEnded`.
- **Collapse logic:** `collapseToWhole` (`bookings.ts:1439-1447`) deletes allocations + unnamed slots, restores the requester's due, and sets WHOLE. Payments, tenders and ledger are untouched.
  - Tested: default fee, edited fee, waived-to-collected.
  - **Probe R5** (slot pay racing a no-show, ×10): serialized by the booking row lock. 0 allocations and 1 participant left afterwards, money intact.
- **Gaps:**
  1. **No-show waive racing a collect.** Same root cause as cancel.
     - **Probe R4:** 10/10 runs ended NO_SHOW, due $0.00, collected $30.00.
  2. The collapse-vs-slot-pay race is not in the repo tests (`per-player-payments.md` §8 admits it).
  3. There is no staff initiator bypass here, since no-show has no initiator.
  4. **Wrong log reason.** When the no-show fee ends up at or below collected (waive, or a fee edited down), `confirmedFee` (`suggest-fee.ts:75-77`) logs `CANCELLATION_NO_FEE`, not `WAIVER`/`NO_SHOW_FEE`. SQL C3b: all 10 NO_SHOW rows carry `CANCELLATION_NO_FEE`. The debt-warning line and the future timeline read this reason, so it is a data-quality bug.

### 1.7 Midnight-crossing games — ⚠️ PARTIAL (real bug)

- **Expected:** every place that buckets a booking by day agrees on which day an 11 pm–1 am game belongs to. BR-7 allows windows crossing midnight.
- **Rule in code:** "the Beirut civil day of the start" (`start-day.ts:18-23`).
- **Where a booking is bucketed:**

  | Place | Rule | Agrees with start-day? |
  |---|---|---|
  | Today list + day summary (`listBookingsForStartDay`, `bookings.ts:943`) | `lower(during)` in civil-day UTC range | ✅ |
  | To collect (`listEndedWithRemaining`) | instants (`upper(during) <= now`) | ✅ (not day-bucketed) |
  | Home inbox (`partitionHomeConfirmed`, `slotDateKind`) | civil day of start | ✅ (and `listDueBookings` is dead code, see §6) |
  | Person stats / games / debt warning | instants via `classifyDue` | ✅ |
  | Card display, missed requests, live queue, waitlist open | instants | ✅ |
  | Ledger period | `occurredAt` = cash date | n/a by design (cash axis) |
  | **Schedule engine** `generateSlotsForDay` (`availability.ts:32`, `windowToUtcRange` `:106`) | slots belong to the **window's** day, so a 22:00–02:00 window lists the 00:00 and 01:00 slots under day D | ❌ **disagrees** |
  | **`resolveOfferedSlot`** in request / approve / owner-create | regenerates slots for `civilDateInTimeZone(start)`, which is D+1 for those slots | ❌ |
  | `bookingFitsOpenHours` (hours-shrink guard, `availability.ts:244`) | civil day of start | ❌ same mismatch |
  | `priceForSlot` (`availability.ts:126`) | weekday of the start's wall clock | ⚠️ a Friday price rule does not apply to Friday night's 00:30 slot |

- **Probe:** pitch hours 22:00–02:00, day 2026-10-08. All four slots are listed for 10-08. 22:00 and 23:00 book fine. **00:00 and 01:00 both fail with `booking.slot_not_offered`**, for owner-create *and* the public request. The unit test `availability.test.ts:150` asserts "slots belong to the requested day", so the engine and the booking path contradict each other by design.
- **Tested?** Only a 23:00–00:30 slot (starts before midnight) in `booking-money.integration.test.ts` "counts a game that crosses midnight on its start day". Post-midnight starts: 0 tests. The DST fall-back day is not tested for Today bucketing (`civilDayUtcRange`). Ledger period and expense dates do have DST tests.

---

## 2. Money core

### 2.1 USD accounting, LBP tender only — ✅ DONE

- **Expected (BR-31, BR-32, RULE-4):** never total LBP across time.
- **Implemented:**
  - Every collected / ledger / summary figure sums `PaymentTender.usdEquivalent` or `LedgerEntry.amountUsd`.
  - Every SQL `SUM` touching tenders (`bookings.ts` ×7, migration backfill, `payments.ts:56-107`) uses `usdEquivalent`.
  - `grep` for `t."amount"` / tender `.amount` in sums: none.
  - LBP appears only in `freezeTenders` (per-tender conversion), in storage, and in the dashboard's view transform `usdToDisplayLbp` (BR-56).

### 2.2 Exchange rate owner-set, frozen, never retroactive — ✅ DONE

- **Expected (BR-34, BR-35, BR-37, RULE-5, RULE-6):** the owner sets the rate, each tender stores the rate it used, and past payments never change.
- **Implemented:**
  - `setExchangeRate` (`settings.manage`) appends a row. There is no update/delete in `src` (the seed wipes the table, dev only).
  - `collect*` read `findLatestExchangeRate` inside the tx.
  - `freezeTenders` stores `rateAtTime` + `usdEquivalent` per tender.
  - `remaining` is computed from stored `usdEquivalent`, never recomputed from the rate.
- **Concrete trace (probe, one booking, due $30):**

  | Step | Tenders on booking | Collected |
  |---|---|---|
  | Rate 90,000; collect $10 USD + 900,000 LBP | USD 10 @90000 → $10; LBP 900000 @90000 → $10 | $20.00 |
  | Owner sets rate 100,000 | *unchanged:* USD 10 @90000 → $10; LBP 900000 @90000 → $10 | $20.00 |
  | Collect 1,000,000 LBP | + LBP 1000000 @100000 → $10 | $30.00 |

- SQL C1c: every LBP tender satisfies `usdEquivalent = ROUND(amount / rateAtTime, 2)`, and every USD tender `usdEquivalent = amount`. 0 violations.

### 2.3 Ledger append-only, one entry per payment, reconcilable — ⚠️ PARTIAL

- **Expected (DR-002 §2.21):** append-only, same tx as the payment, reconcilable to tenders.
- **Implemented:** `recordPayment` (`record-payment.ts:12-44`) writes one payment, its tenders, and **one** ledger row summing the tenders, in the caller's tx. No code path updates or deletes `LedgerEntry`, `Payment` or `PaymentTender`.
- **Verified (SQL C1):**
  - Per booking: `SUM(ledger IN) = SUM(tenders)` **and** count(ledger rows) = count(payments). 0 mismatches over 99 payments.
  - Global $2,419.00 = $2,419.00.
  - No orphan ledger rows, no payment without tenders.
- **Gaps:**
  1. `LedgerEntry` has **no `paymentId`**, only `sourceType + sourceId`. "Exactly one ledger entry per payment" can only be inferred by count and sum per source, never proven row-for-row. A missing entry masked by an extra one on the same booking would pass.
  2. Append-only is **convention only**: no DB trigger, no REVOKE, no CHECK. `src/prisma/seed.ts:106-110` deletes ledger/payment rows, which is fine for dev but nothing stops the same in prod.

### 2.4 Decimal usage — ✅ DONE

- `grep` for `parseFloat`, `toNumber()`, `Number(…usd|amount|price|due|fee|lbp…)`, and `Math.*` on money: **none**.
- The only `Number()` near money is `tenant-settings.ts:60-61`, converting fee **percent** enum strings (0/50/100) to integers. `percentOf` then does Decimal math.
- `parseUsd` / `parseLbp` enforce strict string formats. DB columns are `DECIMAL(12,2)` / `(18,2)` / `(18,0)`.
- Minor: `parseUsd` throws a plain `Error` (not `DomainError`), so a malformed `feeUsd` form value surfaces as an unexpected error, not a validation message.

### 2.5 Every `amountDueUsd` change writes `BookingDueChange` — ✅ DONE

- **Expected (SPEC-16 §3.1):** every change of the collectible amount is logged, in the same tx.
- **Every write of `Booking.amountDueUsd`:**

  | Writer | Logged? |
  |---|---|
  | `insertBookingDuring` (creation, = price) | n/a (initial value) |
  | `setBookingAmountDue` (`bookings.ts:551`), called **only** by `writeDueIfChanged` | ✅ same tx |
  | ← `adjustBookingDue`, `cancelBooking`, `recordNoShow` | ✅ |
  | `cancelBooking` `feeSame` branch | writes a log row with from = to (no due change) |
  | Migration `20260924080000` backfill of CANCELLED rows | ❌ by design (documented "data correction") |
  | `applyPerPlayerSlots` / `applyWholeMode` / `collapseToWhole` | do not touch `Booking.amountDueUsd` (participant dues only) |

- SQL C3c: `latest_mismatch = 0`, `due_differs_from_price_without_log = 0`.
- **Latent drift (X1):** in WHOLE mode the requester's `BookingParticipant.amountDueUsd` is **not** updated when the booking due changes. 36 of 36 WHOLE bookings with a due change have a stale participant due. Nothing reads it in WHOLE mode today (`personOwedOnBooking` uses the booking remaining), so this is a trap for future code, not a live bug.
- Participant dues in per-player mode are not logged anywhere. Slot-due editing is slice 4, so no path changes them yet.

### 2.6 "Never below collected" at every entry point — ⚠️ PARTIAL

- **Expected (SPEC-16 §4.3, RULE-9):** no path lowers the due below what has been collected.

| Entry point | Sequential guard | Tested | Under concurrency |
|---|---|---|---|
| Adjust amount (`adjustBookingDue` → `assertAdjustDue`, `adjust-due.ts:24`) | `toUsd < collected` → `due_below_collected` | ✅ | ❌ **no lock at all** (`findBookingForDecision`). Probe R3 10/10: due $10, collected $30 |
| Adjust → WAIVER | same | ✅ (no-show then waiver) | ❌ same |
| Cancel fee / waive (`confirmedFee`, `suggest-fee.ts:64`) | clamps up to collected | ✅ | ❌ R2 10/10 |
| No-show fee / waive | clamps up to collected | ✅ | ❌ R4 10/10 |
| Per-player switch / collapse | due unchanged | ✅ | ✅ (row lock) |
| Migration backfill | `LEAST(price, collected)` + guard | n/a | n/a |

- **Root cause (one place):** `collectBookingPayment` never locks the booking row. The cancel and no-show row locks are therefore one-sided, and `adjustBookingDue` takes no lock at all.
- There is no DB-level guard. A CHECK can't express "due ≥ collected", and overpay is intentionally allowed (SPEC-06), so it would have to be enforced in the tx.
- **Related, known P1 still open:** concurrent whole-game double collect (`mvp-readiness-audit.md` §"Concurrent double-collect"). **Probe R1:** 10/10 runs collected $60 on a $30 due.
- `adjustBookingDue` does not check status. It changes the due of PENDING or REJECTED bookings too.
  - **Probe:** PENDING adjusted to $1.00, then approved, stays $1.00 against a $30 price.
  - Only the owner (or `adjust_due` staff) can do this, and only by posting the action directly: the UI only offers adjust on owed/expected.

---

## 3. Per-player (SPEC-15)

### 3.1 `splitEvenly` never loses or gains a cent — ✅ DONE

- `split-evenly.ts:8-25` uses integer cents with a floor and gives the remainder cents to the first slots.
- **Probe:** every amount $0.01 … $200.00 in 1¢ steps, plus $0.00, $999.99, $1,234.57 and $9,999,999,999.99, × n = 1…30. That is **600,120 splits: 0 failures**. Each split sums exactly, has length n, spreads at most 1¢, and every share is whole cents and ≥ 0.
- **Test honesty:** the repo test covers only $30/7, $30/10, $30/1, and n = 0. There is no property test over 1…30.

### 3.2 Collect actions are one atomic transaction — ✅ DONE

- `payRemaining` (`collect-player-payment.ts:33-81`) runs one `db.$transaction`: lock the booking → compute → `recordPayment` (payment + tender + ledger) → `insertAllocations`. Pay-all is the same function.
- The integration test "one tap writes one payment, one USD tender, one ledger IN and one allocation" asserts all four rows.
- There is no rollback test for a failure mid-collect. The split has one; this relies on the Prisma tx.
- The whole-game collect is also one tx, but see 2.6 for its missing lock.

### 3.3 Double-tap protection on slot pay — ✅ DONE (tested)

- `findBookingForUpdate` (`bookings.ts:276`) + remaining recomputed after the lock.
- **Repo test:** "pays a slot once when the same slot is tapped twice at the same time". `Promise.allSettled` on a 10-connection pool, so the race is real. It gets exactly one payment/allocation, and the loser gets `payment.nothing_due`.
- **Probe R8** (pay-all vs slot tap, ×10): always one `ok` + one `nothing_due`, allocated = collected = $30.

### 3.4 Cancel / no-show collapse — ✅ DONE, ⚠️ reachability/test depth

- **Money preserved:** payments, tenders and ledger are untouched (asserted by count in tests).
- **No orphans:**
  - SQL C5: 0 allocations without participant or payment.
  - C2b: 0 allocations on WHOLE bookings, 0 PER_PLAYER bookings in a non-APPROVED status, 0 WHOLE bookings with slot rows.
  - The `PaymentAllocation → BookingParticipant` FK is `RESTRICT`, so deleting a participant with allocations is impossible, and collapse deletes allocations first.
- **Reachability:**
  - **No-show:** reachable in the UI (split is offered only after the end).
  - **Cancel:** **unreachable** in the UI since 2026-09-30 (cancel before start, split after end). It is kept and tested via direct use-case calls (documented in `per-player-payments.md` §5).
- The collapse-vs-slot-pay race is not in the repo tests. Probe R5 shows it is serialized correctly.
- Documented trade-off: who paid what is lost on collapse.

### 3.5 PaymentAllocation tenant isolation — ⚠️ PARTIAL

- **The bug:** slice 1 left `PaymentAllocation` out of `TENANT_SCOPED_MODELS`, so creates were not stamped and reads not scoped.
- **The fix:** `src/lib/db.ts:18` (commit `fc23bf2`). It is real: creates get `tenantId` (SQL C2b `alloc_tenant_mismatch = 0`), and `count`/`findMany`/`deleteMany` get `where.tenantId`.
- **All access paths:**

  | Path | Scoped by | Tested |
  |---|---|---|
  | `insertAllocations` (`payments.ts:113`) | extension stamps tenant | ✅ stamping asserted |
  | Client reads (`db.paymentAllocation.count`) | extension | ✅ "scopes PaymentAllocation to the current stadium" |
  | `collapseToWhole` `deleteMany` | extension adds `tenantId` | ❌ |
  | Raw SQL reads (`listSlotsForBookings`, `listPerson*`, `listDebtParticipations`, `countBookingAllocations`) | hand-written `a."tenantId" = bp."tenantId"` + outer tenant filter | ❌ |
  | Slot pay with another tenant's participant id | booking lookup + slot filter by booking | ❌ in repo. **Probe:** both cross-tenant attempts → `booking.not_found` |

- **Still missing:**
  - No DB constraint ties `PaymentAllocation.tenantId` to its payment's and participant's tenant: no composite FK. Isolation for raw SQL is manual.
  - "Participant belongs to the payment's booking" (flagged in progress.md as required) is enforced in `payRemaining` by filtering slots of the locked booking, but there is no test for the negative case.

### 3.6 Per-player vs features built for whole mode — ❌ (one confirmed money bug)

| Feature | Reads correctly in per-player? |
|---|---|
| Day summary (`summarizeDay`) | ✅ booking-level `amountDue − collected`. Probe: owed $14 = booking remaining. |
| Card display / To collect | ✅ booking-level |
| Whole-game collect | ✅ refused (`booking.collect_per_player`). ⚠️ **Probe R9:** split racing a whole collect lets a whole payment land after the split (10/10), because whole collect takes no row lock. The money counts as Unassigned, so it is not lost. |
| Adjust due | ✅ refused (`due_whole_only`) |
| **"Booker pays all remaining"** (`payRemaining` ALL_UNPAID, button total `lists.tsx:285-290`) | ❌ **Sums unpaid slot remainings and ignores Unassigned.** **Probe:** due $30, $10 paid whole-game before the split, 2 slots tapped ($6), so the booking remaining is **$14**. Pay-all charged **$24** → collected $40, **overpaid $10**. This is reachable from the UI: split is offered on a *partial* (owes-cash) booking. SPEC-15 P3 says excess must stay Unassigned, not be charged again. |
| Slot "Pay" on an overpaid booking | ⚠️ documented (RULE-9). Same root: slot remainings do not know about Unassigned. |
| Person stats (`summarizePersonBookings`) | ⚠️ **Probe:** the booker paid $10 whole-game, then split. The person page shows **Total paid $0** and **Owes $3**, because in PER_PLAYER mode paid = allocations only and Unassigned is attributed to nobody. |
| Debt warning / person owes | ⚠️ unnamed unpaid slots owe nothing to any person (documented gap 2, until slice 4) |
| Who-owes (BR-49) | there is no dedicated page. To collect (booking-level, 5 + "more") and the person page are the only views. |

---

## 4. Permissions

OWNER always passes (`can.ts:31-41`). STAFF passes only when the jsonb flag is strictly `true`. The seed's `staff@ahmad` has `{}`, i.e. every staff default below is ✗.

| Action (use case) | Permission checked | OWNER | STAFF default | Notes |
|---|---|---|---|---|
| Public request (`requestPublicSlot`) | none (public, BR-16) | n/a | n/a | No rate limit / abuse guard. |
| Approve (`approveBooking`) | `bookings.approve` | ✓ | ✗ | |
| Approve missed "They played" (`allowStarted`) | `bookings.approve` | ✓ | ✗ | Same flag confirms a *past* game (backdated debt). Consider a stronger flag. |
| Reject / dismiss missed | `bookings.approve` | ✓ | ✗ | |
| Owner create (`createOwnerBooking`) | `bookings.create` | ✓ | ✗ | |
| Cancel, suggested fee | `bookings.cancel` | ✓ | ✗ | |
| Cancel, edited or waived fee | `bookings.cancel` + `bookings.adjust_due` | ✓ | ✗ | |
| **Cancel as "I cancelled" (fee → $0)** | **`bookings.cancel` only** | ✓ | ✗ | ❌ **Bypass:** staff can drop a late fee without `adjust_due` (§1.5). |
| No-show, suggested fee | `bookings.no_show` | ✓ | ✗ | |
| No-show, edited or waived fee | `bookings.no_show` + `bookings.adjust_due` | ✓ | ✗ | |
| Adjust amount (`adjustBookingDue`) | `bookings.adjust_due` | ✓ | ✗ | No status check (PENDING/REJECTED adjustable). |
| Split / back to whole | `bookings.adjust_due` | ✓ | ✗ | SPEC-15 names no flag; `adjust_due` is a reasonable choice. |
| Whole-game collect | `payments.collect` | ✓ | ✗ | |
| Slot pay / pay all | `payments.collect` | ✓ | ✗ | |
| Set exchange rate | `settings.manage` | ✓ | ✗ | |
| Booking rules (fee %) | `settings.manage` | ✓ | ✗ | |
| Pitch price / hours | `settings.manage` | ✓ | ✗ | |
| Record expense | `expenses.record` | ✓ | ✗ | |
| Ledger period totals (Money) | `reports.view` | ✓ | ✗ | |
| Today money line, To collect, person stats | membership only | ✓ | ✓ | ⚠️ Staff without `reports.view` still sees collected/owed totals on Today and the person page. |

- **Every mutating action has a check at the use-case level, before the tx.** Server actions contain no auth; they rely on the use case, which is consistent.
- **Not tested:** no integration test runs any use case as STAFF or asserts `access.not_allowed`. Only `can()` is unit-tested. The probe verified three denials and found the bypass.

---

## 5. Data integrity checks (throwaway SQL, `stadiums_test`)

The probe data covers:
- 2 tenants, 138 bookings (25 PER_PLAYER), 99 booking payments, 100 tenders, 99 ledger rows, 58 allocations, 37 due changes.
- Whole, mixed-currency, rate-change, late cancel, owner cancel, no-show + waiver, split + taps + pay-all, split no-show / cancel collapse, overpay, cross-tenant attempts, and 10 races per scenario R1–R10.

| # | Check | Result |
|---|---|---|
| C1 | Per booking: `SUM(ledger IN) = SUM(tender.usdEquivalent)`, and ledger row count = payment count | ✅ **0 violations**. Global $2,419.00 = $2,419.00. 0 orphan ledger rows, 0 payments without tenders, 0 tender/payment tenant mismatches. |
| C1c | Tender freeze math | ✅ 0 violations |
| C2 | PER_PLAYER: `SUM(allocations) + unassigned = SUM(tenders)` | ✅ holds for all 25, but **this is a tautology** (unassigned is *defined* as tenders − allocations). The meaningful versions are below. |
| C2b | Allocation on the right booking; per-payment allocation ≤ tenders; per-slot allocation ≤ slot due; tenant match; no allocations on WHOLE; PER_PLAYER only APPROVED; slot dues sum = booking due | ✅ all 0. ❌ **1 PER_PLAYER booking overpaid by exactly its Unassigned ($40 on $30)**, the pay-all bug (§3.6). |
| C3 | `BookingDueChange.toUsd <` collected at that moment (payments created at or before the change) | ❌ **24 rows** (10 owner cancels, 10 no-show waivers, 4 discounts). All come from races R2/R3/R4. None from sequential flows. |
| C3b | Latest change *lowered* the due, and due < collected now | ❌ **30 bookings** (10 APPROVED/DISCOUNT, 10 CANCELLED, 10 NO_SHOW). This is the robust version of C3: the timestamp test in C3 misses some, because `Payment.createdAt` is the collect tx's start time. |
| C3c | Latest change = `Booking.amountDueUsd`; due ≠ price without a log | ✅ 0 / 0. (1 `from = to` row, from the intentional cancel note.) |
| C4 | Requester rows per booking | ✅ all 138 have exactly 1. The partial unique index enforces ≤ 1. **≥ 1 is not DB-enforced**, and a booking with 0 would silently vanish from every `INNER JOIN … isRequester` query (Today, To collect, pending). |
| C5 | Orphaned allocations (missing participant or payment) | ✅ 0. Impossible by FK `RESTRICT`. |
| X1 | WHOLE requester participant due ≠ booking due | ⚠️ 36 drifted (all bookings with a due change). Latent (§2.5). |
| X2 | Overlapping APPROVED / PENDING stranded on an APPROVED window | ✅ 0 / ❌ 10 (race R10) |
| X3 | Collected > due | 21 APPROVED WHOLE (R1 ×10, R3 ×10, 1 intentional overpay), 10 CANCELLED (R2), 10 NO_SHOW (R4), 1 PER_PLAYER (pay-all) |

The seeded `stadiums_dev` passes every check trivially: it has no bookings, payments or allocations. There is no real production-shaped data to check against yet.

---

## 6. Test coverage honesty

Coverage was mapped per function from the unit + integration v8 runs.

**Zero coverage (neither suite executes a single statement of the function body):**

| Function | File | Why it matters |
|---|---|---|
| `recordExpense`, `insertExpense` | `expense/application/record-expense.ts`, `expense/infrastructure/expenses.ts` | **The only money-OUT path.** Payment + tenders + ledger OUT are never run in a test. |
| `summarizeLedgerPeriod`, `sumAmountUsdByDirection` | `ledger/application/summarize-ledger-period.ts`, `ledger/infrastructure/entries.ts:203` | The Money tab's IN / OUT / net totals. Only pure period math is unit-tested. |
| `listEndedWithRemaining` | `bookings.ts:994` | The **To collect** inbox SQL. `loadOwnerDay` only runs it for *today*, and every test passes another date. |
| `listDebtWarnings`, `listDebtParticipations` | `list-debt-warnings.ts`, `bookings.ts:1276` | The request-card debt SQL. Only the pure fold is tested. |
| `listPersonBookings`, `listPersonBookingRows` | `list-person-bookings.ts`, `bookings.ts:1097` | Person games list and its keyset pagination. |
| `loadOutcomeNotify`, `findBookingFeeState` | `load-outcome-notify.ts`, `bookings.ts:395` | Builds the **fee amount the customer is told** after cancel, no-show or adjust. |
| `loadDecisionNotify`, `findBookingRequester` | `load-decision-notify.ts`, `bookings.ts:326` | Approve / reject messages. |
| `getCurrentRate`, `getExchangeRateChangedAt` | `payment/application/get-current-rate.ts` | Rate shown to the owner (BR-36). |
| `listApprovedOccupied` | `list-approved-occupied.ts` | Occupied list on the owner Book page. |
| `listLivePitchWindows`, `listLiveWindowsOnPitch` | `bookings.ts:862` | Guard that stops pitch-hour edits from orphaning APPROVED bookings. |
| `listDueBookings`, `listApprovedBookingsInRange`, `listApprovedBookingsStartingBefore`, `sumCollectedUsdBySourceIds` | `list-due-bookings.ts`, `bookings.ts:739/774`, `payments.ts:79` | **Dead code:** no caller in `src`. Delete it or test it. |
| `getLiveQueue`, `countActionablePending` | | Badge. Not money. |
| Schemas `adjust-due-form`, `per-player` | | Form → use-case contract. |
| Every server action (`src/app/**/actions.ts`) | | `optionalFee` parsing, initiator validation, USD/LBP form parsing. |
| Every owner UI component | | No React test setup: fee sheet, per-player sheet, pay-all total. |

**Covered functions with untested branches or scenarios that matter:**

| Scenario | Status |
|---|---|
| Any use case called as STAFF / `access.not_allowed` | 0 tests |
| Cancel initiator = OWNER by staff (the bypass) | 0 tests (fails the spec) |
| Concurrent whole collect | 0 tests (fails: R1) |
| Collect × cancel / no-show / adjust races | 0 tests (fail: R2–R4) |
| Slot pay × cancel/no-show collapse race | 0 tests (passes: R5) |
| Owner-create × owner-create, approve × owner-create | 0 tests (pass: R6/R7) |
| Public request × approve | 0 tests (strands PENDING: R10) |
| Split × whole-collect race | 0 tests (payment lands unassigned: R9) |
| Pay-all with Unassigned > 0 | 0 tests (**overcharges**) |
| Cross-tenant participant id on slot pay | 0 tests (passes in probe) |
| `splitEvenly` over n = 1…30 | 4 examples only (passes 600k-case probe) |
| Post-midnight slot booking | 0 tests (**fails**) |
| DST day for Today bucketing (`civilDayUtcRange`) | 0 tests (ledger / expense DST are tested) |
| Adjust on PENDING / REJECTED | 0 tests (allowed) |
| Rollback of a failed collect | 0 tests |
| Rate change after a partial LBP payment | 0 tests (passes: §2.2 trace) |

---

## Before production — punch list (worst first)

1. **Lock the booking row in `collectBookingPayment`** (use `findBookingForUpdate`, like slot pay), and **lock it in `adjustBookingDue`**. One change closes:
   - concurrent double collect (R1, known P1);
   - cancel/no-show/adjust lowering the due below cash that lands concurrently (R2–R4: 30/30 bad rows);
   - a whole payment slipping in after a split (R9).

   Add a race test per pair.
2. **Fix "Booker pays all remaining" with Unassigned money** (§3.6). Cap pay-all at the booking remaining and allocate in slot order (SPEC-15 P3), or offset Unassigned first. Fix the button total in `lists.tsx:285` to match. This is reachable today in the normal UI and overcharges players.
3. **Close the staff fee bypass on cancel** (§1.5). If the initiator changes the suggestion away from the PLAYER suggestion (or away from any non-zero suggestion), require `bookings.adjust_due`; alternatively, hide "I cancelled" from staff without it. Add use-case tests that run as STAFF for every guarded action.
4. **Midnight windows** (§1.7). Resolve offered slots against both the start's civil day and the previous day's windows, or make the engine emit post-midnight slots under the civil day of their start everywhere. Apply the same fix to `bookingFitsOpenHours` and price-rule weekday. Add an integration test that books 00:00 and 01:00 from a 22:00–02:00 window, and a DST-day Today test.
5. **Test the untested money paths** (§6): `recordExpense` (ledger OUT), `summarizeLedgerPeriod`, `listEndedWithRemaining`, `loadOutcomeNotify` fee text, `listDebtParticipations`. Delete or test the dead `listDueBookings` chain.
6. **Person stats in per-player mode** (§3.6). Decide where Unassigned counts (booker?) so "Total paid" and "Owes" do not drop after a split. This is closely tied to slice 5.
7. **Stranded PENDING** (§1.2). Take the pitch lock in `requestPublicSlot`, or reject PENDING rows that overlap an APPROVED on read or approve.
8. **`adjustBookingDue` status guard.** Refuse PENDING and REJECTED, and consider capping cancel/no-show `feeUsd` at the current due.
9. **Ledger hardening** (§2.3). Add `paymentId` to `LedgerEntry` (nullable for EXPENSE if needed) so 1:1 is provable, and block UPDATE/DELETE on `LedgerEntry` / `Payment` / `PaymentTender` / `BookingDueChange` at the DB (trigger or role grants).
10. **Keep the WHOLE requester participant due in sync** in `writeDueIfChanged`, or document that it is meaningless in WHOLE mode (§2.5 X1). Consider a DB-level "exactly one requester" guarantee (deferred constraint trigger), since 0 requesters hides a booking everywhere.
11. **Tenant isolation depth for `PaymentAllocation`.** Add tests for collapse `deleteMany`, the raw-SQL readers, and a cross-tenant participant id. Longer term, add composite FKs `(id, tenantId)` so the DB enforces the tenant match.
12. **`splitEvenly` property test** over n = 1…30 and a range of amounts (cheap; the code is already correct).
13. **Low:**
    - `parseUsd` should throw a validation error rather than an unexpected one on bad form input;
    - no-show waivers are logged as `CANCELLATION_NO_FEE` (§1.6), so give no-show its own reason;
    - dedupe `SlotInterest` per person and window;
    - decide whether "They played" should need a stronger permission than approve;
    - decide whether staff without `reports.view` should see money totals on Today.

---

## Addendum — punch-list status (2026-09-30)

The audit body above is historical and unchanged. Status of each item after PR #3 (merged) and the `fix/midnight-and-pending` branch:

| # | Item | Status | Commit | Note |
|---|---|---|---|---|
| 1 | Booking row lock in collect and adjust | **Closed** | `259fb64` | R1–R4 and R9 race tests, ten runs each. R3 asserts order, since overpay after a lowered due is allowed (SPEC-06). |
| 2 | Pay-all with Unassigned money | **Closed** | `6b92f81` | `planSlotCharge` caps every per-player charge at the booking remaining; covered slots have no Pay. |
| 3 | Staff fee bypass on cancel | **Closed** | `72c78c5` | STAFF integration suite for every guarded booking/payment use case. |
| 4 | Midnight windows | **Closed** | `66552f3`, `b9259ac` | Post-midnight slots bookable and priced by their window's day. Today, the day strip and the day summary use a 06:00–06:00 business day. |
| 5 | Untested money paths | **Open** | — | `recordExpense`, `summarizeLedgerPeriod`, `listEndedWithRemaining`, `loadOutcomeNotify`, `listDebtParticipations` still have no test; the dead `listDueBookings` chain is still there. |
| 6 | Person stats in per-player mode | **Open** | — | Unassigned money counts for nobody on the person page; tied to SPEC-15 slice 5. |
| 7 | Stranded PENDING | **Closed** | `f8bb1d6` | Public request takes the pitch lock; a taken hour becomes a slot interest and `booking.slot_taken`. |
| 8 | Adjust status guard; fee cap | **Partly closed** | `259fb64` | PENDING/REJECTED refused. A cancel or no-show fee above the current due is still accepted (open). |
| 9 | Ledger hardening (`paymentId`, block UPDATE/DELETE) | **Deferred** | — | Needs a migration and a DR decision on DB-level append-only; nothing writes to these tables outside the use cases today. |
| 10 | WHOLE requester due drift; exactly-one-requester | **Deferred** | — | Latent: nothing reads the participant due in WHOLE mode. |
| 11 | PaymentAllocation isolation depth | **Open** | — | Probe showed cross-tenant slot pay refused; no repo test yet for collapse `deleteMany` or the raw readers. |
| 12 | `splitEvenly` property test | **Open** | — | Code is correct (600,120-case probe); the repo test is still four examples. `planSlotCharge` has a sweep test. |
| 13 | Low items | **Mostly open** | `f8bb1d6` | Public requests no longer add a duplicate interest for the same window (approve still can). `parseUsd` error type, no-show waiver reason, "They played" permission, staff money visibility: open. |
| — | Deadlock: dismiss missed vs "They played" (found while fixing #1) | **Closed** | `24fcf50` | Pending rows locked in id order on both paths; ten-run race test. |

### Update — hardening round 2 (2026-09-30)

| # | Item | Status | Commit | Note |
|---|---|---|---|---|
| 5 | Untested money paths; dead `listDueBookings` chain | **Closed** | `66adab1`, `f0e7cff` | Integration tests for `recordExpense`, ledger period totals (both DST days), `listEndedWithRemaining`, `loadOutcomeNotify` / `findBookingFeeState`, `listDebtWarnings` / `listDebtParticipations`; no bug found. Dead chain deleted; `sumCollectedUsdBySourceIds` kept (used by recent expenses). |
| 8 | Adjust status guard; fee cap | **Closed** | `259fb64`, `48a3ce8` | A typed cancel or no-show fee above the current due is refused (`booking.fee_above_due`). |
| 12 | `splitEvenly` property test | **Closed** | `66adab1` | 120,150 splits over n = 1…30 in the unit suite. |
| 13 | No-show logged as `CANCELLATION_NO_FEE` | **Closed** | `48a3ce8` | A clamped no-show now logs `WAIVER` (owner lowered a non-zero suggestion) or `NO_SHOW_FEE`. Rows written before are not changed: they are `CANCELLATION_NO_FEE` rows on NO_SHOW bookings and cannot all be relabeled without the suggestion at that time (query in progress.md). |
| — | Public and Book pages before 06:00 | **Closed** | `3197dcd` | Default day is the business date, so the rest of last night's window is reachable; started slots are never offered. |
