# DR-007 — Game prices in LBP or USD

**Status:** Accepted
**Date:** 2026-10-16
**Depends on:** DR-002 (data model; §2.14 payments, §2.17 exchange rate, §2.21 ledger), the shop's
LBP pricing (`src/modules/shop/domain/pricing.ts`, migration `20261010150000_shop_lbp_prices`),
`docs/domain/money.md`.
**Amends:** DR-002's rule that every booking amount is USD. Nothing else in DR-002 changes: the
ledger stays USD and stays append-only.

## Why this exists

Some stadiums price games in Lebanese pounds (for example 2,000,000 a game, or 200,000 a player)
and some in dollars. Today every game amount is stored in USD, so an LBP price has to be turned
into dollars when the booking is made. That has two problems:

- The dollar value is not a clean number (2,000,000 at 90,000 is 22.222222…, stored as 22.22), so
  splits, fees and extensions inherit the rounding error.
- Worse, the debt follows the exchange rate. The owner agreed 2,000,000 LBP; if the rate is
  changed in the app the next day, the stored dollars no longer match what the player owes.

What the code does today:

- Every booking money column is USD: `Booking.priceUsd` and `amountDueUsd`
  (`src/prisma/schema.prisma:108,111`), `BookingParticipant.amountDueUsd` (:141),
  `BookingDueChange.fromUsd` and `toUsd` (:220-221), `PaymentAllocation.amountUsd` (:338),
  `Payment.amountDueUsd` (:321).
- Pitch prices are USD strings, with exactly two decimals (`src/modules/venue/domain/schedule-config.ts:32,52-53`,
  a strict object, so a new key needs a schema change).
- A booking payment is turned into dollars at the current rate and the remaining is dollars minus
  dollars collected, with no clamp: an overpayment is recorded in full and the remaining goes
  negative (`src/modules/payment/domain/collect.ts:22-40,45`,
  `src/modules/booking/application/collect-booking-payment.ts:51-64`,
  `src/modules/payment/application/record-payment.ts:30-41`).
- Per-player collection is USD only (`src/modules/booking/application/collect-player-payment.ts:64-65`).
- The shop already keeps pounds owed in pounds: `applyPayment` settles each currency first and a
  rate change never changes the pounds owed (`src/modules/shop/domain/pricing.ts:186-247`), and
  `SaleAllocation` records the pounds and dollars each payment settled (`schema.prisma:505-519`).

## Decisions

1. **One setting per stadium: "game prices in USD or LBP"** (`Tenant.settings`, default USD,
   validated in `src/lib/tenant-settings.ts`). It affects **new bookings only**; an existing
   booking keeps its currency.
   *Why:* one switch is the cheapest thing for an owner to understand, and old games must not
   change under their feet.

2. **A game's debt lives in its price currency.** The booking stores `priceCurrency` and exactly
   one of a USD amount or an LBP amount, for its price and for its due, with a database CHECK
   (the same shape as `Product`, migration `20261010150000_shop_lbp_prices`). Per-player shares
   and due changes follow the same rule. TypeScript types make a reader handle both currencies;
   a reader that only knows dollars must not compile.
   *Why:* the debt is what was agreed. Storing it in the agreed currency is the only way a rate
   change cannot touch it.

3. **The ledger stays USD.** Every tender is converted at the stadium's own rate (the one the
   owner sets in the app, `ExchangeRate`, newest row) at the moment of payment, and that rate is
   frozen on the tender (`PaymentTender.rateAtTime`).
   *Why:* totals across days need one stable unit (DR-002 §2.21). Nothing about reports changes.

4. **A booking payment allocation table, like `SaleAllocation`,** records per payment how much LBP
   and how much USD it settled. LBP still owed = LBP due minus LBP applied. A rate change never
   changes what is owed in LBP.
   *Why:* it is the shop's proven way to keep pounds in pounds while the ledger stays in dollars.

5. **Payment in either currency, both ways,** at the stadium's current rate, by reusing the shop's
   settlement logic (`applyPayment`) instead of writing new money code.
   *Why:* one settlement rule for the whole product is easier to trust and to test.

6. **A game never records more than it is owed.** Money handed over beyond the due is change, in
   the currency it was handed over in, and the screen says how much to give back. A small,
   secondary option, "keep it", records the extra separately with its own label; it is never
   part of the game's price or due. Credit toward a next game is not planned (it does not
   happen in practice).
   *Why:* today an overpayment makes the remaining negative and the game looks "owed to the
   player", which is not true. Change is what happens at the counter.

7. **Rounding units: 5,000 LBP and 1 USD.** A per-player split uses whole units and hands the
   leftover units out one at a time to the first slots, the requester first, so the total is
   always exact. 2,000,000 LBP / 7 is six shares of 285,000 and one of 290,000; $40 / 7 is five
   of $6 and two of $5. Fee suggestions and extension prices round to the unit. Existing
   bookings are not changed.
   *Why:* nobody hands over 285,714 pounds. Whole units keep the total exact without a
   leftover. (The USD split already gives the first slots the extra cent,
   `src/modules/booking/domain/split-evenly.ts:13-22`, and slot 1 is the requester,
   `build-slots.ts:28-33`; the new rule keeps that order with a bigger unit.)

