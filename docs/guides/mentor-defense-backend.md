# Mentor defense — backend map

Read a section out loud, then open the files. This is not a spec.

The whole system exists so one person on one droplet can run many stadiums, and each owner’s paper notebook stays faster than the app would be if I get a rule wrong. Phase 2 (Shop) and Phase 3 (Academy) must plug in by adding modules, not by editing Payment or Ledger.

---

## Cross-cutting

### Multi-tenancy: three layers, not one

**What I chose:** shared database, shared schema, `tenant_id` on every tenant-owned table including children. Isolation is three layers that do different jobs:

1. **URL → header.** Next.js proxy (this version renamed middleware → `proxy`) reads subdomain or `?tenant=` and sets `x-tenant-slug`. Middleware cannot put tenant into app memory — different runtime. It can only pass a header.
2. **Request context.** App code reads the header, loads the Tenant row, stores it on the request (`AsyncLocalStorage`). That is the “which stadium is this request about?” answer.
3. **Prisma extension.** Every query on a tenant-owned model gets `tenantId` injected (reads) or stamped (creates). Callers must not pass `tenantId` — if they do, I cannot tell whether the guard is actually working.

**RLS is deferred, not rejected.** The extension is the load-bearing guard. RLS only catches a bug *in* the extension. It costs a second Postgres role and wrapping every request. Trigger: first paying tenant who isn’t a friend.

**Rejected:** schema-per-tenant / DB-per-tenant (N migrations, pool pain on one droplet). Path slug (`app.com/ahmad`) — superseded by subdomain because “this is his site” matters, and the resolver is one function either way. Session choosing the tenant — a stolen cookie on `sami.stadiums.com` would then show Ahmad’s data.

**The rule I must never invert:** URL picks the stadium. Session only answers “are you allowed *here*?”

**Pointers:** `src/proxy.ts` `proxy` · `src/lib/tenant-slug.ts` `parseTenantSlug` · `src/lib/tenant-context.ts` `getCurrentTenant` / `withCurrentTenant` · `src/lib/db.ts` tenant extension · `src/lib/platform-db.ts` (unscoped alias, awkward on purpose) · `src/lib/prisma-base.ts` (one client, one pool)

---

### Transaction ownership: `tx` is explicit, one owner

Prisma has no ambient “current transaction.” A function that uses global `db` inside someone else’s `$transaction` silently escapes — that write will not roll back.

**What I chose:** the use case that *starts* the action opens `$transaction` and passes `tx` down. Repositories take `TenantTx`. Payment / People / Ledger never open their own.

**Rejected:** Payment owning the tx (it would have to call back up into Booking → upward import). Each module opening its own tx (money taken, game not recorded). A “transaction service” helper (empty indirection).

**Auth stays outside the tx.** Session lives on `platformDb`. Querying it *inside* an interactive transaction deadlocks the tenant guard (see revisited). Pattern: `can(...)` first, then `db.$transaction`.

**Notifications after commit.** Building a WhatsApp link is not a DB write. If cash was collected and notify fails, the money must not roll back.

**Pointers:** `src/lib/db.ts` wrapped `$transaction` · `src/modules/booking/application/collect-booking-payment.ts` `collectBookingPayment` · `src/modules/payment/application/record-payment.ts` `recordPayment` (takes `tx`, does not open) · `docs/guides/prisma-transaction-tenant-guard.md`

---

### Exclusion constraint: why application code cannot own this

Two owners hitting Approve on the same hour is a race. App-level “check then insert” loses: both reads see free, both write APPROVED. The database has to refuse the second write.

Postgres `EXCLUDE USING gist (pitchId WITH =, during WITH &&) WHERE (status = 'APPROVED')` does that. `tstzrange` is one value the DB understands as a range; `&&` is overlap. Half-open `[start, end)` so adjacent hours (20:00–21:00 and 21:00–22:00) do not collide.

`WHERE status = 'APPROVED'` is the product rule: pending requests *may* overlap. The constraint ignores them. CANCELLED / NO_SHOW also drop out of occupancy.

Prisma cannot express EXCLUDE. Hand-written SQL migration. Prisma also cannot type `tstzrange` — `Unsupported`, so inserts are `$executeRaw` and the tenant extension does **not** stamp raw SQL. Those inserts must put `tenantId` in the SQL themselves (ALS read, not a second query).

App code’s job is fallout: catch Postgres `23P01`, tell the owner the slot is gone.

