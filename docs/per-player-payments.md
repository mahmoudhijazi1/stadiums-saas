# Per-player payments: how it works today

**Living doc.** It describes what the code does now (SPEC-15 slices 1–2). Update it in the same change whenever split, slot pay, cancel or no-show behavior changes. The design history stays in [SPEC-15](./specs/SPEC-15-per-player-payments.md), which is historical and is not rewritten. Where this page and the SPEC differ, **this page describes the code** and the difference is listed in section 9.

Last checked against the code: 2026-09-30 (slice 2 plus the cancel and no-show collapse).

---

## 1. The idea in one minute

A booking is normally collected **whole**: one person pays the full price.

Sometimes ten players each hand the owner a few dollars. Writing ten names down would be slower than paper, so the app uses **slots** instead of names:

1. The owner switches the booking to **Per player** and picks a count (default 10).
2. The app makes that many slots and splits the price evenly.
3. A player pays: one tap on his slot.
4. Nobody has to be named. Only players who *don't* pay ever need a name (slice 4, not built yet).

Slot 1 is always the person who booked (the requester). The other slots have no person until someone names them.

## 2. The words

| Word | Meaning |
|---|---|
| **Whole** (`WHOLE`) | One due on the booking, sitting on the requester. No slots. |
| **Per player** (`PER_PLAYER`) | The booking has slots. Each slot has its own due. |
| **Slot** | One player's share. A `BookingParticipant` row with a `slotNumber`. |
| **Due** | What is collectible: `Booking.amountDueUsd`. In per-player mode it equals the sum of the slot dues. |
| **Collected** | Everything paid on the booking, whole-game and slot payments together. |
| **Allocation** | "This part of that payment belongs to this slot." A `PaymentAllocation` row. |
| **Unassigned** | Collected minus allocated. Money that was paid before the split (or that no slot claims). |
| **Remaining (booking)** | Due minus collected. Can go negative when overpaid. |
| **Remaining (slot)** | The slot's due minus its allocations. |

## 3. Numbers

- **Exact cents, no rounding to friendly amounts.** $30 across 7 players is four slots of $4.29 and three of $4.28 (total exactly $30.00). The first slots get the extra cents. (P1)
- **Count: 1 to 30.** Default comes from the pitch setting "Players per game" (default 10). (P2, P5)
- **USD only in this slice.** A slot tap pays the slot's full remaining in USD cash. Mixed currency per player comes in slice 3.
- Money is always `Decimal`. The ledger is USD only.

## 4. What the owner can do (and what stops him)

### Switch Whole to Per player
Needs the `bookings.adjust_due` permission. Where: the booking sheet, money group, only **after the game has ended** and cash is still owed (unpaid or partly paid). Upcoming and live games do not show it. **This is intentional for now** (see gap 4).

Allowed only when **all** are true:
- status is APPROVED
- the booking is currently Whole and has no allocations
- the due is above $0
- count is between 1 and 30

| If not | Error key | Message (en) |
|---|---|---|
| CANCELLED or NO_SHOW | `booking.switch_fee_booking` | A cancelled or no-show fee can't be split among players. |
| any other status (e.g. PENDING) | `booking.switch_not_approved` | Only a confirmed booking can be split among players. |
| already per player | `booking.switch_not_whole` | This booking is already split among players. |
| due is $0 | `booking.switch_no_due` | Nothing is due to split. |
| count outside 1–30 | `booking.split_count` | Player count must be between 1 and 30. |

What happens, in one transaction:
- the requester row becomes slot 1 with its share
- slots 2..N are created with no person
- **the due does not change** (the shares add up to it exactly), so no due-change log row is written
- **payments already taken are not assigned to anyone.** They show as **Unassigned**. They still count as collected on the booking. Nothing is auto-allocated. (spec §3.1)

### Switch back to Whole
Needs `bookings.adjust_due`. Allowed only while there are **zero allocations** (otherwise we would lose who paid what): `booking.switch_has_allocations`. The unnamed slots are deleted and the requester carries the whole due again. Existing payments are unaffected.

The button is disabled once any slot has been paid.

### Pay one slot (one tap)
Needs `payments.collect`. Pays that slot's remaining, in USD.

