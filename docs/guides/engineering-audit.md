# Engineering audit — architecture vs the actual tree

**When:** 2026-09-15  
**Scope:** read-only pass over `src/`, `test/`, and the DRs/guides that claim how this repo is built. No fixes.  
**Method:** import greps and file reads, not recollection of “what we decided.”

This is not a validation that the architecture “basically holds.” Cross-module import bans mostly hold. The weaker story is **docs that describe a repo that no longer exists**, **two repository styles**, and **deferred product knobs that already exist in domain/schema**.

---

## 1. Module boundary violations

### Payment never imports Booking — holds

Grep of `src/modules/payment` for `@/modules/booking`: **no matches**.

Payment still *knows* booking statuses as strings. That is the intended DIP, not an import:

```54:58:src/modules/payment/domain/collect.ts
export function assertCanCollect(status: string): void {
  if (status !== "APPROVED" && status !== "NO_SHOW") {
    throw new DomainError("payment.collect_unapproved");
  }
}
```

The use case that supplies that string is `collectBookingPayment` in Booking (`src/modules/booking/application/collect-booking-payment.ts`), which imports Payment, not the reverse.

### Venue never imports Booking — holds

Grep of `src/modules/venue` for `@/modules/booking`: **no matches**.

Occupied ranges are a local type plus an argument:

```32:41:src/modules/venue/application/get-day-availability.ts
/** Occupied UTC window on one pitch. Caller supplies these; Venue does not import Booking. */
export type OccupiedWindow = {
  pitchId: string;
  start: Date;
  end: Date;
};
```

The callers that pass bookings in are `src/app/(public)/hours.tsx` and `src/app/owner/book/slots.tsx` (page composition). Pitch-hours live bookings come from Booking’s `listLivePitchWindows` into Venue’s `updatePitch` as `LivePitchWindow[]` (`src/modules/venue/application/update-pitch.ts` lines 22–25). Venue classifies; it does not query `Booking`.

### `src/components/ui` never imports `src/modules/*` — holds for `ui/`

Grep of `src/components/ui` for `@/modules/`: **no matches**.

**Neighboring leak (same `src/components/`, not `ui/`):** `src/components/day-chips.tsx` lines 2–6 import `compareCivilDate`, `formatCivilDate`, `CivilDate` from `@/modules/venue/domain/availability`. Shared chrome is not as isolated as the `ui/` rule sounds.

**`src/lib` also depends on a feature module:** `src/lib/request-fields.ts` line 1 imports `normalizePhone` from `@/modules/people/domain/phone`. Plumbing depending on People is the inverse of “lib is shared, modules sit on top.”

### Domain files never import Prisma / never `await` — holds for Prisma; `await` only in comments

Grep of `src/modules/**/domain/**` for `prismaBase`, `@/lib/prisma`, `@/lib/platform-db`: **no matches**.

Grep of domain for `\bawait\b`: only the comment in `src/modules/venue/domain/availability.ts` line 7 (“No database, no await, no Prisma”).

Domain **does** import Zod *types* from the same module’s schemas (e.g. `hours-cover.ts` line 2 → `ScheduleConfig`; `daily-schedule.ts` lines 3–8 → `parseScheduleConfig`). That is not a DB call. It does couple domain to the Zod module instead of a tiny local type.

### Repositories only accept `TenantTx`, never import `db` / `prismaBase` — **violated**

`src/lib/db.ts` lines 116–117 state the rule:

```text
/** `tx` from `db.$transaction` — still tenant-scoped. Repositories take this, never import `db`. */
```

**Booking infra follows it.** `src/modules/booking/infrastructure/bookings.ts` line 4: `import type { TenantTx }`. Functions take `tx: TenantTx`. Application opens `db.$transaction` or passes `db` as the client (structural typing: `db` is assignable to `TenantTx` because extra keys are allowed).

**Venue infra does not.** `src/modules/venue/infrastructure/pitches.ts` line 1:

```ts
import db, { type TenantTx } from "@/lib/db";
```

`listPitches` (line 7), `findPitch` (line 14), `insertPitch` (line 21), `updatePitchRow` (line 34) call `db.pitch.*` with **no** `tx` argument. Only `findPitchById` (line 53) takes `TenantTx` — because Booking’s transaction needs it.

