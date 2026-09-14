# Module file map + request walkthroughs

**When:** 2026-09-15  
**Purpose:** One place to point at while reading the tree — what each layer file is for, then five real request paths told start to finish.

Schemas (`schemas/`) sit at the module edge (Zod in → typed out). They are not listed below; each module that has them is noted once.

Pattern break flags use the same wording as the engineering audit: Venue/Access repos that import `db` instead of taking only `TenantTx`.

---

# Part 1 — File-role map

## access/

**Schemas:** `schemas/login.ts` — Zod for identifier + password.

### domain/

| File | Role |
|---|---|
| `can.ts` | Pure permission check (`OWNER` always yes; `STAFF` only if jsonb flag is true). Domain because it thinks over already-loaded membership data with no DB. |
| `identifier.ts` | Pure normalize/validate login identifier string. Domain because it is string rules only. |

### application/

| File | Role |
|---|---|
| `login.ts` | Use case: look up user, verify password, create session, set cookie. Application because it orchestrates infra and decides success/failure. |
| `logout.ts` | Use case: delete session + clear cookie. Application orchestration. |
| `get-current-membership.ts` | Use case: cookie → session → membership for the *URL* tenant (`cache()` once per request). Application because it joins cookie + two stores. |

### infrastructure/

| File | Role |
|---|---|
| `users.ts` | `platformDb.user.findUnique` by identifier. Infra because User has no `tenantId` (unscoped client). |
| `sessions.ts` | Create / find / delete Session on `platformDb`. Infra; Session is not tenant-owned. |
| `session-cookie.ts` | Read/write/clear the opaque session cookie. Infra (HTTP cookie store, not domain rules). |
| `password.ts` | Hash / verify password. Infra (crypto I/O). |
| `memberships.ts` | **Pattern break:** imports `db` and calls `db.membership.findFirst` with no `tx` argument. Still infra (the query lives here), but it violates “repos take `TenantTx`, never import `db`.” |

---

## booking/

**Schemas:** `public-slot-request.ts`, `owner-create-booking.ts`, `booking-decision.ts`.

### domain/

| File | Role |
|---|---|
| `decision.ts` | Pure status/time rules for approve/reject/cancel/no-show (asserts + past-unpaid helper). Domain: no DB. |
| `offered-slot.ts` | Pure: is this UTC window still an offered Venue slot (price from engine); overlapping-pending id picker. Domain: reuses Venue `generateSlotsForDay` as data in. |
| `exclusion.ts` | Pure walk of error `cause` for Postgres `23P01` / exclusion name. Domain file holding a DB-shaped mapper (honest edge case). |
| `home-inbox.ts` | Pure partition/group helpers for Home lists (pending by slot, overdue/today/later, status tags). Domain: shapes lists, does not query. |
| `waitlist.ts` | Pure: which open interests still match a freed window. Domain. |

### application/

| File | Role |
|---|---|
| `request-public-slot.ts` | Use case: public PENDING + participant inside `$transaction`. |
| `approve-booking.ts` | Use case: auth, re-check slot, APPROVED, reject overlapping pending, map exclusion → DomainError. |
| `reject-booking.ts` | Use case: auth + PENDING → REJECTED. |
| `reject-overlapping-pending.ts` | Use case fragment (takes `tx`): reject losers + insert `slot_interests`. Lives in application so approve and owner-create share one rule set. |
| `cancel-booking.ts` | Use case: auth, cancel rules, APPROVED → CANCELLED. |
| `record-no-show.ts` | Use case: auth, ended-window rules, APPROVED → NO_SHOW. |
| `collect-booking-payment.ts` | Use case: auth, load booking, freeze tenders, call Payment `recordPayment` in same tx. **Boundary:** Booking → Payment. |
| `create-owner-booking.ts` | Use case: phone-call APPROVED booking + person + reject overlapping. |
| `list-pending-requests.ts` | Use case: membership gate + list PENDING. |
| `list-due-bookings.ts` | Use case: Home confirmed lists + remaining + confirm WhatsApp href. **Boundary:** Booking → Payment sums; Booking → Notification message helpers. |
| `list-approved-occupied.ts` | Use case: APPROVED ranges for day grids (passes `db` into infra). |
| `list-live-pitch-windows.ts` | Use case: live APPROVED+PENDING for pitch Settings (passes `db`). |
| `list-open-waitlist.ts` | Use case: open waitlist groups + notify hrefs. **Boundary:** Notification domain. |

