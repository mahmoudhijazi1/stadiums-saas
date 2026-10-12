# Key files

**Purpose:** the 15 files where a mistake would break money, bookings, tenant isolation or login, each explained in plain language with the invariant it protects and the tests that prove it.
**Read when:** you are about to change one of these files, or want to know what must never break.
**Last verified:** `f01c9bf` (code on main; this file adds no code).

How to read an entry: **Does** (what), **Why** (the problem it prevents), **Used by** (what it depends on and who calls it), **Never change without** (the invariant, and the tests). Test paths are under `test/`; "integration" tests need the Docker Postgres (`npm run test:integration`). Not listed on purpose: `booking/domain/series.ts` (weekly series; its tests are `modules/booking/domain/series.test.ts` and `integration/weekly-series.integration.test.ts`). Importer counts come from `grep` on `src/` and are approximate.

## Tenant isolation and login

### 1. `src/proxy.ts`
- **Does:** runs before every page; rejects a bad host with 404, deletes any client-sent `x-tenant-slug`, and renews the session cookie (GET only, at most once a day).
- **Why:** stops a request for a made-up host from reaching the database, and stops a client choosing its own tenant with a header.
- **Used by:** Next.js itself (the file is `proxy.ts` per the Next 16 rename); it uses `lib/tenant-slug.ts` and the session cookie helpers.
- **Never change without:** only the bare `APP_BASE_DOMAIN` or a one-label subdomain is served; nothing reads `x-tenant-slug`; `/platform` (the platform admin, DR-006) is served only on exactly the bare host and, in production, only over https (404 anywhere else), with `noindex` and `no-store`, and never renews the owner cookie. Tests: `proxy.test.ts`, `lib/tenant-slug.test.ts`, `integration/host-tenant.integration.test.ts`, `integration/rolling-session.integration.test.ts`.

### 2. `src/lib/tenant-context.ts`
- **Does:** finds the current stadium from the validated Host, caches it for the request (`getCurrentTenant`), hands out its id (`getCurrentTenantId`) and runs code with the tenant stored for Prisma (`withCurrentTenant`).
- **Why:** the URL, not the session, decides the tenant; and a suspended stadium must not be readable or writable anywhere.
- **Used by:** about 80 files (every page and use case); it calls `platformDb` once per request, and `lib/db.ts` reads the stored id.
- **Never change without:** `getCurrentTenantId` is the single choke point that throws `tenant.suspended`; the tenant id never comes from input or the session. Tests: `integration/suspension.integration.test.ts`, `integration/host-tenant.integration.test.ts`, `integration/isolation.integration.test.ts`.

### 3. `src/lib/db.ts` (the tenant extension)
- **Does:** the Prisma client for stadium data: adds `tenantId` to every read and write of the tenant-owned models, refuses platform-only models, and loads the tenant before `$transaction` begins.
- **Why:** it is the main wall between one stadium's data and another's (Postgres row-level security is not enabled, `docs/ARCHITECTURE.md` §3).
- **Used by:** about 80 use cases and repositories; it reads the tenant from `tenant-context`. Raw SQL is not covered by it, so raw statements must stamp `tenantId` themselves.
- **Never change without:** a new model with a `tenantId` goes into `TENANT_SCOPED_MODELS` or `PLATFORM_ONLY_MODELS`; nothing passes `tenantId` by hand. Tests: `lib/model-classification.test.ts`, `integration/isolation.integration.test.ts`, `integration/tenant-guard-tx.integration.test.ts`.

### 4. `src/lib/platform-db.ts`
- **Does:** the same database connection without the tenant filter (`platformDb`).
- **Why:** a few tables are global (users, sessions, tenants, rate limits) and the tenant lookup itself cannot be tenant-filtered.
- **Used by:** only the files in the allowlist (tenant-context, rate-limit, the access `sessions`, `users` and `tenants` repositories, the manifest route, `scripts/set-password-core.ts`, `modules/platform/**`).
- **Never change without:** never query it inside a tenant `$transaction` (one pool: it can deadlock), and a new importer is a security review. Tests: `platform-db-imports.test.ts` (the allowlist), `integration/platform-tables.integration.test.ts`.