**Rejected:** unique on `(pitchId, start)` — doesn’t catch overlap of different lengths. App lock / `SELECT FOR UPDATE` — I can get it wrong, and two Node processes still race unless the DB agrees.

**Pointers:** `src/prisma/migrations/20260909080800_booking_approved_exclusion/migration.sql` · `src/modules/booking/domain/exclusion.ts` `isExclusionViolation` · `src/modules/booking/infrastructure/bookings.ts` `insertPendingPublicBooking` / `insertApprovedOwnerBooking` · `approveBooking` / `createOwnerBooking` catch → `booking.slot_unavailable`

---

### Money: USD is the notebook, LBP is cash in the drawer

This is the conversation that will go longest.

**USD is the unit of business.** Game price, remaining due, ledger, reports — all USD `Decimal(12,2)`. Never a JS float.

**LBP is a payment instrument.** Owner takes dollars, pounds, or both for one collection. Each part is a *tender*. LBP is converted to USD *at that instant* using the owner’s rate, then frozen. Tomorrow’s rate does not rewrite last night’s cash.

Two rate tables that are not duplication:

- `exchange_rates` — append-only. “What do I use for the *next* collection?” Latest row.
- `payment_tenders.rate_at_time` + `usd_equivalent` — “What rate applied when *this* cash hit the drawer?” Never re-read `exchange_rates`.

**Polymorphic Payment:** `source_type + source_id`, no `booking_id`. Rejected nullable FKs (`booking_participant_id`, `expense_id`, `sale_id`…) — that puts Booking columns inside Payment, so Academy would migrate Payment. Cost I accepted: no FK, orphans possible. Writes are few, all inside `application/` transactions I control. Prisma has no real polymorphic relation — Payment cannot `.booking`. That missing convenience *is* the boundary.

Payment does not know what a booking is. Booking’s use case loads the game, asks Payment “how much already collected for source BOOKING + this id?”, freezes tenders, then `recordPayment(tx, …)` which writes payment + tenders + ledger IN in the *given* tx.

**Ledger is a copy, not a view.** Dashboard is `SUM(amount_usd) GROUP BY direction`. Closed to modification (query never grows joins). Open to extension (Shop later writes a row and appears). The copy is trustworthy only if every payment/expense writes its ledger row in the same `$transaction`. LBP never reaches the ledger. Display-LBP on reports is multiply-at-view-time, never stored, never summed across months.

**Rejected:** summing payments+expenses on the dashboard (every new source edits the query — upward arrow). Storing LBP on the ledger (cannot sum LBP across time — rate moved). Floats.

**Pointers:** `src/lib/money.ts` · `src/modules/payment/domain/collect.ts` `usdEquivalent` / `freezeTenders` / `remainingDue` · `src/modules/payment/application/record-payment.ts` · `src/modules/payment/infrastructure/payments.ts` `insertPaymentWithTenders` / `sumCollectedUsd` · `src/modules/ledger/infrastructure/entries.ts` `insertLedgerEntry` · `src/modules/ledger/domain/totals.ts` `usdToDisplayLbp`

---

### Slots are computed; bookings are stored ranges

**Slots are not a table.** Storing empty future rows means generating forever and re-syncing when the owner changes hours. Venue holds a jsonb *rule*. A pure function generates one civil day’s slots on demand.

**A booking is an absolute UTC range** (`tstzrange`). Once requested, it does not live as “Tuesday 20:00 slot #3”. It is `[start, end)`. That is what occupancy and exclusion need.

**Availability = generated slots − occupied.** Occupied is an *argument* to Venue (`OccupiedRange[]`). Venue never imports Booking. The page / Booking use case passes APPROVED ranges in. Same engine: public grid, owner Book picker, “is this request still a real slot?”

Half-open overlap in JS matches Postgres `&&` on `[)`. Adjacent games do not collide.

Times stored UTC, interpreted Asia/Beirut. Midnight-crossing windows (`end <= start` on the clock) land the end on the next civil day.

**Pointers:** `src/modules/venue/domain/availability.ts` `generateSlotsForDay` / `bookingFitsOpenHours` / `civilDateInTimeZone` · `src/modules/venue/application/get-day-availability.ts` `getDayAvailability` · `src/modules/booking/domain/offered-slot.ts` `resolveOfferedSlot` · `src/modules/booking/application/list-approved-occupied.ts` `listApprovedOccupied`