### infrastructure/

| File | Role |
|---|---|
| `bookings.ts` | All Booking / participant / slot-interest SQL and Prisma: raw `tstzrange` inserts (Client has no `booking.create`), lists, status updates. Takes `TenantTx`. Infra because every query is here. |

---

## venue/

**Schemas:** `schedule-config.ts`, `pitch-draft.ts`.

### domain/

| File | Role |
|---|---|
| `availability.ts` | Pure slot engine: generate day slots, occupy, empty-day kind, civil-date helpers, price-from-rules. Domain: the schedule brain. |
| `daily-schedule.ts` | Pure: hours groups ↔ `ScheduleConfig`, day uniqueness. Domain: form shape ↔ stored jsonb rules. |
| `hours-cover.ts` | Pure: do live windows still fit proposed hours; save blocker (approved hard / pending soft). Domain. |

### application/

| File | Role |
|---|---|
| `get-day-availability.ts` | Use case: load pitches, parse config, generate slots; occupied ranges are an *argument* (no Booking import). |
| `create-pitch.ts` | Use case: OWNER create from draft → schedule → insert. |
| `update-pitch.ts` | Use case: OWNER update + hours-conflict classify; `liveBookings` passed in from Booking. |
| `get-pitch-editor.ts` | Use case: load one pitch as editor defaults. |
| `list-pitch-summaries.ts` | Use case: Settings pitch list summaries. |

### infrastructure/

| File | Role |
|---|---|
| `pitches.ts` | **Pattern break (partial):** `listPitches` / `findPitch` / `insertPitch` / `updatePitchRow` import and call `db` with no `tx`. `findPitchById(tx, …)` is the Booking-tx-safe form. Still infra (queries only), but two styles in one file. |

---

## payment/

**Schemas:** `collect-payment.ts`, `exchange-rate.ts`.

### domain/

| File | Role |
|---|---|
| `collect.ts` | Pure: freeze USD/LBP tenders, remaining due, assert collectable status *as a string* (no Booking import). Domain. |

### application/

| File | Role |
|---|---|
| `record-payment.ts` | Use case fragment (takes `tx`): payment + tenders + ledger IN/OUT. Does not open a transaction; caller owns it. **Boundary:** Payment → Ledger infra. |
| `get-current-rate.ts` | Use case: membership + latest rate row. |
| `set-exchange-rate.ts` | Use case: OWNER insert new rate. |

### infrastructure/

| File | Role |
|---|---|
| `payments.ts` | `TenantTx` inserts and sum-collected helpers. Infra. |
| `rates.ts` | `TenantTx` find/insert exchange rate. Infra. |

---

## ledger/

**Schemas:** `period-query.ts`.

### domain/

| File | Role |
|---|---|
| `period.ts` | Pure civil-period bounds / validation. Domain. |
| `totals.ts` | Pure net / display LBP math. Domain. |

### application/

| File | Role |
|---|---|
| `summarize-ledger-period.ts` | Use case: auth, period bounds, groupBy sums → net. |

### infrastructure/

| File | Role |
|---|---|
| `entries.ts` | `insertLedgerEntry` + `sumAmountUsdByDirection` on `TenantTx`. Infra. |

---

## expense/

**Schemas:** `record-expense.ts`.

### domain/

| File | Role |
|---|---|
| `categories.ts` | Fixed category string union (no Prisma enum import). Domain. |
| `occurred-at.ts` | Pure civil date → `Date` for ledger business day. Domain. |

