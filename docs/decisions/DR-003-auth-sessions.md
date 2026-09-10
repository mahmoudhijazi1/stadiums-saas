# DR-003 — Auth, sessions, and memberships

**Status:** Settled (MVP access)
**Type:** Decision Record — what we decided, what we rejected, and why. This is a defense document.
**Depends on:** DR-001 (URL = tenant; session only authorizes against it; Access module), DR-002 (users / memberships sketch; persons ≠ users)
**Covers:** Access (users, memberships, sessions, `can(...)`). Not owner approve UI, not platform-admin billing UI.

---

## 0. The constraint this document serves

> The URL chooses the stadium. Login only answers: *is this person allowed to work here?* (DR-001 §2)
> Most humans never log in (BRD 4.1, BR-16, A-7). Owner actions stay faster than paper (G-1 / RULE-12).
> Logging in must not require a mailbox they do not have (BR-99). Phone OTP waits for Phase 2 (BR-100).

Public booking stays unauthenticated. This DR exists so the first owner screen (approve) has a real lock, not a fake one.

---

## 1. What logs in, and what does not

**Decision: only Owner and Staff have accounts in Phase 1.** Players keep name+phone. Guardians and coaches wait for later phases.

- *Rejected: player accounts for MVP.* BR-16 / A-7. The public request path must not grow a password.
- *Rejected: `user_id` on `persons`.* Already settled in DR-002 §2.1. The link is `user_person_links` (table appears with User; stays empty until a later slice actually links someone).

**Person vs account is the product rule.** Auth never turns a walk-in player into a User as a side effect of requesting a slot.

---

## 2. Login identifier: `local@tenant-slug`, not a mailbox

Build notes said “email@domain + password.” BR-99 says do not require an email address the user does not have. A-8: they will ignore email.

**Decision: the username is a **login identifier** shaped like `local-part@tenant-slug` (e.g. `owner@ahmad`). It is unique globally. We never send mail to it.** Password is a secret they choose (or we seed). We store a **hash**, never the password. Hash algorithm is chosen in the SPEC from installed libraries — not here.

- *Rejected: real Gmail/Hotmail as the username.* Contradicts BR-99 and A-8.
- *Rejected: phone + SMS/WhatsApp OTP in this slice.* That is BR-100 (Phase 2). Additive later; identifier can stay, a second factor can be added.
- *Rejected: “username” unique only inside one tenant, with `tenant_id` on `users`.* DR-002’s sketch is `users` without `tenant_id`, `memberships` with `tenant_id`. The slug in the identifier (`@ahmad` vs `@sami`) avoids collisions without making User a tenant-owned row.
- *Rejected: magic links / OAuth / Google.* Needs an inbox or a third party. Not simple on a phone outdoors (A-3, A-9).

**Where they type it:** a login page **on that stadium’s URL** (`ahmad.stadiums.com/login` or local `/?tenant=ahmad` + `/login`). They do not pick a stadium from a global picker after login.

---

## 3. Users vs memberships vs the URL

**Decision: follow DR-002’s sketch.**

```
users         id, identifier, password_hash, created_at
              -- NO tenant_id. Unique(identifier).

memberships   id, tenant_id, user_id, role(OWNER|STAFF), permissions(jsonb)
              UNIQUE(tenant_id, user_id)

sessions      id, user_id, expires_at, created_at
              -- NO tenant_id (see §4)
```

**Login sequence (must never invert):**

1. URL / header already resolved the tenant (DR-001).
2. Look up User by identifier; verify password hash.
3. Load **membership for this URL’s `tenantId`**. None → fail (same as unknown password from the user’s point of view: you cannot work *here*).
4. Create a session for the **user**, not for a tenant.

Ahmad’s owner cookie on `sami.stadiums.com` must not show Sami’s bookings. Step 3 is the lock. The session does not contain “current tenant.”

- *Rejected: session chooses tenant* (`session.tenantId` as source of truth). DR-001 §2. A stolen or confused cookie would drive the Prisma guard to the wrong stadium.
- *Rejected: one User row per tenant with `tenant_id` on users.* Then “the same human at two stadiums” becomes two passwords. Memberships already express “this login may work at this stadium.” Platform admin (later) also needs a User that is not a tenant row.

