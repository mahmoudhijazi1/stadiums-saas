# SPEC-01 — Tenancy Foundation

**Type:** Build Spec — precise, boring instructions to hand to Cursor.
**Depends on:** DR-001 (tenancy runtime & modules), DR-002 (data model).
**Goal of this slice:** prove the tenant-isolation chain works end to end, using the smallest
possible real read. If this slice works, every later module rides the same rails.

> **Framework note for the agent:** this project's Next.js version has breaking changes vs.
> training data. Before writing any middleware, Prisma-extension, or Server Component API,
> read the relevant guide in `node_modules/next/dist/docs/` and confirm the current API. Do not
> write these APIs from memory. This spec tells you WHAT to build and WHY; the exact API comes
> from the installed docs.

---

## What this slice delivers

A visitor hits `ahmad.stadiums.com`. The system resolves that to the correct tenant, scopes the
database to that tenant automatically, and renders that tenant's list of pitches — and *only*
that tenant's pitches. A different subdomain shows different pitches. A bug in scoping shows
zero rows, never another tenant's data.

"List pitches" is deliberately trivial. It's the proof, not the feature.

---

## Prerequisites (should already exist from `create-next-app` + Prisma init)

- Next.js app with the `app/` router and TypeScript.
- Prisma installed, `schema.prisma` present, Postgres reachable via `.env`.
- next-intl NOT required for this slice — keep it out until a later spec. Hardcode nothing
  locale-related here; just don't build i18n yet.

---

## Step 1 — Minimal schema for this slice

In `prisma/schema.prisma`, define just enough to prove scoping:

- `Tenant`: `id`, `slug` (unique), `name`, `createdAt`.
- `Pitch`: `id`, `tenantId`, `name`, `createdAt`. Relation to `Tenant`.

Do NOT add `schedule_config`, blocks, or anything else yet — those come in the Venue spec.
`tenantId` on `Pitch` is mandatory (DR-001 §1). Migrate.

**Definition of done:** `npx prisma migrate dev` succeeds; both tables exist.

---

## Step 2 — Tenant resolution middleware

Create `src/middleware.ts` (or wherever this Next.js version expects middleware — verify in the
local docs).

It must:
- Read the incoming host (subdomain). For `ahmad.stadiums.com`, extract `ahmad`.
- For local dev, support a fallback: either `lvh.me` subdomains or a `?tenant=` query param, so
  you can test without real DNS. Put the host-parsing logic in ONE small function so the scheme
  can change later without touching callers (DR-001 §2).
- Set the resolved slug on a request header (e.g. `x-tenant-slug`) passed forward to app code.

It must NOT:
- Query the database. Middleware runs in a separate runtime; keep it to string parsing and
  header-setting (DR-001 §2). Validation that the tenant *exists* happens in app code, not here.

**Definition of done:** hitting different subdomains sets different `x-tenant-slug` headers;
you can log/inspect the header in a route.

---

## Step 3 — Request-scoped tenant context

In `src/lib/tenant-context.ts`:
- Read the `x-tenant-slug` header in app code (Server Component / Server Action context).
- Look up the tenant by slug. If it doesn't exist, this is a 404 for the whole request.
- Expose the resolved `tenantId` to the rest of the request via the request-scoped mechanism
  this Next.js version provides for reading headers in Server Components (verify in local docs —
  do NOT assume AsyncLocalStorage; DR-001 §2 explicitly corrected that assumption).

**Rule (DR-001 §2):** the URL resolves the tenant; a session (none yet) would only authorize
against it, never choose it.

**Definition of done:** a Server Component can obtain the current `tenantId` derived from the
subdomain, and an unknown subdomain 404s.

---

## Step 4 — Prisma client + tenant extension (the primary guard)

In `src/lib/db.ts`:
- Create the Prisma client.
- Add a client extension that automatically injects the current request's `tenantId` into every
  query on tenant-owned models — reads filtered by it, writes stamped with it (DR-001 §3). This
  is the Laravel global-scope equivalent and the primary isolation guard.
- Verify the current Prisma extension API against the installed Prisma docs — extension syntax
  has changed across Prisma versions.

In `src/lib/platform-db.ts`:
- A SEPARATE, unscoped client for platform-level work only (managing tenants). Make it
  deliberately awkward to reach for; it bypasses the guard (DR-001 §3). Not used in this slice
  except possibly by the seed.

**RLS is deferred** (DR-001 §3) — do not add Postgres RLS in this slice. The extension is the
guard for now.

**Definition of done:** a query for pitches, written with NO explicit `tenantId` in the calling
code, returns only the current tenant's pitches because the extension added the filter.

---

## Step 5 — The proof: list pitches

- `infrastructure/`: a repository function `listPitches()` that queries pitches. It must NOT
  pass `tenantId` by hand — the extension supplies it. This proves the guard works.
- `app/`: a Server Component page that calls the repository and renders pitch names in a plain
  list. No styling beyond readable. No client-side JS.

Place these in `src/modules/venue/infrastructure/` and the route under `src/app/`. Even for this
trivial slice, respect the module boundary (DR-001 §4) — the query lives in venue's
infrastructure, the route stays thin.

**Definition of done:** `ahmad.stadiums.com` lists Ahmad's pitches; a second tenant's subdomain
lists only that tenant's pitches; the page code never mentions `tenantId`.

---

## Step 6 — Seed two tenants

In `prisma/seed.ts`, using `platformDb` (unscoped, since seeding crosses tenants):
- Two tenants (`ahmad`, `sami`), each with 2–3 pitches.

**Definition of done:** after seeding, the two subdomains show different, correct, non-
overlapping pitch lists.

---

## Tests (Jest)

Install and configure Jest using the official approach for this Next.js version (verify in local
docs) before or with step 2. See `docs/guides/testing-jest.md`.

| Step | Jest expectation |
|------|------------------|
| 1 Schema | None required (migrate + inspect). |
| 2 Middleware | Unit-test the pure host/slug parser in `test/lib/tenant-slug.test.ts` (mirrors `src/lib/tenant-slug.ts`). |
| 3–4 Context / extension | No mandatory unit tests; isolation is proven by the acceptance test below. |
| 5–6 List + seed | No mandatory unit tests; covered by acceptance test. |

**Definition of done (Jest):** `npm test` passes and includes the slug-parser suite from step 2.

---

## The whole-slice acceptance test

1. Seeded two tenants with different pitches. ✅
2. `ahmad.<dev-host>` shows only Ahmad's pitches. ✅
3. `sami.<dev-host>` shows only Sami's pitches. ✅
4. An unknown subdomain 404s. ✅
5. The page/repository code contains **no** hand-written `tenantId` filter. ✅
6. Temporarily break the extension → the list goes empty, does NOT show the other tenant. ✅
   (This is the "bug shows zero rows, not a leak" property. Restore after testing.)
7. Jest suite for the tenant slug parser passes (`npm test`). ✅

If all seven pass, the foundation is real and SPEC-02 (Venue: schedule config + availability
engine) builds on it.

---

## Out of scope for this slice (do not build)

- Auth / sessions (later spec — email@domain + password).
- i18n / RTL (continuous, but not this slice).
- schedule_config, blocks, bookings, payments — later specs.
- RLS (deferred until the trigger in DR-001 §3).
- Any styling system beyond plain readable HTML.