### application/

| File | Role |
|---|---|
| `record-expense.ts` | Use case: auth, insert expense, `recordPayment` OUT in same tx. **Boundary:** Expense → Payment. |
| `list-recent-expenses.ts` | Use case: list + remaining via Payment sums. |

### infrastructure/

| File | Role |
|---|---|
| `expenses.ts` | Insert / list on `TenantTx`. Infra. |

---

## people/

### domain/

| File | Role |
|---|---|
| `phone.ts` | Pure normalize / digit rules. Domain. |

### application/

| File | Role |
|---|---|
| `find-or-create-person.ts` | Use case fragment: find by phone or create; takes caller’s `tx` (does not open `$transaction`). |

### infrastructure/

| File | Role |
|---|---|
| `persons.ts` | `findPersonByPhone` / `createPerson` on `TenantTx` (alias `PeopleTx`). Follows the Booking repo rule. |

---

## notification/

No `application/` or `infrastructure/`. One domain file only (YAGNI).

### domain/

| File | Role |
|---|---|
| `whatsapp-link.ts` | Pure: normalize phone for `wa.me`, build message strings, build href. Domain: no network send — just strings. |

---

# Part 2 — Request walkthroughs

Shared entry plumbing (almost every path):

1. Browser hits a host or `?tenant=` → `src/proxy.ts` `proxy()` sets `x-tenant-slug`.
2. First use of tenant-scoped `db` / `getCurrentTenant` → `src/lib/tenant-context.ts` loads Tenant via `platformDb` and (inside `$transaction`) parks it in ALS so the Prisma extension does not nest-query.

---

## Path A — Player requests a public slot

**Story:** Player picks an hour on the public page, enters name + phone, taps request. End state: a `PENDING` `Booking` row and a requester `BookingParticipant`.

1. **Entry:** Form posts to Server Action `submitPublicSlotRequest` in `src/app/(public)/request-slot.ts`.

2. **Order of work:**
   - `parsePublicSlotRequest` (`booking/schemas/public-slot-request.ts`) — Zod edge: name, phone, pitchId, start/end ISO. Not domain; rejects bad shape before the use case.
   - `requestPublicSlot` (`booking/application/request-public-slot.ts`) — **application** owns the transaction and the product steps.
   - Inside the tx (next section): Venue pitch load, schedule parse, offered-slot check, People find-or-create, Booking inserts.

3. **Transaction:** `db.$transaction` opens in `requestPublicSlot`. Wrapped by `withCurrentTenant` in `src/lib/db.ts` so ALS has the tenant before the first `tx` query.

4. **Database touches (all inside that tx):**
   - `findPitchById(tx, pitchId)` (`venue/infrastructure/pitches.ts`) — **boundary:** Booking → Venue infra. Normal Prisma `findUnique` on `tx`. Extension stamps/checks `tenantId`. **Why this helper:** takes `tx` so it does not import Venue’s `db` singleton mid-transaction.
   - `parseScheduleConfig` (`venue/schemas`) — no DB; validates jsonb.
   - `listApprovedRanges(tx, pitchId)` (`booking/infrastructure/bookings.ts`) — Prisma/raw list of APPROVED windows on that pitch (occupied).
   - `resolveOfferedSlot` (`booking/domain/offered-slot.ts`) — **domain**, pure. Calls Venue `generateSlotsForDay` in memory. Failures: `booking.slot_not_offered` / `slot_taken` / `slot_ended`.
   - **Boundary:** Booking → People: `findOrCreatePerson(tx, …)` (`people/application`) → `findPersonByPhone` / `createPerson` (`people/infrastructure`) — normal Prisma on `tx`.
   - `insertPendingPublicBooking(tx, …)` — **raw SQL** `$executeRaw` INSERT with `tstzrange` because Prisma Client has no typed `booking.create` for required Unsupported `during`. **Why raw:** only way to write `during`. `tenantId` is in the SQL (extension does not stamp `$executeRaw`).
   - `insertRequesterParticipant(tx, …)` — normal Prisma create; extension stamps `tenantId`.

