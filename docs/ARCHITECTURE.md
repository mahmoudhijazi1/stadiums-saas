# Architecture

**Living.** Written 2026-10-01 from the code on `main` at `f3c3f93` (after PR #12). Every claim cites a file and function or a migration. **UNVERIFIED** marks a claim not traced to code. When code and an older doc disagree, the code wins and the gap is listed in [audits/doc-vs-code-discrepancies.md](./audits/doc-vs-code-discrepancies.md).

This document explains **why** the pieces are arranged this way and what must stay true. For folders, see [guides/folder-structure.md](./guides/folder-structure.md). For tables, see [DATA-MODEL.md](./DATA-MODEL.md). For money, see [domain/money.md](./domain/money.md).

---

## 1. Modules and allowed import directions

One Next.js app. Business logic lives in `src/modules/<context>/{domain,application,infrastructure,schemas}`, and `src/app/` stays thin (CLAUDE.md, "Non-negotiables").

**Current import graph between modules**, computed from `from "@/modules/..."` in `src/modules/*`:

| Module | Imports modules | Never imports |
|---|---|---|
| `access` | none | everything else |
| `notification` | none | everything else (`domain/whatsapp-link.ts` only) |
| `people` | access | booking, payment, venue |
| `venue` | access | booking (CLAUDE.md: "Venue never imports Booking") |
| `ledger` | access | payment, booking |
| `payment` | access, ledger | booking (CLAUDE.md: "Payment never imports Booking") |
| `expense` | access, ledger (period bounds), payment | booking, shop |
| `shop` | access, ledger (period bounds), payment, people | booking, expense (shop never imports booking: the use cases that put items on a game live in `booking`, which imports shop) |
| `booking` | access, notification, payment, people, shop, venue | platform, expense, ledger directly |
| `platform` | access | every tenant module (operator only) |

**The rule is that imports point down.** `booking` is the top business context, and `platform` is a sibling that only uses `access` (identifiers, password hashing and policy). Nothing in `src/modules` imports `platform`; only `scripts/platform-cli.ts` does.

**Known exceptions:**
- `src/lib/request-fields.ts` imports `@/modules/people/domain/phone` (`normalizePhone`), an upward `lib → modules` import. It is harmless (a pure function) but breaks the "lib has no module imports" idea.
- Modules and `lib` import `@/app/generated/prisma/*` (the generated client). That is not an `app/` dependency.

**`platformDb` import guard.** `platformDb` (`src/lib/platform-db.ts`) is the unscoped client: it bypasses the tenant extension. `test/platform-db-imports.test.ts` fails if any file outside its allowlist imports it:

| Allowed importer | Why |
|---|---|
| `src/lib/tenant-context.ts` (`loadTenant`) | Tenant by slug, one query per request |
| `src/app/manifest.ts` (`manifest`) | Tenant name by slug; the route is outside the proxy matcher |
| `src/modules/access/infrastructure/{sessions,users,tenants}.ts` | User and Session are global (DR-003); tenant settings by the server-resolved id |
| `src/lib/rate-limit.ts` | `RateLimit` is a global table |
| `scripts/set-password-core.ts` | Operator password reset |
| `src/modules/platform/**` | Operator use cases |

### How to add a module or an import safely
1. Draw the new edge in the table above. If it points up (for example `payment → booking`), stop: move the shared piece down instead, or pass data in from the caller.
2. A new `platformDb` importer is a security review item. Add it to `ALLOWED` in `test/platform-db-imports.test.ts` with a reason, or use the scoped `db` instead.
3. A new model with a `tenantId` must go into `TENANT_SCOPED_MODELS` or `PLATFORM_ONLY_MODELS` (`src/lib/db.ts`). `test/lib/model-classification.test.ts` fails otherwise.

---

## 2. Request flow

```
nginx (TLS, Host) ─► next start -H 127.0.0.1 (package.json "start")
  ─► src/proxy.ts proxy()           host check, drop x-tenant-slug, renew cookie
  ─► page / Server Action / route handler (src/app, thin)
  ─► use case (src/modules/*/application)
        getCurrentMembership() → can()        authorize BEFORE the transaction
        db.$transaction(tx => …)              the use case owns the transaction
          repositories (infrastructure) take tx
  ─► after commit: redirect with ?ok= / ?notify=, notify links built on the next GET
```

| Step | Code | What it guarantees | What it does NOT guarantee |
|---|---|---|---|
| 1. Host check | `src/proxy.ts` `proxy` → `src/lib/tenant-slug.ts` `resolveTenantFromHeaders` / `classifyHost` | A host other than the bare `APP_BASE_DOMAIN` or a one-label subdomain of it gets a 404 before any DB work. `X-Forwarded-Host` counts only with `TRUST_PROXY_HEADERS=true` (`hostOptionsFromEnv`). | That the tenant exists (the proxy never queries Postgres). The matcher skips static and image paths (`config.matcher`), so step 2 re-validates. |
| 2. Tenant resolution | `src/lib/tenant-context.ts` `loadTenant` (via `getCurrentTenant`, React `cache`) | The slug comes from the validated Host only. The client header `x-tenant-slug` is never read (the proxy deletes it). One `tenant.findUnique` per request. Unknown slug → `notFound()`. | Anything about the user. |
| 3. Suspension check | `CurrentTenant.suspended` from the same query; `getCurrentTenantId` throws `tenant.suspended` | No tenant-scoped query or raw-SQL stamp runs for a suspended tenant (the choke point). `getCurrentMembership` returns null first. Layouts and pages redirect to `/owner/suspended` or render `UnavailableNotice`. | A real HTTP 503: public pages answer 200 with noindex (ROADMAP, "Deferred on purpose"). |
| 4. Session | `src/proxy.ts` `renewSessionCookie` (cookie), `access/application/get-current-membership.ts` `getCurrentMembership` (DB) | The cookie token is looked up by SHA-256 (`findSessionByToken`). Expiry is checked, then renewed at most once a day (`renewedSessionExpiry`). The membership is looked up for the **URL** tenant. | That the user may do a given action: that is `can()`. |
| 5. Authorization | `access/domain/can.ts` `can` inside each use case | OWNER passes; STAFF passes only on flags that are exactly `true`. Checked before `$transaction`. | Row ownership: that is the tenant layer. |
| 6. Use case | `src/modules/*/application/*.ts` | Opens the only transaction. Maps unexpected errors (`rethrowUnexpected`). | — |
| 7. Repository | `src/modules/*/infrastructure/*.ts` | Takes `tx`. Tenant filter by the extension, or by `getCurrentTenantId()` in raw SQL. | — |

**Why the tenant comes from the URL and not the session:** one user can belong to several stadiums, and a cookie is host-only (`session-cookie-options.ts`, no `domain`). Reading the tenant from the URL and then checking membership means a stolen or reused cookie can never widen access across tenants (DR-001, DR-003).

---

## 3. The three tenancy layers

| Layer | Code | Does | Does NOT |
|---|---|---|---|
| **1. Tenant resolution** | `tenant-slug.ts` `classifyHost`, `tenant-context.ts` `loadTenant`, `getCurrentTenantId` | Picks exactly one tenant per request from the validated Host; refuses suspended tenants; parks the tenant in ALS for Prisma (`withCurrentTenant`) | Filter rows. Stop `platformDb` code. |
| **2. Prisma tenant extension** | `src/lib/db.ts` `scoped` (`$allModels.$allOperations`) | For `TENANT_SCOPED_MODELS`: stamps `tenantId` on `create*`; adds `where.tenantId` on `find*`/`count`/`aggregate`/`groupBy`/`updateMany`/`deleteMany`; pre-checks `update`/`delete`; post-checks `findUnique`. Refuses `PLATFORM_ONLY_MODELS` outright. | **Raw SQL** (`$queryRaw`/`$executeRaw`): each statement must filter by `getCurrentTenantId()` itself. **`upsert` and `updateManyAndReturn`** are not pre-guarded (they fall to the post-check). **`platformDb`**. Joined tables in raw SQL are reached by id only. |
| **3. Membership and permission** | `get-current-membership.ts`, `can.ts` | The acting user belongs to this tenant, with this role and these flags | Row-level ownership inside the tenant (all members see all tenant rows; DR-003). |

**Postgres RLS is not enabled** (DR-001 §3; audit §10 recommends it). Isolation therefore rests on layers 1 and 2 plus the discipline in raw SQL. The raw-SQL inventory (31 statements in `booking/infrastructure/bookings.ts` and `people/infrastructure/persons.ts` at audit time) and the cross-tenant probes are in [audits/security-audit.md](./audits/security-audit.md) §1.

**Risk in layer 2.** The `update`/`delete` pre-check runs `prismaBase.<model>.findFirst` **outside** any open transaction (`db.ts`, the branch for `op === "update" || op === "delete"`). Inside `db.$transaction`, that needs a second pool connection while the transaction holds one. The only call site today is `venue/infrastructure/pitches.ts` (`tx.pitch.update`, used by `updatePitch`). Two consequences:
- **Pool pressure:** it can wait on the pool. The size is `PG_POOL_MAX`, default 10, in `prisma-base.ts` `createPrismaBase`.
- **Visibility:** it cannot see a row created earlier in the same transaction.

Prefer `updateMany({ where: { id } })` (filtered by the extension) inside transactions.

### How to write tenant-safe raw SQL
1. Get `const tenantId = await getCurrentTenantId();` inside the repository function. Never take a tenant id from a parameter.
2. Put `"tenantId" = ${tenantId}` on the **driving** table of every statement. Add it on joined tables too when a join is not by a tenant-owned id.
3. Use tagged templates or `Prisma.join` only. Never `$queryRawUnsafe` or `Prisma.raw` with input.
4. Add a cross-tenant case to `test/integration/isolation.integration.test.ts` (or the suite for that use case).

---

## 4. Transaction ownership

- **Only the use case that starts an action calls `db.$transaction`.** Repositories take `tx: TenantTx` and never open one. Examples: `approve-booking.ts` `approveBooking`, `collect-booking-payment.ts` `collectBookingPayment`, `record-expense.ts` `recordExpense`.
- **Authorize before the transaction.** Every use case calls `getCurrentMembership()` and `can()` first (`approveBooking`, `cancelBooking`, `collectBookingPayment` …).
- **ALS before BEGIN.** `db.$transaction` is wrapped by `withCurrentTenant` (`db.ts`, bottom), so the tenant is loaded before the transaction opens and the extension reads it from memory. A nested `platformDb` query during an interactive transaction can deadlock on the one pool (`prisma-base.ts` comment; [guides/prisma-transaction-tenant-guard.md](./guides/prisma-transaction-tenant-guard.md)).
- **Platform tables** use their own transactions on `platformDb` (`platform/infrastructure/platform-store.ts` `platformTransaction`). They run in the CLI process and never inside a tenant request.
- **Rate-limit counters** (`lib/rate-limit.ts` `hitRateLimit`) are single autocommit statements, run **before** any tenant transaction (`request-public-slot.ts` `assertRequestRate`; `login.ts` `recordFailure`).

## 5. Notifications after commit

The server sends nothing. "Notifications" are `wa.me` links built by `notification/domain/whatsapp-link.ts` and shown to the owner, who taps them.
- They are built **after** commit, on a later request: the action redirects with `?notify=…&bookingId=…` (for example `submitCancelBooking` in `app/owner/(app)/today/actions.ts`). The page then calls `booking/application/load-decision-notify.ts` `loadDecisionNotify` / `load-outcome-notify.ts` `loadOutcomeNotify`, which read committed rows.
- Approve returns the auto-rejected people (`approveBooking` → `rejectOverlappingPending`) after the transaction. Nothing is sent inside it.
- A failure to build a link is logged and skipped (`loadDecisionNotify`, `"Decision WhatsApp link skipped"`). It never rolls anything back.

---

## 6. Lock order

**Resources:**
- **P**: the pitch row. Taken by `booking/infrastructure/bookings.ts` `lockPitchForUpdate` (`SELECT … FOR UPDATE`).
- **B**: one booking row. Taken by `findBookingForUpdate` (`FOR UPDATE`), or implicitly by `UPDATE … WHERE status = 'PENDING'` (`setPendingStatus`).
- **B\***: a set of booking rows. Taken by `lockPendingRowsInOrder` (`ORDER BY id FOR UPDATE`).
- **R**: a `RateLimit` row. Taken by `lib/rate-limit.ts` `hitRateLimit` (`INSERT … ON CONFLICT DO UPDATE`, autocommit).

| Use case (file, function) | Order taken | Notes |
|---|---|---|
| `request-public-slot.ts` `requestPublicSlot` | R(ip) → R(phone) **committed**, then tx: P | Each R is its own statement and never held. Inside the tx: insert Booking, participant, SlotInterest. |
| `create-owner-booking.ts` `createOwnerBooking` | P → insert B(new) → B\* (overlapping pending, via `rejectOverlappingPending`) | |
| `approve-booking.ts` `approveBooking` | P → B\* ({this request} ∪ overlapping pending, one statement, id order) → B\* again (subset, via `rejectOverlappingPending`) | The second lock set ⊆ the first (same query under P; new overlapping PENDING needs P). |
| `cancel-booking.ts` `cancelBooking` | P → B | |
| `record-no-show.ts` `recordNoShow` | P → B | |
| `dismiss-missed-requests.ts` `dismissMissedRequests` | B\* (missed pending, id order) | No P. |
| `reject-booking.ts` `rejectBooking` | B (implicit, `setPendingStatus` UPDATE) | Single row. |
| `collect-booking-payment.ts` `collectBookingPayment` | B | Then inserts Payment, tenders, ledger (new rows). |
| `collect-player-payment.ts` (`payRemaining` → `collectSlotPayment`, `collectAllRemaining`) | B | Then updates participants and allocations of **that** booking. |
| `adjust-booking-due.ts` `adjustBookingDue` | B | |
| `switch-collection-mode.ts` `switchToPerPlayer`, `switchToWhole` | B | Then replaces participants of that booking. |
| `venue/application/update-pitch.ts` `updatePitch` | P (implicit, `tx.pitch.update`) | Plus the pre-check read on another connection (§3). |
| `record-expense.ts` `recordExpense` | none (inserts only) | |
| `booking/application/add-booking-items.ts` `addBookingItems` | B → S (the booking row, then the sale row) | S is the payer's tab (the booker's for "on the game"); an existing one is locked (`lockSale`, `FOR UPDATE`) before lines are appended, a new one is ours alone. The booking due is never written. |
| `booking/application/remove-booking-item.ts` `removeBookingItem` | B → S | Reads the line before locking (lines are immutable), then B, then S, then re-reads the net quantity under S. |
| `shop/application/collect-tab-payment.ts` `collectTabPayment` | S only | A tab never touches the booking due, so it needs no B. It waits for an add or a removal on that tab and nothing else. |
| `shop/application/record-walk-in-sale.ts` `recordWalkInSale` | none, by design | One transaction that only inserts rows it creates (Sale, SaleItem, Payment, tenders, ledger) and reads Product/ExchangeRate without locking. No pitch or booking row is touched, so it cannot join a wait cycle. If a later slice puts items on a game, it takes **B** first like the other money paths. |
| `login.ts` `login` | R (account/IP failures and blocks, autocommit) | No transaction. |
| Platform: `suspendTenant`, `resumeTenant` | the Tenant row (`updateMany`, a no-key update) | Own process and pool. |

