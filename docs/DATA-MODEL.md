# Data model

**Living.** Written 2026-10-01 from `src/prisma/schema.prisma` and `src/prisma/migrations/*` on `main` at `f3c3f93`. **UNVERIFIED** marks a claim not traced to code or a migration. Money semantics are in [domain/money.md](./domain/money.md); request flow and locks are in [ARCHITECTURE.md](./ARCHITECTURE.md).

**Read this before any migration.** Several guarantees live **only** in migration SQL (§3). `prisma migrate dev` against an edited schema will not recreate them, and a careless `db push` would silently drop them. Migrations in this repo are written by hand and checked with `prisma migrate diff` against `stadiums_test` (progress.md entries from 2026-09-30 on).

---

## 1. Tables

**Legend:**
- **T** = tenant-scoped: in `TENANT_SCOPED_MODELS` (`src/lib/db.ts`). The extension filters and stamps `tenantId`.
- **P** = platform-only: in `PLATFORM_ONLY_MODELS`. The scoped client refuses it.
- **G** = global, no `tenantId`.

### Tenancy and access
| Table | Kind | What a row is | Columns that need explaining |
|---|---|---|---|
| `Tenant` | G (root) | One stadium business. `slug` is its subdomain. | `settings` jsonb, parsed by `lib/tenant-settings.ts` `parseTenantSettings` (Zod defaults from `{}`). `suspendedAt` null = active (`tenant-context.ts` `loadTenant` → `suspended`). `suspendedReason` is operator-only and never shown. Slug is immutable (RUNBOOK, "Slugs"). **Stadium info** lives in `settings` (no migration): `address` (max 120), `mapLink` (https, one of the Google Maps hosts in `lib/map-link.ts`), `phone` and `whatsapp` (digits, Lebanese numbers, `lib/lebanon-phone.ts`), `whatsappSame` (boolean, default true) and `brandPreset` (a KEY of `lib/brand-presets.ts`, never a colour). Every read re-checks them: a stored value that fails reads as "not set" / the default preset. The display name stays `Tenant.name`, changed only by `platform/application/stadium-info.ts` (audited as `tenant.rename`). |
| `User` | G | A login account. | `identifier` = `local@tenant-slug` (`access/domain/identifier.ts` `parseLoginIdentifier`), unique. `passwordHash` = `scrypt:cost:r:p:salt:hex`, or legacy `salt:hex` (`access/infrastructure/password.ts` `hashPassword`, `parse`). |
| `Membership` | T | A user may work at this stadium. | `role` OWNER / STAFF; `permissions` jsonb flags, read by `access/domain/can.ts` `can` (STAFF: a flag must be exactly `true`). Unique `(tenantId, userId)`. |
| `Session` | G | A logged-in browser. | `tokenHash` = SHA-256 of the cookie token (`access/infrastructure/session-token.ts`), unique. `expiresAt` rolling 30 days (`access/domain/session-lifetime.ts`). `id` is a cuid and never leaves the server. |
| `UserPersonLink` | T | Account ↔ person (SELF / GUARDIAN). | No code writes it. **UNVERIFIED** that anything reads it (no call site found by grep). |
| `PushSubscription` | T | One browser on one device that may get owner alerts (web push). | `sessionId` → `Session` **ON DELETE CASCADE**: logout, log out other devices, password change and expiry clean-up remove the device. `endpoint` is globally UNIQUE (one browser belongs to one user and tenant at a time; a new login on the same phone takes it over). `p256dh`, `auth` = the browser's keys (base64url). `locale` ar/en for the payload language. Written by a raw `ON CONFLICT (endpoint)` upsert in `push/infrastructure/subscriptions.ts` (tenantId stamped from the tenant context); at most 10 per user per tenant. Migration `20261011090000_push_subscriptions`. See [push-notifications.md](./push-notifications.md). |
| `RateLimit` | G | One counter per key. | `key` carries account, IP or tenant (`booking/domain/public-request-limits.ts`, `access/domain/login-limits.ts`). `windowStart` + `count`, written only by `lib/rate-limit.ts` `hitRateLimit` (atomic upsert). |
| `Subscription` | P | One plan record. The latest by `createdAt` is current. | `plan` is a label only. `paidUntil` is informational (OVERDUE in `platform/application/list-tenants.ts`). `recordedBy` = actor string. Append-only (trigger). |
| `PlatformAuditLog` | P | One mutating platform command. | `actor` as given (`cli:user@host`); `detail` jsonb, never a password (`platform/application/*`). Append-only (trigger). |