**`tenant_id` on memberships, not on users.** Memberships are tenant-owned (the guard injects). Users and sessions are not tenant-owned — looking up “does this identifier exist?” is platform-shaped, like Tenant by slug. Use `platformDb` only for User/Session tables if the tenant extension would lie; memberships go through `db`. SPEC will list the allowlist. Do not invent a second pool (see [prisma-transaction-tenant-guard](../guides/prisma-transaction-tenant-guard.md)).

---

## 4. Session: HTTP-only cookie, server-side

**Decision: a server-side session id in an HTTP-only cookie.** The browser does not store the password or a JWT that APIs trust blindly.

Exact cookie name, Max-Age, and Next 16 cookie/session API are **SPEC + local `node_modules/next/dist/docs/`** — not this DR.

- *Rejected: JWT in `localStorage` / `sessionStorage`.* XSS can steal it; it is not faster than paper for the owner; it invites “decode the token to know the tenant.”
- *Rejected: putting `tenantId` in the cookie as the isolation key.* Cookie may exist; **authorization is membership ∩ URL tenant.** Prefer a host-only cookie (not parent-domain) when the installed Next API allows it, so `ahmad`’s cookie is not even sent to `sami`. If a shared cookie is unavoidable, step 3 in §3 still saves us.

Logout deletes the session row (or expires it) and clears the cookie.

---

## 5. Roles and permissions

**Decision: `role` is `OWNER | STAFF` on the membership. `permissions` is jsonb, Zod-validated (same rule as `schedule_config`).**

- **OWNER:** full access to this tenant (BR-96). Not a json shopping list they must tick.
- **STAFF:** reduced. **Default: cannot approve bookings** (BR-97). Other staff permissions start conservative; BR-98 says we must be able to add/remove flags later **without a migration of the permission model** — that is why flags live in jsonb, not new columns.

**`can(membership, permission)` is a pure function in Access `domain/`.** Server Actions: validate → `can(...)` → delegate. No “staff vs owner” `if` scattered in Booking.

- *Rejected: only a role enum, no jsonb.* Then every new staff capability is a code change and a deploy, against BR-98.
- *Rejected: a `permissions` table of rows per flag.* Extra CRUD before the owner can hire one evening worker (G-1). Jsonb on the membership is enough for one droplet.
- *Open, not this DR:* whether staff may collect payment (BRD Q-2). Default deny until a later decision.

Platform administrator (BR-66, BR-104) is **not** `role=OWNER` on a tenant. Out of this DR. Do not overload memberships for “us.”

---

## 6. Module boundaries

**Access owns:** users, memberships, sessions, password verify, `can(...)`.

**Access does not own:** booking approve, schedule, money. Those ask Access “may this membership do X?” and then run their own use case.

Arrows: Booking / Venue / … may import Access. Access must not import Booking (DR-001 §4).

`user_person_links` is People (DR-002), not Access. It needs a User id; the **table** is created when User exists. Filling it is a later SPEC. Access does not import People to “find person by login.”

Thin `app/` login route: form → Server Action → Access use case. No Prisma in the page.

---

## 7. Seed and first owner

**Decision: seed creates one User + OWNER membership per seeded tenant** (Ahmad, Sami), with a known local password documented in seed only — not in the client bundle.

Platform “create owner accounts” (BR-102 manual subscription) is a later slice. Until then, seed (and later a documented script) is how a stadium gets its first login.

---

## 8. Cross-cutting invariants from this document

- URL tenant first; session never selects the stadium.
- Players do not log in in Phase 1.
- Identifier is `local@tenant-slug`, not a mailbox; password is hashed.
- Users/sessions have no `tenant_id`; memberships do; `UNIQUE(tenant_id, user_id)`.
- `can(...)` in Access domain; staff default cannot approve.
- No second Prisma pool/client for auth.
- Public `requestPublicSlot` stays unauthenticated.

---

## 9. Still open (not blocking SPEC-04)

- Exact Next 16 session/cookie helpers and password-hash package (read installed docs in the SPEC).
- Staff collect-payment (Q-2) and “which staff collected” (Q-7).
- Platform-admin login.
- Phone confirmation (BR-100).
- Filling `user_person_links`.

---

*Corrections welcome by section number. SPEC-04 implements this; it does not reopen §1–5 unless this file changes first.*
