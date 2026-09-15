# Audit — error handling consistency + logging completeness

**When:** 2026-09-15  
**Scope:** read-only. Every Server Action under `src/app/`, every `application/` use case under `src/modules/{access,people,venue,booking,payment,ledger,expense}`, plus notification WhatsApp helpers (RULE-9 / DR-004 side effects). No fixes.  
**Rule source:** [DR-004](../decisions/DR-004-error-handling.md), [SPEC-12](../specs/SPEC-12-error-handling.md), BRD RULE-9 / RULE-10.  
**Method:** greps + file reads — same standard as `docs/guides/engineering-audit.md`.

---

# Part 1 — Error handling consistency

## Established rule (what “consistent” means here)

From DR-004 / SPEC-12:

1. Domain / application throw `DomainError` (key) or wrap unexpected as `UnexpectedError` after log — never raw strings / unwrapped Prisma crossing into `app/`.
2. Every Server Action wraps the use case in `try/catch`, maps via `actionErrorKey`, never lets a failure throw uncaught past the action (except `redirect()`, which throws by design).
3. User-facing copy is dictionary keys only — no stacks, Prisma codes, or English technical `Error.message` in the UI.
4. Every thrown key has AR+EN dictionary entries; flag orphan throws and dead dictionary keys.
5. Notification / WhatsApp prep must not roll back or block a committed primary write (DR-004 §“Side effects vs money”; DR-001 §5). Failures should be logged, then soft-failed.

Shared helpers (not module-specific):

| Helper | Role | Evidence |
|---|---|---|
| `rethrowUnexpected` | Rethrow `DomainError` / `UnexpectedError`; else `logger.error` + `UnexpectedError` | `src/lib/use-case-error.ts` 10–19 |
| `actionErrorKey` | Domain → key; Zod → `form.invalid`; else log if not already `UnexpectedError` → `error.generic` | `src/lib/use-case-error.ts` 26–38 |
| Dictionary | AR + EN for keys | `src/lib/error-messages.ts` 7–73 |
| UI | `?error=` → `errorMessage(key)` toast; crash boundaries never render `error.message` | `src/components/ui/flash-toast.tsx` 35; `src/app/error.tsx` 7–8, 18–22 |

---

## Server Action inventory (cross-cutting)

| Action | File | try/catch + `actionErrorKey` | Verdict |
|---|---|---|---|
| `submitPublicSlotRequest` | `src/app/(public)/request-slot.ts` 18–43 | Yes (31–32) | Consistent |
| `submitLogin` | `src/app/login/actions.ts` 29–44 | Yes (38–39) | Consistent |
| `submitLogout` | `src/app/login/actions.ts` 47–50 | **No** — `await logout()` then `redirect` with no catch | **Violation** |
| `setUiLocale` | `src/app/locale-actions.ts` 14–27 | No (cookie write only) | Minor gap (not a use-case call) |
| `submitApproveBooking` / reject / cancel / no-show / collect | `src/app/owner/today/actions.ts` | Yes (`submitDecision` 27–35; approve 45–52; collect 76–92) | Consistent |
| `submitCreateOwnerBooking` | `src/app/owner/book/actions.ts` 14–31 | Yes (25–26) | Consistent |
| `submitRecordExpense` | `src/app/owner/money/actions.ts` 12–41 | Yes (35–36) | Consistent |
| `submitSetExchangeRate` | `src/app/owner/more/settings/actions.ts` 15–32 | Yes (22–23) | Consistent |
| `submitCreatePitch` / `submitUpdatePitch` | `src/app/owner/more/settings/pitches/actions.ts` 30–85 | Yes (41–42, 74–75) | Consistent |

`redirect` / `redirectOwner` sit outside `try/catch` where required (DR-004: `redirect` throws) — matches the rule.

---

## Key ↔ dictionary audit

**Literal `new DomainError("…")` keys in `src/`:** all present in both ARABIC and ENGLISH maps (`src/lib/error-messages.ts`). No missing keys.

**Dynamic keys (script miss):** `updatePitch` throws `new DomainError(blocker)` where `blocker` is `"venue.hours_approved" | "venue.hours_pending"` (`hours-cover.ts` 38–47; `update-pitch.ts` 65–71). Both keys exist in the dictionary (lines 33–37 / 69–72).

