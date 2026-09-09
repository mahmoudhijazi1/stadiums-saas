# SPEC-03 — Public booking request

**Type:** Build Spec — precise, boring instructions to hand to Cursor.
**Depends on:** DR-001 (modules, tenant guard, transactions), DR-002 §2.1–2.3, §2.8–2.10
(people + booking, no person on the booking row, exclusion on APPROVED only),
BRD BR-15, BR-16, BR-19, BR-23–25, RULE-1, RULE-2, RULE-7, RULE-8.
**Builds on:** SPEC-01 (tenant rails), SPEC-02 (computed slots). Do not re-open those slices.
**Scope (option A):** a visitor requests a slot with name + phone. That creates **PENDING**
only. No login. No owner approve UI (auth comes before owner-facing screens).

> **Framework note:** Next.js / Prisma in this repo differ from training data. Before schema,
> `tstzrange`, Server Actions, or extensions, read `node_modules/next/dist/docs/` and installed
> Prisma docs. This spec is WHAT and WHY; exact APIs come from the installed docs.

> **Comments:** every exported function gets a short human comment — why it exists, in one or two
> sentences, like you’d tell a teammate. No narrating the code (“loop over i”). No essays.

---

## What this slice delivers

A visitor on `ahmad.<dev-host>` sees the SPEC-02 slot list, types a **name and phone**, and
submits. The system find-or-creates a **person** for this tenant (RULE-8: phone unique *per
stadium*), writes a **PENDING** booking for that pitch and UTC range, and writes one participant
flagged `is_requester`.

A second person can request the **same** slot. Both rows stay PENDING (RULE-2 / BR-19). The
public page still shows the slot as free — only **APPROVED** will occupy it later.

The owner does not approve in this slice. Proof is Prisma Studio (or a one-line “request
received” on the page). Isolation still holds: Sami never sees Ahmad’s people or bookings.

---

## Prerequisites

- SPEC-01 + SPEC-02 true: tenant extension, `generateSlotsForDay`, `getDayAvailability`, seed.
- `npm test` includes slug, schedule-config, availability.
- next-intl still out. No auth, no owner dashboard.

---

## Decisions this spec must not reopen

| Source | Decision |
|--------|----------|
| DR-002 §2.1 | `persons` is not `users`. No `user_id` on person. **`user_person_links` waits for the auth SPEC** (it needs a User row). The decision stands; the table is sequenced, not cancelled. |
| DR-002 §2.2 | `UNIQUE(tenant_id, phone)`. Same phone at two stadiums = two people. |
| DR-002 §2.3 | Person = name + phone only. |
| DR-002 §2.8 | Exclusion constraint **is** the double-booking guard. Prisma cannot express it — **hand-written SQL**. `WHERE status = 'APPROVED'` so PENDING may overlap. |
| DR-002 §2.9 | Booking has **no** person column. People attach through `booking_participants`. |
| DR-002 §2.10 | Requester is a participant with `is_requester`. No `requested_by` on bookings. |
| DR-002 §2.18 | `price_usd` is `Decimal(12,2)`, never a float. Copy the **slot price at request time** (snapshot). Do not trust a price posted by the browser. |
| DR-001 §4–5 | Booking may import Venue and People. Venue must not import Booking. The use case that starts the request owns the `$transaction` and passes `tx` into repositories. |
| DR-001 §3 | Add `Person`, `Booking`, `BookingParticipant` to the tenant-scoped model set in `src/lib/db.ts`. Callers still do not pass `tenantId` by hand. |
| SPEC-02 | Slots stay computed. PENDING does **not** go into `occupied` yet. Occupied = approved ranges, in a later slice. |

---

## Phone (this spec pins it)

DR/BRD did not pin digits. For MVP:

- Store digits only (strip spaces, dashes, `+`).
- Zod: 8–15 digits after normalize.
- If the person already exists for this tenant: **reuse the row as-is** (keep the stored name). A second request with a different spelling must not overwrite.

---