---

### Decisions I later had to fix (good “I found this” stories)

**1. Tenant lookup inside `$transaction` (SPEC-03).** Interactive tx holds one connection. The Prisma extension also needed “which tenant?” and queried `platformDb` — which was the *same* client. Deadlock / 5s expired transaction / socket kill. Tried: warming React `cache()` (Prisma’s callback does not see it). Second pool (proxy cap 10, sockets die). Two clients, one pool (adapter-pg assumes exclusive use). **Fix:** one client, one pool. Load tenant *before* `BEGIN`, stash on ALS. Guard reads memory during tx. Guide: `docs/guides/prisma-transaction-tenant-guard.md`.

**2. Second PrismaClient after `prisma generate`.** Dev process kept the old client; new model (`expense`) existed in types, not on the cached instance.

**3. Approve after hours changed.** PENDING was created against old hours. Owner shrinks the window. Without a re-check, Approve would flip it APPROVED and exclusion would happily take a slot we no longer offer. `approveBooking` now runs `resolveOfferedSlot` against *current* hours. Save-hours refuses live APPROVED in a removed window (`hours-cover`); PENDING-only needs a confirm then save — the request stays PENDING until someone tries to approve.

**4. Cancel on past unpaid (BR-49).** SPEC-10 let Cancel hit any APPROVED. Cancelling a past unpaid game dropped the debt with no ledger row — owner’s notebook would still show they owe. Now: remaining due uses the same `sumCollectedUsd` + `remainingDue` as Collect; `assertNotPastUnpaidCancel` if `start <= now` and remaining > 0. Future unpaid and past paid still cancel. Cancel still does not write Payment/Ledger — that is the refund cut, not a second bug (see Booking).

**5. No-show instead of fake-cancel.** BR-22 wanted “didn’t happen” without deleting the debt. `NO_SHOW` is a status, not a boolean. You can only mark it after `end`, so occupancy-freeing a no-show cannot reopen a live hour. Collect allows `NO_SHOW`. Clock: cancel’s unpaid check is `start`; no-show waits until `end`.

**6. Raw SQL vs the tenant stamp.** `$executeRaw` bypasses the extension. Booking inserts stamp `tenantId` themselves via `getCurrentTenantId()` (ALS). Prisma 7 `create` types still want `tenantId` on the payload even when the extension stamps it — we omit it and assert the type (callers must not pass it).

**Pointers:** `approveBooking` · `src/modules/venue/domain/hours-cover.ts` · `src/modules/booking/domain/decision.ts` `assertNotPastUnpaidCancel` / `assertEndedForNoShow` · `src/modules/booking/application/cancel-booking.ts` · `src/modules/booking/application/record-no-show.ts` · `src/modules/payment/domain/collect.ts` `assertCanCollect`

---

## Platform

**Problem:** many stadiums, one process. Tenant identity (slug, name) is not “Ahmad’s bookings.”

**Decision:** Tenant is unscoped. Looked up by slug through `platformDb`. Feature code uses `db` (scoped). I made `platformDb` a named alias of the same client, not a second pool — reaching for it should feel exceptional. Users and Sessions also live here (no `tenant_id`); Memberships do not.

There is no `src/modules/platform/` folder yet. The module is the Tenant table + the unscoped client. Plans/subscriptions are named, not built.

**Tricky:** not the Tenant row — the *split* between `platformDb` and `db`, and never querying `platformDb` inside `$transaction`. That is the SPEC-03 bug.

**Pointers:** `src/lib/platform-db.ts` · `src/lib/tenant-context.ts` `loadTenant` · Prisma `Tenant` in `src/prisma/schema.prisma`

---

## Access

**Problem:** only owner/staff log in. Players never get a password. Login must work without an inbox, and a cookie on the wrong subdomain must show nothing.

**Decisions:** identifier `local@tenant-slug` (e.g. `owner@ahmad`) — looks like email, never mailed. Users have no `tenant_id`; memberships do (`UNIQUE(tenant_id, user_id)`). Session is a server row + HTTP-only cookie; it stores the *user*, not the stadium. Login: URL tenant → verify password → membership **for this tenant** or same error as bad password → create session.

`can(membership, permission)` is a pure function. OWNER = always. STAFF = jsonb flag strictly `true`. Default staff cannot approve. Flags in jsonb so a new staff capability is not a migration (BR-98). No `if (role === 'STAFF')` in Booking.