**Access memberships same singleton style:** `src/modules/access/infrastructure/memberships.ts` line 1 `import db from "@/lib/db"`; `findMembershipForUser` hits `db.membership.findFirst` with no `tx`.

**People infra follows the Booking style:** `src/modules/people/infrastructure/persons.ts` lines 2–6 explicitly: “Never import `db` or `platformDb` here.”

So the rule is real in Booking/People/Payment/Ledger/Expense repos, and **aspirational** in Venue + Access memberships.

**`platformDb` “allowlist” is documentation, not code.** DR-001 §3 says the unscoped client is “restricted to a small file allowlist.” `src/lib/platform-db.ts` is a one-line re-export of `prismaBase` with a comment. There is no allowlist, no lint, no wrapper. Actual imports: `src/lib/tenant-context.ts` (Tenant by slug), `src/modules/access/infrastructure/users.ts`, `src/modules/access/infrastructure/sessions.ts`. Anyone can add a fourth.

---

## 2. Domain / application / infrastructure discipline

Checked: **venue**, **booking**, **payment**, **access**.

### Domain is mostly pure

Examples that match the claim:

- `generateSlotsForDay` / `bookingFitsOpenHours` in `src/modules/venue/domain/availability.ts` — no I/O.
- `assertPendingForDecision` / `isPastUnpaidCancel` in `src/modules/booking/domain/decision.ts`.
- `usdEquivalent` / `freezeTenders` in `src/modules/payment/domain/collect.ts`.
- `can()` in `src/modules/access/domain/can.ts`.

`isExclusionViolation` (`src/modules/booking/domain/exclusion.ts`) is pure (walks `error.cause` for `23P01`). It is persistence-shaped (Postgres exclusion name in the string at line 18) sitting in domain because Prisma wraps driver errors. Honest: it is an adapter for a DB constraint, not a product rule.

### Application does not contain raw SQL

Grep of `src/modules/**/application/**` for `$queryRaw` / `$executeRaw` / `prisma.`: **no matches**.

Application **does** import `db` to start work. That is the house pattern, not a SQL leak. Thin examples:

```7:9:src/modules/booking/application/list-approved-occupied.ts
export async function listApprovedOccupied() {
  return listApprovedRanges(db);
}
```

```10:16:src/modules/booking/application/list-live-pitch-windows.ts
export async function listLivePitchWindows(pitchId: string, now: Date) {
  const membership = await getCurrentMembership();
  // ...
  return listLiveWindowsOnPitch(db, pitchId, now);
}
```

`$executeRaw` lives in infra where it belongs, e.g. `insertPendingPublicBooking` in `src/modules/booking/infrastructure/bookings.ts` lines 18–37 (and the near-copy `insertApprovedOwnerBooking` lines 47–69).

### Application contains presentation that is not “orchestration”

`getDayAvailability` (`src/modules/venue/application/get-day-availability.ts` lines 96–109) defines `formatLocalHm` with `Intl.DateTimeFormat`. Same clock formatting is reimplemented as `formatLocalTime` in:

- `src/modules/booking/application/list-due-bookings.ts` lines 130–137
- `src/modules/booking/application/list-open-waitlist.ts` lines 105+

That is not Prisma in application. It is view-model formatting inside use cases, copied three times, timezone hardcoded (see §4).

`listDueBookings` also builds WhatsApp URLs (`toDueBooking` / `confirmHref`, lines 92–128). Product chose “Booking builds the href, Notification stays dumb.” That is a real application responsibility, not a layer bug — but it makes the Home list use case a formatter + linker, not just a query.

### Infrastructure contains a little business

`setPendingStatus` / `setApprovedCancelled` / `setApprovedNoShow` in `src/modules/booking/infrastructure/bookings.ts` (lines 247–290) throw `new DomainError("booking.not_found")` when `updateMany` count ≠ 1. The status guard is in the `where` clause (`status: "PENDING"` etc.). Domain already has `assertPendingForDecision` / `assertApprovedForCancel`. Infra is duplicating the rule as a SQL filter and mapping 0 rows to a domain error. Small, but it is not “queries only.”

