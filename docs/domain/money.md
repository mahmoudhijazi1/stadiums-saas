# Money

**Living.** Written 2026-10-01 from the code on `main` at `f3c3f93`. Every claim cites a file and function. **UNVERIFIED** marks a claim not traced to code. The per-player user guide is [../per-player-payments.md](../per-player-payments.md), the tables are in [../DATA-MODEL.md](../DATA-MODEL.md), and the locks are in [../ARCHITECTURE.md](../ARCHITECTURE.md) §6. Background decisions: DR-002 §2.14–2.21, SPEC-06, SPEC-15, SPEC-16.

---

## 1. The model in one page

| Concept | Where it lives | Why it is this way |
|---|---|---|
| **USD is the unit of account** | Every `*Usd` column, `LedgerEntry.amountUsd`, all totals (`ledger/application/summarize-ledger-period.ts`) | The Lebanese pound floats. Totals across days only make sense in one stable unit. |
| **Tenders** | `PaymentTender` (USD or LBP, `amount` in that currency) | The owner takes mixed cash. What was physically taken is kept, not only its USD value. |
| **Frozen rate** | `PaymentTender.rateAtTime`, set once by `payment/domain/collect.ts` `freezeTenders` | Changing today's rate must never change yesterday's totals. USD tenders store the current rate when one exists, for reference; LBP requires one (`usdEquivalent` → `payment.rate_required`). |
| **usdEquivalent** | `collect.ts` `usdEquivalent`: USD → `amount` rounded to 2 dp; LBP → `amount / rate`, rounded half-up to 2 dp | The only USD value money logic reads. Summing `usdEquivalent` is how "collected" is computed (`payments.ts` `sumCollectedUsd`). |
| **Payment** | `Payment` + its tenders, written by `payment/application/record-payment.ts` `recordPayment` | One collection event. Polymorphic source (BOOKING / EXPENSE / SALE) so Payment never imports Booking (DR-002 §2.14). |
| **Shop sale** | `shop/application/record-walk-in-sale.ts` `recordWalkInSale`: Sale + SaleItems + a SALE payment (direction IN) + tenders + one ledger IN, one transaction | The price is read from the database inside the transaction and frozen on each line; the client sends only item ids and quantities. A walk-in sale must be settled in full (`shop.sale_not_fully_paid`); paying more is accepted but the excess is **not recorded**: it is change (see "Change at the counter" below). Items can also be put on a game (mini shop slice 2): always on a **player's tab**, a Sale with a payer ("On the game (booker)" is the tab of the booking's requester). A tab is collected through SALE payments (any positive part, no cap; cash beyond what is owed is change, not recorded). It is never part of the booking or slot due, so "Booker pays all remaining" does not cover it and cancel, no-show and the per-player split ignore it (the tab stays owed). Today's pill, the earlier-debts section, the Owed page and Money's "Owed to you" add the unpaid tabs of games that are owed, and Today and Money use the same rule so their totals match. A removal is a compensating negative line, allowed only while the tab has no payment. The Money tab shows shop **sales** and shop-**supplies** expenses (category `SHOP_SUPPLIES`) side by side, never a profit. |
| **Ledger** | `LedgerEntry`, written by `recordPayment` in the **same transaction** | The Money tab reads only the ledger (`ledger/infrastructure/entries.ts` `sumAmountUsdByDirection`). One IN or OUT row per payment. |
| **priceUsd** | `Booking.priceUsd`, set at request time from the pitch price rules | The price snapshot. It changes only when the game is extended (§4, "Extend"): it rises by the added price, so the next extension is still priced per minute from the agreed total. |
| **amountDueUsd** | `Booking.amountDueUsd` | What is collectible **now**. Starts equal to `priceUsd`; changed only through due changes (§4). Every collect and cap reads it, not `priceUsd`. |
| **Collected** | `sumCollectedUsd(tx, "BOOKING", id)` = Σ tender `usdEquivalent` over the booking's payments | Derived, never stored. |
| **Remaining** | `collect.ts` `bookingRemaining(amountDueUsd, collected)`, **not clamped** | Negative = overpaid. It stays visible rather than hidden (RULE-9/10: warn, never block). |
| **Unassigned** | `collect.ts` `unassignedUsd(collected, allocated)` | Money on a PER_PLAYER booking that no slot claims, usually paid before the split. Still counts as collected (F-1). |

---

## 2. Collecting (WHOLE mode)