**Dictionary-only utility keys (never thrown as `DomainError`):** `error.generic`, `form.invalid` — produced by `actionErrorKey` (`use-case-error.ts` 31, 38). Expected.

**`notification.bad_phone`:** thrown in `whatsapp-link.ts` 40, 53, but every production caller catches and returns `null` (`list-due-bookings.ts` 115–128; `list-open-waitlist.ts` 88–92). Dictionary entries exist (lines 30, 65) but **never reach FlashToast** today. Not a missing key — a soft-fail path that never surfaces the key.

No other dead dictionary keys found.

---

## Module-by-module

### access — **inconsistent** (logout action boundary)

| Piece | Evidence | Status |
|---|---|---|
| `login` | `DomainError("access.invalid_login")` 31, 36; `try` + `rethrowUnexpected` 24–44; info log 42 | Consistent |
| `submitLogin` | wraps use case | Consistent |
| `logout` | `src/modules/access/application/logout.ts` 10–16 — no try/catch, no `rethrowUnexpected` | Gap (DB/cookie failure is raw) |
| `submitLogout` | `src/app/login/actions.ts` 47–50 — **uncaught** past action | **Violation** of DR-004 “Server Actions never throw uncaught” |
| `getCurrentMembership` | returns `null`, does not throw domain keys | OK as gate helper |
| `can` domain | no throws | OK |

**Gap:** logout is the only mutating owner-facing action without `try/catch` + `actionErrorKey`.

---

### people — **consistent** (thin fragment; errors owned by caller)

| Piece | Evidence | Status |
|---|---|---|
| `findOrCreatePerson` | `src/modules/people/application/find-or-create-person.ts` — no throws; phone normalize only | Consistent |
| Call sites | Inside Booking `$transaction` in `request-public-slot.ts` / `create-owner-booking.ts`, both wrapped by `rethrowUnexpected` | Consistent |

No people-specific Server Action. No raw strings. No dictionary keys owned by this module.

---

### venue — **inconsistent** (mutating OK; read paths incomplete wrap)

| Piece | Evidence | Status |
|---|---|---|
| `createPitch` / `updatePitch` | `rethrowUnexpected` (`create-pitch.ts` 19–33; `update-pitch.ts` 35–83); DomainError keys for access / pitch / hours blockers | Consistent |
| Pitch Server Actions | wrap + `actionErrorKey` | Consistent |
| Bad `schedule_config` | log + `UnexpectedError` in `get-day-availability.ts` 57–64, `list-pitch-summaries.ts` 38–45, `get-pitch-editor.ts` 43–50, `update-pitch.ts` 42–49 | Consistent for that case |
| `listPitchSummaries` / `getPitchEditor` / `getDayAvailability` Prisma failures (beyond jsonb parse) | No outer `rethrowUnexpected` — e.g. `listPitches()` failure in `get-day-availability.ts` 50 bubbles raw | Gap vs SPEC-12 step 5 (“list/read use cases”) |
| Domain `venue.hours_day_overlap` | `daily-schedule.ts` 54; dictionary present | Consistent |

**Gap:** RSC callers (`owner/book/slots.tsx` 23–28, Settings pages) can surface raw Prisma / driver errors into Next `error.tsx` without `useCase`/`tenantId` logger context.

---

### booking — **inconsistent** (mutating + actions strong; read + WhatsApp soft-fail logging weak)

| Piece | Evidence | Status |
|---|---|---|
| Mutating use cases (`approve`, `reject`, `cancel`, `recordNoShow`, `collectBookingPayment`, `createOwnerBooking`, `requestPublicSlot`) | Each has `try` + `rethrowUnexpected`; exclusion → `DomainError("booking.slot_unavailable")` with log (`approve-booking.ts` 91–98; `create-owner-booking.ts` 89–96) | Consistent |
| Owner / public actions | All wrap (see inventory) | Consistent |
| Domain keys (`decision.ts`, `offered-slot.ts`, infra `bookings.ts` not_found) | All in dictionary | Consistent |
| List use cases (`listPendingRequests`, `listDueBookings`, `listOpenWaitlist`, `listApprovedOccupied`, `listLivePitchWindows`) | `access.not_allowed` where gated; **no** Prisma catch-all | Gap (same as venue reads) |
| WhatsApp after committed data | `confirmHref` / waitlist href: `try/catch` → `null` (`list-due-bookings.ts` 115–128; `list-open-waitlist.ts` 88–92) — does **not** block lists or roll back money/booking | RULE-9 soft-fail **holds** |
| Same WhatsApp catches | Empty `catch` — **no** `logger.*` | Gap vs DR-004: “Notification prep … Log them.” |