`insertPendingPublicBooking` stamps `'PENDING'::"BookingStatus"` and `'PUBLIC'::"BookingSource"` in SQL (lines 33–34). Source/status defaults are product rules in the INSERT string because Prisma cannot `booking.create` (`during` is Unsupported). Acceptable given the constraint; still logic in SQL.

### Venue writes skip `$transaction`

`createPitch` (`src/modules/venue/application/create-pitch.ts`) calls `insertPitch` with no `db.$transaction`. `updatePitch` (`src/modules/venue/application/update-pitch.ts`) `findPitch` then `updatePitchRow` as two separate `db` calls (lines 34–43, 53+). Booking writes that matter (approve, collect, public request) wrap in `$transaction`. Venue is the odd module.

### Prisma types in application (Access)

`src/modules/access/application/get-current-membership.ts` line 2: `import type { MembershipRole } from "@/app/generated/prisma/enums"`. Domain `can.ts` inlines `"OWNER" | "STAFF"` instead. Two sources of the same union.

### Error key from the wrong module

`updatePitch` line 36: `throw new DomainError("booking.pitch_not_found")` inside **Venue**. Callers see a Booking copy key for a missing pitch on Settings.

---

## 3. Over-engineering — unused flexibility

Not a forest of unused interfaces. The real extras are **schema/engine knobs the UI never sets**, plus a few type aliases and a phantom name in the rules.

### `BookingLike` does not exist

`.cursor/rules/000-core-architecture.mdc` and `docs/guides/folder-structure.md` tell you domain takes `BookingLike`. Repo-wide grep of `BookingLike` under `src/`: **only those docs**. What exists is smaller: `BookingStatusLike` (`decision.ts` line 7), `MembershipLike` (`can.ts` line 18), `WaitlistWindowLike`, `PendingLike`, `PendingRangeLike`. The named example in the always-on rule is fictional.

### `PeopleTx = TenantTx`

`src/modules/people/infrastructure/persons.ts` lines 7–8. One alias, one consumer (`find-or-create-person.ts`). It documents intent; it does not vary.

### `gapMinutes` is a full feature nobody can set

- Zod: `src/modules/venue/schemas/schedule-config.ts` line 50.
- Slot engine: `src/modules/venue/domain/availability.ts` line 41 (`gapMs = input.config.gapMinutes * 60_000`).
- Editor always writes `0`: `daily-schedule.ts` line 89 (`gapMinutes: 0`).
- Tests exercise a 15-minute gap: `test/modules/venue/domain/availability.test.ts` (“shifts the next start by gapMinutes”).

The algorithm is more general than the product. That is unused flexibility with a test to keep it alive.

### Time-window `priceRules` run in production with no editor

Schema allows optional `start`/`end` (`schedule-config.ts` lines 27–36). Domain applies them:

```127:130:src/modules/venue/domain/availability.ts
  for (const rule of config.priceRules) {
    if (rule.start !== undefined && rule.end !== undefined) {
      if (!clockLiesInWindow(wall.minutes, rule.start, rule.end)) continue;
```

UI comment, `src/app/owner/more/settings/pitches/price-rules.tsx` lines 47–49: “start/end round-trip hidden (no time-window UI this slice).” The `Row` type still has `start?:` / `end?:` (lines 14–19) and `toPayload` copies them if present (lines 38–40). Seeded/imported JSON with windowed rules would price differently than the Settings screen can explain.

### Hours JSON is an array of windows; the form keeps one

`collapseHoursGroups` (`daily-schedule.ts` lines 19–38) documents: “A day with two windows still becomes one row using window[0].” `hours.mon` etc. are `z.array(timeWindowSchema)` — the stored shape is already multi-window. The editor cannot create the second window; the type can hold it.

### `OccupiedWindow` vs `LivePitchWindow`

Two `{ start, end }` (+ pitch or status) shapes so Venue never imports Booking. That is boundary cost, not unused abstraction. Fine.

### No “strategy interface with one class”

Use cases are functions. No repository interfaces, no DI container, no `IPaymentGateway`. If a senior hunts for classic over-architecture, they will not find it. They will find **JSON schema ahead of the Settings UI**.

---

## 4. Under-engineering / inconsistency / drift

### Docs describe a different app

`docs/guides/folder-structure.md` still shows:

- `app/[locale]/` and next-intl (contradicts DR-005 / SPEC-13: cookie locale, no locale segment)
- `middleware.ts` (the file is `src/proxy.ts`; Next 16 rename is commented there lines 5–7)
- `lib/auth.ts`, `lib/i18n.ts` — **do not exist**
- `modules/*/ui/`, `booking.rules.ts`, `platform/` — **do not exist**

The always-on architecture rule is closer to the code than this guide. A new agent reading folder-structure first will invent the wrong tree.

### Two repository conventions (already §1)

Booking/People/Payment: `tx: TenantTx`. Venue pitch CRUD: import `db`. Access memberships: import `db`. `listApprovedOccupied` passes `db` into a `TenantTx` parameter without opening a transaction. Works; it is not one pattern.

### `"Asia/Beirut"` copied instead of tenant settings

Literal in (non-exhaustive): `approve-booking.ts` line 24, `request-public-slot.ts` line 17, `create-owner-booking.ts` line 22, `list-due-bookings.ts` line 25, `list-open-waitlist.ts` line 15, `record-expense.ts` line 21, `summarize-ledger-period.ts` line 13, `update-pitch.ts` line 16, `(public)/page.tsx` line 28, `(public)/hours.tsx` line 9. Owner UI also has `OWNER_TIME_ZONE` in `src/app/owner/shared.tsx` line 5 — and modules do not import it. Prisma Tenant has **no** timezone column (`grep timeZone` in `src/prisma`: none). Every stadium is Beirut by copy-paste.

### Duplicate insert SQL

`insertPendingPublicBooking` and `insertApprovedOwnerBooking` (`bookings.ts` 18–69) differ by two SQL literals (`PENDING`/`PUBLIC` vs `APPROVED`/`OWNER`). Copy-paste that should have been one helper with status/source args.

### Duplicate clock formatters

See §2. Plus `formatLocalClock` in `src/app/owner/shared.tsx`. Four ways to print `HH:mm` in Asia/Beirut.

### Home “coming days” vs date chips

`list-due-bookings.ts` line 27: `COMING_DAYS = 7`. `src/components/day-chips.tsx` line 13: `WINDOW_DAYS = 5`. Two different “week” lengths with no shared constant.

### Dead educational duplicate

`src/lib/db-with-comments.ts` — grep of the repo for `db-with-comments`: **no imports**. It is a commented twin of `db.ts`. Dead weight.

### Thin re-exports

- `src/app/(public)/locale-actions.ts` — one line re-export of `@/app/locale-actions`.
- `src/app/(public)/day-chips.tsx` — wrapper around `@/components/day-chips`.

Not harmful; they look like leftovers from a move.

### App layer runs domain for UI flags

`src/app/owner/today/lists.tsx` lines 24–27 import `groupPendingBySlot`, `upcomingStatus`, `isPastUnpaidCancel`, `isNoShowWindowEnded`. That is more than validate → authorize → delegate. It is the right place to map DTOs to buttons, but the “app is routes only” slogan is stricter than this file.

### Notification is a one-file module

`src/modules/notification/` contains only `domain/whatsapp-link.ts`. No application, no infrastructure. Fine for YAGNI. The folder map in folder-structure implies a full three-layer module that is not there.

### No `platform/` module

Tenant lookup lives in `src/lib/tenant-context.ts` via `platformDb`. DR-001’s module table lists platform as a bounded context. In the tree it is lib + Prisma `Tenant`.

---

## 5. YAGNI / deferred list vs the tree

| Deferred (IA / SPECs) | In the tree? |
|---|---|
| Pitch delete | **No.** Grep `deletePitch` / `removePitch`: no matches. |
| `pitch_blocks` | **No.** No model, no module files. |
| Recurring bookings | **No.** |
| Pitch delete UI / extra weekday windows in the editor | Editor still one window per group (`window[0]`). JSON **can** store many windows (schema arrays). Capacity without UI. |
| `gapMinutes` UI | Editor forces `0`. Engine + tests support ≠ 0. **Leaked into domain, not into Settings.** |
| `priceRules` time windows | Schema + `clockLiesInWindow` in availability (lines 127–130). Settings hides start/end. **Leaked into engine + Zod + row payload, not into visible controls.** |
| `[locale]` / next-intl | **Not in app routes.** Still in folder-structure.md. Doc leak, not code leak. |
| Shop / Academy folders | **Not created.** Good. |
| RLS | Commented as later in `db.ts` line 24. No RLS SQL. Good. |