5. **Exit:** Use case returns `{ bookingId }`. Action redirects to `/?tenant=&date=&ok=requested` (or `error=`). Toast / query shows success.

6. **Failures the player sees** (via `actionErrorKey` → `?error=` → Arabic in `error-messages.ts`):
   - Zod → `form.invalid`.
   - Missing pitch (other tenant UUID → extension returns `null` on `findUnique`) → `booking.pitch_not_found`.
   - Slot not offered / taken / ended → those three keys.
   - Unexpected → logged, generic `error.generic`.
   - No notify step; WhatsApp is not involved.

---

## Path B — Owner approves that request

**Story:** Owner taps موافقة on Home. End state: that booking `APPROVED`; other overlapping `PENDING` on the same window become `REJECTED` with a `SlotInterest` for waitlist.

1. **Entry:** Form posts to `submitApproveBooking` in `src/app/owner/today/actions.ts`.

2. **Order of work:**
   - `parseBookingDecision` — Zod bookingId.
   - `approveBooking` (`booking/application/approve-booking.ts`) — **application**.
   - `getCurrentMembership` (`access/application`) — cookie → session (`platformDb`) → membership (`db`). **Boundary:** Booking → Access.
   - `can(membership, BOOKINGS_APPROVE)` (`access/domain/can.ts`) — **domain**.
   - Inside `$transaction`: load booking, assert PENDING, load pitch, re-check offered slot against *current* hours + current APPROVED occupancy, set APPROVED, `rejectOverlappingPending`.

3. **Transaction:** `db.$transaction` in `approveBooking`. Auth runs *before* the tx (session is on `platformDb`; must not nest inside the interactive tx).

4. **Database (inside tx):**
   - `findBookingForDecision(tx, id)` — Prisma/raw load; missing → `booking.not_found`.
   - `assertPendingForDecision` — **domain**, no DB.
   - `findPitchById(tx, …)` — Venue infra on `tx` (**boundary** Booking → Venue).
   - `parseScheduleConfig` — no DB.
   - `listApprovedRanges(tx, pitchId)` — occupied APPROVED (does not include this PENDING yet).
   - `resolveOfferedSlot` — **domain** re-check: if owner shrunk hours since request, or another APPROVED took the hour → DomainError before status flip.
   - `setPendingStatus(tx, id, "APPROVED")` — Prisma `updateMany` where still PENDING; 0 rows → `booking.not_found` (infra throwing DomainError).
   - `rejectOverlappingPending(tx, claimed)` (**application**, same module):
     - `listPendingBookings(tx)`
     - `overlappingPendingIds` (**domain**)
     - per loser: `setPendingStatus(…, "REJECTED")`, `findRequesterPersonId`, `insertSlotInterest` (Prisma creates).

5. **Exit:** Action redirects `/owner/today?ok=approved&highlight=<id>`. Flash toast strips `ok`; highlight ring stays. Sheet is **not** auto-opened.

6. **Failures:**
   - No membership / no approve permission → `access.not_allowed`.
   - Not PENDING → `booking.pending_only`.
   - Slot no longer offered/taken/ended → those keys (same as public).
   - Postgres exclusion race (`23P01`) → `isExclusionViolation` (**domain**) maps to `booking.slot_unavailable` (“الساعة لم تعد متاحة.”).
   - Missing requester on a loser → `booking.requester_not_found`.

---

## Path C — Owner collects mixed-currency payment

**Story:** On Home sheet, owner opens دفع بعملتين, enters USD + LBP remaining split, taps تحصيل. End state: `Payment` + `PaymentTender` rows + one ledger `IN` for the frozen USD total.

1. **Entry:** Form posts to `submitCollectPayment` in `src/app/owner/today/actions.ts` (hidden bookingId + usdAmount + lbpAmount).

