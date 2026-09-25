# SPEC-16: Due Adjustments — Cancellation Fees, No-Show Fees, Waivers

**Type:** Build spec + UX decisions
**Depends on:** SPEC-14 (no-show), SPEC-15 (per-player foundation: `Booking.amountDueUsd`), UX-01 §6, UX-02.
**Governing rules:** RULE-9 (never blocked from taking money), RULE-10 (the system may warn, never obstruct), RULE-12 (faster than paper).

---

## 1. The idea

What is owed on a booking is not always the price. Late-cancellation fees, no-show fees, discounts, waivers and half-played games are **one concept: the amount due changes, for a reason.**

`Booking.amountDueUsd` (SPEC-15) already means "what is collectible on this booking." This spec adds:
1. One use case that changes it, always with a reason, always logged.
2. A tenant policy that **suggests** fees. The owner decides.
3. Cancelled bookings can carry a fee: **the slot is freed, the debt stays.**
4. Reputation: a request from someone who owes money shows the debt to the owner.

---

## 2. Scenario (the reference case)

Policy: cancellation less than 24h before → 50% fee.

1. **Monday:** Ahmad books Friday 9:00 PM, $30. Confirmed.
2. **Friday 6:00 PM:** Ahmad cancels by WhatsApp, 3 hours before.
3. **Owner → booking → Cancel → "Player cancelled".** The sheet shows:
   ```
   Cancelled 3 hours before the game
   Policy: late cancellation → 50%
   Fee: $15      [Edit]  [Waive]
   [ Confirm cancel ]
   ```
   **Decision 1:** accept (one tap), edit ($10, a regular), or waive (special case). Logged: "$30 → $15 · late cancellation · Mahmoud".
4. **Immediately:** the slot is free; interested people can be notified; Sami books it.
5. **That night:** Ahmad appears in To collect and on his person page: owes $15 (amber).
6. **Two weeks later:** Ahmad requests Thursday 8:00 PM. The request card shows `⚠ Owes $15 · late cancellation, Fri 25 Sep`.
   **Decision 2:** approve anyway, or ask him to pay first.
7. Ahmad pays $15 when he comes. A normal payment; the debt clears.

---

## 3. Data

### 3.1 `BookingDueChange` (new, append-only)

| Column | Notes |
|---|---|
| `id`, `tenantId` | standard |
| `bookingId` | FK → Booking, RESTRICT |
| `fromUsd`, `toUsd` | `DECIMAL(12,2)`, both ≥ 0 |
| `reason` | enum: `LATE_CANCELLATION_FEE`, `NO_SHOW_FEE`, `CANCELLATION_NO_FEE`, `PARTIAL_GAME`, `DISCOUNT`, `WAIVER`, `CORRECTION` |
| `note` | text, nullable |
| `actorMembershipId` | FK → Membership, RESTRICT, NOT NULL |
| `createdAt` | timestamptz |

Index: `("tenantId", "bookingId")`.

- Never updated or deleted.
- `Booking.amountDueUsd` stays the denormalized current value, written in the **same transaction** as the log row.
- The UX-02 booking timeline (slice 5) reads this table.

### 3.2 Tenant policy (settings jsonb, Zod-validated)

| Setting | Default |
|---|---|
| `cancellationWindowHours` | 24 (if it already exists, reuse it) |
| `lateCancellationFeePercent` | 0 (no fee until the owner turns it on) |
| `noShowFeePercent` | 100 (matches SPEC-14 behavior today) |

Allowed values in the UI: 0, 50, 100 (stored as an integer 0–100).

### 3.3 Existing cancelled bookings (one-time backfill)

Today, cancelled bookings keep `amountDueUsd = priceUsd` and are ignored because cancelled = "none". Once cancelled bookings can be owed (§4), those rows would suddenly show debts.

Backfill in the migration: for every `CANCELLED` booking, `amountDueUsd = LEAST(priceUsd, collected)`, so remaining is 0. No log rows for the backfill (it is a data correction, recorded in the migration comment).

### 3.4 Ledger
Unchanged. The ledger records cash only. A paid fee is a normal payment (ledger IN). A waiver or discount writes nothing, because no money moved.

---

## 4. Rules (pure domain functions)