- One payment, one USD tender, one ledger IN, one allocation. All in one transaction.
- The booking row is **locked** and the slot remaining is **recomputed after the lock**. Two taps on the same slot at once pay it once; the second gets `payment.nothing_due`.
- Works on APPROVED bookings only (`payment.collect_unapproved` otherwise). Cancel and no-show collapse a per-player booking to Whole first, so a per-player booking is never in another status.
- **Only the slot's own remaining is checked, not the booking's.** If the booking is already overpaid (for example a fully paid whole game that was then split), a slot can still take cash. Warn, never block the owner from taking money (RULE-9). The extra shows as a negative booking remaining and the slot is still credited.
- There is no undo and no refund in this slice. A mistaken tap stays.

### Booker pays all remaining
Needs `payments.collect`. One payment covering every unpaid slot, with one allocation per slot. The button shows the total. If nothing is unpaid: `payment.nothing_due`.

### Whole-game collect on a per-player booking
Refused: `booking.collect_per_player` ("This booking is split per player. Record payment per player."). The whole-game forms are hidden in the sheet. This stops a payment from landing with no slot.

### Adjust due on a per-player booking
Refused (`booking.due_whole_only`). Editing per-slot dues is slice 4.

## 5. Cancel and no-show on a per-player booking

Both collapse the booking to Whole, the same way. This is the part most likely to surprise, so it is spelled out.

When an owner or player cancel, or a no-show, is confirmed on a per-player booking, inside the **same transaction** as the status change, the due change and the ledger:

1. The booking row is locked (`FOR UPDATE`, like slot pay), so a tap in flight finishes first.
2. The booking's allocations are deleted, along with the unnamed slots.
3. The requester row carries the due again and the booking goes back to Whole.
4. The normal fee logic runs unchanged on the booking's total collected: the suggested fee, the owner's edit, or a waive.
5. The booking becomes CANCELLED or NO_SHOW.

**How reachable each path is in the UI today.** Splitting is only offered after the game ended, so:
- **No-show:** fully reachable. It is offered on any ended APPROVED game, paid or not, so this is where collapse runs in practice.
- **Cancel:** **not reachable in the UI for a per-player booking.** Cancel is offered only before the game starts (`isCancelWindowClosed`, error `booking.cancel_started`), and a booking can only be split after the game has ended, so no per-player booking can ever be cancelled from the sheet. (Before 2026-09-30 a fully paid ended game could still be cancelled; that path is gone.) The integration tests split future games by calling the use case directly, which the sheet cannot do, so they still exercise the cancel collapse.
- **The cancel collapse is kept anyway, as currently unreachable code.** It is a few lines that share `collapseToWhole` with no-show, it is covered by integration tests, and it is needed the moment splitting before the game starts is allowed: without it, cancelling a per-player booking would leave a CANCELLED booking that is still per player, with stale slots and allocations.

Things to know:
- **Payments, tenders and ledger rows are not touched.** Money and reports stay correct. Everything collected (slot payments and Unassigned alike) counts as collected on the booking.
- **Who paid what is lost** on that booking. The attribution lives in the allocations, and they are removed. This is the accepted trade-off.
- These are the **only** paths allowed to remove allocations. "Switch back to Whole" still refuses when allocations exist.
- It happens even when nothing was paid (the booking is just returned to Whole first).
- After the collapse the fee is collected with the normal whole-game collect. Slots no longer exist on that booking.
- The existing fee clamp still applies: a fee below what was already collected is raised to what was collected (so a waived no-show with $3 collected ends with due $3).

Examples:
- **Cancel:** due $30, collected $16 ($10 whole-game before the split, then two slot taps of $3). Owner cancel suggests no fee, so the due drops to what was collected: due $16, remaining $0, CANCELLED, Whole, one participant, zero allocations.
- **No-show at the default 100% fee:** due stays $30, collected $3 from one slot. The booking becomes NO_SHOW and Whole; the owner collects the remaining $27 as a whole-game payment.
- **No-show with fee edited to $20** after $6 collected: due changes $30 to $20, remaining $14.

## 6. What the screen shows

In the booking sheet, money group:
- Due and Remaining as before.
- **Mode switch**: Whole game | Per player (needs adjust permission; only after the game has ended and cash is still owed).
- Whole: choosing Per player asks for a count, then Split.
- Per player: **"N of M paid"**, an **Unassigned $X** line when above zero, the slot list (number, "Player N", due, and **Pay** or a Paid check), and **Booker pays all remaining $X**.
- The per-player actions do **not** redirect, so the sheet stays open across taps.

Slot names: slot 1 shows the requester's name. Other slots show "Player N" until slice 4 lets the owner name them.

