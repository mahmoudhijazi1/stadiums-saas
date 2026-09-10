# Gotcha — Prisma `$transaction` + the tenant guard

**When this was found:** 2026-09-09, finishing SPEC-03 (public name+phone → PENDING booking).  
**Status:** Fixed. The public form works.  
**You are returning later:** start at §1 (symptoms). The diary of failed attempts is §4. The rule you must not break is §5.

This is **not** a new architecture decision. It is how we had to implement [DR-001](../decisions/DR-001-tenancy-and-modules.md) against Prisma 7 + `adapter-pg`. Product rules stay in the DRs.

---

## 1. What you will see if this regresses

Two different errors. They look unrelated. They are the same family of bug: **a second database query while an interactive transaction is open**.

| When | Error | Typical duration |
|---|---|---|
| Submit the public form | `Transaction API error: A query cannot be executed on an expired transaction. The timeout for this transaction was 5000 ms` on `prisma.pitch.findUnique()` | ~5.1s |
| Submit, or even just load pitches | `Connection terminated unexpectedly` | ~50–150ms, or a GET 500 |

The 5s error is Prisma giving up. The socket error is Postgres (or the local proxy on `DATABASE_URL`) hanging up because too many pools, or two Prisma clients fighting over one pool.

**Where it blows up in our app:** first query *inside* `db.$transaction` — for public booking that is `findPitchById` → `tx.pitch.findUnique`, after the tenant extension has already asked “which stadium is this?”

---

## 2. Why it happens (the setup)

Three facts collide.

### 2.1 The tenant guard queries the DB

`src/lib/db.ts` is a Prisma **query extension**. Every Pitch / Person / Booking / BookingParticipant operation calls `getCurrentTenantId()`, which (if nothing is cached) does:

`headers()` → `x-tenant-slug` → `platformDb.tenant.findUnique`

That is correct for isolation (DR-001). Callers still must **not** pass `tenantId`.

### 2.2 Interactive `$transaction` holds one connection

Prisma 7 interactive transactions (`db.$transaction(async (tx) => { ... })`) check out a connection, run `BEGIN`, and **hold that connection** until commit/rollback. Default **timeout is 5000 ms**. Docs: [Prisma transactions](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions).

While that connection is held, Prisma will **not** run another query on the **same** `PrismaClient`. The second query waits. The transaction waits for the second query. After 5s Prisma expires the transaction, then the first `tx` query fails with “expired transaction”.

### 2.3 `platformDb` was the same client

`platformDb` is supposed to be the unscoped hatch (tenant lookup, seed). In code it was:

```ts
export const platformDb = prismaBase; // same PrismaClient as `db`
```

So the guard’s Tenant lookup **is** a second query on the client that is already in `$transaction`. Deadlock.

A Server Action is a **new request**. The page already loaded the tenant; that does not help the POST. React `cache()` is per-request and, worse, **does not apply inside Prisma’s `$allOperations` callback**.

Raising the Prisma timeout only makes the form hang longer. Do not do that.

---

## 3. What the public submit actually does

`submitPublicSlotRequest` (thin Server Action) → `requestPublicSlot` → `db.$transaction`:

1. `findPitchById(tx, …)` ← **first `tx` query; this is where both errors appeared**
2. Domain: is this a real offered slot? Copy engine price.
3. `findOrCreatePerson`
4. Raw INSERT booking (`during` is Unsupported; no `booking.create`)
5. `bookingParticipant.create`

Step 1 already runs the tenant extension. If that extension hits the database, you never get to step 2.

---

## 4. What we tried (so you do not retry it)

Diary in [progress.md](../progress.md) Chapters **17–20**. Short version:

| Attempt | Idea | Result |
|---|---|---|
| **A** | `await getCurrentTenantId()` *before* `$transaction` so React `cache()` is warm | Still 5.1s on `findUnique`. Prisma’s extension callback **does not see** React `cache()`. |
| **B** | Give `platformDb` its **own** `pg.Pool` + `PrismaClient` | Deadlock gone in theory. Homepage 500: `Connection terminated unexpectedly`. `DATABASE_URL` has `connection_limit=10`. Two pools (max 10 each) + Prisma Studio + HMR leaked pools → proxy drops sockets. |
| **C** | Two `PrismaClient`s, **one** shared pool | GET pitches 200. POST 500 in ~52ms: `Connection terminated unexpectedly`. Prisma 7 `adapter-pg` treats the pool as **exclusive**. A second client + `$transaction` yanks the socket. |

