# SPEC-04 — Access: login, session, `can(...)`

**Type:** Build Spec — precise, boring instructions to hand to Cursor.
**Depends on:** DR-001 §2–4 (URL tenant; Access module; no upward imports), DR-003 (all of it),
DR-002 sketch (users / memberships; `user_person_links` empty), BR-96–99, BR-16.
**Builds on:** SPEC-01–03. Do not re-open those slices. Public `requestPublicSlot` stays unauthenticated.
**Scope:** Owner/staff can log in **on this stadium’s URL**, stay logged in via an HTTP-only cookie,
and fail on the other stadium. A tiny locked page proves `can(...)`. **No approve UI.**

> **Framework note:** Next.js / Prisma in this repo differ from training data. Before cookies,
> `cookies()`, route files, or Prisma models, read `node_modules/next/dist/docs/` and installed
> Prisma docs. This spec is WHAT and WHY; exact APIs come from the installed docs.
> Password hashing: prefer `node:crypto` (already in Node) unless installed docs clearly prefer
> a package already in `package.json`. Do not add Auth.js / NextAuth / a second Prisma pool.

> **Comments:** every exported function gets a short human comment — why it exists. No essays.

> **Transactions:** User/Session lookups use `platformDb` (no `tenant_id`). Do **not** call
> `platformDb` from inside `db.$transaction`. Read
> [guides/prisma-transaction-tenant-guard.md](../guides/prisma-transaction-tenant-guard.md).
> Login does not need an interactive transaction: look up user → verify hash → load membership
> (`db`) → insert session (`platformDb`). Membership read is not nested inside a `db` BEGIN
> that then talks to `platformDb`.

---

## What this slice delivers

On `/?tenant=ahmad` (or later `ahmad.<host>`), an owner opens `/login`, types
`owner@ahmad` and the seeded password, and reaches a **plain** `/owner` page that shows the
stadium name and role. Same cookie on `/?tenant=sami` does **not** show Ahmad’s `/owner`
(no membership for Sami). Logout clears the session.

Staff seed is optional; if seeded, staff **cannot** pass `can(..., "bookings.approve")` (BR-97).
OWNER can. No approve button yet — Jest proves `can`.

Players still request slots with name+phone only.

---

## Prerequisites

- SPEC-01–03 true: tenant header, `db` extension, public request, seed Ahmad + Sami.
- `npm test` green.
- next-intl still out. No owner approve, no dashboard, no platform-admin UI.

---

## Decisions this spec must not reopen

| Source | Decision |
|--------|----------|
| DR-001 §2 | URL chooses tenant. Session only authorizes **against** it. |
| DR-003 §1 | Phase 1 accounts = owner/staff only. Public booking stays anonymous. |
| DR-003 §2 | Identifier `local@tenant-slug`, not a mailbox. Hash the password. |
| DR-003 §3 | `users` / `sessions` have **no** `tenant_id`. `memberships` do. `UNIQUE(tenant_id, user_id)`. |
| DR-003 §4 | HTTP-only cookie + server session row. No JWT in `localStorage`. Cookie is not the tenant key. |
| DR-003 §5 | `OWNER \| STAFF`. `permissions` jsonb. `can` in Access domain. Staff default: cannot approve. |
| DR-003 §6 | Access must not import Booking. `user_person_links` is People (empty table). |
| DR-001 §3 | Membership (and `UserPersonLink`) are tenant-owned → add to `TENANT_SCOPED_MODELS`. Users and sessions are **not**. |

---

## Permissions (this spec pins the first flag)

Zod-validate membership `permissions` jsonb (DR-002 jsonb rule).

- Permission string used in code: `"bookings.approve"` (the only flag this slice needs).
- **OWNER:** `can` is true for every known permission (BR-96). Do not require a json shopping list.
- **STAFF:** `can` is true only if that key is `true` in jsonb. Seed/default **omit or false** for
  `"bookings.approve"` (BR-97).
- Extra keys: reject on write (`strictObject` / strip-unknown per installed Zod 4). Unknown keys
  on read: treat as no access, do not crash the owner’s evening.

A later SPEC may add `"payments.collect"` etc. without a new permissions table (BR-98).

---

## Step 1 — Schema

In `src/prisma/schema.prisma` (Prisma 7 syntax from installed docs):

**User** (no `tenantId`): `id`, `identifier` (unique string), `passwordHash`, `createdAt`.
Relations to Membership and Session. Optional relation to `UserPersonLink`.

**Membership** (`tenantId` required): `id`, `tenantId`, `userId`, `role` enum `OWNER | STAFF`,
`permissions` Json (default `{}`). `@@unique([tenantId, userId])`. `@@index([tenantId])`.
FKs to Tenant and User.

**Session** (no `tenantId`): `id`, `userId`, `expiresAt`, `createdAt`. FK to User.
`@@index([userId])`. Cookie stores an opaque id (or token) that **looks up this row**. Do not
trust a client-supplied `userId` without this lookup.

**UserPersonLink** (`tenantId` required — child table, DR-002 §2.1 / DR-003 §6): `id`,
`tenantId`, `userId`, `personId`, `relation` enum `SELF | GUARDIAN`. FKs to Tenant, User, Person.
`@@index([tenantId])`. **This slice writes zero rows.** Table exists so we do not retrofit later.

Wire Tenant relations (`memberships`, `userPersonLinks`).

Do **not** add platform-admin, password-reset, or `tenantId` on User/Session.

Migrate. If `template1` shadow DB blocks `migrate dev`, handwritten SQL + `migrate deploy`
(same as SPEC-02/03).

**Definition of done:** tables exist; Membership and UserPersonLink have `tenant_id`; User
identifier unique; no `tenant_id` on User/Session.

