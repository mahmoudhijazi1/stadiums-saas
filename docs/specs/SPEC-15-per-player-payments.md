# SPEC: Per-Player Payments (BR-41 to BR-49)

**Type:** Build spec + UX decisions. Number it in sequence with the existing SPEC files.
**Depends on:** DR-002 (data model), SPEC-03, SPEC-06, SPEC-14, UX-01 §6.1, UX-02.
**Governing rule:** RULE-12. Collecting from ten players must be faster than paper.

---

## 1. The key idea: a name is only needed when someone owes money

After a game, ten players hand the owner cash. A player who pays on the spot never needs to be identified. **Only unpaid players need a name**, because they are the ones the owner chases later.

So collection works with **player slots**, not people:
1. The owner enters a **count** (default from the pitch, e.g. 10).
2. The app creates that many slots ("Player 1" … "Player 10") and splits the booking's price evenly.
3. Each player who pays = **one tap** on his slot.
4. When done, **only unpaid slots are asked for a name** (phone optional). The debt now belongs to a person.
5. Later slice: **"Same as last time"** copies the named players from this booker's previous game.

---

## 2. Model

### 2.1 What exists (from the audit)
- `BookingParticipant`: `personId NOT NULL`, `amountDueUsd`, `paidAt` (never written), `isRequester`. No team. Only index: `tenantId`.
- `Person.phone NOT NULL`, unique `(tenantId, phone)` (not partial).
- `Payment` is linked to the booking by `sourceType + sourceId`, with tenders and one ledger IN per payment.
- Every money figure today uses `Booking.priceUsd − sum(tenders)`. Nothing reads participant amounts.

### 2.2 Changes

**Booking**
- `collectionMode` enum `WHOLE | PER_PLAYER`, default `WHOLE`.
- `amountDueUsd DECIMAL(12,2) NOT NULL`, backfilled to `priceUsd`.
  - `WHOLE`: equals `priceUsd`.
  - `PER_PLAYER`: equals the sum of participant dues.
  - Maintained **in the same transaction** as any change to mode, participants, or dues.
  - **Why a denormalized column:** every existing remaining/owed query replaces `priceUsd` with `amountDueUsd` in one spot and stays a single-table read. Same reasoning as `avg_cost` on variants.

**Why the due total, not the price, in split mode:** if the owner lets the goalkeeper play free, dues sum to $27 on a $30 game. He decided to forgive $3, so what is owed is $27. The price stays what was agreed (DR-002 §2.11: independent; a mismatch is a warning, never a block).

**BookingParticipant**
- `personId` becomes **nullable**. An unnamed paid slot never creates a Person.
- `slotNumber INT` nullable (display order for "Player N").
- **Drop `paidAt`.** It is never written, and paid state is derived from allocations. Two sources of truth for "paid" would drift.
- Partial unique index: one `isRequester = true` row per booking (existing queries `INNER JOIN` on it and would duplicate rows otherwise).
- Index `("tenantId", "personId")` (person history, UX-02 D10).
- `team` stays out (BR-44 has no money value; add when there is a UI for it).

**Person**
- `phone` becomes **nullable**. Unique index becomes partial: `(tenantId, phone) WHERE phone IS NOT NULL`.
- Trade-off: a name-only person cannot be matched when someone later claims an account. Accepted for speed (RULE-12). If a phone is entered, the existing person is matched as today.
- Duplicate protection: when naming a slot, the name field autocompletes from existing persons (same search as the header search), so "Abu Ali" is picked, not re-created.

**PaymentAllocation (new)**

| Column | Notes |
|---|---|
| `id`, `tenantId` | standard |
| `paymentId` | FK → Payment, RESTRICT |
| `participantId` | FK → BookingParticipant, RESTRICT |
| `amountUsd DECIMAL(12,2)` | > 0 |

- One payment (one collection act, possibly mixed currency) can cover several players: "Ahmad pays for himself, Sami and Ali" = 1 payment + 3 allocations.
- `WHOLE` mode has **no allocations**. Everything already built keeps working.
- Payments, tenders and the ledger are **unchanged**. Money reports stay correct.
- Respects DR-002 §2.14 (no participant FK on `Payment`): the link lives in its own table.

### 2.3 Derived figures (pure domain functions)