None of A–C is the fix. Do not reintroduce a second pool or a second `PrismaClient` on this pool.

---

## 5. What actually works (the rule)

**One `PrismaClient`. One `pg.Pool` (`max: 10`).**

**Load the tenant before `BEGIN`. Store it on the request. The guard reads memory during the transaction — it must not query.**

That *is* DR-001:

> Middleware sets a header. Application code reads the header and establishes **request-scoped tenant context**.

Middleware still cannot use `AsyncLocalStorage` for the app (different runtime). **Application code can.** We use Node `AsyncLocalStorage` in `tenant-context.ts`. React `cache()` stays for the React/page side only.

### Flow now

```
Server Action / use case
  → db.$transaction   (wrapped)
      → withCurrentTenant
          → load Tenant via platformDb   ← ordinary query, no BEGIN yet
          → ALS.run(tenant, …)
              → BEGIN
              → tx.pitch.findUnique
                  → extension getCurrentTenantId()
                      → ALS hit (no DB)
              → person / booking / participant
              → COMMIT
```

### Code map (read these, in this order)

| File | Job |
|---|---|
| `src/lib/prisma-base.ts` | One client, one pool. Do not add a second `PrismaClient`. |
| `src/lib/platform-db.ts` | Unscoped **name** (`platformDb = prismaBase`). Same engine. Awkward on purpose. |
| `src/lib/tenant-context.ts` | `loadTenant`, React `cache()`, ALS, `withCurrentTenant`. |
| `src/lib/db.ts` | Query extension + **`$transaction` wrapped** in `withCurrentTenant`. |
| `src/modules/booking/application/request-public-slot.ts` | Owns the transaction (DR-001). Does not pass `tenantId`. |

`insertPendingPublicBooking` still calls `getCurrentTenantId()` for `$executeRaw` (the extension does not stamp raw SQL). Inside the wrapped transaction that is an ALS read, not a second Tenant query.

---

## 6. Rules for later slices (auth, approve, payment)

Copy these; do not “simplify” them away.

1. **Never** query `platformDb` / `prismaBase` from inside an interactive `$transaction` callback, including from the tenant extension. Tenant must already be on ALS.
2. **Never** create a second `PrismaClient` or a second `pg.Pool` for tenant lookup. The local URL cap is 10 connections. HMR leaks pools; if sockets look haunted, restart `npm run dev`.
3. **Do not** pass `tenantId` into repositories to “avoid the guard.” The guard is the proof.
4. **Do not** raise Prisma `timeout` to hide a nested query.
5. **Do not** rely on React `cache()` inside Prisma `$allOperations`. Use ALS (`withCurrentTenant`). `db.$transaction` is already wrapped; if you open a transaction some other way, wrap it yourself.
6. Keep transactions **short**: CPU (slot generation) can stay inside for now; do not add HTTP or extra Prisma clients inside `tx`.
7. Notifications stay **after** commit (DR-001). Unrelated to this bug, still true.

---

## 7. How to verify after a change in this area

1. `npm run dev` (restart if you just changed `prisma-base.ts` / pools).
2. `http://localhost:3000/?tenant=ahmad&date=YYYY-MM-DD` — pitches render (GET 200).
3. Name + phone (8–15 digits) → Request → **Request received**, same `?date=`, slot still listed.
4. Dev log: POST not 500, not ~5s.
5. Prisma Studio: Person, Booking `PENDING`/`PUBLIC`, BookingParticipant `isRequester`.
6. `npm test` — domain tests unrelated to this; they should still pass.

---

## 8. If it breaks again — checklist

1. Stack still on `db.ts` `$allOperations` / `pitch.findUnique` inside `request-public-slot`? Nested tenant lookup is back.
2. Did someone set `platformDb = new PrismaClient(...)`? Revert to the alias.
3. Did someone remove the `$transaction` wrapper in `db.ts`? Put it back.
4. `Connection terminated unexpectedly` on GET? Too many pools. Restart the Next process; confirm only one `pg.Pool`.
5. ALS empty in the extension? `getCurrentTenantId()` will hit the DB again → deadlock if you are inside `tx`.

---

## 9. What this is not

- Not a Venue/slot-engine bug.
- Not “the insert is slow.”
- Not a reason to put `tenantId` on the public form (hidden field is the **slug** for `?tenant=` after redirect only).
- Not RLS. RLS is still deferred (DR-001).

When you wake up: SPEC-03 is implemented. Next product slice is **auth**, before owner approve. This file is only so we do not walk into the same Prisma trap on the first `$transaction` that approves a booking.