## Step 1 — Schema: Person, Booking, BookingParticipant

In `src/prisma/schema.prisma` (verify Prisma 7 enum / Decimal / relation syntax in installed docs):

**Person** (`tenantId` required): `id`, `tenantId`, `name`, `phone`, `createdAt`.  
`@@unique([tenantId, phone])`. `@@index([tenantId])`. Relation to Tenant.

**Booking** (`tenantId` required): `id`, `tenantId`, `pitchId`, status enum
`PENDING | APPROVED | REJECTED | CANCELLED | NO_SHOW`, source enum `OWNER | PUBLIC`,
`priceUsd` `Decimal(12,2)`, `requestedAt`. Relation to Tenant and Pitch.

**How to store `during`:** the DB column is Postgres `tstzrange` (UTC). Prisma cannot model
exclusion. Typical split:

- Hand-written migration: `during tstzrange NOT NULL`.
- Application / Prisma: expose `startAt` / `endAt` as `DateTime` **or** `Unsupported("tstzrange")`
  — pick what the **installed** Prisma 7 docs allow. Infrastructure maps to `{ start: Date; end: Date }`
  for domain. Do not invent a slots table.

**BookingParticipant** (`tenantId` required — child table, no exception): `id`, `tenantId`,
`bookingId`, `personId`, `team` optional (omit or nullable; unused this slice),
`amountDueUsd` `Decimal(12,2)`, `paidAt` optional, `isRequester` boolean. FKs to Booking and
Person. `@@index([tenantId])`.

This slice only writes `source = PUBLIC`, `status = PENDING`, `isRequester = true`, `paidAt` null,
`team` null. `amountDueUsd` = the booking’s `priceUsd` (whole game on the requester until split
exists).

Do **not** add payments, slot_interests, users, pitch_blocks.

Migrate. If `migrate dev` fails on the `template1` shadow DB (see `docs/progress.md`), write the
SQL yourself and `migrate deploy`, same as SPEC-02 step 1.

**Definition of done:** tables exist; `tenant_id` on all three; unique (tenant, phone).

---

## Step 2 — Exclusion constraint (raw SQL)

Enable `btree_gist` if needed (`pitch_id` equality inside GiST). Then:

```sql
EXCLUDE USING gist (pitch_id WITH =, during WITH &&) WHERE (status = 'APPROVED')
```

(Use the real column names from the migration.)

This ships **now** even though we only insert PENDING — so we never “forget” the reason we chose
Postgres. You cannot test a collision until a later approve slice; still add the constraint.

**Definition of done:** constraint is in a migration file; `npx prisma migrate status` clean.

---

## Step 3 — Tenant extension

In `src/lib/db.ts`, add `Person`, `Booking`, `BookingParticipant` to `TENANT_SCOPED_MODELS`.

**Definition of done:** a Person/Booking query from app code has no hand-written `tenantId`.

---

## Step 4 — People: find-or-create by phone

New module **only as needed** — `src/modules/people/` (no empty `ui/` etc.).

- `domain/`: normalize phone (pure). Jest it.
- `infrastructure/`: `findPersonByPhone(tx, phone)`, `createPerson(tx, { name, phone })`.
  Accept `tx` (DR-001). No `tenantId` in the call.
- `application/` is optional this slice if Booking’s use case calls People infra directly;
  prefer a tiny `findOrCreatePerson(tx, { name, phone })` in People application so Booking
  does not own the “create person” rule.

**Definition of done:** same phone twice → one person. Different tenants → two people (seed or
manual check later).

---

## Step 5 — Booking domain (pure)

`src/modules/booking/domain/` — no Prisma, no `await`.

At least:

- Normalize/validate that `{ start, end }` is one of the slots `generateSlotsForDay` returned
  for that pitch’s config and civil date (Booking **asks** Venue; copy the slot’s `priceUsd`).
- Reject if `end <= now` (don’t request a slot that already finished). Use an injected `now: Date`.
- Do not check “already APPROVED” here for the public page filter — that’s later occupied
  ranges. Domain may still expose `overlaps(a, b)` for tests.

