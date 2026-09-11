# DR-004 — Error handling: logs for us, calm screens for the owner

**Status:** Accepted
**Date:** 2026-09-12
**Depends on:** DR-001 §5 (notifications after commit; money/booking writes roll back together),
BRD RULE-9 / RULE-10, G-1.

## Why this exists

The owner is not technical and is often in a hurry. He must never see a raw error, a stack
trace, or a blank/broken screen. RULE-9 / RULE-10 apply here: an error must not stop him
finishing the job unless it is truly impossible to continue.

The developer **does** need the full story: timestamp, tenant, use case, original error and
stack, in `logs/` via the existing logger.

## Two kinds of error (always distinguish)

1. **Expected / domain** — normal product outcomes: slot taken, invalid phone, nothing due,
   not allowed. These are not bugs.
2. **Unexpected** — bugs, DB down, programmer mistakes, raw Prisma. These **are** bugs. Log
   everything. The owner gets one generic line.

A raw thrown string or an unwrapped Prisma error must not reach `app/` or the browser.

## Typed errors (`src/lib/errors.ts`)

- `DomainError` — expected. Carries a **message key** (e.g. `"booking.slot_taken"`), not a
  hardcoded UI sentence at the throw site.
- `UnexpectedError` — wraps `unknown`. No details for the client. Always logged.

English (and later Arabic) copy lives in a small dictionary keyed by those keys
(`src/lib/error-messages.ts`). **next-intl stays out of this slice.** Keys are the seam.

Domain functions and use cases throw `DomainError`. Known “not found” from infrastructure
(e.g. `updateMany` count 0) is also `DomainError`. A driver/Prisma dump is **not** — the use
case catch-all wraps it as `UnexpectedError` and logs. This slice does **not** wrap every
Prisma call in infrastructure (too large; additive later).

## Server Actions never throw uncaught

`redirect()` still sits **outside** try/catch (Next redirect.md: `redirect` throws). Every
other failure is caught:

- `DomainError` → redirect with `?error=<key>` (keep `tenant` / other query). No log unless
  we want info-level; default: no error log (not a bug).
- `ZodError` → `?error=form.invalid`.
- Anything else → `logger.error` with use-case name + tenant if known + stack; redirect
  `?error=error.generic`.

Do **not** put the original message or stack in the query string.

Pages map the key through the English dictionary. Unknown keys and legacy `error=1` show the
generic line. Recoverable domain failures stay **on the same page** (inline banner), not a
crash.

`useActionState` + client forms are **not** this slice. Redirect + key is enough while pages
stay Server Components. A later slice may return `{ ok, messageKey }` once forms go client.

## Logging

Keep `src/lib/logger.ts` (file under `logs/`, also stdout). Extend it so unexpected logs can
include **useCase** and **tenantId** when the caller has them. Never log secrets (already the
rule). One logger — no ad-hoc `console.log` of errors in `app/` or modules.

`error.tsx` is a Client Component (Next error.js docs). It **must not** import the file
logger. Unexpected render failures are logged on the server (digest). The boundary shows a
friendly retry screen only.

## UI never shows a blank crash as the product UI

- `src/app/error.tsx` — Client Component. Props: `error`, **`retry`** (this Next version;
  not `reset`). Friendly English + Arabic on **this screen only** (hardcoded; not the i18n
  product). Do not render `error.message` (dev leak). Optional small `error.digest` so a
  log line can be matched. Button calls `retry()`.
- `src/app/global-error.tsx` — same idea; must include `<html>` and `<body>` (replaces the
  root layout).

## Side effects vs money (DR-001 §5)

Notification prep / WhatsApp link failures must not roll back a committed booking or
payment. Log them. Ledger + exclusion writes stay inside `$transaction` and fail the whole
transaction if they fail — a silent money error is worse than a blocked collect.

## Rejected alternatives

- **Throw English strings forever** — cannot swap locale; actions already special-case
  message text.
- **useActionState on every form this slice** — correct Next pattern for expected errors,
  but it forces Client Components on every owner form. Deferred.
- **Wrap every Prisma call now** — additive later; use-case catch-all is the boundary today.

## What later slices add

- next-intl: dictionary becomes locale files; keys stay.
- Optional: infrastructure Prisma → `UnexpectedError` at each query.
- `useActionState` when a form needs inline field errors without redirect.