**Rejected:** player accounts; real Gmail as username; phone OTP (Phase 2); JWT in localStorage; `session.tenantId` as isolation; `tenant_id` on users (same human at two stadiums = two passwords).

**Tricky:** the sequence, not the hash. Cookie exists on Sami’s URL → `getCurrentMembership` loads session, then membership via *scoped* `db` → no row → null. Tenant never comes from the cookie. User/Session via `platformDb`, membership via `db`, **not** in one `$transaction`.

**Pointers:** `src/modules/access/domain/can.ts` `can` · `src/modules/access/domain/identifier.ts` `parseLoginIdentifier` · `src/modules/access/application/login.ts` `login` · `src/modules/access/application/get-current-membership.ts` `getCurrentMembership` · `src/modules/access/infrastructure/{users,sessions,memberships,password,session-cookie}.ts`

---

## People

**Problem:** ~90% of humans never register. Owner types a name + phone after a game. Same phone at two stadiums is two customers — stadiums do not share lists.

**Decisions:** `persons` ≠ `users`. Link table `user_person_links` ships empty (adding it later means backfilling). `UNIQUE(tenant_id, phone)`, not global. Name+phone only — extra fields are friction. Find-or-create by normalized digits; never overwrite the stored name (first writer wins). Booking’s use case owns the tx; People does not open one.

**Rejected:** `user_id` on persons (cannot express guardian / zero accounts). Global unique phone.

**Tricky:** almost none. The interesting part is the *absence* of a user. Public request must not create an account.

**Pointers:** `src/modules/people/domain/phone.ts` `normalizePhone` · `src/modules/people/application/find-or-create-person.ts` `findOrCreatePerson` · `src/modules/people/infrastructure/persons.ts`

---

## Venue

**Problem:** each pitch has its own hours, slot length, prices. The offered grid must change when the owner edits rules, without rewriting history.

**Decisions:** `schedule_config` jsonb, Zod at every read/write (Prisma types Json as `unknown`). No slots table. Location on tenant settings, not on the pitch (multi-site is rare). `pitch_blocks` named as Academy’s seam — not built yet. Hours-cover when shrinking: live APPROVED in a removed window blocks the save; PENDING-only is confirm-then-save. Duration change does not trip hours-cover (it would move the grid; I do not warn). `gapMinutes` stays 0 in the editor because changing gap moves offered slots and hours-cover would stay silent.

Venue does not import Booking. `updatePitch` takes `liveBookings: { start, end, status }[]` from Booking’s `listLivePitchWindows`.

**Rejected:** columns per hour rule (every new rule shape = migration). Stored slot rows.

**Tricky:** timezone math, not the jsonb. `zonedLocalToUtc` uses Intl parts + a second pass on the offset (DST-safe even if Beirut is currently fixed). Midnight wrap. `bookingFitsOpenHours` asks “does this UTC range still sit inside *a window*?”, not “does it still match a generated slot of this duration?” — that is why duration-only edits do not fight existing games.

**Pointers:** `src/modules/venue/schemas/schedule-config.ts` `parseScheduleConfig` · `src/modules/venue/domain/availability.ts` · `src/modules/venue/domain/hours-cover.ts` `classifyHoursConflicts` / `hoursSaveBlocker` · `src/modules/venue/domain/daily-schedule.ts` `scheduleFromHoursGroups` · `src/modules/venue/application/{get-day-availability,update-pitch,create-pitch}.ts`

---

## Booking

**Problem:** a pitch+time can be requested by the public (PENDING), confirmed by the owner, created instantly from a phone call, cancelled, or marked no-show — without double-booking, and without dropping unpaid debt.

**Decisions:** booking holds no person — participants attach later (owner often books before he knows who). Requester is `is_requester` on a participant, not `requested_by` (same person twice would drift). `price_usd` and sum of participant dues are independent — mismatch is a warning, never a constraint (8 of 10 show up; one person pays for all). PENDING overlap freely; APPROVED is exclusive. Price copied from the engine at request time — never trusted from the form. Approve / owner-create auto-reject overlapping PENDING and drop `slot_interests` on the *window*, not the dead booking id (waitlist outlives the loser). Cancel writes no money. NO_SHOW writes no money; Collect still works.

**Tricky (real):**

