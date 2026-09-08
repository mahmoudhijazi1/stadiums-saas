# DR-002 — Core Data Model

**Status:** Settled (MVP core)
**Type:** Decision Record — what we decided, what we rejected, and why. This is a defense document.
**Depends on:** DR-001 (Tenancy & module map — module boundaries, transaction ownership, ledger-as-truth)
**Covers modules:** People, Venue, Booking, Payment, Ledger, Expense
**Not covered here (behavior, not schema):** auth strategy, domain-vs-Prisma types, backups

---

## 0. The one rule this model was built to pass

> Adding the Academy (Phase 3) and the Shop (Phase 2) must change **nothing** in the core tables.
> New modules hang off People, Venue, Payment, and Ledger — they add tables, they don't alter these.

Every choice below is in service of that, and of the overriding product constraint: **every owner-facing action must be faster than paper (G-1 / RULE-12).** Where completeness and speed-of-use conflicted, speed won.

---

## 1. The model on one page

```
PLATFORM
  tenants          id, slug, name, settings(jsonb: location, whatsappNumber,
                   cancellationHours, locale, timezone), created_at
  plans, subscriptions

ACCESS
  users            id, credential fields
  memberships      id, tenant_id, user_id, role(OWNER|STAFF), permissions(jsonb)

PEOPLE
  persons          id, tenant_id, name, phone, created_at
                   UNIQUE(tenant_id, phone)
  user_person_links  id, tenant_id, user_id, person_id, relation(SELF|GUARDIAN)
                     -- ships empty in MVP

VENUE
  pitches          id, tenant_id, name, schedule_config(jsonb), created_at
  pitch_blocks     id, tenant_id, pitch_id, during(tstzrange),
                   reason(MAINTENANCE|PRIVATE|ACADEMY)   -- academy's seam

BOOKING
  bookings         id, tenant_id, pitch_id, during(tstzrange),
                   status(PENDING|APPROVED|REJECTED|CANCELLED|NO_SHOW),
                   source(OWNER|PUBLIC), price_usd(Decimal 12,2), requested_at
                   EXCLUDE USING gist(pitch_id WITH =, during WITH &&)
                     WHERE status='APPROVED'
  booking_participants  id, tenant_id, booking_id, person_id, team(A|B|null),
                        amount_due_usd(Decimal 12,2), paid_at(null), is_requester
  slot_interests   id, tenant_id, pitch_id, during(tstzrange), person_id, created_at

PAYMENT
  payments         id, tenant_id, source_type, source_id, amount_due_usd   -- no FK
  payment_tenders  id, tenant_id, payment_id, currency(USD|LBP), amount,
                   rate_at_time, usd_equivalent(frozen)
  exchange_rates   id, tenant_id, lbp_per_usd, created_at   -- append-only

LEDGER
  ledger_entries   id, tenant_id, direction(IN|OUT), amount_usd(Decimal 12,2),
                   occurred_at, source_type, source_id, created_at
                   -- append-only, USD only

EXPENSE
  expenses         id, tenant_id, category(enum), description, occurred_at, created_at
                   -- no amount (the money is a Payment)
```

### Dependency arrows — all point down, never up

```
Booking ──asks──> Venue      "is this slot free?"
Booking ──asks──> Payment    "collect for these participants"
Booking ──asks──> People     "find-or-create by phone"
Expense ──asks──> Payment    "collect for this expense"
Payment ──writes─> Ledger    "money moved"   (via the use case, same transaction)
Expense ──writes─> Ledger    "money moved"
Academy(P3) ─────> People, Venue, Payment    "changes nothing above"
Shop(P2) ────────> Payment, Ledger
```

If an arrow ever needs to point up, the boundary is drawn wrong.

---

## 2. Decisions, with rejected alternatives

### PEOPLE

**2.1 `persons` is separate from `users`; the link is its own table.**
A person is a name + phone with no login (BRD 4.1). ~90% never register. The owner must type ten names after a game without ten signups.
- *Rejected:* `user_id` column on `persons`. A column can't express "zero, or one, or through-a-guardian." A table can. `persons` has no `user_id`.
- `user_person_links` **ships empty in MVP.** Present now because adding it later means backfilling every existing person — painful. Empty-but-present is cheap; retrofit is not.

**2.2 `UNIQUE(tenant_id, phone)`, not global unique.**
Phone is unique *per tenant* (RULE-8). Same human at two stadiums = two person rows. Stadiums never share customer lists — a marketplace would make us a competitor to our own customer (R-7).

**2.3 `persons` carries name + phone only in MVP.**
No note field, no extras. Every field is friction against G-1 (three-second entry after a game). Add later if a real owner needs it — additive.

### VENUE

**2.4 `schedule_config` is jsonb, not columns.**
Opening hours, slot length, gaps, day/time pricing (BR-3/4/5) are a *rule* whose shape varies. As columns, every new rule shape is a migration. As jsonb it's owner-editable data, read as a whole, never queried piece by piece.
- **Framework note:** Prisma types `Json` as `unknown`. Rule: **Zod-validate jsonb at the application edge**, every read and write. Prisma stores it; Zod guarantees its shape.