2. **Order of work:**
   - `parseCollectPayment` (`payment/schemas`) — Zod amount strings.
   - Action builds `TenderDraft[]` with `parseUsd` / `parseLbp` (`lib/money`).
   - `collectBookingPayment` (`booking/application`) — **application** (Booking owns “collect on a booking”).
   - `getCurrentMembership` + `can(…, PAYMENTS_COLLECT)` — Access **boundary**.
   - Inside `$transaction`: load booking for collect, assert status, load rate, sum already collected, freeze tenders, **boundary into Payment** `recordPayment(tx, …)`.

3. **Transaction:** One `db.$transaction` in `collectBookingPayment`. Payment does **not** open a second tx.

4. **Database:**
   - `findBookingForCollect(tx, id)` — Booking infra.
   - `assertCanCollect` / `remainingDue` / `assertHasDue` / `freezeTenders` — Payment **domain** (status is a string; Payment never imports Booking).
   - `findLatestExchangeRate(tx)` — Payment infra. LBP without a rate → `payment.rate_required` in domain.
   - `sumCollectedUsd(tx, "BOOKING", id)` — Payment infra (polymorphic source).
   - `recordPayment` (`payment/application`) on same `tx`:
     - `insertPaymentWithTenders` — Prisma `payment.create` + each `paymentTender.create` (extension stamps `tenantId`).
     - `insertLedgerEntry` — **boundary** Payment → Ledger infra; Prisma `ledgerEntry.create`, direction `IN`, `amountUsd` = sum of tender USD equivalents.

5. **Exit:** Redirect `/owner/today?ok=collected`. Remaining on next load drops by the frozen total.

6. **Failures:**
   - No collect permission → `access.not_allowed`.
   - Wrong status → `payment.collect_unapproved`.
   - Already paid / nothing left → `payment.nothing_due`.
   - Empty/zero tenders → `payment.amount_required` / `amount_positive`.
   - LBP and no rate → `payment.rate_required` (“عيّن سعر الصرف أولاً.”).
   - Missing booking → `booking.not_found`.

**Inline consistency note:** This path’s Booking and Payment repos take `tx`. That matches Part 1’s Booking/Payment rule. Venue’s `db`-import style is not involved here.

---

## Path D — Owner edits pitch hours that conflict with a live booking

**Story:** Owner shrinks hours so a still-live APPROVED (or PENDING) window no longer fits. System refuses (approved) or warns then requires confirm (pending-only).

1. **Entry:** Pitch edit form posts to `submitUpdatePitch` in `src/app/owner/more/settings/pitches/actions.ts`.

2. **Order of work:**
   - `parsePitchDraft` (`venue/schemas`) — includes `confirmPending` from the form when shown.
   - `listLivePitchWindows(pitchId, now)` (`booking/application`) — membership gate, then `listLiveWindowsOnPitch(db, …)`.
     - **Flag:** passes **`db`**, not a transaction. Booking infra still typed as `TenantTx`; `db` is structurally assignable.
     - **Boundary:** Settings action → Booking (Venue must not import Booking).
   - `updatePitch({ pitchId, draft, liveBookings, now })` (`venue/application`) — **application**.
   - `getCurrentMembership` — must be `OWNER` (role check, not `can()` flag).
   - `findPitch(pitchId)` — Venue infra.
     - **Flag:** `findPitch` uses imported **`db`**, no `tx` (Part 1 Venue break).
   - `parseScheduleConfig` on existing jsonb; bad jsonb → `UnexpectedError` (logged).
   - `scheduleFromHoursGroups` — Venue **domain** builds next `ScheduleConfig` (`gapMinutes: 0` always from editor).
   - `classifyHoursConflicts(next, liveBookings, …)` — Venue **domain**: finished windows ignored; APPROVED outside new hours → `approvedBlocking`; PENDING only → `pendingWarning`.
   - `hoursSaveBlocker(…)` — Venue **domain**: approved → hard; pending without confirm → soft; pending with `confirmPending` → allow.
   - If clear: `updatePitchRow` — Venue infra `db.pitch.update` (**again `db`, no tx**).