### 5. `src/modules/access/domain/can.ts`
- **Does:** answers "may this member do this action on this stadium" (`can(membership, permission)`).
- **Why:** one place decides permissions: owner always yes, staff only on flags that are exactly `true`, and never for owner-only actions (`shop.manage`).
- **Used by:** about 60 files (use cases check it before the transaction; pages hide what a member may not do).
- **Never change without:** a staff flag must be strictly `true`, and an owner-only permission is never granted to staff. Tests: `modules/access/domain/can.test.ts`, `integration/staff-permissions.integration.test.ts`, `integration/staff-money-gating.integration.test.ts`.

### 6. Login and session: `src/modules/access/application/login.ts` and `get-current-membership.ts`
- **Does:** `login` checks the tenant, then the password, then membership on this stadium, and sets the cookie; `getCurrentMembership` turns the cookie into a membership for the URL's stadium (or null).
- **Why:** the same error for an unknown user, a wrong password or no membership here (no hints), brute force is blocked, and a cookie from one stadium never works on another.
- **Used by:** the login Server Action and every owner page and use case; depends on `lib/rate-limit.ts`, the access repositories (`sessions`, `users`, `memberships`) and `tenant-context`.
- **Never change without:** the tenant is never read from the session; 8 failures in 15 minutes block the account for 15 minutes; session tokens are stored hashed. Tests: `integration/auth-sessions.integration.test.ts`, `integration/login-rate-limit.integration.test.ts`, `integration/login-timing.integration.test.ts`, `integration/rolling-session.integration.test.ts`, `modules/access/domain/session-lifetime.test.ts`.

### 7. `src/lib/rate-limit.ts`
- **Does:** counts hits per key in a Postgres table with one atomic upsert (`hitRateLimit`) and sweeps old rows.
- **Why:** limits logins and public booking requests without losing counts when requests race.
- **Used by:** `login.ts`, `own-credentials.ts`, `request-public-slot.ts`, and the push `notify-new-request` and `send-test-push` use cases.
- **Never change without:** it is global (put the account, IP or tenant in the key) and never runs inside a tenant transaction. Tests: `integration/login-rate-limit.integration.test.ts`, `integration/rate-limit-sweep.integration.test.ts`, `integration/public-limits.integration.test.ts`.

## Bookings

### 8. `src/prisma/migrations/20260909080800_booking_approved_exclusion/migration.sql`
- **Does:** adds the Postgres exclusion constraint `Booking_approved_during_excl`: two APPROVED bookings on the same pitch cannot overlap in time.
- **Why:** double booking must be impossible even when two requests race; application code alone cannot guarantee it. Prisma cannot express it, so it is hand-written SQL.
- **Used by:** every insert of an APPROVED booking (`insertApprovedOwnerBooking`, the approve use case); it needs the `btree_gist` extension.
- **Never change without:** never remove it or model it in the schema DSL; only APPROVED rows are excluded (PENDING may overlap on purpose). Tests: `modules/booking/domain/exclusion.integration.test.ts`, `modules/booking/application/approve-booking.integration.test.ts`.

### 9. `src/modules/booking/infrastructure/bookings/` (was one file, `bookings.ts`)
- **Does:** the raw SQL for bookings, split by topic and re-exported from `index.ts` (importers still use `@/modules/booking/infrastructure/bookings`): `create.ts` (inserts; the `during` time range cannot be written by the Prisma client), `locks.ts` (`lockPitchForUpdate`, `findBookingForUpdate`, `lockPendingRowsInOrder`), `pending.ts`, `single.ts`, `status.ts`, `due.ts`, `day.ts`, `owed.ts`, `per-player.ts` and the rest.
- **Why:** it is where overlap, locks and `tenantId` stamping happen; the Prisma extension does not stamp raw SQL.
- **Used by:** the booking use cases (UNVERIFIED: the exact number of importers). Read `locks.ts` first: its top comment points to the lock-order table in `docs/ARCHITECTURE.md` section 6.
- **Never change without:** every statement carries `"tenantId" = ${tenantId}` from `getCurrentTenantId()`; pitch lock first, then booking rows. Tests: `integration/isolation.integration.test.ts`, `integration/pending-races.integration.test.ts`, `integration/money-races.integration.test.ts`, `integration/booking-money.integration.test.ts`.