`rejectOverlappingPending` throws `booking.requester_not_found` inside parent tx (`reject-overlapping-pending.ts` 35–36) — wrapped by approve/owner-create catch. OK.

---

### payment — **inconsistent** (mutations OK; read rate unwrapped)

| Piece | Evidence | Status |
|---|---|---|
| Domain `collect.ts` | Only `DomainError` keys (amount / rate / collect_unapproved / nothing_due) | Consistent |
| `setExchangeRate` | `rethrowUnexpected` (`set-exchange-rate.ts` 19–23); action wraps | Consistent |
| `recordPayment` | Fragment inside caller tx (`record-payment.ts`) — no own catch; parent Booking/Expense wraps | Consistent |
| `getCurrentRate` | `DomainError("access.not_allowed")` 13; Prisma `findLatestExchangeRate` unwrapped (`get-current-rate.ts` 10–16) | Gap |

`payment.nothing_due` blocking double-collect is intentional domain (not RULE-9 “take money anyway” — RULE-9 is about system beliefs vs stock/amounts; collect still allows overpay via tenders once due > 0). No violation found for blocking collect on overpay path.

---

### ledger — **inconsistent** (domain keys OK; only use case is read-only without wrap)

| Piece | Evidence | Status |
|---|---|---|
| `period.ts` domain | `DomainError("ledger.invalid_period")` 19, 55, 67; dictionary present | Consistent |
| `summarizeLedgerPeriod` | Auth DomainError 33; then `sumAmountUsdByDirection` with no catch (`summarize-ledger-period.ts` 27–54) | Gap |
| No ledger Server Action | Page/RSC only (`money/panel.tsx` 125–129) | N/A |

Invalid GET period query is softened at the page (`money/page.tsx` 29–46 ZodError → defaults), not via DomainError banner — acceptable for GET; not an action leak.

---

### expense — **inconsistent** (record OK; list read unwrapped)

| Piece | Evidence | Status |
|---|---|---|
| Domain `occurred-at.ts` | `expense.invalid_date` 17, 29; dictionary present | Consistent |
| `recordExpense` | `rethrowUnexpected` 38–69; action wraps | Consistent |
| `listRecentExpenses` | `access.not_allowed` 24; payment sums unwrapped (`list-recent-expenses.ts` 21–40) | Gap |

---

## RULE-9 / RULE-10 / notification side effects

| Claim | Evidence | Verdict |
|---|---|---|
| WhatsApp link build must not roll back booking/payment | Links built in **list** use cases after reads, not inside approve/collect `$transaction` | Holds |
| Soft-fail bad phones | catch → `null` href (due/waitlist) | Holds for non-block |
| Soft-fail must be logged (DR-004) | Empty catch, no logger | **Violates “Log them”** |
| Money + ledger stay atomic | `collectBookingPayment` / `recordExpense` call `recordPayment` inside same `$transaction` | Holds (correct opposite of soft-fail) |

No place found where WhatsApp failure aborts a primary write. The gap is observability, not rollback.

---

## User-facing leak check

| Surface | Evidence | Verdict |
|---|---|---|
| FlashToast | `errorMessage(error, locale)` only (`flash-toast.tsx` 35) | No stack / Prisma |
| Login banner | `errorMessage(errorKey)` (`login/page.tsx` 41) | OK |
| `error.tsx` / `global-error.tsx` | Hardcoded AR+EN; digest only; comment forbids `error.message` | OK |
| `parseUsd` / `parseLbp` English `throw new Error(...)` | `money.ts` 15–16, 55–56 | Called from actions **after** Zod that already validated; if thrown, action maps to `error.generic` (not the English string in query). Residual: RSC `parseLbp(periodQuery.displayRate)` in `panel.tsx` 131–132 is safe only because Zod already accepted the rate in `readPeriodQuery`. |

No evidence of Prisma codes or stacks in `?error=` query values — actions pass keys / `error.generic` only.

---

