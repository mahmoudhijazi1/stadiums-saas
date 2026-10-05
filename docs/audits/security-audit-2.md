# Security audit 2: delta since the first audit

**Status: PARTIAL, stopped on a Critical finding (per instructions).** Started 2026-10-05 on `audit/final-review`, from `main` at `0bec8ec` (after PRs #13–#16). Sections a) and parts of b) and c) are done; d) and the rest of b) and c) are not. This is a historical snapshot once complete: append, never rewrite.

**Method.**
- **Run:** probes against `stadiums_test` only, using a production build (`next start`, `NODE_ENV=production`) on 127.0.0.1:3311 with Host headers. The probe scripts lived in the session scratchpad and were deleted.
- **Read:** code read directly, cited by file and function.
- **UNVERIFIED** marks a claim not traced to code or a run. **Server** items go under "To confirm on the server".
- The dev mockups branch is out of scope (not merged, per the owner).

---

## ⛔ Critical

### N-1 Next.js 16.3.4 is in the range of a critical RCE advisory
- **Severity:** Critical (advisory). Effective exposure is believed low; see below.
- **Evidence:** `npm audit --omit=dev` reports `next` (direct dependency, installed `16.3.4`), with GHSA-vcvr-r3jv-pc5j, "Remote Code Execution in next/og ImageResponse", affecting `>=16.2.0 <16.3.6`. The fix is available as **`next@16.3.8`** (not a semver-major bump).
- **Reachability in this app:**
  - `grep -rn "next/og\|ImageResponse" src` finds nothing.
  - There are no `opengraph-image`, `twitter-image`, `icon` or `apple-icon` routes under `src/app`, and the build output has none.
  - So no app route calls the vulnerable function. **UNVERIFIED:** whether any framework-internal route reaches it. The advisory text was not read in full here.
- **Consequence if reachable:** remote code execution on the droplet, which holds the database credentials (`DATABASE_URL`).
- **Fix:** bump `next` and `eslint-config-next` to `16.3.8` (patch line), rebuild, then run `npm test`, `npm run test:integration`, `npm run build` and `npm run test:e2e`. Deploy promptly regardless of reachability.
- **Effort:** S.

---

## a) Regression of S-1 … S-21

| ID | Fixed claim | Re-verified how | Result |
|---|---|---|---|
| S-1 | The seed refuses production | **Run:** `NODE_ENV=production npx tsx src/prisma/seed.ts` on `stadiums_test` → "Seed refused: NODE_ENV is production" | Holds |
| S-2 | Random 256-bit tokens stored as SHA-256 | **Run:** the login cookie value is 43 base64url characters (probe). **Read:** `access/infrastructure/sessions.ts` `createSession`/`findSessionByToken` | Holds |
| S-3 | Login lockout (8 per 15 min) | **Run:** 9 wrong passwords → `?error=access.login_throttled`; the right password is then still refused and no cookie is set | Holds |
| S-4 | Same cost for unknown accounts | **Read:** `login.ts` → `verifyAgainstDummy` (the timing test exists in `test/integration/login-timing…`; not run in this tier) | Holds (read) |
| S-5 | Public limits and name cap | **Read:** `request-public-slot.ts` `assertRequestRate`, `public-slot-request.ts` `PUBLIC_NAME_MAX` | Holds (read). See N-2. |
| S-6 | Typed-name warning | **Read:** `request-public-slot.ts` `typedNameIfDifferent`; `pending-list.tsx` still renders `RequestedNameNotice` after PR #16 | Holds (read) |
| S-7 / S-13 | Headers, no X-Powered-By | **Run:** `/owner/login` → `X-Frame-Options: DENY`, `nosniff`, `strict-origin-when-cross-origin`, CSP-Report-Only present, no `X-Powered-By`, no HSTS from the app (nginx's job) | Holds |
| S-8 | Bounded page lists | **Read:** `listPendingInbox`; the new free-strip query `countPendingBySlot` is bounded by `[from, to)` and filtered by tenant | Holds (read) |
| S-9 | No client `x-tenant-slug` | **Run:** sami host + ahmad cookie + `x-tenant-slug: ahmad` + `X-Forwarded-Host: ahmad…` → 307 to login; the old image-path bypass `/owner/today/x.png` → 404 | Holds |
| S-10 | Host allowlist | **Run:** `ahmad.attacker.example` 404, `a.b.lebstads.test` 404, `127.0.0.1` 404, uppercase tenant host 200 | Holds |
| S-11 | Forwarded host only when trusted | **Run:** as in S-9 (`TRUST_PROXY_HEADERS` unset) | Holds |
| S-14 | Invisible characters stripped | **Read:** `clean-person-name.ts` unchanged since the fix | Holds (read) |
| S-16 | Hash cost and env override | **Read:** `password.ts` unchanged | Holds (read) |
| S-17 | A user's expired sessions deleted at login | **Read:** `login.ts` → `deleteExpiredSessions` | Holds (read) |
| S-18 | Env validation exits in production | **Run:** `next start` with `APP_BASE_DOMAIN=https://bad/` → exit 1, naming the variable | Holds |
| Cookie flags | HttpOnly, Secure, SameSite=Lax, Path=/, no Domain, 30 days | **Run:** the real `Set-Cookie` on login | Holds |
| Cross-tenant session | Tenant A's cookie on tenant B | **Run:** 307 to `/owner/login` | Holds |
| Cache-Control | Authenticated responses | **Run:** `/owner/today`, `/money`, `/requests`, `/book`, `/search` → `private, no-cache, no-store…`; `/owner/requests/live` → `no-store` | Holds |
| Service worker | Never caches authenticated content | **Run:** `/sw.js` contains only `cache.add(OFFLINE_URL)`. The manifest scope is `/owner/` | Holds |

The deferred items (S-12, S-15, S-17 global sweep, S-19, S-20, S-21, RLS, enforced CSP) were not re-examined.

---

## b) / c) New findings so far

| ID | Severity | Finding (evidence) | Scenario | Fix | Effort |
|---|---|---|---|---|---|
| N-2 | Medium | Without `TRUSTED_CLIENT_IP_HEADER`, the public limits are per phone only (`request-public-slot.ts` `assertRequestRate`). The owner inbox shows the next **200** upcoming requests (`bookings.ts` `listPendingInbox`). | A script rotating fresh phone numbers files 3 near-term PENDING each. The 200 nearest slots fill with junk, and real requests for later hours fall beyond the cap and are hidden from the owner. | Set the IP header in nginx (server). Add a per-tenant cap on new persons per hour, and show "N more requests" when the inbox is capped. | M |
| N-3 | Low | `/dev/palette` (`src/app/dev/palette/page.tsx`) has no guard. **Run:** 200 on a tenant host in production. It shows static design tokens only, with no tenant data. | It reveals that the app is a Next.js design build. No data is exposed. | `notFound()` when `NODE_ENV === "production"`, or delete it. | S |
| N-4 | Low | `RateLimit` rows are pruned only by `pruneRateLimits`, which runs on a **successful login** (`login.ts`). Public-request keys (`public:phone:…`, `public:ip:…`) accumulate between owner logins, and sessions last 30 days. | Rotating-phone traffic grows the table without bound until the next login. The rows are small, so this is a disk and index cost, not a correctness issue. | Also prune in `requestPublicSlot` (cheap, indexed), or run a daily job. | S |
| N-5 | Low | `npm audit` (dev tree): `prisma` CLI → `deepmerge-ts`, `mysql2` (high); `fast-uri` (moderate); `brace-expansion`/`braces` (dev tooling). | Dev and build-time only; MySQL is not used. | Update `prisma` when its 7.x line drops these; `npm audit fix` for `fast-uri`. | S |

## Not done yet (resume here after the Critical is handled)
- **b):**
  - review of `scripts/platform.ts` and `set-password.ts` output and shell history: passwords are never arguments, but `--reason`/`--note` are;
  - the RUNBOOK `psql "${DATABASE_URL…}"` line exposes the DB password in `ps` while it runs;
  - the effect of the proxy cookie refresh on revoked tokens;
  - a full re-check of suspension bypasses across the new free-strip and Today code.
- **c):**
  - wa.me message text (S-15 is still open);
  - public-request timing for known vs new phones;
  - the authorization matrix: re-derived from code (below) but not yet probed per action;
  - git history: no `.env`, keys or dumps were ever added (`git log --all --diff-filter=A`). Backups are UNVERIFIED.