### 10. `src/modules/booking/application/approve-booking.ts`
- **Does:** confirms a PENDING request; overlapping PENDING requests on that pitch become REJECTED and are recorded as interests in the approved window.
- **Why:** the owner's yes must win a race with other requests without a deadlock or a double booking.
- **Used by:** the approve Server Action (`app/owner/(app)/today/actions.ts`); it uses `can`, the pitch lock and the exclusion constraint.
- **Never change without:** authorize before the transaction; lock the pitch first, then the booking rows in one ordered statement. Tests: `integration/pending-races.integration.test.ts`, `modules/booking/application/approve-booking.integration.test.ts`, `integration/staff-permissions.integration.test.ts`.

### 11. `src/modules/booking/application/request-public-slot.ts`
- **Does:** a player's name-and-phone request becomes a PENDING booking with the price taken from the pitch, not from the form.
- **Why:** it is the only door open to the public, so it limits abuse (5 requests per phone and 60 per IP per hour, 3 future pending per phone) and never double-books an approved hour.
- **Used by:** the public request action `app/(public)/request-slot.ts`; it uses `rate-limit` (before the transaction) and the pitch lock.
- **Never change without:** counters are hit before the transaction; a taken hour creates no PENDING row (it records an interest and fails with `booking.slot_taken`). Tests: `integration/public-limits.integration.test.ts`, `integration/public-window.integration.test.ts`, `integration/requested-name.integration.test.ts`, `integration/slot-pages.integration.test.ts`.

### 12. `src/modules/booking/application/create-owner-booking.ts`
- **Does:** the owner's phone-call booking: APPROVED at once, price from the pitch, overlapping public pending requests rejected.
- **Why:** it must be as safe as approve (same lock order) while staying faster than paper (RULE-12).
- **Used by:** the owner Book action (`app/owner/(app)/book/actions.ts`; UNVERIFIED: other callers); it does not collect money.
- **Never change without:** authorize before the transaction; take the pitch lock before inserting. Tests: `modules/booking/domain/exclusion.integration.test.ts`, `integration/booking-money.integration.test.ts`, `integration/midnight.integration.test.ts`, `integration/money-races.integration.test.ts`.

### 13. `src/modules/venue/domain/availability.ts`
- **Does:** computes which slots a pitch has on a day from its hours and rules (nothing is stored), including games that cross midnight, price rules and day boundaries in a given time zone.
- **Why:** what the owner and the public see as free must be exactly what can be booked.
- **Used by:** about 30 files (public page, Book, Today strip, booking use cases); pure functions, no database.
- **Never change without:** a slot after midnight belongs to the weekday of the window it came from; ended or in-progress hours are not bookable. Tests: `modules/venue/domain/availability.test.ts`, `integration/midnight.integration.test.ts`, `integration/day-start-setting.integration.test.ts`.

## Money

### 14. `src/modules/payment/application/record-payment.ts`
- **Does:** writes one payment, its tenders (what was handed over, in each currency) and its ledger row in the transaction it is given.
- **Why:** the ledger must never disagree with the payments: both are written together or not at all.
- **Used by:** `collect-booking-payment.ts`, `collect-player-payment.ts`, `record-expense.ts` and the shop use cases `record-walk-in-sale.ts` and `collect-tab-payment.ts`; freezing tenders to USD is `payment/domain/collect.ts`.
- **Never change without:** it never opens a transaction; payments, tenders and ledger entries are append-only, amounts are `Decimal`, the ledger is USD, and LBP is converted at the rate frozen when taken. Tests: `modules/payment/domain/collect.test.ts`, `integration/booking-money.integration.test.ts`, `integration/money-races.integration.test.ts`, `integration/expense-ledger.integration.test.ts` (shared checks in `integration/invariants.ts`).

### 15. `src/modules/shop/domain/pricing.ts`
- **Does:** prices shop items in USD or LBP, freezes each line's USD value when it is added, and settles a sale or tab with `applyPayment`: pounds against pound lines first, dollars against dollar lines, the rest is change.
- **Why:** a two-currency counter must never record more or less than is owed, and a later rate change must not change what was owed.
- **Used by:** the shop and booking-item use cases (`record-walk-in-sale`, `collect-tab-payment`, `add-booking-items`, `remove-booking-item`, `list-booking-items`, `sale-state`); pure, no database.
- **Never change without:** a fully paid sale records exactly its frozen USD; an LBP line needs the rate when added and a removal reverses at the rate it was added at. Tests: `modules/shop/pricing.test.ts`, `integration/shop-lbp.integration.test.ts`, `integration/shop-money.integration.test.ts`, `integration/shop-change.integration.test.ts`.