# Part 2 — Logging completeness

## Logger behavior (what exists)

`src/lib/logger.ts`:

- Writes `logs/YYYY-MM-DD.log` under `process.cwd()` via `fs.appendFileSync` (lines 15, 50–57).
- Line shape: ISO timestamp + `[INFO|ERROR]` + message + optional `useCase=` / `tenantId=` tokens (`formatLogContext` 36–41) + optional stack on following lines (`formatError` 28–32).
- Mirrors to **stdout/stderr** via `console.info` / `console.error` (59–66).
- Context type only allows `useCase` and `tenantId` (19–22) — not bookingId, paymentId, etc. as structured fields.

`.gitignore` keeps `/logs/*` except `.gitkeep` (lines 43–45) — logs are local/droplet disk, not in git.

---

## Does every UnexpectedError get logged with enough context?

| Path | Logged? | Context | Evidence |
|---|---|---|---|
| Mutating use case catch via `rethrowUnexpected` | Yes | message + stack + `useCase` + `tenantId` (when `safeTenantId` resolves) | `use-case-error.ts` 17–19 |
| Action catch of raw (non-Unexpected) error | Yes | `` `${useCase} failed` `` + stack + useCase + tenantId | `use-case-error.ts` 32–36 |
| Already-`UnexpectedError` at action | **Not re-logged** (by design) | Assumes use case already logged | `use-case-error.ts` 32 |
| Bad jsonb → `UnexpectedError` in venue reads/update | Yes | useCase name + tenantId | e.g. `get-day-availability.ts` 60–64 |
| Raw Prisma on **list/read** use cases with no catch | **No app logger call** | Relies on Next digest / process crash path | e.g. `list-pending-requests.ts` 10–17; `summarize-ledger-period.ts` 42–46 |
| WhatsApp soft-fail | **No** | — | empty catch cited above |
| `submitLogout` failure | **No** (uncaught) | — | `login/actions.ts` 47–50 |

**Verdict:** Unexpected paths on **mutating** use cases are logged with timestamp + useCase + tenantId + stack. That is enough to start debugging those flows. Read-path and logout failures are **not** guaranteed to hit this logger with useCase/tenantId.

---

## Business events — logged today?

| Event | Logged today? | Evidence |
|---|---|---|
| Booking approved | Yes (`info`) | `approve-booking.ts` 89: ``Booking approved ${bookingId}`` |
| Booking rejected | Yes | `reject-booking.ts` 36 |
| Booking cancelled | Yes | `cancel-booking.ts` 47 |
| Booking no-show | Yes | `record-no-show.ts` 37 |
| Payment collected | Yes | `collect-booking-payment.ts` 59: includes paymentId + bookingId |
| Exchange rate set | Yes | `set-exchange-rate.ts` 21 |
| Expense recorded | Yes | `record-expense.ts` 67 |
| Pitch created | Yes | `create-pitch.ts` 30 |
| Pitch updated | Yes | `update-pitch.ts` 81 |
| Public slot requested | Yes | `request-public-slot.ts` 69 |
| Owner booking created | Yes | `create-owner-booking.ts` 86 |
| Login success | Yes | `login.ts` 42 |
| Logout | **No** | `logout.ts` — no logger |
| Approve / owner-create exclusion collision | Yes (`error`) | `approve-booking.ts` 92–95; `create-owner-booking.ts` 90–93 |

All of the above `info` lines are **string concatenation only** — they do **not** pass `{ useCase, tenantId }` into `logger.info` (unlike error paths). Grep of `logger.info(` in modules shows message-only calls.

---

## Structured vs string concatenation

- **Errors (unexpected):** semi-structured — free-text message + `useCase=` / `tenantId=` tokens + multiline stack. Not JSON. Greppable on a droplet with `rg useCase=approveBooking logs/`, painful for automated shipping.
- **Business info events:** unstructured English sentences with embedded ids. No `tenantId=` token on those lines. Multi-tenant droplet debugging requires reading the id then correlating by time.

---

## Where logs go in production (droplet fit)