**Why no cycle exists:**
1. **P is always first.** No path takes P after holding any B, so no transaction can hold B and wait for P.
2. **B\* is one ordered statement.** Every multi-row booking lock is a single `ORDER BY id FOR UPDATE`, so any two multi-row lockers ask for their common rows in the same order.
3. **Single-B paths wait for nothing after B.** Collect, adjust, switch and reject lock one row and then only write new rows or child rows of that booking. No other path locks those child rows first: participants and allocations are only changed under their booking's lock.
4. **R is never held.** Each rate-limit upsert commits on its own, before any transaction, so it cannot be part of a wait cycle.
5. **Tenant-row updates don't conflict.** The platform's tenant-row update (`suspendedAt`, a non-key column) takes `FOR NO KEY UPDATE`, which does not conflict with the `FOR KEY SHARE` that foreign-key checks take on `Tenant`.

**Foreign-key locks:**
- Inserting a Booking or SlotInterest takes `FOR KEY SHARE` on its Pitch. That conflicts with another transaction's P (`FOR UPDATE`).
- Every Booking insert (`createOwnerBooking`, `requestPublicSlot`) already holds its own P, and SlotInterest inserts happen under P (`rejectOverlappingPending`, `requestPublicSlot`). So they wait only on P, in the same P-first order.