- **d):** malicious staff (no flags), malicious public visitor, owner versus another tenant: probes not yet run beyond the cross-tenant session and header spoof above.

### Authorization matrix (re-derived from code; not yet probed per action)
- **Flag-gated** (`can()`):
  - approve, reject and dismiss: `bookings.approve`;
  - cancel: `bookings.cancel` (plus `adjust_due` to lower the fee);
  - no-show: `bookings.no_show` (plus `adjust_due`);
  - adjust and the switches: `bookings.adjust_due`;
  - collect and slot pay: `payments.collect`;
  - create booking: `bookings.create`;
  - expense: `expenses.record`;
  - money summary: `reports.view`;
  - rate, booking rules, time display, pitches: `settings.manage`.
- **Membership only (any staff):** `get-live-queue`, `get-person-booking-stats`, `list-debt-warnings`, `list-live-pitch-windows`, `list-open-waitlist`, `list-pending-requests`, `list-person-bookings`, `load-decision-notify`, `load-free-strip`, `load-outcome-notify`, `load-owner-day`, `list-recent-expenses`, `get-current-rate`, `get-person`, `search-people`, `get-pitch-editor`, `list-pitch-summaries`.
  - Of these, **`list-recent-expenses`** may expose expense amounts to staff without `reports.view`. Not yet checked against the Money page's gating; to verify in d).