### Venue and people
| Table | Kind | What a row is | Columns that need explaining |
|---|---|---|---|
| `Pitch` | T | A field. | `scheduleConfig` jsonb (hours, slot length, gaps, price rules), parsed by `venue/schemas/schedule-config.ts` `parseScheduleConfig` before every use. A corrupt row is logged and throws (`update-pitch.ts`, `get-day-availability.ts`). `defaultPlayerCount` is 1–30 (CHECK). |
| `Person` | T | Name + phone at **one** stadium (the same phone at two stadiums = two rows). | `phone` digits only (`people/domain/phone.ts` `normalizePhone`), nullable, unique per tenant when set (partial unique). `name` cleaned by `people/domain/clean-person-name.ts`. `searchName` = `normalizeName(name)`, the Arabic/Latin fold used by search. |

### Bookings
| Table | Kind | What a row is | Columns that need explaining |
|---|---|---|---|
| `Booking` | T | A pitch + a UTC window. | `during` is a `tstzrange` `[start,end)`: `Unsupported` in Prisma, read and written only in raw SQL (`booking/infrastructure/bookings.ts`). `status` PENDING / APPROVED / REJECTED / CANCELLED / NO_SHOW. `source` OWNER / PUBLIC. `priceUsd` is the price snapshot at request time. `amountDueUsd` is what is collectible now (changes through due changes; see money.md). `collectionMode` WHOLE / PER_PLAYER. `requestedName` is the typed name when it differs from the Person name (S-6). |
| `BookingSeries` | T | A weekly recurring booking: only the **link** between ordinary bookings. Every occurrence is a real APPROVED, owner-created `Booking` made up front (`Booking.seriesId`, nullable, FK RESTRICT, indexed); there is no job and there are no virtual bookings. | `anchorDate` (DATE) + `anchorTime` ("HH:mm") = week 0 in Asia/Beirut; week k starts at that wall-clock time on anchorDate + 7k calendar days, converted to UTC for that day (`booking/domain/series.ts` `seriesOccurrences`), so a clock change keeps the local time. `durationMinutes` > 0 (CHECK). `personId` is the booker, `createdByMembershipId` who made it. Migration `20261013090000_booking_series`. How many weeks are left is derived (APPROVED games in the future), never stored. |
| `BookingParticipant` | T | Who is on a booking. | `isRequester` (at most one per booking; the requester must have a person). `personId` null = an unnamed per-player slot. `slotNumber` 1…n in PER_PLAYER, null in WHOLE. `amountDueUsd` = that slot's share (PER_PLAYER). In WHOLE it is set on create and collapse but **not** kept equal on due changes (`write-due-change.ts` only calls `setBookingAmountDue`); WHOLE reads never use it (`person-owed.ts` `personOwedOnBooking`). |
| `SlotInterest` | T | "Tell me if this hour frees up": a person waiting on an **approved** window. | `during` is the approved window, not the rejected request's. One per (pitch, window, person) by code (`hasSlotInterest` under the pitch lock); no DB constraint. |
| `BookingDueChange` | T | One change of `Booking.amountDueUsd`. | `fromUsd`/`toUsd` ≥ 0 (CHECK); `reason` enum (`BookingDueReason`: the fee and adjust reasons, `SHOP_ITEMS` unused, and `EXTENSION` = 30 minutes added to a confirmed game, migration `20261012090000_extension_due_reason`; its `note` holds the old and new time range, "18:00-19:00 → 18:00-19:30"); `actorMembershipId`. Append-only **by convention only** (no trigger). |