## 7. Where each rule lives (for whoever changes it)

| Rule | File |
|---|---|
| Split into slots, 1–30 | `src/modules/booking/domain/build-slots.ts` (uses `split-evenly.ts`) |
| May switch / may pay a slot | `src/modules/booking/domain/switch-mode.ts` |
| Switch use cases | `src/modules/booking/application/switch-collection-mode.ts` |
| Slot pay, pay-all | `src/modules/booking/application/collect-player-payment.ts` |
| Cancel and no-show (collapse) | `src/modules/booking/application/cancel-booking.ts`, `record-no-show.ts`, `collapseToWhole` in `infrastructure/bookings.ts` |
| Whole-collect guard | `src/modules/booking/application/collect-booking-payment.ts` |
| Due-change guard (`due_whole_only`) | `src/modules/booking/domain/adjust-due.ts`, `application/write-due-change.ts` |
| Allocation insert | `src/modules/payment/infrastructure/payments.ts` (`insertAllocations`) |
| Derived figures (remaining, unassigned, owed) | `src/modules/payment/domain/collect.ts`, `src/modules/booking/domain/person-owed.ts` |
| Pitch player count | `Pitch.defaultPlayerCount`, migration `20260929120000_pitch_default_player_count` |
| Sheet UI and actions | `src/app/owner/(app)/today/per-player-collect.tsx`, `actions.ts` |
| Error copy, Arabic and English | `src/lib/error-messages.ts`, `src/lib/ui-copy.ts` |

Module rule: Booking may import Payment. Payment never imports Booking, so `insertAllocations` only receives ids.

## 8. How it is tested

- Unit: `build-slots`, `switch-mode`, `split-evenly`, `person-owed`.
- Integration (`per-player.integration.test.ts`, real Postgres): the split and its refusals, rollback when a slot insert fails, one tap writes one payment/tender/ledger/allocation, the concurrent double tap, pay-all, Unassigned and overpaid, whole-collect refusal, switching back, allocation tenant scoping, cancel with payments, cancel with an edited fee, cancel with nothing paid, no-show at the default fee, no-show with an edited fee, no-show waived.
- **Not covered by any test:** the sheet itself (there is no browser or React test setup), the 401/refresh behavior, a cancel or no-show racing a slot tap (the row lock is in place but not exercised).

## 9. Gaps and differences from the SPEC

Ordered by how much they can hurt.

| # | What | Effect | Status |
|---|---|---|---|
| 1 | **Cancel and no-show delete allocations.** | Who paid what is lost on that booking. Money is intact. | Accepted (owner's decision). |
| 2 | **Unpaid unnamed slots owe nothing to any person.** | The debt shows only on the booking (To collect and the sheet), not on a person page or who-owes. Named slots and the requester do. | By design until slice 4. |
| 3 | **Overpaid booking styling.** A negative remaining is drawn with the "owed" style in the sheet's figures. | Cosmetic. The card treats it as paid. | Open, small. |
| 4 | **Cancel and no-show collapse even with zero payments**, and switching to per player is offered only after the game has ended with cash still owed (the sheet's `owesCash` check, the same rule that already hides the whole-game Collect button on upcoming and live games). **Splitting before the game ends is not possible yet.** This is an intentional scope boundary, not a bug. It may be reconsidered after slices 3–5 land. | None. | Deliberate. |
| 5 | **Not built yet:** pay together, mixed currency per player, naming unpaid slots, editing slot dues and the BR-47 warning, assigning Unassigned, "Same as last time". | Slices 3–5. | Planned. |

No open decisions. The earlier gaps (no-show with a different fee refused, cancel not locking the booking row, slot pay on NO_SHOW/CANCELLED) were closed on 2026-09-30.

## 10. Quick examples

**Ten players, $30, everyone pays on the spot.** Split 10, tap Pay ten times. Ten allocations of $3.00, remaining $0.

**Half paid, the booker covers the rest.** Five taps, then "Booker pays all remaining $15.00": one payment of $15.00 with five allocations.

**Owner took $30 from the booker, then decides to split.** Switch to per player: collected $30, allocated $0, Unassigned $30, booking remaining $0. Slots still show unpaid. Tapping Pay on a slot is allowed (the booking becomes overpaid by that amount, Unassigned stays $30). This is why the switch is only offered while cash is owed.

**They cancel or no-show after paying part.** See section 5: the booking collapses to Whole, the fee logic runs on what was collected, attribution is dropped.