- **No authentication (public by design):** `request-public-slot`, `list-approved-occupied`, `get-day-availability` (both suspension-gated by the tenant choke point).

## To confirm on the server
Unchanged from security-audit.md, plus:
- `TRUSTED_CLIENT_IP_HEADER` is set together with nginx `proxy_set_header X-Real-IP $remote_addr` (N-2).
- The deployed `next` version, after the bump (N-1).

---

## Resumed 2026-10-05: abuse probes (final pass)

**N-1 is still open:** `package.json` still pins `next` at `16.3.4`. It is not re-reported here as new; it remains the top item.

**Method.**
- **Use-case runs:** a throwaway Jest file against `stadiums_test` called every application function with mocked request edges (Host + cookie), the same harness as the integration suites.
- **HTTP runs:** a production build (`next build` then `next start`, `NODE_ENV=production`, 127.0.0.1:3311) on `stadiums_test`, driven with Host headers.
- Both probe files and the seeded rows were deleted afterwards (all tables truncated). `stadiums_dev` was not touched.
- **Server Actions** were not invoked over HTTP. Each one is a thin `parse → use case` wrapper, so the use-case results stand for them. **UNVERIFIED:** an action that does something before its use case.

### a) Malicious staff (membership with `permissions: {}`), tenant A
**Refused (`access.not_allowed`), 19 of 19 flag-gated calls:**
- approve, reject, dismiss-missed;
- cancel, no-show, adjust due, switch to per-player, switch to whole;
- collect, collect slot, collect all remaining, create booking;
- record expense, set rate, set booking rules, set time display;
- create pitch, update pitch;
- `summarizeLedgerPeriod`.

**Allowed (membership only, as designed in the matrix):**
- `listOpenWaitlist`;
- `listRecentExpenses`, `getCurrentRate`;
- `getPersonBookingStats`, `listPersonBookings`, `listDebtWarnings`;
- `loadOwnerDay`, `loadFreeStrip`, `getLiveQueue`, `listPendingRequests`;
- `loadDecisionNotify`, `loadOutcomeNotify`;
- `getPerson`, `searchPeople`;
- `getPitchEditor`, `listPitchSummaries`, `listLivePitchWindows`.

**HTTP, staff `{}`:** `/owner/money` returned 200 and showed the expense "SecretRent" with **777.00**, with no summary card. `/owner/people/<id>` showed the person's paid and owed dollar amounts. `/owner/search` showed names and phones.

| ID | Severity | Finding (evidence) | Scenario | Fix | Effort |
|---|---|---|---|---|---|
| N-6 | Medium | `reports.view` hides only the period summary. `money/panel.tsx` `OwnerMoney` calls `listRecentExpenses()` (and `getCurrentRate`) for every member. `expense/application/list-recent-expenses.ts` `listRecentExpenses` checks membership only. Person money comes from `get-person-booking-stats.ts` `getPersonBookingStats` (paid / owes / expected), which is also membership-only. **Run:** staff `{}` saw 777.00 on `/owner/money` and a person's $ totals on `/owner/people/[id]`. | A gate-keeper hired only to open the pitch reads every expense amount (rent, salaries) and each player's payments. The OUT side of the books is fully visible, and the IN side can be rebuilt person by person. This matches SPEC-08's literal scope (summary only) but not its intent ("who sees the numbers"). | Gate `listRecentExpenses` on `reports.view` OR `expenses.record`, and skip the list in `OwnerMoney` otherwise. Hide `totalPaidUsd`/`expectedUsd` on the person page unless `reports.view` or `payments.collect` (owes-now can stay for the reminder). Owner decision: write it as a one-line DR note. | S |
| N-7 | Info | Staff `{}` can read `getPitchEditor` (hours, prices) and `listOpenWaitlist`. | Read-only, same tenant, and needed to answer phone calls. | None. Listed so that it is not re-flagged. | — |