`booking/application/collect-booking-payment.ts` `collectBookingPayment`, in one transaction:
1. `findBookingForUpdate` locks the booking row. **Why:** two taps of Collect must not both see "remaining > 0" (progress.md "Booking row lock on every money path").
2. `assertCanCollect(status)`: only APPROVED, NO_SHOW or CANCELLED (a fee).
3. PER_PLAYER is refused (`booking.collect_per_player`). Cash on a split booking goes through the slots.
4. `assertHasDue(remaining)`: something must still be due. This stops a double submit.
5. `freezeTenders(tenders, latestRate)` drops zero parts, rejects negatives, requires at least one part, and freezes the rate.
6. `recordPayment` writes the Payment (with `amountDueUsd` = the due at that moment), its tenders, and **one** ledger IN whose amount = Σ `usdEquivalent`.

**By design, the tenders are not capped at the remaining.** An owner may take more than is owed; remaining goes negative and shows as overpaid. **Why:** RULE-9/10, the owner is never blocked from taking money.

Input formats are checked at the edge, not in the domain:
- USD: exactly two decimals (`lib/money.ts` `parseUsd`).
- LBP: a whole number (`parseLbp`).

They are called from the Server Actions (`app/owner/(app)/today/actions.ts` `submitCollectPayment`).

While the owner types, the mixed USD + LBP forms (the collect sheet on Today, and the expense sheet) show a live total and what is left to complete. It comes from `payment/domain/tender-preview.ts` `previewTenders`, which uses the same parsing ("20" means "20.00"; LBP in whole pounds) and the same LBP rounding as `usdEquivalent`, so the figure shown is the figure recorded. "Complete with … LBP" fills `lbpCovering` = ceil(left × rate): the fewest pounds that freeze to at least what is left. The preview warns and never blocks: an overpay is shown, not refused (RULE-9/10). UI: `app/owner/tender-balance.tsx`.

## 3. Per-player (PER_PLAYER mode)

- **Split** (`switch-collection-mode.ts` `switchToPerPlayer`):
  - It is allowed only for an APPROVED, WHOLE booking with no allocations and `amountDueUsd` > 0 (`switch-mode.ts` `assertCanSwitchToPerPlayer`).
  - `buildSlots` → `split-evenly.ts` `splitEvenly(amountDueUsd, n)` divides the **full due** (not the remaining) into n slots, in cents: the total is exact, the spread is at most 1¢, and the extra cents go on the first slots. `test/modules/booking/domain/split-evenly.test.ts` checks this as a property.
  - Money already collected stays **Unassigned**.
- **Charge cap** (`slot-charge.ts` `planSlotCharge`):
  - Every slot tap and "pay all remaining" charges at most `amountDueUsd − collected`, Unassigned included.
  - Within that cap it fills unpaid slots in slot order, and the last one may be partial.
  - **Why:** money paid before the split must never be taken twice (audit §3.6).
- **Pay** (`collect-player-payment.ts` `payRemaining`):
  - It locks the booking, plans the charge, then `assertCanPaySlot` (PER_PLAYER, APPROVED, a positive charge).
  - One **USD** tender equal to the charge, then `recordPayment`, then `insertAllocations`: one allocation per slot and Σ allocations = the charge.
- **Back to WHOLE** (`switchToWhole`): only while there are no allocations (`assertCanSwitchToWhole`). **Why:** otherwise who paid what would be lost.
- **Cancel / no-show on a split booking:**
  - `bookings.ts` `collapseToWhole` **deletes the allocations** and the per-player rows and sets WHOLE, in the same transaction as the cancel.
  - Payments, tenders and ledger rows stay, so collected is unchanged; only the attribution is lost (SPEC-15 slice 2).