| Function | Definition |
|---|---|
| `splitEvenly(amountCents, n)` | Exact cents; remainder cents go to the first slots. `$30 / 7` → 4 × $4.29 + 3 × $4.28 = $30.00 |
| booking remaining | `amountDueUsd − sum(all tenders)` (replaces `priceUsd − collected`) |
| participant paid | `sum(allocations)` |
| participant remaining | `participant.amountDueUsd − participant paid` |
| unassigned | `sum(all tenders) − sum(all allocations)` on the booking |
| person owed on a booking | `WHOLE`: booking remaining, on the requester. `PER_PLAYER`: that participant's remaining |

"Person owed on a booking" is the single rule used by the person page, who-owes, and person stats (UX-02 §4). Build it once.

---

## 3. UX

### 3.1 Switching to per-player
In the collect sheet (UX-01 §6.1 mode switch): **Whole game | Per player**.
- Choosing Per player asks for a count (default: the pitch's player count, a new pitch setting defaulting to 10).
- Creates slots: the requester is slot 1 (named), the rest are "Player 2…N" (unnamed), with dues from `splitEvenly`.
- If payments already exist in whole-game mode, they appear as **"Unassigned $X"**. They still reduce the booking's remaining, but no single player's.
- Switching back to Whole game is allowed only while there are no allocations (otherwise the owner would silently lose who paid what).

### 3.2 Collecting per player
```
Due $30 · Collected $12 · Remaining $18
Unassigned $0

 ✓ 1 Ahmad        $3.00  Paid
 ✓ 2 Player 2     $3.00  Paid
   3 Player 3     $3.00  [Pay]
   ...
[ Booker pays all remaining ]
```
- **Tap [Pay]** = that player paid his remaining in USD cash. One tap.
- **Long-press / select mode** → select several → "Pay together": one payment, one allocation per selected player.
- **Mixed currency** for a player or a group: the same tender input as whole-game collect. Remaining updates live.
- **Partial amount across a group:** allocated to the selected players in slot order; the last one may be partial.
- **"Booker pays all remaining":** one payment allocated across all unpaid slots.

### 3.3 Naming unpaid players
When closing the sheet with unpaid unnamed slots: "3 players haven't paid. Who are they?"
- Name with autocomplete from existing persons; phone optional.
- The owner can skip (RULE-10: warn, never block). The debt then stays on the booking: "2 unnamed players owe $6".

### 3.4 Editing dues
Tap a slot's amount to edit it. After any manual edit, dues stop auto-recalculating; if the sum ≠ price, show the BR-47 warning. Adding or removing a slot recalculates only while no due has been edited manually.

### 3.5 Where the split shows elsewhere
- Card and day summary: unchanged shape, now reading `amountDueUsd`.
- Booking sheet: "8 of 10 paid".
- Person page / who-owes: per-person owed via the rule in §2.3.

---

## 4. Open decisions

| # | Question | Default |
|---|---|---|
| P1 | Round even splits to cash-friendly amounts ($4.29 → $4.50)? | No. Exact cents; owner edits. |
| P2 | Player count default: pitch setting or pitch type? | Pitch setting, default 10 |
| P3 | Overpayment on a group (paid more than selected remaining)? | Allocate up to remaining; the excess stays Unassigned. No block. |
| P4 | Can a whole-game remainder be assigned to the booker as his personal debt? | Yes; this is the WHOLE-mode rule in §2.3 |
| P5 | Maximum slots | 30 |

---

## 5. Slices (one per prompt)

1. **Foundation, no visible change.** Migration (§2.2), `Booking.amountDueUsd` backfill, domain functions (§2.3) with tests, and every remaining/owed computation switched from `priceUsd` to `amountDueUsd`. Proof: all existing screens show identical numbers.
2. **Per-player mode + slots + one-tap USD pay + "Booker pays all remaining".**
3. **Pay together + mixed currency per player/group + partial allocation.**
4. **Naming unpaid slots (autocomplete, phone optional) + due editing + BR-47 warning.**
5. **Unassigned → assign to players + "Same as last time".**

UX-02 slice 2 (person page) should come **after slice 1**, so its stats use the §2.3 rule from the start.

## 6. Out of scope
Team A/B UI, refunds, players viewing their own dues (Phase 2 portal), WhatsApp reminders per player (after slice 4, reuse the notify list).