**2.5 No slots table. Slots are computed by a pure function.**
Storing empty slot rows = generating rows into the future forever and keeping them synced with rule changes. Pure waste on a droplet. Venue holds the rule; the availability engine generates the day's slots on demand.

**2.6 Location lives in `tenant.settings` jsonb, not on the pitch, not its own column.**
- *Rejected: on the pitch.* BR-1's multi-location case is rare; taxing 99% of owners (one site) to serve 1% is wrong. If a real multi-site owner appears, add optional `location` to `pitch` that falls back to the tenant's — additive.
- *Rejected: own column.* It's owner-authored display text (RULE-11), read as a whole with the rest of public-page config. Same reasoning as `schedule_config`.
- `tenant.settings` is where all per-stadium knobs live (cancellation window, WhatsApp number, locale, timezone, location) — each Zod-validated, so adding one is never a migration.

**2.7 `pitch_blocks` — the academy's seam into the schedule.**
BR-6: owner blocks time for maintenance/private/academy. An academy session (Phase 3, BR-89) writes a `pitch_block` with reason ACADEMY, and booking already treats it as unavailable. Academy plugs in here touching nothing.
- **Framework note:** `during` is `tstzrange` — a start+end stored as one value the database understands as a range. Times stored UTC, rendered Asia/Beirut (handles past-midnight games, BR-7).

### BOOKING

**2.8 The exclusion constraint IS the double-booking guarantee. This is the reason for Postgres.**
```
EXCLUDE USING gist (pitch_id WITH =, during WITH &&) WHERE (status = 'APPROVED')
```
The database physically refuses two APPROVED overlapping bookings on one pitch (RULE-1, BR-23). Two simultaneous approvals (BR-24): one wins, one gets a DB error, app code catches it and clears the loser. **The database prevents the collision; application code handles the fallout.**
- `WHERE status='APPROVED'` is why pending requests overlap freely (RULE-2, BR-25) — the constraint ignores anything not approved.
- **Framework note:** Prisma **cannot express this.** It's a hand-written raw-SQL migration. Expected, not a workaround (like dropping to raw `DB::statement` in a Laravel migration).

**2.9 The booking holds no person.**
A booking belongs to a *pitch and a time*. People attach through `booking_participants`.
- Why: the owner books by phone call (source OWNER) often *before* he knows who's playing. Participants are added later as they show up and pay. If person lived on the booking, an owner booking with nobody named yet couldn't exist.

**2.10 The requester is a participant flagged `is_requester`.**
A public request find-or-creates a person by phone, writes a PENDING booking, and writes one participant flagged `is_requester`.
- *Rejected:* a `requested_by` column on `bookings`. The requester is almost always a player anyway; a separate column stores the same person twice and they can drift. The flag says who to notify (BR-71) without duplication.

**2.11 `price_usd` and the sum of participant `amount_due_usd` are independent. Mismatch is a warning, never a constraint.**
8 of 10 show up; one person pays for all; the game still ran at its price (BR-47). Forcing them equal would block the owner (RULE-9/10). DB lets them differ; UI shows "collected $24 of $30."

**2.12 NO_SHOW is a status, not a boolean.**
BR-22 wants "didn't happen" recorded separately from cancelled. A no-show used up the slot and is business information — distinct status.

**2.13 `slot_interests` carries its own `pitch_id + during`, not a rejected-booking id.**
The self-populating waitlist. Approval auto-rejects losing requests (BR-20); each drops an interest row (BR-21). On cancellation the freed slot reads this table to show who wanted the window (BR-29), one tap to notify (BR-30). Describing the *window* (not the dead booking) means the interest outlives any single booking. Nobody maintains a waitlist by hand.

### PAYMENT

**2.14 Payment links to its source by `source_type + source_id`, no foreign key (polymorphic).**
- *Rejected: nullable FK columns + check constraint* (`booking_participant_id`, `expense_id`, `sale_id`, `academy_fee_id`, exactly-one-set). That puts a Booking column inside the Payment table, so adding the academy means migrating Payment — Payment changes for a booking reason, boundary gone. It's also a table where three of four FK columns are always null: the schema admitting it doesn't fit.
- Polymorphic keeps Payment **closed to booking-shaped changes**: a new source is a new enum value, not a column migration. Payment knows there's an amount attached to *something*; it never knows what.
- **Cost, stated honestly:** no FK means the DB won't stop an orphan payment. Accepted because writes are few, all inside transactions, all in `application/` code we control — versus a schema that leaks Booking into Payment permanently.
- **Framework note:** Prisma can't express a real polymorphic relation, so there's no `payment.booking` navigation. You look the source up explicitly. That missing convenience *is* the boundary — Payment shouldn't be able to walk into Booking.

**2.15 A payment is a SET of tenders. Each tender freezes its rate and its USD-equivalent.**
$20 + 900,000 LBP for one $30 game = two tender rows (BR-33). Each freezes `rate_at_time` (RULE-5, BR-34) and stores `usd_equivalent` computed at that instant. Change the rate tomorrow — the row never moves. Reports read `usd_equivalent` and never touch a rate table.