### 4.1 `classifyDue` (update)
| Status | Condition | Result |
|---|---|---|
| APPROVED | ended, remaining > 0 | owed |
| APPROVED | not ended, remaining > 0 | expected |
| NO_SHOW | remaining > 0 | owed |
| **CANCELLED** | **remaining > 0** | **owed** (a fee) |
| any | otherwise | none |

Every consumer (day summary, person stats, To collect, later who-owes) already goes through `classifyDue`, so fees appear everywhere automatically.

### 4.2 `suggestFee(policy, booking, now, initiator)`
- `initiator = OWNER` (rain, maintenance, his own reason) → 0, reason `CANCELLATION_NO_FEE`.
- `initiator = PLAYER`, cancelled at or after `start − window` → `price × lateCancellationFeePercent`, reason `LATE_CANCELLATION_FEE` (or `CANCELLATION_NO_FEE` when the percent is 0).
- `initiator = PLAYER`, before the window → 0, reason `CANCELLATION_NO_FEE`.
- No-show → `price × noShowFeePercent`, reason `NO_SHOW_FEE`.
- Exact cents (Decimal), rounded half-up.

### 4.3 `adjustDue` guards
- `toUsd ≥ 0`.
- `toUsd ≥ collected`. Lowering below what was already collected would mean owing the player money; refunds are out of scope. Message: "Already collected $X. Refunds are not supported yet."
- Only `collectionMode = WHOLE`. Per-player dues are edited per participant (SPEC-15 slice 4).
- No-op if `toUsd = fromUsd` (no log row).

### 4.4 Cancellation of ended games
Unchanged (existing BR-49 guard): an ended unpaid game cannot be cancelled. The owner uses No-show or Adjust amount instead.

---

## 5. UX

### 5.1 Cancel sheet
1. Who cancelled: **Player cancelled** / **I cancelled** (rain, maintenance, other).
2. Fee line with the suggestion, `[Edit]` and `[Waive]`. Hidden entirely when the suggestion is 0 and the owner cancelled.
3. Confirm. One use case: cancel + due change + log, one transaction.

### 5.2 No-show sheet
Same fee line, suggestion = `noShowFeePercent` (default 100%, identical to today's behavior). Waive sets it to 0.

### 5.3 "Adjust amount" (booking sheet)
Available on owed or expected bookings in WHOLE mode. New amount + reason chips: Discount / Partial game / Waive / Correction, optional note.

### 5.4 Request card warning
When the requester owes money (sum of owed via `classifyDue` + `personOwedOnBooking`):
```
⚠ Owes $15 · late cancellation, Fri 25 Sep
```
Shows the total and the most recent owed reason/date. Tap → person page. Approve and Reject stay available (warn, never block).

### 5.5 Public page
When `lateCancellationFeePercent > 0`, show one line near the request button:
"Cancelling less than 24 hours before the game costs 50% of the price."
Generated from settings, Arabic and English.

### 5.6 WhatsApp
Cancellation message includes the fee when > 0: "Your booking for Friday 9:00 PM is cancelled. Cancellation fee: $15."

### 5.7 Settings (More → Booking rules)
Cancellation window (hours), late-cancellation fee (0 / 50 / 100%), no-show fee (0 / 50 / 100%). Explicit Save (business rules).

---

## 6. Permissions
- New permission `bookings.adjust_due` (OWNER by default; STAFF not).
- Staff with `bookings.cancel` / `bookings.no_show` can accept the suggested fee but cannot Edit or Waive.
- Booking rules settings: `settings.manage`.

---

## 7. Slices (one per prompt)

1. **Data + rules, no visible change beyond fees being possible:** migration (§3.1, §3.3), settings schema (§3.2), `classifyDue` update, `suggestFee`, `adjustDue` use case with guards and log, cancel/no-show use cases accept `{ initiator, feeUsd }` and write the due change. Jest.
2. **UI:** cancel sheet (§5.1), no-show sheet (§5.2), Adjust amount (§5.3), Booking rules settings (§5.7).
3. **Reputation + communication:** request card warning (§5.4), public policy line (§5.5), WhatsApp fee text (§5.6).

## 8. Out of scope
Refunds, deposits (عربون), automatic fees without owner confirmation, per-player fees, invoice-style charge lines (lights, ball rental).