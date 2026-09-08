# DR-001 — Tenancy Runtime & Module Boundaries

**Status:** Settled (MVP foundation)
**Type:** Decision Record — what we decided, what we rejected, and why. This is a defense document.
**Followed by:** DR-002 (Core Data Model)

---

## 0. The constraint everything below serves

> Every owner-facing action must be faster than writing it on paper (G-1 / RULE-12).
> Each stadium's data is completely separate from every other's (RULE-7, RULE-8).

One droplet, one developer, shared database, many tenants. The decisions below exist to make tenant isolation cheap to get right and hard to get wrong — without paying for infrastructure this business doesn't need yet.

---

## 1. Multi-tenancy strategy

**Decision: shared database, shared schema, `tenant_id` on every tenant-owned table (including child tables).**

- *Rejected: schema-per-tenant.* N schemas = N× migrations, connection-pool pain on one droplet. Doesn't buy isolation that RLS can't already give.
- *Rejected: database-per-tenant.* Same cost, worse. A Laravel-multi-DB-tenancy habit that doesn't fit a single-droplet Node app.
- Shared schema is the only option that scales operationally on one droplet with one person maintaining it.

**Cross-cutting rule:** `tenant_id` on every tenant-owned table, no exceptions, including tables like `booking_participants` and `payment_tenders` that hang off a parent that already has one. Denormalized on purpose — every table can be scoped and checked independently, which is what makes RLS (see §3) a cheap backstop rather than a redesign.

---

## 2. Tenant resolution: middleware, header, context

**The framework fact that shapes this whole section:**

> Next.js middleware runs in a **separate runtime** from application code. It cannot set up request-scoped state that the rest of the app can read directly. It can only pass a note forward — a request header.

**Decision: middleware resolves subdomain → tenant, validates it, sets a header. Application code reads that header and establishes request-scoped tenant context.**

```
request → middleware (resolves ahmad.stadiums.com → tenantId, sets header)
        → app code (reads header, establishes context for this request)
        → Prisma extension (reads context, injects tenant_id into every query)
```

- *Rejected (from the earlier context brief):* middleware writing tenant context directly into shared state (e.g. AsyncLocalStorage) for app code to read. **Not possible** — the runtimes don't share memory. This was an error in the original planning notes and is corrected here.

**Tenant URL scheme: subdomain (`ahmad.stadiums.com`).**

- *Rejected: path slug (`app.com/ahmad`)* — the original context-brief choice, made for simpler SSL/DNS on a droplet. Superseded: subdomains give a cleaner "this is his own site" feel (A-12) and resolution goes through one function either way, so the DNS/SSL cost is paid once, not repeatedly.
- Resolution is a **single resolver function** — local dev can substitute `lvh.me` or a `?tenant=` query param without touching the rest of the app. Additive, not a redesign, if the scheme ever changes again.

**The rule that must never invert:**

> The URL resolves the tenant. The session only authorizes *against* that tenant. Never the reverse.

Why this direction and not the other: if the session decided the tenant, a stale or forged session could leak one tenant's session into another tenant's subdomain. The URL is the source of truth for *which business this request is about*; the session only answers *is this person allowed here*.

---

## 3. Defense in depth: Prisma extension as primary guard, RLS deferred

**Decision: a Prisma Client extension (Laravel global-scope equivalent) injects `tenant_id` into every query automatically. This is the primary guard. Row Level Security is deferred, not rejected.**

Why deferred and not built now:
- The Prisma extension is the real, load-bearing guard — it's where 99% of the safety comes from, and it's *free* (application code, not a second DB role).
- RLS only catches a **bug in the extension** — a second line of defense against a mistake, not the primary mechanism.
- RLS costs a second Postgres role and transaction-wrapped queries for every request. Real cost, for a benefit that only matters if the primary guard already failed.

**Trigger to add RLS:** the first real paying tenant who isn't a friend, or any data leak you'd genuinely be afraid of. Not "eventually" — a named, concrete trigger.

**Standing condition for staying cheap without RLS today:** `tenant_id` must be on every tenant-owned table, including children (§1). If that condition is ever violated — a table added without `tenant_id` "because it hangs off a parent" — the deferral becomes unsafe. This is why §1's rule has no exceptions.

**A separate, deliberately awkward `platformDb` client** — unscoped, for platform-level work only (managing tenants, plans, subscriptions), restricted to a small file allowlist. It's made awkward on purpose: reaching for it should feel like an exception, because it bypasses the primary guard entirely.