3. **Transaction:** **None.** Read live bookings, then read pitch, then update — three separate `db` uses. Not the Booking write pattern.

4. **Database:**
   - Live windows: Booking infra Prisma/raw list filtered by pitch + not-ended.
   - `findPitch` / `updatePitchRow`: normal Prisma on singleton `db`; extension injects `tenantId` on update path’s post-check for unique ops.

5. **Exit:**
   - Success → redirect Settings `ok=pitch_updated`.
   - Error → stay on edit URL with `error=` and draft query fields kept; if `venue.hours_pending`, also `needPending=1` so the confirm checkbox UI can show.

6. **Failures (Arabic):**
   - Live APPROVED in removed hours → `venue.hours_approved` — “لا يمكن تقليص الساعات: هناك حجز مؤكد…”
   - Only PENDING in removed hours, first save → `venue.hours_pending` — confirm to save without rejecting those requests.
   - Day in two hours groups → `venue.hours_day_overlap` (from domain when building schedule).
   - Staff / not owner → `access.not_allowed`.
   - Wrong-tenant pitch id → `findPitch` → extension null → `booking.pitch_not_found` (**wrong module key on a Venue error** — flagged in the audit).

---

## Path E — Tenant guard blocks a cross-tenant id

**Story:** Request is for stadium Ahmad (`x-tenant-slug=ahmad`). Someone posts a form (or crafts a request) with Sami’s `pitchId` UUID. Isolation must not return Sami’s pitch as if it were Ahmad’s.

This is not a dedicated “guard endpoint.” The guard is the Prisma extension on every tenant-scoped model.

1. **Entry (concrete example):** Same as Path A — `submitPublicSlotRequest` with `pitchId` = a pitch that exists only under Sami.

2. **Order of work until the block:**
   - Zod accepts any non-empty pitchId string.
   - `requestPublicSlot` opens `$transaction` → `withCurrentTenant` loads Ahmad into ALS.
   - `findPitchById(tx, samiPitchId)` runs `tx.pitch.findUnique({ where: { id } })`.

3. **Transaction:** Open (same as public request). The guard runs *on each query inside*.

4. **What the guard does** (`src/lib/db.ts` `$allOperations`, roughly lines 90–98):
   - `findUnique` / `update` / `delete` cannot always put `tenantId` in the unique `where`.
   - Extension runs the query, then if the row has `tenantId` and it ≠ current tenant:
     - **`findUnique` → returns `null`** (does not throw).
     - **`update` / `delete` → throws** `Error("Tenant scope violation on Pitch.…")`.
   - Contrast: `findMany` / `updateMany` get `where.tenantId` injected up front, so other-tenant rows never appear.

5. **Exit for this example:** `findPitchById` returns `null` → use case throws `DomainError("booking.pitch_not_found")` → action redirects `?error=booking.pitch_not_found` → user sees “الملعب غير موجود.” No Sami data is rendered. No ledger/booking write happens (transaction rolls back on throw).

6. **If the same wrong id hit an update path** (e.g. `updatePitchRow` with Sami’s id while on Ahmad):
   - Extension throws the raw `Tenant scope violation…` Error (not a DomainError).
   - `rethrowUnexpected` / `actionErrorKey` typically surfaces as generic `error.generic` after logging — **harsher and less user-friendly than the findUnique → null → `pitch_not_found` path**.

**Inline consistency note:** The guard does not care whether the caller passed `tx` or imported `db`; both go through the same extended client. Venue importing `db` does not bypass isolation — it only breaks the “repos take `tx` only” discipline and makes mid-transaction Venue calls unsafe if someone called `findPitch` instead of `findPitchById`.

---

## How to use this file

- Part 1: when asking “why is this file here?”  
- Part 2: when debugging a flow — open the named files in order and follow the narrated steps.  
- Pattern breaks called out in Part 1 and again inline in Paths C/D/E where they matter.