### b) Malicious public visitor
**Edge validation holds.** `app/(public)/request-slot.ts` → `parsePublicSlotRequest` (`booking/schemas/public-slot-request.ts`) caps the name at 60 after `cleanPersonName`, requires 8–15 phone digits, ISO UTC times, and a strict object.

**Called directly, the use case accepted all of these:**
- a 10,000-character name;
- a name made only of spaces and zero-width characters;
- the phone `abc`;
- 200 zeros as a phone;
- `‮<script>` in the name.

**It refused** a pitch from another tenant, an off-grid start, and a past slot. Invalid dates threw a raw `RangeError` ("Invalid time value").

**Same phone:** 3 accepted, then `booking.request_limit` (S-5 holds).

**Rotating phones:** 6 of 6 accepted, with `x-real-ip` sent but not trusted (N-2, confirmed by a run).

**Existing person's phone, other name:** accepted. Still one Person row, and the name is not overwritten (S-6 holds).

**Leaks:**
- `listApprovedOccupied` returns ranges only, with no names or phones.
- The public page for tenant A does not contain a booked player's name or phone (**Run**).
- The suspended tenant's manifest returns the generic `lebstads` name.

| ID | Severity | Finding (evidence) | Scenario | Fix | Effort |
|---|---|---|---|---|---|
| N-8 | Low | `booking/application/request-public-slot.ts` `requestPublicSlot` trusts its caller for name and phone shape and for date parsing. Only the Server Action validates. **Run:** a 10k-char name and the phone `abc` were stored when the use case was called directly. | Today, none: the only caller parses first. The first new caller (an API route, a WhatsApp bot, a seed) that skips `parsePublicSlotRequest` stores unbounded names and junk phones. | Parse inside the use case: call `parsePublicSlotRequest(input)` at its top (it is cheap and idempotent). | S |
| N-9 | Low | No booking horizon on the public path. **Run:** a slot **400 days ahead** was accepted. `resolveOfferedSlot` checks the grid and "not started" only. | A script files PENDING requests months ahead, under rotating phones (N-2). They clutter the inbox or push real requests past its 200 cap. The cost is owner attention. | Reject `start > now + N days` (N = what the public chips show, e.g. 14) in `requestPublicSlot`. This needs a one-line owner decision. | S |

### c) Owner of tenant A against tenant B's ids (A's session, A's host)
- **Writes (13), all refused:** approve, reject, cancel, no-show, adjust, both switches, collect, collect slot (B booking, and **A booking + B participant**), collect all, create on B's pitch, update B's pitch. Each answered `booking.not_found` / `booking.pitch_not_found`.
- **Public request** on A's host with B's `pitchId`: `booking.pitch_not_found`.
- **Reads (9):** with B's person, booking or pitch ids they returned empty or null: stats zeros, `[]`, `null`. No B data came back.
- **After the run:** B's 4 bookings and 2 payments were unchanged, and A's day and expense lists contained no B names.
- **Payment, expense and interest ids:** no use case or action takes them as input (the expense list, ledger and interest are listed per tenant), so there is nothing to probe.
- **No finding.**

### d) Suspended tenant (suspended `cstad`, its owner's cookie)
- **Use-case runs, all refused:**
  - owner side (`access.not_allowed`): Today data, free strip, live queue, pending list, collect, cancel, expense, set rate, expenses list, rate, search;
  - public side (`tenant.suspended`): `requestPublicSlot`, `listApprovedOccupied`.
- **HTTP runs:**
  - `/owner/today`, `/owner/today?date=…`, `/owner/money` and `/owner/login` → 307 to `/owner/suspended`;
  - `/owner/requests/live` → 403 (with and without the cookie);
  - `/manifest.webmanifest` → 200 with the generic name, so the tenant name is not exposed;
  - `/sw.js` → 200, static and tenant-free;
  - `/` and `/?date=…` → 200 `UnavailableNotice` without the stadium name (the 503 is deferred per ROADMAP).
- **No finding.** The `/` 200 is already known and deferred.