- **Who owes what** (`booking/domain/person-owed.ts`):
  - `personOwedOnBooking`: WHOLE → the requester owes the booking remaining, everyone else owes 0. PER_PLAYER → each slot's own remaining.
  - `personPaidOnBooking` follows the same split.
  - **Known gap F-1:** Unassigned credits nobody ([../audits/logic-findings.md](../audits/logic-findings.md#f-1-money-paid-before-a-split-credits-nobody-audit-punch-list-6)).

## 4. Due changes

Every change of `Booking.amountDueUsd` goes through `booking/application/write-due-change.ts` `writeDueIfChanged`: `assertAdjustDue` → `setBookingAmountDue` → `insertBookingDueChange`, in the caller's transaction and under the booking row lock.

| Path | Rule (code) |
|---|---|
| Adjust (`adjust-booking-due.ts` `adjustBookingDue`) | The status must be APPROVED, CANCELLED or NO_SHOW (`assertDueAdjustableStatus`). The new due must be ≥ 0 and ≥ collected (`assertAdjustDue`: `booking.due_negative`, `booking.due_below_collected`; going below collected would be a refund, which is out of scope). **WHOLE only** (`booking.due_whole_only`). |
| Cancel (`cancel-booking.ts`) / no-show (`record-no-show.ts`) | The fee comes from the tenant policy (`suggest-fee.ts`). It must be ≤ the due (`assertFeeWithinDue` → `booking.fee_above_due`). If it would be below collected, it is clamped up to collected, and the logged reason then follows `clampedReason`: `CANCELLATION_NO_FEE` for a cancel, `WAIVER` or `NO_SHOW_FEE` for a no-show. |
| Extend (`extend-booking.ts` `extendBooking`) | 30 minutes added to an APPROVED, whole-pay game that has not ended (repeatable, 180 minutes in total). The suggested added price is `priceUsd / current minutes x 30`, rounded half up to cents (`extension-plan.ts` `addedPriceForExtension`): $30 for 60 minutes adds $15; $10 for 90 minutes adds $3.33. `Booking.priceUsd` and `amountDueUsd` both rise by the added amount; the due goes through `writeDueIfChanged` with reason `EXTENSION`, so it is never below collected and what was collected is untouched. A member with `bookings.adjust_due` may send a different amount (0 to 100,000); anyone else gets the suggestion or `access.not_allowed`. Shop tabs, the ledger and the start time are not touched. |
| No-op | The same value (after rounding to cents) writes nothing (`assertAdjustDue` → `"noop"`). |

`fromUsd`/`toUsd` are recorded exactly, and `actorMembershipId` says who changed it.

---

### Shop items priced in LBP (mini shop)

USD stays the unit of account; **LBP is the price tag and the payment**.

- An item is priced in dollars or in pounds. Each sale line freezes its USD value when it is added (the shared tender conversion at the current rate; an LBP item cannot be sold while no rate is set). An LBP line also keeps its pounds and the rate.
- A sale or tab is therefore made of an **LBP part** (its LBP lines, whole pounds) and a **USD part**. What it owes is owed in those currencies: a rate change after an item was added never changes the pounds owed. A partial LBP payment leaves the rest in pounds (20,000 - 10,000 = 10,000), never a USD remainder with stray cents.
- `shop/domain/pricing.ts` `applyPayment` settles it: an LBP tender settles the LBP part first, a USD tender the USD part first, and any excess converts to the other part at the current rate (`SaleAllocation` stores what each payment settled).
- **Ledger rule.** The USD recorded (each tender's `usdEquivalent`, summed into the ledger IN) for pounds paid against LBP lines is those lines' **frozen USD value**, allocated in proportion to the pounds settled, and the payment that settles the last pound takes the exact remainder. So a fully paid sale or tab records exactly its frozen USD whatever the rate did in between, and the aggregate totals (Today, Owed, Money, the Shop card) are all in USD from the frozen values of what is outstanding. Dollars paid against dollar lines record themselves. LBP is never summed across time.
- Per-sale and per-tab amounts are displayed in their own currencies ("20,000 ل.ل", "60,000 ل.ل + $1.50"); aggregates are USD.

### Change at the counter (walk-in sales and tab collections)

When the cash handed over exceeds what is owed, the excess is **not** recorded: the last tender is reduced to what the sale or tab used and the rest is change for the customer, shown as "Change: X" / "الباقي للزبون: X" in the currency it was handed over in (pounds whole). So $10 for a $4.50 item records $4.50 with $5.50 change; 100,000 ل.ل for 60,000 ل.ل records 60,000 with 40,000 ل.ل change. Excess pounds first settle any dollar part at the current rate (and excess dollars any pound part); only what is beyond both parts is change. The sheets show the change live, computed by the same `applyPayment` the server runs. **Booking collection is unchanged**: it still accepts an overpay and records it in full (RULE-9/10, M8).

## 5. Invariants and where each is enforced

| # | Invariant | Code | Database | Nowhere / notes |
|---|---|---|---|---|
| M1 | Money is `Decimal`, never a JS float | `decimal.js` everywhere in `collect.ts`, `slot-charge.ts`, `split-evenly.ts`; `lib/money.ts` parsers | `DECIMAL(12,2)` / `(18,2)` / `(18,0)` columns | — |
| M2 | Every payment writes exactly one ledger row, in the same transaction, for Σ tender `usdEquivalent` | `record-payment.ts` `recordPayment` (the only writer of both) | — | **No FK** from ledger to payment (F-2). Checkable per source only by count and sum. |
| M3 | Ledger, payments, tenders, due changes and rates are never updated or deleted | No `update`/`delete` on them in `src/modules` | — | Convention only (F-2). The seed deletes them; dev only (`seed-guard.ts`). |
| M4 | A payment has ≥ 1 tender, each with `amount` > 0 | `freezeTenders`, `usdEquivalent` | — | No CHECK on `PaymentTender.amount`. |
| M5 | An LBP tender has a positive frozen rate | `usdEquivalent` → `payment.rate_required` | — | No CHECK (`rateAtTime` is nullable for USD). |
| M6 | A frozen rate never changes | Tenders are insert-only (`payments.ts` `insertPaymentWithTenders`) | — | Convention (M3). |
| M7 | `Booking.amountDueUsd` ≥ 0 | `assertAdjustDue` | CHECK `Booking_amountDueUsd_nonneg` | — |
| M8 | After any **due change**, due ≥ collected | `assertAdjustDue` (`due_below_collected`), `suggest-fee.ts` clamp | — | Not an invariant of the booking itself: a collect may overpay (§2). |
| M9 | A cancel or no-show fee ≤ the due | `assertFeeWithinDue` | — | — |
| M10 | Collect only on APPROVED / NO_SHOW / CANCELLED, and only while something is due | `assertCanCollect`, `assertHasDue` under the booking lock | — | — |
| M11 | No whole-game collect on a PER_PLAYER booking | `collectBookingPayment` → `booking.collect_per_player` | — | — |
| M12 | PER_PLAYER: Σ slot `amountDueUsd` = `Booking.amountDueUsd` | `splitEvenly` (exact); adjust is WHOLE-only; the split needs WHOLE with no allocations | — | Nothing re-checks it later. A future path that changes the due on a PER_PLAYER booking would break it silently. |
| M13 | A per-player charge ≤ the booking remaining (Unassigned included); Σ allocations of a payment = its total | `planSlotCharge`; `payRemaining` tenders = `charge.totalUsd` | CHECK `PaymentAllocation_amountUsd_positive`; unique `(paymentId, participantId)` | — |
| M14 | Allocations to a slot ≤ that slot's due | `planSlotCharge` (`Decimal.min(remaining, left)`) | — | — |
| M15 | Participant dues ≥ 0; one requester per booking, with a person | `splitEvenly` | CHECKs + partial unique (DATA-MODEL §3 #4, #7, #8) | — |
| M16 | WHOLE: the requester participant's `amountDueUsd` mirrors the booking due | Set on create and on `collapseToWhole` | — | **Not maintained** by `writeDueIfChanged`. Harmless because WHOLE reads the booking (`personOwedOnBooking`), but a reader of the participant column in WHOLE would be wrong (the booking audit addendum, "WHOLE requester due drift"). |
| M17 | No refunds: money only moves OUT as an expense | No refund use case (`adjust-due.ts` comment; `cancel-booking.ts` "No refund") | — | — |
| M18 | Each money row belongs to the booking's tenant | The Prisma extension stamps `tenantId` (Payment, PaymentTender, PaymentAllocation, LedgerEntry are scoped) | — | Raw SQL must stamp it itself (ARCHITECTURE §3). |

---

## 6. How to change money code safely

1. **Never write a Payment without `recordPayment`.** It is the only place that pairs the payment with its ledger row (M2). Always pass the caller's `tx`.
2. **Lock first.** Any path that reads "collected" or "due" and then writes money must hold the booking lock (`findBookingForUpdate`) and re-read after it.
3. **Change the due only through `writeDueIfChanged`.** It is the single place that keeps M7, M8 and the audit trail. If you allow a due change on PER_PLAYER, you must also rewrite the slot dues so that M12 holds, in the same transaction.
4. **Never recompute an old tender.** Rates are frozen (M6). Report totals from the ledger, not from tenders times today's rate.
5. **Round once, half-up, to cents** (`usdEquivalent`, `splitEvenly`). Never round a sum of already-rounded parts again.
6. **Test with real Decimals** and run `npm run test:integration` (the money-races, per-player, booking-money and fees suites). Add a reconciliation assertion (Σ ledger = Σ tenders per source; see `test/integration/invariants.ts`).