**Built more flexible than any current screen needs:** `gapMinutes`, windowed `priceRules`, multi-window `hours[day][]`, `COMING_DAYS` independent of chip window. The Settings form is the honest product; `ScheduleConfig` is the future product living in jsonb already.

**Not half-scaffolded:** no empty `shop/`, no `deletePitch` stub, no `PitchBlock` Prisma model.

---

## 6. Test coverage shape

Jest lives under `test/`, mirroring `src/` (`docs/guides/testing-jest.md`). **Zero files** under `test/modules/**/application/**`. That matches the guide’s “don’t over-test thin use cases” — and it means approve/collect/cancel orchestration, exclusion mapping in the use case, and tenant `$transaction` behavior have **no automated net**.

### Strong (domain / schemas / lib that actually branch)

| Area | Evidence |
|---|---|
| Slot generation, occupancy, empty-day kinds | `test/modules/venue/domain/availability.test.ts` (includes `gapMinutes: 15`) |
| Hours groups round-trip | `test/modules/venue/domain/daily-schedule.test.ts`, `hours-cover.test.ts` |
| Booking decision / offered slot / waitlist / home partition | `test/modules/booking/domain/*.test.ts` |
| Money freeze / remaining | `test/modules/payment/domain/collect.test.ts` |
| Access `can` / identifier | `test/modules/access/domain/*.test.ts` |
| WhatsApp message bodies | `test/modules/notification/domain/whatsapp-link.test.ts` |
| Zod edges | booking/venue/payment/expense/ledger schema tests |
| Tenant slug, money, errors, locale, ui-copy | `test/lib/*` |

### Weak or missing

| What | Status |
|---|---|
| `src/modules/booking/domain/exclusion.ts` | **No test file.** SPEC-05’s collision mapper is untested. |
| `src/modules/expense/domain/categories.ts` | No test (a const array — low value). |
| All `application/` use cases | **No Jest.** `approveBooking`, `collectBookingPayment`, `requestPublicSlot`, `updatePitch`, `recordPayment`+ledger-in-same-tx: untested as flows. |
| All `infrastructure/` | **No Jest.** Tenant extension injection, `$executeRaw` INSERT, exclusion 23P01 through Prisma wrap: untested. |
| Access password hashing / session cookie | No tests. |
| `src/lib/db.ts` tenant extension | No tests. Isolation is a comment + SPEC-01 lore. |
| UI (sheet, slot picker except duration helper) | Intentionally thin; `test/components/slot-duration.test.ts` only. |

The shape matches the written testing policy (domain first). It does **not** match a senior’s usual bar for “ledger row + payment in one `$transaction`” or “tenant_id on every query,” which are the load-bearing claims in DR-001/002.

---

## 7. Overall rating

The codebase is genuinely disciplined **where two modules might otherwise glue themselves together**. Payment does not import Booking. Venue does not import Booking. `components/ui` stays dumb. Domain functions are synchronous and Prisma-free. Booking writes that can race go through `$transaction` and raw `tstzrange` INSERTs for a reason the comments explain. That is more adult than most early Next+Prisma apps.

It is weaker than the documentation claims in three places. First, **folder-structure.md and the `BookingLike` rule describe a system that is not in the tree** (`[locale]`, `middleware.ts`, `auth.ts`, module `ui/` folders). Second, **“repositories take TenantTx, never import db” is true for Booking and false for Venue pitch CRUD** (`pitches.ts` line 1). Third, **deferred Settings (gaps, time-window prices, extra daily windows) already execute in `availability.ts` / Zod** while the form writes `gapMinutes: 0` and hides `start`/`end`. The json blob is a superset of the product.

If a senior engineer spent an hour here, the first pushback would not be “you need interfaces.” It would be: **the written architecture is a mix of a 2026 Next 16 app and a stale target diagram; pick one repository style; stop copy-pasting `Asia/Beirut`; and either test `isExclusionViolation` + one transactional use case or stop talking about exclusion and tenant isolation as if the test suite proved them.**
