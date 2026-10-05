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
