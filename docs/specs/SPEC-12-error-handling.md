# SPEC-12 — Error handling (typed errors, logs, no crash screen)

**Type:** Build Spec — precise, boring instructions to hand to Cursor.
**Depends on:** [DR-004](../decisions/DR-004-error-handling.md), DR-001 §5,
RULE-9 / RULE-10.
**Builds on:** SPEC-01–11. Do not re-open cancel, waitlist, collect, or Book rules.
**Scope:** Typed `DomainError` / `UnexpectedError`, English message dictionary, logger
context, Server Actions that **never throw uncaught** (except `redirect`), friendly
`?error=<key>` banners, Next `error.tsx` + `global-error.tsx`.
**No** next-intl, no toast library, no converting forms to Client `useActionState`,
no wrapping every Prisma call.

> **Framework note:** Before `error.tsx` / Server Actions, read
> `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`
> and `01-app/01-getting-started/10-error-handling.md`. This Next version uses **`retry`**,
> not `reset`. `redirect` still throws — keep it outside try/catch.

> **Comments:** every exported function gets a short human comment — why it exists.

---



## What this slice delivers

Ahmad taps Request on an hour that already ended. He stays on the public page with a short
English line (“That hour has already ended”), not a Next crash. The log file gets nothing
for that (domain). If the database is down, he sees a bilingual retry screen; `logs/` has
the stack, use case, and tenant when known.

Same for owner actions: “Slot no longer available” (or the dictionary line) in the existing
banner, never a stack.

---



## Prerequisites

- SPEC-01–11 click-proofed. `logger` already writes `logs/YYYY-MM-DD.log`.
- Public `submitPublicSlotRequest` currently has **no** try/catch — that is the crash.
- `npm test` green.

---



## Pins this spec must make

**Keys, not sentences at throw sites.** `DomainError` has `key: string`. Copy lives in
`src/lib/error-messages.ts` (English `Record<string, string>` + `errorMessage(key)`).
Unknown key → generic. Legacy `?error=1` → generic.

**Catalog (use these keys; do not invent parallel English throws):**

| Key | English (dictionary) |
| --- | --- |
| `error.generic` | Something went wrong. Try again. |
| `form.invalid` | Check the form and try again. |
| `access.not_allowed` | You cannot do that. |
| `access.invalid_login` | Invalid login. |
| `booking.not_found` | Booking not found. |
| `booking.pending_only` | Only a pending request can be approved or rejected. |
| `booking.confirmed_only` | Only a confirmed booking can be cancelled. |
| `booking.slot_not_offered` | That hour is not offered. |
| `booking.slot_taken` | That hour is taken. |
| `booking.slot_ended` | That hour has already ended. |
| `booking.slot_unavailable` | Slot no longer available. |
| `booking.pitch_not_found` | Pitch not found. |
| `booking.requester_not_found` | Requester not found. |
| `payment.collect_unapproved` | Only an approved booking can be collected. |
| `payment.nothing_due` | Nothing due. |
| `payment.rate_required` | Set exchange rate first. |
| `payment.amount_required` | Amount required. |
| `payment.amount_positive` | Amount must be positive. |
| `notification.bad_phone` | Phone cannot be used for WhatsApp. |
| `ledger.invalid_period` | Invalid period. |
| `expense.invalid_date` | Invalid expense date. |

Map existing throws 1:1. Money parse failures in `lib/money.ts` used by Zod refinements may
stay as they are if Zod already turns them into `ZodError` at the action — then `form.invalid`.
If a use case throws them, use `form.invalid` or the payment amount keys.

**Actions:** catch everything except `redirect`. Domain → `?error=<key>`. Unexpected → log
(`useCase`, `tenantId` if cheap / already known from hidden `tenant` slug is **not**
isolation — log the ALS tenant id when `getCurrentTenantId` is safe **outside** an open
`$transaction`; if unsure, omit tenantId rather than deadlock). Generic key to the URL.

**Pages:** `/owner`, `/login`, `/` (public) show `errorMessage(key)` in the existing failure
paragraph. Preserve other query params (`tenant`, `bookOn`, `date`, period fields).

**error.tsx:** Client Component. Do **not** import `logger`. Do **not** show `error.message`.
English + Arabic hardcoded on that screen (product i18n still parked). `retry()` button.
Optional digest in `<code>`. `global-error.tsx` includes `<html>` and `<body>`.