**What is not proven:**
- The claim that `ORDER BY id FOR UPDATE` locks rows in id order relies on Postgres placing its row-locking step above the sort for this query shape (no `LIMIT`). **UNVERIFIED** by a Postgres-internals reference here. It is exercised by `test/integration/pending-races.integration.test.ts` (dismiss vs "They played") and `money-races.integration.test.ts`.
- `updatePitch` versus a concurrent P holder: `updatePitch` takes P implicitly and nothing else, so it cannot form a cycle. Its pre-check connection wait (§3) is a **pool** wait, not a lock wait. **UNVERIFIED** under load.

### How to add a use case that locks safely
1. If it touches a pitch's schedule or bookings as a set, take **P first** (`lockPitchForUpdate`), in the same transaction, before any booking read you rely on.
2. Lock several bookings **only** through `lockPendingRowsInOrder` (or an equivalent single `ORDER BY id FOR UPDATE`). Never lock them in a loop.
3. Lock a single booking with `findBookingForUpdate` and re-read its state after the lock (stale reads before the lock caused real bugs; see progress.md "Booking row lock on every money path").
4. Never call `hitRateLimit` or any `platformDb` query inside a tenant transaction.
5. Add the row to the table above, and add a race test to `test/integration/*-races.integration.test.ts`.