### Shop
| Table | Kind | What a row is | Columns that need explaining |
|---|---|---|---|
| `Product` | T | An item the stadium sells (Cola, Chips). | `priceCurrency` USD / LBP says which currency the price tag is in: a USD item has `priceUsd` (Decimal 12,2), an LBP item has `priceLbp` (BigInt, whole pounds), exactly one of them (CHECK `Product_price_by_currency`). The **current** price only. Never deleted: `archivedAt` hides it from selling and keeps it on past sales. Names are not unique. |
| `Sale` | T | One counter sale, or the shop items put on one game. | No stored total: it is the sum of its lines. `bookingId` (real FK, RESTRICT) set = items on a game, always a **player's tab**: `payerPersonId` (FK RESTRICT) or `payerName` + optional `payerPhone` when there is no person (CHECK: a sale on a booking names a payer, a payer needs a booking). One tab per booking and payer; paid through its own SALE payments, never part of the booking or a slot due. "On the game (booker)" is just the tab of the booking's requester. `createdByMembershipId` = who sold. Insert-only **by code only**: no trigger. |
| `SaleItem` | T | One line of a sale. | `unitPriceUsd` is **frozen** at sale time, so a later price edit never changes a past sale. A USD item: `lineTotalUsd = qty * unitPriceUsd` (CHECK). An LBP item also keeps `unitPriceLbp`, `lineTotalLbp = qty * unitPriceLbp` (CHECK) and `rateAtTime`, the rate its USD value was frozen at: `lineTotalUsd` is the conversion of the whole line (shared tender conversion, half-up), so it is not qty x a rounded unit; a removal's line carries the difference so the lines of one item always add up to the conversion of the pounds that remain. A removal is a second line with a **negative** `qty` and `reversesItemId` naming the line it undoes (CHECK: negative exactly when it reverses; a trigger checks same sale, item and price and that the net never goes below zero). `addedAt` is when the line was added: the Shop card counts by it. Insert-only by code only. |
| `SaleAllocation` | T | How much of a sale's LBP part and USD part one payment settled. | One insert-only row per payment on a sale (`paymentId` unique, no FK: Payment does not know its sources). What a sale or tab still owes in pounds is the sum of its LBP lines minus the sum of `lbpApplied` (likewise dollars with `usdApplied`), so a rate change never changes the pounds owed. |

### Money
| Table | Kind | What a row is | Columns that need explaining |
|---|---|---|---|
| `ExchangeRate` | T | One LBP-per-USD rate. The latest by `createdAt` is current. | Append-only by convention (`payment/infrastructure/rates.ts` only inserts). |
| `Payment` | T | One collection or expense payment. | Polymorphic `sourceType` BOOKING / EXPENSE / SALE + `sourceId` (no FK). `amountDueUsd` = the booking due at collect time, or the expense total. |
| `PaymentTender` | T | One cash part of a payment. | `currency` USD / LBP; `amount` in that currency; `rateAtTime` frozen (null for USD when no rate existed); `usdEquivalent` rounded to cents, half-up. |
| `PaymentAllocation` | T | USD from one payment credited to one participant (PER_PLAYER). | `amountUsd` > 0 (CHECK); unique `(paymentId, participantId)`. Deleted on cancel/no-show collapse (`bookings.ts` `collapseToWhole`). |
| `LedgerEntry` | T | USD movement IN (collect) or OUT (expense). | Linked to its source by `sourceType`+`sourceId`, **not** `paymentId` (F-2). `occurredAt` = collect time, or the expense's business date. Append-only by convention. |
| `Expense` | T | What was spent. | No amount column: the money is a Payment with `sourceType` EXPENSE (`record-expense.ts`). |

---

