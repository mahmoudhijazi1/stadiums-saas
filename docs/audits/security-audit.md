# Security audit: full application

**Historical snapshot.** Written 2026-09-30 on branch `audit/security`, against `main` at `7ba058d` plus PR #6 (`498e400`, docs only). Do not rewrite this body. Add a one-line banner or a dated addendum at the end when something changes.

**Method.**
- Read the code. Every claim below names a file and function.
- Throwaway probes ran against `stadiums_test` only, never `stadiums_dev`, and were all deleted afterwards:
  - an integration test that impersonates tenant B's owner and calls every id-taking use case with tenant A's ids;
  - a flood test on `requestPublicSlot`;
  - `curl` probes against `next start` pointed at `stadiums_test`, with the seed run there under `NODE_ENV=production`.
- **UNVERIFIED** marks a claim I could not trace to code or prove with a probe.
- The production server (nginx, firewall, ports, TLS, Hestia) is not in this repo. Everything about it is under [To confirm on the server](#to-confirm-on-the-server), and nothing there is guessed.
- A Critical or High finding needs a working probe. Where a strong suspicion had no probe, the finding is rated Medium and marked UNVERIFIED.

## Summary

| Severity | Count | Findings |
|---|---|---|
| Critical | 0 | none |
| High | 1 | [S-1](#s-1-the-seed-wipes-any-database-it-is-pointed-at-including-production) seed has no production guard |
| Medium | 7 | [S-2](#s-2-session-ids-are-cuid-v1-not-cryptographically-random) session ids, [S-3](#s-3-no-brute-force-protection-on-login) login brute force, [S-4](#s-4-login-reveals-which-identifiers-exist-by-timing) login timing, [S-5](#s-5-public-requests-can-be-flooded-and-names-are-unbounded) public flood, [S-6](#s-6-anyone-can-file-a-public-request-under-someone-elses-phone) phone impersonation, [S-7](#s-7-no-security-headers) headers, [S-8](#s-8-unbounded-queries-on-hot-paths) unbounded queries |
| Low | 13 | S-9 … S-21 |
| Info / pass | — | tenant isolation probes, raw SQL, `platformDb`, CSRF, open redirects, XSS, service worker, cache headers, error pages |

**Bottom line.**
- Tenant isolation held on every probe: 22 use cases, 31 raw SQL calls, and every `platformDb` call site.
- No Critical finding.
- The one High finding is operational. `npm run db:seed` deletes every table and recreates three users with a password that is public in the repo, and nothing stops it from running in production. The fix follows this report on the same branch.
- The Medium findings are what separate "pilot with friends" from "public product". They are session ids from `Math.random`, no rate limits anywhere, no security headers, and a public form that anyone can flood or use to impersonate a customer by phone.

---

## 1. Tenant isolation

### 1.1 Models vs `TENANT_SCOPED_MODELS`

`src/lib/db.ts` lists these tenant-scoped models: Pitch, Person, Booking, BookingParticipant, SlotInterest, BookingDueChange, Membership, UserPersonLink, ExchangeRate, Payment, PaymentAllocation, PaymentTender, LedgerEntry and Expense. Every model with a `tenantId` column in `prisma/schema.prisma` is on the list.
- Global by design (DR-001): Tenant, User, Session.
- **Missing: none.**

Latent guard gaps, with no call sites today:
- `upsert` and `updateManyAndReturn` are not pre-guarded. They fall through to the post-check (**S-20**).
- The update/delete ownership pre-check reads through the base client, outside the caller's transaction (**S-20**).

### 1.2 Raw SQL inventory

There are 31 raw calls: 29 in `src/modules/booking/infrastructure/bookings.ts` and 2 in `src/modules/people/infrastructure/persons.ts` (`searchPersons`).
- All are `$queryRaw` / `$executeRaw` tagged templates or use `Prisma.join`.
- None use `$queryRawUnsafe`, `$executeRawUnsafe` or `Prisma.raw`.
- Every statement filters its driving table on `getCurrentTenantId()` from ALS.
- Joined tables (Person, BookingParticipant, PaymentAllocation) are reached by id from the tenant-filtered row, not re-filtered on `tenantId`. That is correct today, because ids come from tenant rows. A second `tenantId` predicate on each join would be defence in depth. It is not a finding.
- `searchPersons` escapes `%`, `_` and `\` in the LIKE pattern and caps results at 20.

### 1.3 Cross-tenant id probes

The probe signed in as tenant B's owner on B's host, then passed tenant A's ids to every id-taking use case. Afterwards it checked that tenant A's rows were unchanged.

| Result | Use cases |
|---|---|
| `booking.not_found` | approveBooking, rejectBooking, cancelBooking, recordNoShow, collectBookingPayment, adjustBookingDue, switchToPerPlayer, switchToWhole, collectSlotPayment, collectAllRemaining |
| `null` / empty / zeros | loadOutcomeNotify, loadDecisionNotify, listDebtWarnings, getPerson, listPersonBookings, getPersonBookingStats, searchPeople, listLivePitchWindows, getPitchEditor |
| `booking.pitch_not_found` | updatePitch, createOwnerBooking, requestPublicSlot |

All 22 were refused. **Pass.**

Every server action and `route.ts` reaches data only through these use cases (see §3), so the action layer adds no id path of its own. `submitUpdatePitch` interpolates the form's `pitchId` into a redirect path. That path always starts with `/owner/`, so it is not an open redirect (§2.4).

### 1.4 Tenant resolution

The flow is: `src/proxy.ts` → `resolveRequestHost` / `parseTenantSlug` (`src/lib/tenant-slug.ts`) → the proxy sets or deletes `x-tenant-slug` → `loadTenant` (`src/lib/tenant-context.ts`).

| Probe (curl → `next start`, `stadiums_test`) | Result |
|---|---|
| `Host: ahmad.lebstads.test` | 200, ahmad |
| `Host: AHMAD.LEBSTADS.TEST` (uppercase) | 200, ahmad (normalised) |
| Unknown subdomain | 404 |
| Bare domain `lebstads.test` | 404 (no tenant; public landing not served) |
| `www.lebstads.test` | 404 |
| `ahmad.attacker.example` | **200, ahmad**: any base domain is accepted (S-10) |
| Trailing dot `ahmad.lebstads.test.` | 200 |
| `ahmad.lebstads.test:443` | 200 |
| Spoofed `x-tenant-slug: sami` on a normal path | Ignored: the proxy overwrites it |
| Spoofed `x-tenant-slug` on `/owner/people/x.png` | **Believed**: the proxy matcher skips any path ending in an image extension (S-9) |
| `Host: localhost` + `X-Forwarded-Host: ahmad.lebstads.test` | Believed (S-11) |
| `Host: localhost` + `Origin` / `Referer` only | No tenant page reached |
| Sami's session cookie on ahmad's host | 307 to `/owner/login` (membership is looked up per URL tenant) |

The session only authorizes against the URL tenant, as DR-001 requires. `getCurrentMembership` looks up the membership for the resolved tenant. A session with no membership there gets the login page. None of the resolution quirks leads to cross-tenant data.

### 1.5 `platformDb` call sites

`platformDb` bypasses the tenant guard. It is used in:
- `access/infrastructure/sessions.ts`: find by cookie id, create, delete;
- `access/infrastructure/users.ts`: find by identifier;
- `access/infrastructure/tenants.ts`: settings read and write by the **server-resolved** tenant id;
- `src/app/manifest.ts`;
- `src/lib/tenant-context.ts`;
- the seed.

None takes a tenant id or row id from user input. None runs inside a tenant transaction. **Pass.**

### 1.6 The manifest route

`src/app/manifest.ts` is outside the proxy matcher and resolves the host itself. It returns the tenant's display name for an existing slug and the fallback `lebstads` otherwise. That lets anyone test whether a stadium slug exists (**S-12**, Low). The public page gives the same answer (200 vs 404), so the manifest adds almost nothing.

---

## 2. Auth and sessions

### 2.1 Cookie

`src/modules/access/infrastructure/session-cookie.ts` sets the cookie `stadium_session` with:
- `httpOnly`;
- `SameSite=Lax`;
- `path=/`;
- `Secure` when `NODE_ENV=production`;
- `Max-Age` of 7 days;
- no `Domain` attribute, so it is host-only. A cookie issued for ahmad is not sent to sami. **Pass.**

The `Secure` flag was confirmed from code, not from a response header: the last capture of `Set-Cookie` was cut short when the probe server was stopped.

### 2.2 Session storage, lifetime, logout, fixation

- The session row is `Session { id @default(cuid()), userId, expiresAt }`, and the cookie value is the raw `Session.id`.
- `findSessionById` rejects rows past `expiresAt`.
- Logout (`logout.ts`) deletes the row and clears the cookie. Probe P9: deleting the row made `/owner/requests/live` return 401. **Pass.**
- Fixation: `login` always creates a new row and overwrites the cookie. An attacker cannot plant a cookie for a tenant host: cookies are host-only, and no tenant controls content on a sibling subdomain. **Pass.**
- Session ids are cuid v1 (**S-2**). Expired rows are never deleted (**S-17**).

### 2.3 Passwords, brute force, enumeration

- `password.ts` uses `scrypt` with the Node defaults (N=16384, r=8, p=1), a 16-byte random salt and a `timingSafeEqual` compare. The cost is below the current OWASP guidance of N=2^17 (**S-16**).
- `login.ts` returns the same error key (`access.invalid_login`) for an unknown identifier, a wrong password, and a user with no membership on this tenant. **Pass** on message enumeration.
- It skips scrypt for unknown identifiers. Probe P7: about 50 ms for an existing identifier vs about 6 ms for an unknown one (**S-4**).
- There is no rate limit or lockout (**S-3**).

### 2.4 Open redirects and reflected values

- `redirectOwner` (`src/app/owner/login/form-query.ts`) builds every redirect from a fixed `/owner/...` path. User input only goes into the query string.
- `?error=` and `?ok=` are rendered through fixed catalogs (`src/lib/error-messages.ts`, `ui()`). An unknown key falls back to generic copy, so nothing is reflected verbatim.
- The login page takes no `next=` / `returnTo` parameter. **Pass.**
- `loadDecisionNotify` puts the `reason` query value into the WhatsApp message text (**S-15**, Low).

---

## 3. Authorization matrix

Every server action is "thin": it parses the form with Zod, calls one use case, and redirects. The use case calls `getCurrentMembership()` and `can(membership, permission)`. OWNER always passes. STAFF passes only when the flag is exactly `true` (`access/domain/can.ts`).

| Entry point | File | Zod | Use case → permission |
|---|---|---|---|
| submitApproveBooking | `owner/(app)/today/actions.ts` | parseBookingDecision | approveBooking → `bookings.approve` |
| submitRejectBooking / submitDismissBooking | same | parseBookingDecision | rejectBooking → `bookings.approve` |
| submitDismissMissed | same | none (no input) | dismissMissedRequests → `bookings.approve` |
| submitCancelBooking | same | parseBookingDecision | cancelBooking → `bookings.cancel` (+ `bookings.adjust_due` to lower the fee) |
| submitRecordNoShow | same | parseBookingDecision | recordNoShow → `bookings.no_show` (+ `bookings.adjust_due` to lower the fee) |
| submitAdjustBookingDue | same | parseAdjustDueForm | adjustBookingDue → `bookings.adjust_due` |
| submitCollectPayment | same | parseCollectPayment | collectBookingPayment → `payments.collect` |
| submitSwitchToPerPlayer / submitSwitchToWhole | same | switch…Schema.parse | switch… → `bookings.adjust_due` |
| submitCollectSlot / submitCollectAllRemaining | same | collect…Schema.parse | collectSlotPayment / collectAllRemaining → `payments.collect` |
| submitCreateOwnerBooking | `owner/(app)/book/actions.ts` | parseOwnerCreateBooking | createOwnerBooking → `bookings.create` |
| submitRecordExpense | `owner/(app)/money/actions.ts` | parseRecordExpense | recordExpense → `expenses.record` |
| submitSetExchangeRate | `owner/(app)/more/settings/actions.ts` | parseExchangeRate | setExchangeRate → `settings.manage` |
| submitSetBookingRules | same | parseBookingRulesForm | setBookingRules → `settings.manage` |
| submitSetTimeDisplay | same | parseTimeDisplayForm | setTimeDisplay → `settings.manage` |
| submitCreatePitch | `…/settings/pitches/actions.ts` | parsePitchDraft | createPitch → `settings.manage` |
| submitUpdatePitch | same | parsePitchDraft (`pitchId` **not** parsed, S-21) | listLivePitchWindows (membership only) → updatePitch → `settings.manage` |
| submitLogin / submitLogout | `owner/login/actions.ts` | parseLogin / none | login / logout (public; logout needs a cookie) |
| submitPublicSlotRequest | `app/(public)/request-slot.ts` | parsePublicSlotRequest | requestPublicSlot (public, tenant from host) |
| setUiLocale | `app/locale-actions.ts` | parseUiLocale (allowlist) | none: it only writes the `ui_locale` cookie |
| GET `/owner/requests/live` | `owner/(app)/requests/live/route.ts` | n/a | getLiveQueue → membership only; 401 otherwise |
| `/manifest.webmanifest` | `app/manifest.ts` | n/a | public |

Reads on owner pages (Today, History, People, Money) go through the same membership check. `summarizeLedgerPeriod` requires `reports.view`. People search needs only a membership, so staff with no flags can search every customer's name and phone. This is by design in DR-003 (**S-19**, Info).

Staff permissions were probed in `test/integration/staff-permissions.integration.test.ts` (PR #3) and `expense-ledger.integration.test.ts` (PR #5). Each use case that requires a flag refuses a staff member without it and writes nothing.

**UI-hidden actions the server still accepts (Info, both documented):**
- Switching to per-player before the game ends. The UI offers it after the game, and the server allows it any time the booking is CONFIRMED (SPEC-15).
- Adjust on a booking that owes nothing. Since `259fb64` the server refuses non-CONFIRMED statuses (`booking.due_not_confirmed`). An adjust on a fully paid CONFIRMED booking is allowed and intended (fee changes).

No action accepted a call the UI hides for permission reasons.

---

## 4. Public surface (`requestPublicSlot`)

- Path: `submitPublicSlotRequest` → `parsePublicSlotRequest` → `requestPublicSlot`.
- Schema (`booking/schemas/public-slot-request.ts`):
  - `name`: `z.string().trim().min(1)`, **no max**;
  - `phone`: normalised, digits only, 8–15 characters;
  - `pitchId`, `start` and `end`: parsed.
- The use case takes the pitch lock and checks that the slot is offered (`resolveOfferedSlot`). It then finds or creates the Person by phone and inserts a PENDING booking, or a SlotInterest if the hour is taken.

| Question | Finding |
|---|---|
| Rate limit | None. Flood probe: 200 requests in 1.9 s, all accepted (203 PENDING rows, 202 persons) (**S-5**) |
| Length limits | Name unbounded. A 200,000-character name was stored (**S-5**). Next's 1 MB Server Action body limit is the only cap |
| Format limits | Phone is strict. Name accepts bidi overrides and control characters. A U+202E name was stored (**S-14**) |
| Phone enumeration / leaks | The public response is a fixed `?ok=` / `?error=` key whether the phone is known or not. The person's stored name is never shown publicly. **No leak** |
| Impersonation | A request with a victim's phone and any name is filed under the victim's Person, and the victim's name is kept. The owner sees a request "from" a regular customer, with that customer's debt warning (**S-6**) |
| User text into HTML | React escapes all text. There is no `dangerouslySetInnerHTML` anywhere in `src/`. **Pass** |
| User text into wa.me links | `whatsapp-link.ts` requires the phone to be digits and passes the message through `encodeURIComponent`. **Pass** |
| User text into WhatsApp messages | The customer's own name goes into messages sent to that same customer's phone. Names are never sent to a different person. Bidi characters can reorder how the owner sees the text (S-14) |

---

## 5. Injection and CSRF

- **Zod on every server action:** yes (§3 matrix). The one exception is `submitUpdatePitch`'s `pitchId`: a raw string passed to a Prisma `where`, so no injection, but not validated (S-21).
- **SQL injection:** none. See the raw SQL inventory (§1.2).
- **`dangerouslySetInnerHTML`:** zero uses. `grep -rn dangerouslySetInnerHTML src` finds nothing.
- **`serverActions.allowedOrigins`:** not set in `next.config.ts`. That is correct for this model: Next compares `Origin` with the `Host` / `X-Forwarded-Host` of the same request. A wildcard such as `*.lebstads.com` would let sami's page post actions to ahmad's host, so leave it unset.
- **Probe P8:**

  | Request | Result |
  |---|---|
  | Foreign `Origin: https://evil.example` | 500, no session cookie |
  | Sibling tenant `Origin: http://sami.lebstads.test` against ahmad's host | No session cookie |
  | No `Origin` header (only possible from non-browser clients) | Accepted |

  Browsers always send `Origin` on a cross-origin POST, so this is not a CSRF vector. **Pass.**
- **SameSite note:** tenant subdomains are *same-site* with each other, so `SameSite=Lax` does not stop a request from one subdomain to another. Two things protect cross-subdomain CSRF today: the `Origin` check above, and the fact that no tenant can put content on the domain.
- **GET endpoints with side effects:** none.
  - `/owner/requests/live` is a read.
  - Logout is a POST server action.
  - The notify loaders (`loadDecisionNotify`, `loadOutcomeNotify`) only build links.
  - `setUiLocale` is a server action (POST) and harmless.
  - **Pass.**

---

## 6. Secrets and configuration

- **`.env`:** gitignored. `git log --all -p` shows only `.env.example`, which holds the local Docker credentials (`stadiums_local` / `stadiums_local_dev`, local only). No production secret appears in history. The app has no application secret: sessions are opaque DB rows with no signing key.
- **Env validation:** none (**S-18**). `DATABASE_URL` is read raw by `pg.Pool`. `APP_BASE_DOMAIN` and `APP_PROTOCOL` fall back to defaults (`https` is the protocol default, which is safe).
- **Seed:** `src/prisma/seed.ts` deletes every table and recreates tenants ahmad and sami. It also creates `owner@ahmad`, `owner@sami` and `staff@ahmad`, all with the password `LOCAL_DEV_PASSWORD = "dev-owner"`, which is public in the repo. It has no environment guard (**S-1**, High).
- **Error pages:** `src/app/error.tsx` and the global error page show only Next's digest, never `error.message` or a stack. `actionErrorKey` maps errors to catalog keys, and unexpected errors log server-side and show generic copy. **Pass.**
- **Logs:** `src/lib/logger.ts` writes to `logs/YYYY-MM-DD.log` (gitignored) and to the console. Context is ids only (bookingId, tenantId, userId). No names, phones or passwords were found in any `logger.*` call. There is no rotation or retention (**S-17**).

---

## 7. Headers, caching and PWA

Probe P5 checked the response headers of `/owner/today`, `/`, `/owner/login` and `/owner/requests/live`.

| Header | Present | Note |
|---|---|---|
| `Cache-Control` on authenticated pages | Yes: `private, no-cache, no-store, max-age=0, must-revalidate` (dynamic render) | **Pass** |
| `Cache-Control` on `/owner/requests/live` | Yes: `no-store` (set in `route.ts`) | **Pass** |
| Content-Security-Policy | No | S-7 |
| Strict-Transport-Security | No, from the app. The server may add it (UNVERIFIED) | S-7 |
| X-Frame-Options / `frame-ancestors` | No | S-7 |
| X-Content-Type-Options | No | S-7 |
| Referrer-Policy | No | S-7 |
| Permissions-Policy | No | S-7 |
| X-Powered-By | `Next.js` | S-13 |

**Service worker (`public/sw.js`): pass.**
- It caches only `/offline.html` at install.
- Navigations go network-first, falling back to the offline page when the network fails.
- Other requests are not intercepted.
- It never writes a response to the cache at run time, so it cannot keep authenticated content.
- `sw.js` itself is served with `Cache-Control: no-cache` (`next.config.ts`).

---

## 8. Dependencies

`npm audit` (2026-09-30) reports **4 high, all transitive through the `prisma` CLI, a dev dependency** that is not in the runtime bundle:
- `deepmerge-ts`, via `@prisma/config`;
- `mysql2` and its dependencies, pulled in by the CLI's driver bundle. This app does not use MySQL.

It reports nothing for `next@16.3.4`, `@prisma/client@7.10.0`, `@prisma/adapter-pg`, `pg` or `zod`.

The installed packages ship no security changelog. `node_modules/next/dist/docs/` documents the Server Actions origin check this audit relies on (§5), but no advisory. Whether any advisory published after this `npm audit` run affects 16.3.4 or 7.10.0 is **UNVERIFIED**. Re-run `npm audit` before each deploy.

**Fix:** update `prisma` (dev) when a release drops the vulnerable transitive versions. There is no runtime exposure.

---

## 9. DoS

| Surface | Cost | Finding |
|---|---|---|
| Live poll `/owner/requests/live`, every 20 s per open owner tab | One membership lookup plus `getLiveQueue` (pending list, unbounded) | Fine at pilot scale. The pending list grows without bound under S-5 flooding (S-8) |
| Login | One scrypt (about 50 ms of CPU, 16 MB of memory) per attempt for an existing identifier, no limit | S-3: a few parallel clients can pin the CPU of a one-droplet deploy |
| Public request | One tx with a pitch `FOR UPDATE` lock, Person upsert, Booking insert; no limit | S-5: 100+ requests/s from one client; the rows then slow every owner page |
| Public page view | `listApprovedRanges` over all approved bookings for the pitch window, per view | S-8 |
| Unbounded queries | `listApprovedRanges`, `listSlotInterestsWithPeople`, `listPendingBookings` (no `take`) | S-8 |

---

## 10. RLS

DR-001 §3 deferred RLS and names the **trigger:** "the first real paying tenant who isn't a friend, or any data leak you'd genuinely be afraid of."

**Assessment: the trigger is effectively met, on the second clause.**
- The `PaymentAllocation` gap in the extension's model list was a real near miss, recorded in the booking and payments audit. The guard is a hand-kept list.
- 31 raw SQL statements bypass the extension entirely. Each depends on a hand-written `tenantId = ${tenantId}`.
- Today's probes found no leak. Both mechanisms are still one forgotten line away from one.

**Recommendation.** Add Postgres RLS before the first non-friend paying tenant, as a second wall behind the extension. Do not replace the extension.
1. Migration: `ENABLE` and `FORCE ROW LEVEL SECURITY` on the 14 scoped tables, plus one policy per table: `USING (tenant_id = current_setting('app.tenant_id', true))` with the same `WITH CHECK`.
2. A dedicated app DB role without `BYPASSRLS` and not the table owner. Migrations and the seed keep an owner role.
3. `SET LOCAL app.tenant_id = …` at the start of every tenant transaction. The extension already knows the ALS tenant.
4. Top-level (non-`$transaction`) queries must also run inside a short transaction that sets the variable. Otherwise `current_setting` is empty and the policy returns zero rows. That fails closed, which is safe but must be found by tests.
5. `platformDb` paths (sessions, users, tenants, the manifest) touch only global tables, or need a policy exemption through the owner role.
6. Integration: the existing isolation suite plus a test that a query without `SET LOCAL` returns nothing.

**Effort:** about 2–3 days, including the top-level query wrap (item 4, the bulk of the work) and the role split on the server (UNVERIFIED: depends on how the production DB user is set up). This needs a DR-001 amendment, so it is listed under design decisions.

---

## Findings

### S-1 The seed wipes any database it is pointed at, including production

- **Severity:** High. **Status:** fix follows in the next commit on this branch.
- **Where:** `src/prisma/seed.ts`, top-level `main()`; run with `npm run db:seed` (`prisma db seed`).
- **Attack / failure scenario:**
  1. On the droplet, someone runs `npm run db:seed` against production: a copy-pasted onboarding command, or `prisma db seed` picked up after a `migrate reset`.
  2. `main()` deletes every row in every table: bookings, payments, ledger.
  3. It recreates `owner@ahmad` and `owner@sami` with the password `dev-owner`, which is public in this repo.
  4. Result: total data loss, and anyone who reads the repo can log in to the recreated tenants.
- **Proof (probe):** with `NODE_ENV=production` and `DATABASE_URL` pointing at `stadiums_test`, the seed ran to completion without refusing. Every table was wiped and refilled, and `owner@ahmad` / `dev-owner` then logged in on the probe server.
- **Fix:**
  - A pure guard, `assertSeedAllowed({ nodeEnv, databaseUrl })`, called before any write.
  - It refuses when `NODE_ENV === "production"`.
  - It refuses unless the database name in `DATABASE_URL` is `stadiums_dev` or `stadiums_test`.
  - Unit tested.

### S-2 Session ids are cuid v1, not cryptographically random

- **Severity:** Medium (exploit UNVERIFIED; treat as the top Medium).
- **Where:**
  - `prisma/schema.prisma`, `Session.id @default(cuid())`;
  - `access/infrastructure/sessions.ts`, `createSession`;
  - the cookie value is the raw id.
- **What:** Prisma's cuid v1 (`node_modules/@prisma/client/runtime/client.js`) is built as follows:

  | Part | Contents | Predictability |
  |---|---|---|
  | Prefix | `c` | fixed |
  | Timestamp | milliseconds | predictable |
  | Counter | 4 characters | predictable |
  | Host fingerprint | stable per process | predictable |
  | Random | 8 characters from `Math.random()` | about 41 bits |

  So only about 41 bits are unpredictable, and they come from a PRNG that is not cryptographically secure. Observed id: `cmunec1rx0001vn7d4b40gzlt`.
- **Attack scenario:**
  1. An attacker who can see one of their own session ids learns the fingerprint and the counter.
  2. They can narrow the timestamp of a victim's login from app behaviour.
  3. They search the remaining space online against `/owner/requests/live`, which answers 401 vs 200.
  4. V8's `Math.random` (xorshift128+) state can be recovered from a few outputs. That would reduce the search sharply, but I did not build that probe, so the exploit is UNVERIFIED.
- **Fix:**
  - Generate the id in `createSession` with `crypto.randomBytes(32).toString("base64url")`: 256 bits from the CSPRNG.
  - Better: store `sha256(token)` as the row key, so a DB read does not yield live cookies.
  - Invalidate existing sessions on deploy.
  - About half a day. This needs no design decision beyond "hash or not", but it is Medium, so it is out of this branch's fix scope. See the ROADMAP.

### S-3 No brute-force protection on login

- **Severity:** Medium.
- **Where:** `access/application/login.ts` (`login`) and `owner/login/actions.ts` (`submitLogin`).
- **Attack scenario:**
  - Owner identifiers are guessable (`owner@<slug>`, and the slug is the subdomain).
  - Unlimited attempts let an attacker run a password list against every stadium.
  - Each attempt with an existing identifier costs about 50 ms of scrypt CPU. A handful of parallel clients can saturate the single droplet (DoS for every tenant).
- **Fix (needs a design decision):** a per-identifier and per-IP limit, for example 5 failures per 15 minutes per identifier and a per-IP cap. Open questions:
  - where the counter lives: in-memory, which is fine on one droplet but resets on deploy, or a table;
  - which IP to trust: this depends on nginx's `X-Forwarded-For`, UNVERIFIED;
  - lockout vs delay.

  nginx `limit_req` on `POST /owner/login` is a cheap first layer (server, UNVERIFIED).

### S-4 Login reveals which identifiers exist by timing

- **Severity:** Medium.
- **Where:** `access/application/login.ts`, `login`: `verifyPassword` is skipped when `findUserByIdentifier` returns null.
- **Proof (probe P7):** 5 attempts each with a wrong password. An existing identifier took about 50 ms; an unknown one took about 6 ms.
- **Attack scenario:** an attacker enumerates valid staff identifiers (`staff@ahmad`, `ali@ahmad`) before brute forcing (S-3).
- **Fix:** when no user is found, verify against a fixed dummy hash so both paths cost one scrypt. It is a small change, but Medium, so not in this branch's scope.

### S-5 Public requests can be flooded, and names are unbounded

- **Severity:** Medium.
- **Where:** `booking/schemas/public-slot-request.ts` (`name` has no `.max`), `booking/application/request-public-slot.ts` (`requestPublicSlot`), and `app/(public)/request-slot.ts`.
- **Proof (flood probe):**
  - 200 requests in 1.9 s were all accepted, creating 203 PENDING bookings and 202 persons.
  - A 200,000-character name was stored.
- **Attack scenario:**
  - A script files thousands of requests with random phones across every open slot.
  - The owner's Requests tab and Today page become unusable. The 20-second live poll re-reads the whole pending list.
  - The People list fills with junk persons.
  - A few requests with 1 MB names bloat every page that renders them.
  - Pending holds no slot (SPEC-03), so real bookings are not blocked. The owner's queue is.
- **Fix:**
  - Unambiguous part: `name: z.string().trim().min(1).max(80)`, matching the pitch name cap.
  - Needs a decision: a rate limit per IP and per phone (for example 5 pending requests per phone per tenant per day), and whether to add a CAPTCHA or a WhatsApp confirmation step.
- **Status:** listed under design decisions. The name cap alone is not the High fix and would change user-facing validation copy, so it is left for the rate-limit slice.

### S-6 Anyone can file a public request under someone else's phone

- **Severity:** Medium.
- **Where:** `people/application/find-or-create-person.ts` (matches by phone, never updates the name), called from `requestPublicSlot`.
- **Proof (flood probe):** a request with a victim's phone and the name "Someone else" was attached to the victim's Person. The owner's card shows the victim's stored name and the victim's debt warning.
- **Attack scenario:**
  - A rival or prankster requests 20 late-night slots in a regular customer's name.
  - The owner approves them and the confirmation WhatsApp goes to the victim.
  - If the owner records no-shows, the fees are charged to the victim.
- **Fix (needs a decision):** phone ownership cannot be proven without an OTP. Options:
  - show "name on request differs from saved name" on the owner card (cheap, keeps RULE-12);
  - a WhatsApp confirmation link before a request counts;
  - per-phone limits (with S-5).

### S-7 No security headers

- **Severity:** Medium (HSTS may be set by nginx: UNVERIFIED).
- **Where:** `next.config.ts` (`headers()` sets only `sw.js` caching).
- **Attack scenario:**
  - **Without HSTS:** a first visit over a hostile Wi-Fi network can be downgraded to HTTP and the session cookie phished at login.
  - **Without `frame-ancestors` / XFO:** a foreign site can frame the public page for UI redress. Owner pages are less exposed, because `SameSite=Lax` stops the cookie in a cross-site frame.
  - **Without CSP:** any future XSS has no second wall.
  - **Without nosniff and Referrer-Policy:** minor leaks. Full URLs, which can hold booking ids, are sent to wa.me.
- **Fix:** add `headers()` for `/(.*)`:
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains` (confirm HTTPS on every subdomain first);
  - `X-Frame-Options: DENY` and `frame-ancestors 'none'`;
  - `X-Content-Type-Options: nosniff`;
  - `Referrer-Policy: strict-origin-when-cross-origin`;
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`;
  - a CSP. The CSP needs a design pass, because Next's inline runtime scripts need nonces (`node_modules/next/dist/docs/` CSP guide) and that changes rendering.
- **Status:** listed under design decisions (CSP and nonce strategy; whether HSTS lives in nginx or the app).

### S-8 Unbounded queries on hot paths

- **Severity:** Medium.
- **Where:** `booking/infrastructure/bookings.ts`: `listApprovedRanges` (every public page view, every Book page), `listPendingBookings` (Today, live poll), `listSlotInterestsWithPeople`.
- **Attack scenario:** combined with S-5, a few thousand junk rows make every public view and every 20-second owner poll scan and serialize them all.
- **Fix:** bound the date window in every range query, add `take` with a "show more" on pending lists, and add the Booking `(tenantId, pitchId, start)` index already listed as MVP audit P1. Part of the rate-limit slice.

### S-9 Spoofed `x-tenant-slug` is believed on image-extension paths

- **Severity:** Low.
- **Where:** `src/proxy.ts` `config.matcher` (excludes `.*\.(?:svg|png|jpg|jpeg|gif|webp)$`) and `lib/tenant-context.ts` `loadTenant`, which trusts the header.
- **Proof (probe P2):** `GET /owner/people/x.png` with `Host: sami…` and `x-tenant-slug: ahmad` resolved tenant ahmad. With a sami cookie it redirected to login. With an ahmad cookie it rendered ahmad's shell on sami's host.
- **Why Low:** the attacker must already hold a session for the tenant they spoof, because membership is checked against the resolved tenant. This bypasses the host binding, not authorization.
- **Fix:** in `loadTenant`, ignore the header unless the proxy set it (for example a proxy-only marker header), or narrow the matcher exclusion to `/icons/` and `/_next/`.

### S-10 Any base domain is accepted

- **Severity:** Low.
- **Where:** `lib/tenant-slug.ts`, `parseTenantSlug`: the first label of any host with 3 or more labels.
- **Proof (P1):** `Host: ahmad.attacker.example` served ahmad.
- **Attack scenario:** if nginx forwards unknown hosts to the app (UNVERIFIED), someone can point `ahmad.evil.com` at the droplet and serve a real tenant's page under their domain for phishing.
- **Fix:** require the host to end in `APP_BASE_DOMAIN`, and have the nginx `default_server` return 444 (server, UNVERIFIED).

### S-11 `X-Forwarded-Host` is trusted when Host is localhost

- **Severity:** Low (depends on nginx).
- **Where:** `lib/tenant-slug.ts`, `resolveRequestHost`.
- **Attack scenario:** if port 3000 is reachable directly (UNVERIFIED), a request with `Host: localhost` picks any tenant through `X-Forwarded-Host`. The impact is the same as S-9, host binding only.
- **Fix:** only honour `X-Forwarded-Host` behind a known proxy (env flag), and bind Next to 127.0.0.1.

### S-12 Manifest reveals whether a tenant slug exists

- **Severity:** Low.
- **Where:** `src/app/manifest.ts`.
- **Detail:** returns the tenant name or `lebstads`. The public page already answers 200 vs 404, so the manifest adds almost nothing. See §1.6.
- **Fix:** none needed. Optionally return the same generic name for unknown slugs (already the case) and accept the oracle.

### S-13 `X-Powered-By: Next.js`

- **Severity:** Low.
- **Where:** `next.config.ts`.
- **Fix:** `poweredByHeader: false`.

### S-14 Names accept bidi overrides and control characters

- **Severity:** Low.
- **Where:** `public-slot-request.ts` `name` and the owner-create schema.
- **Proof:** a U+202E name was stored.
- **Scenario:** a name that renders reversed or hides part of itself on the owner card and in WhatsApp messages.
- **Fix:** strip Unicode categories `Cc` and `Cf` except ZWJ/ZWNJ, which are needed for Arabic, at parse time.

### S-15 Free text from the URL goes into WhatsApp messages

- **Severity:** Low.
- **Where:** `booking/application/load-decision-notify.ts`: `reason` from the query goes through `cleanReason` (trim, collapse whitespace, 80 characters).
- **Scenario:** a crafted link sent to the owner pre-fills a rejection message with attacker text. The owner still sees the text and must press send in WhatsApp.
- **Fix:** accept only the reason keys the UI offers, or accept the risk.

### S-16 scrypt at default cost

- **Severity:** Low.
- **Where:** `access/infrastructure/password.ts`: N=16384.
- **Fix:** N=2^17 with `maxmem` raised, and store the parameters in the hash string so old hashes still verify. This conflicts with S-3's CPU concern, so decide together.

### S-17 Expired sessions and logs are never cleaned

- **Severity:** Low.
- **Where:** `Session` table (no deletion of expired rows); `lib/logger.ts` (daily files, no retention).
- **Fix:** delete expired sessions on login, or with a daily job. Add logrotate on the server (UNVERIFIED).

### S-18 No env validation at startup

- **Severity:** Low.
- **Where:** `lib/db.ts`, `lib/public-page-url.ts`.
- **Scenario:** a missing `APP_BASE_DOMAIN` in production sends customers links to `localhost:3000`. A missing `DATABASE_URL` fails on first query, not at boot.
- **Fix:** a Zod env schema parsed once at startup.

### S-19 Staff with no flags can search all customers

- **Severity:** Info.
- **Where:** `people/application/search-people.ts`: membership only.
- **Detail:** this follows the DR-003 design. It is noted because it is the widest PII read available to the lowest role.

### S-20 Latent tenant-guard gaps

- **Severity:** Low.
- **Where:** `lib/db.ts` extension.
- **Detail:**
  - `upsert` and `updateManyAndReturn` are not pre-guarded;
  - the update/delete ownership pre-check runs on the base client outside the transaction.
- **Scenario:** none today, since there are no call sites. A future `upsert` on a scoped model would rely only on the post-check.
- **Fix:** add both operations to the guard, and run the pre-check on the same client. RLS (§10) closes the class.

### S-21 `submitUpdatePitch` reads before it authorizes, and does not parse `pitchId`

- **Severity:** Low.
- **Where:** `owner/(app)/more/settings/pitches/actions.ts`, `submitUpdatePitch`.
- **Detail:** `listLivePitchWindows(pitchId)` runs with membership only, before `updatePitch` checks `settings.manage`. The result is not returned to the caller, so nothing leaks. `pitchId` is a raw string.
- **Fix:** parse `pitchId` with Zod, and move the live-window read inside `updatePitch` after the permission check.

---

## Design decisions needed (not fixed here)

1. **Rate limiting** (S-3, S-5, S-8):
   - the store: in-memory or DB;
   - which client IP to trust from nginx;
   - the limits for login, per phone and per IP on public requests;
   - nginx `limit_req` as a first layer.
2. **Session token format** (S-2): random 256-bit token, and whether to store it hashed. It is not ambiguous, but it is Medium; recommended as the first follow-up.
3. **Public request identity** (S-6): a mismatch flag, WhatsApp confirmation, or per-phone limits.
4. **Name rules** (S-5, S-14): an 80-character cap and control-character stripping, with the Arabic/RTL review from DR-005.
5. **Security headers and CSP** (S-7): nonce-based CSP with Next, and whether HSTS lives in nginx or the app.
6. **RLS** (§10): amend DR-001, a role split, and `SET LOCAL` per transaction. About 2–3 days.
7. **Host allowlist** (S-9, S-10, S-11): bind resolution to `APP_BASE_DOMAIN` and a trusted proxy.

## To confirm on the server

Everything here is **UNVERIFIED**. The repo has no nginx, firewall or Hestia configuration.

1. nginx `proxy_set_header Host $host` and whether it sets or overwrites `X-Forwarded-Host` and `X-Forwarded-For` (S-9, S-11, S-3).
2. A `default_server` block that rejects unknown hosts, so `ahmad.evil.com` does not reach Next (S-10).
3. Port 3000 (Next) bound to 127.0.0.1 or firewalled, and Postgres 5432 not public.
4. TLS on the apex and on every `*.lebstads.com` subdomain (a wildcard certificate), HTTP→HTTPS redirect, and HSTS (S-7).
5. Firewall (ufw / Hestia): only 22, 80 and 443 open. SSH by key only.
6. Hestia panel: not on a public port, or restricted by IP, with 2FA.
7. `NODE_ENV=production` set for the running app, which controls the cookie's `Secure` flag.
8. Whether `npm run db:seed` or `prisma migrate reset` has ever been run on the production DB, and what the production database name is (S-1 guard allowlist).
9. Production DB user: is it the table owner or a superuser? This matters for RLS (§10).
10. The disk used by `logs/` and logrotate (S-17).
11. Backups: frequency, off-droplet copy, and a tested restore.
12. nginx `limit_req` / `client_max_body_size` on `/owner/login` and the public page (S-3, S-5).

---

## Addendum: fixes on this branch

| Finding | Status | Where |
|---|---|---|
| S-1 seed has no production guard | **Fixed.** `assertSeedAllowed` runs before the seed opens a connection. It refuses `NODE_ENV=production` and any database other than `stadiums_dev` / `stadiums_test`. Re-probed: `NODE_ENV=production` on `stadiums_test` exits 1 and deletes nothing; a DB named `stadiums_prod` is refused; the dev seed on `stadiums_test` still runs. | `src/prisma/seed-guard.ts`, `src/prisma/seed.ts`, `test/prisma/seed-guard.test.ts` |

No other finding is Critical or High. The Medium and Low findings stay open (see [ROADMAP.md](../ROADMAP.md) items 6–12).