---

## Step 2 — Guard vs platformDb

- Add `Membership` and `UserPersonLink` to `TENANT_SCOPED_MODELS` in `src/lib/db.ts`.
- Access **infrastructure** for User and Session uses `platformDb` (unscoped). Membership
  uses `db` / `tx` (guard stamps `tenantId`). Callers still do not pass `tenantId` on membership.
- Do not create a second `PrismaClient` or `pg.Pool`.

**Definition of done:** a membership `findMany` from app code has no hand-written `tenantId`;
`platformDb.user.findUnique({ where: { identifier } })` is used for login lookup.

---

## Step 3 — Access domain (pure)

New module **only as needed** — `src/modules/access/` (no empty `ui/`).

- `domain/identifier.ts` — normalize (`trim`, lower-case), shape `local@slug` (slug same rules
  as `tenant-slug`: `[a-z0-9]+(?:-[a-z0-9]+)*`, local-part non-empty, no spaces). Jest it.
- `domain/can.ts` — `can(membershipLike, permission)`: OWNER → true; STAFF → jsonb flag.
  Takes an interface, not a Prisma type (DR-001: domain is pure). Jest: owner can approve;
  staff default cannot; staff with `{ "bookings.approve": true }` can.
- Password **verify/hash** may live in `application/` or a tiny `infrastructure/password.ts`
  if it uses `node:crypto` (async is OK there, not in `domain/`).

**Definition of done:** Jest in `test/modules/access/domain/`.

---

## Step 4 — Zod login body

`src/modules/access/schemas/login.ts` — `identifier`, `password`. `strictObject` if Zod 4
allows. Reject extra keys. Identifier through the domain normalizer then shape check.

**Definition of done:** tests for missing password, extra field, happy `owner@ahmad`.

---

## Step 5 — Use cases: login, logout, current membership

`src/modules/access/application/`

**`login`:** parse → load current tenant (URL) → `platformDb` user by identifier → verify
hash → `db.membership.findFirst` (or unique) for this tenant + user → fail if missing →
insert Session on `platformDb` → set HTTP-only cookie (Next 16 `cookies()` docs; prefer
host-only if the API allows). Same generic failure for bad password / unknown user / no
membership (do not leak “user exists but not here”). `logger.info` user id on success, not
the identifier if you can avoid log spam; never log the password.

**`logout`:** delete/expire session row; clear cookie.

**`getCurrentMembership`:** read cookie → session row (not expired) → membership for
**current URL tenant**. None → unauthenticated. This is the only way `/owner` knows who
you are. Do not read tenant from the session.

Cookie Max-Age: pick a boring default (e.g. 7 days) and store `expiresAt` to match.

**Definition of done:** login on Ahmad works; that session has no membership on Sami.

---

## Step 6 — Thin UI

- `src/app/login/page.tsx` — Server Component. Identifier + password form. Preserve local
  `?tenant=` like the public page (hidden slug is **not** isolation). After success: `redirect`
  to `/owner` **outside** try/catch (Next redirect docs).
- `src/app/owner/page.tsx` — Server Component. If `getCurrentMembership` is null → redirect to
  `/login` (keep `?tenant=`). Else show tenant name, identifier, role, a Logout form.
  **No Prisma, no `tenantId` in the page.** No approve list.
- Server Actions in `src/app/` stay thin: Zod → Access use case.

Public `/` is unchanged (still no login wall).

**Definition of done:** Ahmad owner sees `/owner`; Sami’s URL does not; page files have no Prisma.

---

## Step 7 — Seed

Extend `src/prisma/seed.ts` (still unscoped client):

- `owner@ahmad` + OWNER membership on Ahmad’s tenant.
- `owner@sami` + OWNER membership on Sami’s tenant.
- Password: one documented local value (e.g. in a seed comment / progress log, **not** in
  client JS). Hash with the same helper as login.
- Optional: `staff@ahmad` STAFF with permissions `{}` so `can` approve is false.

Re-run seed on the branch when you implement this step.

**Definition of done:** after seed, login with `owner@ahmad` on `?tenant=ahmad` works.

---

## Tests (Jest)

| Step | Jest |
|------|------|
| 1–2 Schema / guard | None (migrate + Studio / login click). |
| 3 Identifier + `can` | `test/modules/access/domain/` |
| 4 Zod | `test/modules/access/schemas/` |
| 5–7 Use case / pages / seed | No mandatory unit tests. |

**Definition of done (Jest):** `npm test` includes SPEC-01–03 suites plus Access domain/schema.

---

## Whole-slice acceptance

1. Migrate applied; User has no `tenant_id`; Membership has `tenant_id`. ✅
2. `/?tenant=ahmad` → `/login` → `owner@ahmad` + seed password → `/owner` shows Ahmad + OWNER. ✅
3. Same browser, `/?tenant=sami` → `/owner` does not show Ahmad (login required or “not allowed”). ✅
4. `owner@ahmad` on `?tenant=sami` login fails (no membership). ✅
5. Logout → `/owner` redirects to login. ✅
6. Public slot form still works without login. ✅
7. `npm test`: owner `can` approve; staff default cannot. ✅
8. No `tenantId` on login/owner pages; Access does not import Booking. ✅

---

## Out of scope (do not build)

- Owner approve/reject, occupied slots, `pitch_blocks`
- Filling `user_person_links`
- Staff invite UI, password reset, email sending
- Platform admin, subscriptions
- Phone OTP (BR-100)
- i18n/RTL, RLS
- JWT, OAuth, a second database pool

---

## After this slice

Owner **approve** (exclusion fires). Then payment, dashboard polish.

---

## Step order for the agent

One numbered step at a time. Wait for OK. Do not scaffold unused Access folders.