## 2. Enums
`BookingStatus`, `BookingSource`, `CollectionMode`, `BookingDueReason` (8 values; `SHOP_ITEMS` is **unused**: slice 2 wrote it for items added to the booking due, the next change made "on the game" the booker's tab, and Postgres cannot drop an enum value, so it stays; which path writes which of the others is in `booking/domain/suggest-fee.ts` and money.md), `MembershipRole`, `PersonLinkRelation`, `ExpenseCategory`, `PaymentSourceType`, `Currency`, `LedgerDirection`. All are in `schema.prisma`.

---

## 3. What only the migrations contain

| # | Guarantee | Migration | Depends on it (code) | If it were lost |
|---|---|---|---|---|
| 1 | **Exclusion** `Booking_approved_during_excl`: no two APPROVED bookings on one pitch overlap (`EXCLUDE USING gist ("pitchId" WITH =, during WITH &&) WHERE status = 'APPROVED'`), plus `CREATE EXTENSION btree_gist` | `20260909080800_booking_approved_exclusion` | `approve-booking.ts` and `create-owner-booking.ts` catch it via `booking/domain/exclusion.ts` `isExclusionViolation` (SQLSTATE 23P01, walked through the adapter's cause chain). The pitch lock normally prevents reaching it; the constraint is the last wall. | Double-booked hours under a race, silently. |
| 2 | **Expression index** `Booking_tenantId_lower_during_idx` on `("tenantId", lower(during))` | `20260924030000_booking_start_day_index` | Every raw query filtering or sorting by `lower(b.during)`: day views, the pending inbox, the future-pending count (`bookings.ts`, 36 uses of `lower(during)`). | Slow day and inbox queries (no wrong results). |
| 3 | **Partial unique** `Person_tenantId_phone_key` on `(tenantId, phone) WHERE phone IS NOT NULL` | `20260924060000_per_player_foundation` (replaces the full unique from `…080100_person_booking`) | `people/application/find-or-create-person.ts` `findOrCreatePerson` (one person per phone per stadium). | Duplicate people per phone; debt warnings and history split. |
| 4 | **Partial unique** `BookingParticipant_one_requester_idx` on `(bookingId) WHERE isRequester` | `…060000_per_player_foundation` | `findRequesterPersonId`, `personOwedOnBooking` (WHOLE puts the remaining on the single requester). | Two requesters: debt shown on the wrong person. |
| 5 | **Partial unique** `BookingParticipant_bookingId_slotNumber_not_null_key` on `(bookingId, slotNumber) WHERE slotNumber IS NOT NULL` | `…060000_per_player_foundation` | `bookings.ts` `applyPerPlayerSlots` (slot numbers 1…n), `planSlotCharge` (slot order). | Duplicate slot numbers; charge order undefined. |
| 6 | **CHECK** `Booking_amountDueUsd_nonneg` (`amountDueUsd >= 0`) | `…060000_per_player_foundation` | `booking/domain/adjust-due.ts` `assertAdjustDue` also refuses negatives; the DB is the backstop. | — |
| 7 | **CHECK** `BookingParticipant_requester_has_person` (`isRequester = false OR personId IS NOT NULL`) | `…060000_per_player_foundation` | Every reader of the requester. | Requester without a person: debt warnings break. |
| 8 | **CHECK** `BookingParticipant_amountDueUsd_nonneg` | `…060000_per_player_foundation` | `split-evenly.ts` `splitEvenly` never produces negatives; the DB backstops. | — |
| 9 | **CHECK** `PaymentAllocation_amountUsd_positive` (`amountUsd > 0`) and unique `(paymentId, participantId)` | `…060000_per_player_foundation` | `slot-charge.ts` `planSlotCharge` (never emits a zero allocation); `payment/infrastructure/payments.ts` `insertAllocations`. | Zero or duplicate credits. |
| 10 | **CHECK** `BookingDueChange_usd_nonneg`, plus a backfill of CANCELLED dues | `20260924080000_booking_due_change` | `write-due-change.ts` `writeDueIfChanged`. | — |
| 11 | **CHECK** `Pitch_defaultPlayerCount_range` (1–30) | `20260929120000_pitch_default_player_count` | `venue/schemas/pitch-draft.ts` (the form), `switchToPerPlayer` default count. | — |
| 12 | **Backfill** of `Person.searchName` (SQL `lower(...)` fold) | `20260924070000_person_search_name` | `people/infrastructure/persons.ts` `searchPersons` (`LIKE` on `searchName`). New rows use `normalizeName` in JS. **UNVERIFIED** that the SQL fold equals `normalizeName` for every input. | Old people not found by search. |
| 13 | **Append-only triggers** `PlatformAuditLog_append_only`, `Subscription_append_only` via `platform_append_only()` (`BEFORE UPDATE OR DELETE FOR EACH ROW`) | `20261001090000_tenant_management` | `platform/infrastructure/platform-store.ts` (inserts only). TRUNCATE is allowed, which the test helper and the seed rely on. | The audit log becomes editable. |
| 14 | **Session wipe** (`DELETE FROM "Session"`), then `tokenHash NOT NULL UNIQUE` | `20260930120000_session_token_hash` | `access/infrastructure/sessions.ts` `findSessionByToken`. | — (one-time: everyone logged out) |

**Not in the database, although older comments or docs call it "append-only":** `LedgerEntry`, `Payment`, `PaymentTender`, `ExchangeRate` and `BookingDueChange`. No trigger or grant protects them. The code never updates or deletes them (grep for `update`/`delete` on these models in `src/modules` finds none), but the seed deletes them. This is tracked as ROADMAP #2 / F-2.

**Raw-SQL tenant stamping.** Prisma's extension does not touch `$queryRaw`/`$executeRaw`. Every raw statement stamps or filters `"tenantId"` itself from `getCurrentTenantId()`. All `during` writes are raw SQL: `bookings.ts` `insertBookingDuring` (Booking) and `insertSlotInterest` (SlotInterest). See ARCHITECTURE.md §3, "How to write tenant-safe raw SQL".

**Race without a constraint handler.** `find-or-create-person.ts` `findOrCreatePerson` does find-then-insert with no handler for a duplicate-key (`P2002`) error. Two first-time requests with the same new phone on **different** pitches take different pitch locks, so the second insert can hit the partial unique (#3) and surface as an unexpected error ("error.generic"). **UNVERIFIED** by a test.

---

## 4. How to change the schema safely

1. **Never edit an applied migration.** Add a new folder `YYYYMMDDHHMMSS_name/migration.sql` and write the SQL by hand.
2. **Additive first.** New columns nullable or defaulted, so the old code keeps running during deploy (the pattern in `…140000_booking_requested_name` and `…090000_tenant_management`).
3. **Keep what Prisma can't express.** Anything in §3 must be restated in the new SQL if a table is rebuilt. After applying to `stadiums_test`, run:
   ```bash
   DATABASE_URL=…/stadiums_test npx prisma migrate diff --config prisma7.config.ts --from-config-datasource --to-schema src/prisma/schema.prisma --script
   ```
   It must show no drift for your change.
4. **Guard backfills.** Stop with `RAISE EXCEPTION` when the data violates the new rule, as `…060000_per_player_foundation` does, instead of adding a CHECK that fails half-way.
5. **New tenant-owned table:** add `tenantId`, then add the model to `TENANT_SCOPED_MODELS` (or `PLATFORM_ONLY_MODELS`); `test/lib/model-classification.test.ts` enforces this. Add it to `test/integration/truncate.ts` `TABLES`. Add an isolation test.
6. **`tstzrange` columns:** keep them `Unsupported`. Every read and write goes through raw SQL in the infrastructure file, with the tenant stamp.
7. **Append-only tables with a trigger:** clear them with `TRUNCATE`, never `DELETE` (see `src/prisma/seed.ts`).
8. **Never run** `prisma migrate dev` or `db push` against a database you care about. The `.env` `DATABASE_URL` points at `stadiums_dev`; pass `DATABASE_URL` explicitly for `stadiums_test`.