| Mechanism | Fit |
|---|---|
| File under `cwd/logs/` | Works on a single droplet **if** the process user can write and the directory persists across deploys (volume or sticky path). Lost on rebuild if only ephemeral disk. |
| Console mirror | Visible in `systemd`/Docker/`journalctl` if the process is supervised that way — good secondary. |
| No rotation beyond daily filenames | Risk of disk fill on a long-lived droplet; no size cap in `logger.ts`. |
| No remote sink (Datadog, etc.) | Matches “one developer, one droplet” — appropriate for MVP **if** the operator knows to `tail`/`scp` `logs/` and watches disk. |

DR-004 explicitly keeps this file logger — not a mismatch with intent; ops caveats remain.

---

## Direct `console.log` / `console.*` outside the shared logger

| Location | What |
|---|---|
| `src/lib/logger.ts` 59–66 | **Only** intentional mirror inside the shared logger |
| `test/integration/migrate-test-db.ts` 22 | `console.log` in test harness — not app runtime |
| `src/modules/**`, `src/app/**` | **No** ad-hoc `console.log` / `console.error` found |

DR-004 “One logger — no ad-hoc `console.log` of errors in `app/` or modules” **holds** for application code.

---

# Verdict

## Error handling — defendable for mutations; not fully “every error has an expected shape”

**You can defend** the main owner/public money and booking flows: mutating use cases throw `DomainError` keys or logged `UnexpectedError`; Server Actions map to `?error=<key>` / `error.generic`; dictionaries cover all thrown keys (including dynamic hours blockers); crash UI does not render `error.message`.

**You cannot yet claim universal consistency.** Concrete gaps:

1. **`submitLogout` has no try/catch** — uncaught past the action boundary (`login/actions.ts` 47–50).
2. **Most list/read use cases never wrap Prisma failures** — raw errors can hit RSC → `error.tsx` without `rethrowUnexpected` / `actionErrorKey` (booking lists, ledger summarize, expense list, payment get rate, venue day availability beyond jsonb).
3. **WhatsApp soft-fail swallows without logging** — RULE-9 non-block holds; DR-004 “Log them” does not.

Of the seven modules requested: **people = consistent**; **access / venue / booking / payment / ledger / expense = inconsistent** (each gap named above). None of the six “inconsistent” modules is a full collapse of the DomainError model on their mutating paths — the holes are logout, reads, and notification observability.

## Logging — enough for happy-path forensics; not enough for a clean production incident story

**Present:** unexpected failures on wrapped use cases log timestamp + useCase + tenantId + stack; all listed business mutations emit an `info` line with the entity id.

**Missing for a real incident:** tenantId on info lines; structured/queryable fields; logging of WhatsApp soft-fails; logout audit; guaranteed logger coverage when a read use case throws; disk rotation / retention policy for `logs/`.

---

## Ordered fix list (no work done — priority only)

1. **P0 — Action boundary:** Wrap `submitLogout` in try/catch + `actionErrorKey` (or deliberately swallow + log). Same DR-004 rule as every other action.
2. **P0 — Soft-fail observability:** In `list-due-bookings` / `list-open-waitlist` WhatsApp catches, `logger.error` (or `info`) with useCase + tenantId, still return `null`. Satisfies DR-004 without blocking RULE-9.
3. **P1 — Read use-case wrap:** Add the same `rethrowUnexpected` (or shared read helper) to list/summarize/get* use cases that hit Prisma, so RSC failures become logged `UnexpectedError` with useCase/tenantId instead of opaque Next digests.
4. **P1 — Business info context:** Pass `{ useCase, tenantId }` into existing `logger.info` success lines (approve/reject/cancel/no-show/collect/rate/expense/pitch/login). Keep message text if wanted; stop relying on string-only lines.
5. **P2 — Structure:** Emit one JSON object per line (or key=value for bookingId/paymentId) so droplet `rg` / future shipping is trivial. Expand `LogContext` beyond useCase/tenantId.
6. **P2 — Ops:** Document droplet log path + retention; add simple rotation or logrotate note (daily files alone will fill a disk).
7. **P3 — Logout audit info:** `logger.info` on successful logout (optional; pairs with P0).
8. **P3 — `setUiLocale`:** Only if cookie writes ever fail in prod — wrap or ignore; lowest risk.

Until P0–P1 land, treat the defendable claim as: **“Mutating Server Actions have an expected error shape.”** Not: **“Every error in the app does.”** Logging claim: **“We can usually reconstruct a failed approve/collect from `logs/`,”** not **“We can debug any production incident from structured logs alone.”**