**2.16 The rate is stored in two places, and it is not duplication.**
`exchange_rates` = "the rate *now*, for the next collection" (current, append-only). Tender `rate_at_time` = "the rate when *this* was paid" (historical, frozen). Different questions. The tender never re-reads `exchange_rates`.

**2.17 `exchange_rates` is append-only.**
Owner sets it (RULE-6, BR-35), rounded and real-world (90,000 not 89,437), one-tap edit in the header (BR-36). New rate = new row; old rows untouched — which is *why* past tenders keep their frozen rate (BR-37). Current rate = latest row.

**2.18 Money is `Decimal`, never a float.**
USD = `Decimal(12,2)`, LBP = `Decimal(18,0)` (no fractional pounds; huge numbers). JS floats give $29.999999 (BR-40).
- **Framework note:** Prisma returns Decimal as a Decimal object, not a JS number — do money math with a decimal library, not `+`.

**2.19 Collection UX:** show "Due $30" → add tenders → each USD-equivalent subtracts → live "Remaining" until zero. Full-USD payment = one tender, two taps (BR-38/39).

### LEDGER

**2.20 The ledger is the single source of truth for *reading* money. Not a computed view.**
- *Rejected: derived* (sum payments + expenses + shop + academy on demand). Every new revenue source means editing the dashboard query — an upward arrow, and several growing joins on a droplet for a screen he opens daily.
- **Truth about "what the business earned" lives in one table, but that table is fed by everyone.** Say it as "one place to *read* from," NOT "one source of truth" — the ledger *adds* a copy of the money, it doesn't reduce copies.
- **Open/Closed, named:** the dashboard is *closed to modification* (its query never changes); the system is *open to extension* (academy fees, shop sales write a ledger row and appear automatically).
- The dashboard is one query: `SELECT direction, SUM(amount_usd) ... GROUP BY direction`. No cross-module joins. Sub-ms on the droplet (BR-59).

**2.21 The ledger is append-only, USD only, and each row is written inside the same transaction as its cause.**
- **Append-only:** refund = new OUT row; cancellation reversal = new row. Never an edit. This is what makes it trustworthy.
- **USD only:** LBP never reaches the ledger — it was frozen to USD-equivalent back at the tender. "Never sum LBP across time" (BR-32/RULE-4) is enforced by the LBP simply not being here.
- **Same transaction as its cause, ALWAYS.** This is the condition the whole decision rests on. The ledger duplicates money that's also in `payments`/`expenses`; if a ledger row is ever written without its source (or vice versa), the dashboard silently lies and nothing tells you — and that is the #1 product risk (R-1: owner stops trusting the numbers, returns to paper).
  > **CODE-REVIEW RULE:** every code path that writes a payment or expense writes its ledger row in the *same* `$transaction`. No "we'll write it after." No exceptions.
- **LBP display toggle** (BR-56): multiply the USD total by a display rate chosen at that moment. A view transformation, never stored, never summed in LBP.

### EXPENSE

**2.22 An expense has no amount. The money is a Payment.**
An expense is the *thing that happened* (BR-50/51). Paying it is a Payment with `source_type = EXPENSE`, flowing through the same machinery as a booking: split-tender (BR-52), frozen rate, a ledger OUT row in the same transaction.
- Expense answers "what did I spend on?"; Payment answers "how was it paid?"; Ledger answers "how much left the business in March?" Three questions, three modules, one clean chain. **Adding expenses reused Payment and Ledger whole — the proof the boundaries were drawn right.**

**2.23 `category` is a fixed enum for MVP.**
- *Rejected: managed `categories` table* — a CRUD screen he'd set up before recording his first expense (friction against G-1).
- *Rejected: free text* — gives "kahraba" / "كهرباء" / "electricity" as three categories and a useless dashboard.
- Enum (ELECTRICITY, WATER, MAINTENANCE, SALARY, EQUIPMENT, OTHER) covers a village stadium's real costs (BR-51); `OTHER` catches the rest. If a real owner keeps reaching for OTHER, learn what's missing and add it — additive.

---

## 3. Cross-cutting invariants (true for every table)

- **`tenant_id` on every tenant-owned table, including child tables** (`booking_participants`, `payment_tenders`, `slot_interests`, etc.). This is the standing condition for keeping RLS cheaply deferrable (DR-001) and the safety net behind the Prisma extension.
- **Append-only tables:** `exchange_rates`, `ledger_entries`. Corrections are new rows, never edits or deletes.
- **All times `timestamptz`, stored UTC, rendered Asia/Beirut.** Test day-crossing games from day one (R-5).
- **All jsonb Zod-validated at the application edge.** Prisma stores; Zod guarantees shape.
- **All money `Decimal`.** Never a float, anywhere.

---

## 4. Still open (touches the model, not yet settled)

- Domain types vs Prisma types — where to separate, where a mapper would be a pointless passthrough.
- (Everything else remaining on the project's open list is behavior, not schema: auth strategy, PWA offline read, droplet backups, staff-collects-payment permission.)

---

*Corrections welcome by decision number (2.x). This document changes as we settle the rest.*