1. **Approve / owner-create transaction.** Auth outside. Inside: load booking, assert PENDING, `resolveOfferedSlot` against current hours + current APPROVED occupancy, flip status (hits exclusion), then `rejectOverlappingPending`. Race: exclusion is the lock; `isExclusionViolation` is fallout. `23P01` is wrapped by adapter-pg — walk `cause`, do not look for Prisma `P2002`.

2. **Status vs occupancy vs debt.** APPROVED occupies. CANCELLED / NO_SHOW / REJECTED / PENDING do not. Cancel on past unpaid is forbidden (debt would vanish). No-show after `end` is how you close “didn’t happen” *without* dropping debt. Those two clocks (`start` vs `end`) are easy to mix up.

**Price snapshot vs a later $40 Friday (not a bug).** Player requests Friday 20:00 when the engine says $30. That `$30.00` is written on the booking (and the requester’s `amount_due_usd`) inside `requestPublicSlot`. Owner then changes Friday’s `priceRules` to $40. `approveBooking` runs `resolveOfferedSlot` against *current* hours so a closed window still fails (`booking.slot_not_offered`). It **discards** the engine’s returned `priceUsd` and only flips status. The approved row stays $30. Collect remaining is against that snapshot, not the new list price. That is snapshot-at-request-time on purpose: the PENDING row is the offer they saw, and we never take a price from the form. Re-pricing on approve would silently raise what they asked for. If the owner wants $40, reject and have them request again, or Book a new slot (owner-create snapshots *now*, because it becomes APPROVED in the same insert). I would not “fix” this unless product asks for “approve at current list price” as an explicit confirm.

**Cancel of a paid game vs refunds (deliberate cut, not a forgotten reverse).** What happens today:

- **Future unpaid** → `CANCELLED`. Hour is free. No payment ever existed, so the ledger is silent. Correct: they never owed in the notebook because cash never moved; the implicit “due” was the APPROVED row, which is gone.
- **Past unpaid** → refused (`booking.cancel_past_unpaid`). Use no-show + Collect.
- **Paid, future or past** → `CANCELLED`. Hour frees if it is still in the future (someone else can take it). Collect is gone (`assertCanCollect` is APPROVED/NO_SHOW only). **Every ledger IN for that booking stays.** Reports still count that cash as earned.

The IN row is not “money we never kept.” Collect means cash hit the drawer. Cancel means the game will not happen (or, for a past paid cancel, we are closing the reservation). Whether he hands the cash back is a separate action. Auto-reversing on Cancel would be the worse default — village owners often keep a deposit.

The real gap is only this: if he *does* refund from the drawer, the dashboard overstates income until a refund slice exists. SPEC-10 / DR-002 already named that slice. Direction: **never edit or delete the IN**. A later refund use case appends a ledger OUT (same `$transaction` as a Payment OUT, source still the booking or a `REFUND` source type), amount = what actually left the drawer, tenders frozen at *refund* time. Partial refund = smaller OUT, not a rewrite of the original tenders.

**NO_SHOW occupancy (fine, under-explained).** No-show is allowed only after `end`. Occupied lists and the exclusion stay APPROVED-only, so the row stops occupying. That does **not** let a new player take “the same hour”: `dropEndedSlots` and `resolveOfferedSlot` already refuse `end <= now` (`booking.slot_ended`). Public Request, owner Book, and Approve all share that gate. Waitlist also hides ended windows. So the double-reality is only in the questions, not in the grid: occupancy answers “is this pitch reserved for a game that will happen?” — after no-show the hour is over, so “free” is academic; debt answers “do they still owe?” — unpaid no-show stays on Home until Collect. If we ever allowed no-show *before* `end`, then yes someone could book over it mid-window. We do not.

**Pointers:** `src/modules/booking/domain/offered-slot.ts` `resolveOfferedSlot` / `overlappingPendingIds` · `src/modules/booking/domain/decision.ts` · `src/modules/booking/domain/waitlist.ts` `isWaitlistWindowOpen` · `src/modules/booking/application/{request-public-slot,approve-booking,create-owner-booking,cancel-booking,record-no-show,reject-overlapping-pending,collect-booking-payment,list-open-waitlist}.ts` · `src/modules/booking/infrastructure/bookings.ts`

---

## Payment

**Problem:** take cash in USD, LBP, or both, for a booking *or* an expense, without Payment knowing either product.