Comments: short, human, why.

**Definition of done:** Jest in `test/modules/booking/domain/`. Closed-day / unknown time fails;
a real generated slot passes; past slot fails.

---

## Step 6 — Zod for the public form

`src/modules/booking/schemas/` — name, phone, pitchId, start/end as ISO strings (or whatever the
form posts). Parse **before** the use case. Reject extra keys if `strictObject` is available
(Zod 4).

**Definition of done:** tests for missing name, bad phone, extra field.

---

## Step 7 — Use case: `requestPublicSlot`

`src/modules/booking/application/` — this function opens `db.$transaction` and passes `tx`.

1. Load pitch (infra). 404/fail if missing (wrong tenant → empty via extension).
2. Parse schedule, `generateSlotsForDay` for the slot’s civil date in `Asia/Beirut`.
3. Domain: is this an offered slot, not in the past? Price from the matching generated slot.
4. `findOrCreatePerson`.
5. Insert Booking `PENDING` + `PUBLIC`, `during` / start-end, snapshot `priceUsd`.
6. Insert BookingParticipant `isRequester: true`.
7. `logger.error` on failure, then rethrow. Success: `logger.info` with booking id (no phone
   dump if you can avoid it — phone is PII).

Notifications: none (and never inside the transaction anyway).

**Definition of done:** one Server Action can call this; two overlapping PENDINGs both succeed.

---

## Step 8 — Thin UI on the existing page

Keep `src/app/page.tsx` a Server Component. Add a **small** form per slot (or one form with hidden
pitch/start/end): name, phone, submit.

Use a Server Action: validate (Zod) → no auth this slice → `requestPublicSlot`. Verify the Action
API in local Next docs (`searchParams` stays a Promise).

After success: plain text “Request received” (no styling system). Stay on the same `?date=`.
Do **not** hide the slot.

No client-side booking logic. A tiny Client Component is OK only if the form needs it for the
installed Next version — prefer a server `<form action={...}>` if the docs still support it.

**Definition of done:** Ahmad can submit; Sami’s page cannot create Ahmad’s rows; page has no
Prisma and no `tenantId`.

---

## Tests (Jest)

| Step | Jest |
|------|------|
| 1–3 Schema / SQL / extension | None (migrate + Studio). |
| 4 Phone normalize | `test/modules/people/domain/…` |
| 5 Slot rules | `test/modules/booking/domain/…` |
| 6 Zod | `test/modules/booking/schemas/…` |
| 7–8 Use case / page | No mandatory unit tests. |

**Definition of done (Jest):** `npm test` still includes SPEC-01/02 suites plus the new ones.

---

## Whole-slice acceptance

1. Migrate applied; exclusion exists in SQL. ✅
2. `?tenant=ahmad` + a live slot → submit name+phone → PENDING booking + person + requester
   participant. ✅
3. Second request, same slot, different phone → second PENDING. ✅
4. Same tenant, same phone, second request → **same** person row, new booking. ✅
5. Slot still listed as available on the public page. ✅
6. `?tenant=sami` cannot see Ahmad’s people/bookings. ✅
7. No `tenantId` in page or in repository `where` clauses. ✅
8. `npm test` passes. ✅

---

## Out of scope (do not build)

- Auth, sessions, users, memberships, `user_person_links`
- Owner approve/reject, auto-reject other PENDINGs (BR-20), `slot_interests` (BR-21)
- Owner-created bookings (source OWNER, confirmed immediately — RULE-3)
- Payments, ledger, expenses
- `pitch_blocks`, feeding `occupied` from bookings
- WhatsApp / in-app owner notification (BR-70)
- i18n/RTL, RLS
- Splitting `amount_due` across a team (BR-41)

---

## After this slice

Auth SPEC, then owner approve (exclusion actually fires). Or a later booking SPEC if you
explicitly allow a proof approve without login (that would be option B — not this spec).