---

## 4. The module map

**The test for every boundary:** does it change for a different reason? If yes, separate module.

| Module | Owns | Changes when… |
|---|---|---|
| **Platform** | tenants, plans, subscriptions | Billing/plan rules change. Uses `platformDb`. |
| **Access** | users, memberships, permissions, sessions | Login/permission rules change. |
| **People** | persons, user↔person links | How a human is represented changes. |
| **Venue** | pitches, schedule rules, blocks, availability engine | The owner's scheduling rules change. |
| **Booking** | bookings, participants, interests | The booking flow changes. |
| **Payment** | payments, tenders, exchange rate | Money-handling rules change. |
| **Ledger** | ledger entries | Never, in practice — it's the stable read layer (see DR-002 §2.20). |
| **Expense** | expenses | What counts as an expense changes. |
| **Notification** | message building, WhatsApp links | The notification channel changes. |
| **Shop** *(Phase 2)* | products, stock, sales | Deferred — named seam only. |
| **Academy** *(Phase 3)* | groups, coaches, attendance | Deferred — hangs off People/Venue/Payment, changes nothing above. |

**Dependency rule — arrows point down, never up:**

```
Booking, Expense, Shop(P2), Academy(P3)
        │
        ▼
    Payment ──▶ Ledger
        ▲
People, Venue ◀── used by Booking, Academy
Access, Notification ◀── used by anyone
Platform ── stands alone
```

If a lower module ever needs to know about a higher one — e.g. Payment importing something from Booking — the boundary is wrong. This is not a style preference; it's the mechanism that lets Phase 2 (Shop) and Phase 3 (Academy) plug in by *adding* modules instead of *editing* existing ones (BR-95's proof case).

**Where modules live:** `src/modules/*`, not `app/`. `app/` (Next.js routes) contains only Server Actions that validate → authorize → delegate — no business logic. Self-test: *"if I dropped Next.js for Express, what changes?"* Answer should be: only `app/`.

**Inside each module, three layers:**
- `domain/` — pure functions, no database, no `await`. The rules.
- `application/` — the use cases, orchestration. This is where `await` and transactions live.
- `infrastructure/` — all Prisma queries, hidden here.

---

## 5. Transaction ownership

**Decision: the use case that starts the action opens the transaction and passes the transaction client (`tx`) down. No module opens its own transaction.**

```ts
// application/collectBookingPayment.ts
await db.$transaction(async (tx) => {
  await recordPayment(tx, ...)      // Payment
  await markParticipantPaid(tx, ...) // Booking
  await writeLedgerEntry(tx, ...)    // Ledger
})
```

- *Rejected: the lowest module (e.g. Payment) owns the transaction.* Payment would have to call back up into Booking to mark a participant paid — an upward arrow, and the boundary from §4 collapses.
- *Rejected: each module opens its own transaction.* Three separate transactions is three separate chances to half-fail — money taken with no game recorded, or a ledger entry with no payment behind it. This is the exact failure the transaction exists to prevent.
- *Rejected: a shared "transaction service" helper.* Nothing to configure or swap — empty indirection with no behavior of its own.

**Framework fact:** Prisma has no ambient "current transaction." Every repository function must accept the client as an explicit argument (`tx`, not `db`). A function that uses `db` instead of `tx` silently escapes the transaction — its write won't roll back with the rest. This is not a style choice; it's the only way the transaction boundary is real.

**The one thing that is deliberately outside the transaction: notifications.**

```ts
const result = await db.$transaction(async (tx) => { /* money writes */ })
await notify(result)   // after, not inside
```

Two reasons: (1) building a WhatsApp link isn't a database write — holding the transaction open for it wastes resources on the droplet for no reason; (2) if the cash was really collected and the notification fails, the money must not roll back. The rule: **transactions contain writes to your own database, nothing else.**

---

## 6. Cross-cutting invariants from this document

- `tenant_id` on every tenant-owned table, including children — no exceptions (the RLS-deferral condition).
- URL resolves tenant; session only authorizes against it — never the reverse.
- All module dependencies point down; a module never imports from a module above it.
- The use case that starts an action owns the transaction; nothing opens its own.
- Notifications always happen after the transaction commits, never inside it.

---

*Corrections welcome by section number. This document is the foundation DR-002 (data model) and all future build specs build on.*