8. **"Consider it paid".** When what is left is under 5,000 LBP (or that amount in USD at the
   current rate, on a USD game), one tap marks it paid by writing a due change with a new reason,
   `ROUNDING`. Never automatic; the owner decides.
   *Why:* a few thousand pounds should not keep a game "owed" forever, but forgiving money is the
   owner's call (RULE-9/10: warn, never decide for the owner). The due-change log keeps the proof.

9. **Collecting in the other currency shows the exact equivalent and, next to it, the amount
   rounded UP to the next 5,000 LBP** ("$6 = 537,000 LBP, about 540,000"). It is for display
   only; what is recorded is never the rounded figure.
   *Why:* the owner can say a round number out loud and still see the exact one. It rounds up so
   the owner never loses by quoting it; a player who wants to round down uses "Consider it paid"
   (decision 8).

10. **Pitch prices.** `scheduleConfig` keeps its USD prices and gains LBP prices (whole pounds,
    multiples of 5,000). The stadium setting decides which set is used. Switching the setting
    asks the owner to enter the other set; the old set is kept, unused.
    *Why:* a switch must not silently price games at 0, and switching back should not lose work.

11. **Every screen that shows what is owed shows it per currency** ("$56 + 4,000,000 LBP"),
    because a stadium that switches will have old USD games next to new LBP games. The Money page
    shows both currencies and defaults to the stadium's pricing currency.
    *Why:* adding dollars to pounds would need a rate and would move with it, which is the bug
    this record removes. The owed totals stay as truthful as the debts.

12. **The shop does not change.** Existing data stays USD. The migration is additive (new columns
    and a new table; nothing dropped or rewritten).
    *Why:* the shop works; this record borrows from it and must not risk it.

13. **UX rule for every slice.** The common case takes no extra step; the currency is chosen once,
    in the settings; no screen asks "which currency" for a game (RULE-12).

14. **Due changes and the payment's due snapshot follow decision 2.** `BookingDueChange` stores
    its currency and its from and to amounts in that currency (exactly one pair, enforced by a
    CHECK). `Payment` stores the currency of its due snapshot and the amount in that currency
    (exactly one, enforced by a CHECK). Expense payments stay USD. `test/integration/invariants.ts`
    compares dues per currency (slice 3).
    *Why:* a due change or a snapshot in dollars next to an LBP debt would put the rate back into
    the debt, which is the bug decision 2 removes. Expenses have no game price, so they gain
    nothing from a second currency.

15. **"Keep it" (slice 10) is recorded under its own ledger source type,** so the rule "booking
    ledger IN equals booking tenders" stays true. `paymentTenders`' `keepChange` mode is not used
    for games.
    *Why:* the kept extra is not part of the game, so it must not be counted with the game's
    money; a separate source type keeps the existing invariant and the game's totals exact.

16. **The `ROUNDING` value added to `BookingDueReason` is permanent.** Postgres cannot drop an
    enum value, so once the slice 3 migration adds it, it stays.
    *Why:* recorded now so nobody plans on undoing it later.

## Consequences to plan for

- `Payment.amountDueUsd` and `BookingDueChange.fromUsd/toUsd` are USD columns and cannot carry an
  LBP due as they are. Slice 3 decides the shape; the CHECK pattern of decision 2 applies
  (slice 3 done: migration `20261016090000_game_price_currency`)
  (settled by decision 14).
- The "keep it" record must not break the money invariant that booking ledger IN equals booking
  tender sums (`test/integration/invariants.ts:21-31`). It needs its own label or source type,
  not a second tender on the game's payment. The same file's due check
  (`invariants.ts:33-47`, latest `toUsd` equals `amountDueUsd`) must learn both currencies
  (settled by decisions 14 and 15).
- `paymentTenders` has a `keepChange` mode that folds the excess into the tender
  (`pricing.ts:249-285`). Decision 6 does not use it for games; the excess is change or a
  separate "keep it" record (settled by decision 15).
- `BookingDueReason` (schema:198-212) and `DueChangeReason` (`suggest-fee.ts:6-15`) both gain
  `ROUNDING`. A Postgres enum value cannot be dropped later (settled by decision 16).
- `settleState` clamps at zero (`pricing.ts:139-141`); a game never goes negative either, which
  matches decision 6.

## Slices, in order (each reviewed before commit)

0. This record.
1. An overpayment becomes change on USD games.
2. Pure helpers (units, split, rounding, the friendly amount) with tests.
3. The migration and currency-aware types. **Done** (migrations `20261016090000_game_price_currency`
   and `20261016090100_rounding_due_reason`; progress.md, 2026-10-16). **3b done:** every raw SQL
   reader of game money names its currency and refuses an LBP game (progress.md, 2026-10-16).
4. The setting and LBP pitch prices.
5. Creating bookings in LBP (owner, public request, weekly series).
6. Collecting a whole game in LBP, and "Consider it paid".
7. Per-player in LBP.
8. Fees, extensions and adjust-due in LBP.
9. Every reader: Today, Owed, the person page, debt warnings, the booking sheet, WhatsApp texts,
   the Money page.
10. "Keep it".

## Not decided here

Whether the collect screen blocks an overpayment today is not traced (UNVERIFIED); slice 1 checks
and fixes it. The exact column names and types of slice 3 are decided in that slice, within
decisions 2 to 4.