**Jest:** DomainError identity + `errorMessage` fallback. Update existing `.toThrow("…")`
that targeted domain strings to `toThrow(DomainError)` / `key`. Do not weaken tests.

**Do not** wrap every Prisma query. Use-case `catch` that is not `DomainError` → log +
`UnexpectedError` or let the action treat it as unexpected (log there). Prefer wrapping in
the use case so actions stay dumb: `if (error instanceof DomainError) throw error;`
`logger.error(...); throw new UnexpectedError(error)`.

**Exclusion** stays a domain outcome: `isExclusionViolation` → `DomainError("booking.slot_unavailable")`.
Log the collision at error level (already done) — it is rare but expected.

---



## Step 1 — Typed errors + English dictionary

`src/lib/errors.ts`: `DomainError` (extends Error, `key`), `UnexpectedError` (wraps
`unknown`, `cause` set). Short comments.

`src/lib/error-messages.ts`: dictionary + `errorMessage(key: string): string`.

Jest: DomainError has key; UnexpectedError wraps; unknown key → generic English.

**Definition of done:** `npm test` includes those cases. No UI yet.

---



## Step 2 — Logger context

Extend `logger.error` (and info if natural) to accept an optional context object
`{ useCase?: string; tenantId?: string }` appended to the line. Do not log secrets.
Jest not required if the helper is tiny; a small unit test on a format helper is welcome.

**Definition of done:** a call with `useCase` and `tenantId` writes those tokens into the
log line. Existing `logger.error("msg", error)` still works.

---



## Step 3 — `error.tsx` + `global-error.tsx`

Read local error.md. `retry`, not `reset`. Client Components. No Prisma, no logger import.
Friendly bilingual retry. No stack.

**Definition of done:** files exist; `npm test` still green. Cannot fully click a crash
without forcing one — visual check: no `error.message` in the JSX.

---



## Step 4 — Domain + known infra throws → `DomainError`

Replace `throw new Error("…")` in `domain/` and known infra (`Booking not found`, etc.) with
`new DomainError("…key")`. Update Jest. `whatsAppHref` → `notification.bad_phone`.

**Definition of done:** `npm test` green; no remaining domain/infra *product* English throws
in the catalog table (money/Zod edge per pins).

---



## Step 5 — Use cases wrap unexpected

Each mutating use case: rethrow `DomainError`; exclusion → domain key; else log with
`useCase` + tenant if safe, throw `UnexpectedError`. List/read use cases: same for
`Not allowed`. Do not log DomainError as bugs.

**Definition of done:** approve/create/cancel/collect/expense/public-request/login no longer
`throw error` raw in the catch-all.

---



## Step 6 — Thin actions + banners

Owner, login, public Server Actions: catch → `?error=<key>`; `redirect` outside try/catch.
Public request **must** get a try/catch (today it crashes). Pages print `errorMessage`.

**Definition of done:** ended slot on public → banner, not crash; owner slot taken → banner;
`logs/` has stack only when something unexpected is thrown (force by temporarily breaking only
if needed — prefer not). `staff` still cannot approve (domain banner or unchanged).

---



## Tests (Jest)

| Step | Jest |
| --- | --- |
| 1 Errors + dictionary | `test/lib/` |
| 2 Logger format | optional |
| 4 Domain keys | existing domain tests updated |
| 3, 5–6 | Click + ended-slot public form |

---



## Whole-slice acceptance

1. `npm test` green.
2. Public request on an ended hour → page banner, no crash overlay as the product UI.
3. Owner domain failure (e.g. cancel a pending id if reachable, or taken Book) → banner
   with dictionary English, still on `/owner`.
4. `error.tsx` does not render `error.message`.
5. Unexpected path: logger has stack + useCase; query is `error.generic` only.
6. Pages still have no Prisma / no `tenantId`. Payment still does not import Booking.

---



## Out of scope

- next-intl / RTL product UI
- `useActionState` / toasts
- Wrapping every Prisma call
- Changing cancel/waitlist/collect business rules
- Overpay warning

---



## After this slice

Arabic can consume the same keys. Optional Prisma wrap at infra. Then no-show / BR-71 as
product asks.

---



## Step order for the agent

One numbered step at a time. Wait for OK. Do not scaffold `shop/` or `academy/`.
Do not add next-intl “while we’re here.”