**Decisions:** payment = set of tenders. Freeze in domain (`freezeTenders`) before write. `recordPayment` is a leaf: insert payment+tenders, sum `usdEquivalent`, write ledger. Direction IN vs OUT is the caller’s. Collect on booking lives in *Booking* (`collectBookingPayment`) so Payment never imports Booking; it receives `sourceType`/`sourceId` and a status *string* (`assertCanCollect` allows APPROVED and NO_SHOW). Rate append is OWNER-only, not a tx. Cancel / no-show never call Payment. A refund, when it exists, is another `recordPayment` with `direction: "OUT"` — not an update of the original collection (see Booking).

**Tricky:** freeze math, not the insert. LBP ÷ rate, `ROUND_HALF_UP`, two places. USD copies amount; still stores current rate when one exists (null if owner never set a rate and paid in USD only). Remaining = `priceUsd − sum(usdEquivalent)` across *all* payments for that source — partial collect is another payment, not an edit. Over-collect is not hard-blocked in domain beyond “must have remaining > 0 before this collect.”

**Pointers:** `src/modules/payment/domain/collect.ts` · `src/modules/payment/application/{record-payment,set-exchange-rate,get-current-rate}.ts` · `src/modules/payment/infrastructure/{payments,rates}.ts`

---

## Ledger

**Problem:** owner opens “this month” every day. The number must match the drawer, and Shop/Academy later must not rewrite this query.

**Decisions:** append-only USD rows. Refund = new OUT, never an edit — that sentence in DR-002 is the refund design; Cancel today does not emit that OUT yet (see Booking). Period = civil dates in Asia/Beirut → UTC `[startInclusive, endExclusive)` at midnight there (same Intl offset idea as Venue, own copy — Ledger does not import Venue). No `$transaction` on the read. LBP display is the page’s job (`getCurrentRate` + `usdToDisplayLbp`), not the summary use case.

**Tricky:** period bounds, not SUM. “September in Beirut” is not “September in UTC.” Inclusive `from`, exclusive day-after `to`. If `occurredAt` on an expense is noon Beirut, it still falls in that civil day.

**Pointers:** `src/modules/ledger/domain/period.ts` `periodBoundsFromCivilRange` / `currentMonthCivilRange` · `src/modules/ledger/domain/totals.ts` `netUsd` · `src/modules/ledger/application/summarize-ledger-period.ts` · `src/modules/ledger/infrastructure/entries.ts` `sumAmountUsdByDirection`

---

## Expense

**Problem:** record what was spent (electricity, salary, …) and how it was paid, without a second money engine.

**Decisions:** expense has **no amount**. It is the thing that happened. Paying it is a Payment `source_type = EXPENSE` through the same freeze + ledger OUT path. That reuse is the proof the Payment/Ledger boundary is right. Category is a fixed enum (not a categories CRUD, not free text). One submit = create + pay — no unpaid-expense inbox. `occurredAt` is noon on the civil date in Beirut (so the row lands in the month the owner meant, not the server’s local midnight).

**Rejected:** amount on expense (then I’d have two money writers). Managed categories table before first save.

**Tricky:** almost none once Payment exists. The non-obvious bit is `occurredAt` passed through to the ledger so “this expense is for last Tuesday” is what reports sum, not `createdAt`.

**Pointers:** `src/modules/expense/domain/occurred-at.ts` `occurredAtFromCivilDate` · `src/modules/expense/domain/categories.ts` · `src/modules/expense/application/record-expense.ts` `recordExpense`

---

## Ask me for more depth (didn’t fit)

- **Timezone conversion** — the two-pass `zonedLocalToUtc` in Venue vs the copies in Ledger/Expense. Why not one shared helper yet (module arrows).
- **Prisma 7 + `adapter-pg`** — why `$executeRaw` / `Unsupported` for `during`; why create types fight the tenant stamp; why one pool is a hard rule.
- **Waitlist vs occupancy** — interest stored as window, not booking id; `isWaitlistWindowOpen`; WhatsApp link built after read, phones not logged (`src/modules/notification/domain/whatsapp-link.ts`).
- **`price_usd` vs participant `amount_due_usd`** — independence is settled; split-the-due across players is not built (one requester carries the whole price today).
- **Staff collect-payment** — `can()` flag exists; default deny; “who collected” not stored.
- **RLS when it actually lands** — second DB role, `SET` tenant per tx, and whether the Prisma extension stays.
- **Error model (DR-004)** — `DomainError` keys vs `UnexpectedError` logs; not in the modules above but it is how every use case talks to `app/`.
