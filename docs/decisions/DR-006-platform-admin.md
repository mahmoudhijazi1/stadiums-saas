# DR-006 — Web platform admin (identity, host, two-factor, scope of v1)

**Status:** Accepted
**Date:** 2026-10-12
**Depends on:** DR-001 (tenancy; the `platformDb` allowlist), DR-003 (auth and sessions; this record
copies its session design and deliberately does not share it), the tenant-management CLI
(`scripts/platform.ts`, `src/modules/platform`), security audit S-2/S-3/S-4 (session tokens, rate
limits, login timing).
**Reverses:** the "Deferred on purpose: Web platform admin" row in `docs/ROADMAP.md`, by the owner's
decision of 2026-10-12.

## Why this exists

Today the operator manages stadiums only from a terminal (`npx tsx scripts/platform.ts ...`). That
works at a few stadiums and fails the first time the operator is on a phone: creating a stadium,
suspending one that did not pay, and checking who is overdue all need an SSH session. The backend
already exists (`src/modules/platform` use cases take an explicit actor and never touch a
terminal), so the missing piece is an identity, a door and a screen.

The web admin can suspend every stadium and create owners. It is the most dangerous page in the
product, so it gets its own identity, its own cookie, a second factor and its own review. It
shares code with the owner app, never trust.

**Build may start. Deploy waits for the preconditions below.**

## Decisions

### 1. Host and routing

- **Served only at the path `/platform` on the bare `APP_BASE_DOMAIN` host**: exactly that host, not
  `www`, not any tenant subdomain. `/platform` on any other host returns 404. Every other path on
  the bare host stays 404 as today. Responses carry `X-Robots-Tag: noindex` and
  `Cache-Control: no-store`; `/platform` is **not** listed in `robots.txt` (a `Disallow` line would
  advertise it).
- *Why a path on the bare host:* the bare host never resolves a tenant, so the admin and a tenant
  can never be confused by the tenant machinery (DR-001), and no new DNS name, certificate or nginx
  server block is needed.
- **The name is `/platform`, not `/admin`**, to avoid automated `/admin` scanning. This is noise
  reduction only. **Security rests on the password, the TOTP code, the lockout and the sessions
  below, never on the path being secret.**
- **The admin cookie is host-only** (`__Host-` prefix), so tenant subdomains never receive it.
- **Same Next app**, route group `src/app/(platform)` under `/platform`; logic in
  `src/modules/platform` (already in the `platformDb` allowlist). The route group is a new
  consumer of that module, so `test/architecture/rules.ts` gets one line for it, with this record
  as the reason.
- `src/proxy.ts` only routes (host and path checks, headers). It does **not** read the session: a
  database query per request is what the proxy deliberately avoids (the 503 row of the ROADMAP). The `(platform)` layout and
  every Server Action check the session themselves.
- **Per-IP login limits need nginx to overwrite `X-Real-IP`** with the client address and
  `TRUSTED_CLIENT_IP_HEADER=x-real-ip` set in the app. Without it only the per-account limit
  applies (`trustedClientIp` returns null, fail safe). This comes with the custom nginx template.

### 2. Identity

- **New global table `PlatformAdmin`** (no `tenantId`): `identifier`, `passwordHash` (the same
  `hashPassword`, minimum **16 characters**: a stricter policy than owners' 12, kept apart from
  `password-policy` so the owner rule does not move), `totpSecret` (encrypted), `lastTotpStep`,
  `createdAt`. **One kind of admin, no roles.**
- **Created only by the CLI** (`scripts/platform.ts admins create`). There is no signup page and no
  invitation flow.
- **Lost phone: CLI `admins reset-totp` over SSH. No web recovery.** A web recovery path would be
  the weakest link of the whole design. Reset also deletes that admin's sessions and writes an audit
  row (actor `cli:<os user>@<host>`).
- **CLI `admins set-password`** sets a new password (16 characters or more) for an existing admin,
  **deletes that admin's sessions and writes an audit row.** A password is never an argument.

### 3. Two-factor

- **TOTP per RFC 6238:** SHA-1, 30-second step, 6 digits, accept the current step plus or minus one.
  **A code whose step is not after `lastTotpStep` is refused (no replay).** The check is one atomic
  update (`UPDATE ... SET lastTotpStep = :step WHERE id = :id AND lastTotpStep < :step`), so two
  simultaneous logins with the same code cannot both succeed.
- Implemented with `node:crypto`; **no new dependency.** The enrollment QR is printed in the terminal
  with the existing `qrcode` package (`admins enroll-totp`).
- **`totpSecret` is encrypted with AES-256-GCM** using a new env variable `PLATFORM_TOTP_KEY` (32
  random bytes, base64), **required in production**. A leaked database alone does not give the
  secrets. Losing or rotating the key means every admin re-enrolls through the CLI.

### 4. Sessions

- **New global table `PlatformSession`:** `tokenHash` (SHA-256 of a 256-bit random token, as owner
  sessions, S-2), `adminId`, `createdAt`, `lastSeenAt`, `expiresAt`. A new token is issued at every
  login.
- **Cookie `__Host-lebstads_admin`:** `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/` (what the
  `__Host-` prefix requires). **Absolute 8 hours, idle 30 minutes.** Logout deletes the row (a POST
  Server Action; there is no GET logout). **Owner and admin sessions never share a cookie or a
  table.**
- **The `__Host-` cookie is used whenever `APP_PROTOCOL` is `https`.** Only otherwise (local
  development over plain HTTP, where a `__Host-` cookie is refused) the cookie is named
  `lebstads_admin`, without the prefix and without `Secure`. **In production, if `APP_PROTOCOL` is
  not `https`, `/platform` returns 404 entirely**: the admin never runs over plain HTTP where it
  could be exposed.
- `lastSeenAt` is updated at most once a minute, not on every request.

### 5. Login

- **One form: identifier, password, code.** One generic error for any failure (unknown identifier,
  wrong password, wrong or replayed code, blocked). A dummy scrypt runs for an unknown identifier,
  as owner login does (S-4). The code is checked only after the password, and a failed code counts
  as a failure.
- **5 failures per account in 15 minutes block that account for 15 minutes; the same per IP** when
  `TRUSTED_CLIENT_IP_HEADER` is set. Uses `lib/rate-limit.ts`, outside any transaction.
- *Accepted cost:* someone who knows the identifier can lock that admin out for 15 minutes at a
  time. That is a nuisance, not a break-in; the per-IP limit and the CLI are the way through. **The admin
  identifier must therefore not be guessable** (not `admin`, `root`, a person's name or the
  domain): a long, unrelated string. The RUNBOOK (slice 7) documents how to unlock an account.

### 6. Audit

- **Every mutating action and every successful login writes `PlatformAuditLog`** with actor
  `admin:<id>` (the `src/modules/platform` use cases already take the actor). **Never a password,
  code, token or secret in `detail`.** A failed login is counted by the rate limit, not written to
  the audit log.

### 7. Scope of v1

- **Stadiums list:** slug, name, status, plan, paid-until with OVERDUE, pitches, bookings in the last
  30 days. **Stadium detail.** **Create a stadium with its owner** (the owner's first password is
  generated and shown once, on a `no-store` response). **Suspend** (reason required, type the slug)
  and **resume** (type the slug).
- **Mobile-first layout that also works on a laptop.**
- **Later:** record a subscription payment, reset an owner's password, an audit log screen.
- **Not planned:** logging in as an owner, editing a stadium's data, billing or plan limits.

### 8. Deploy preconditions

All of these before the first deploy of `/platform`:

- The server safety work is done: a **custom HestiaCP nginx proxy template**, a **rotated database
  password**, a **tested restore**.
- nginx **overwrites `X-Real-IP`** with the client address and `TRUSTED_CLIENT_IP_HEADER=x-real-ip`
  is set.
- `PLATFORM_TOTP_KEY` is in the server `.env`.
- **The server clock is synchronised** (`timedatectl` shows "System clock synchronized: yes"): TOTP
  codes depend on it, and so do the session expiries.

## Threats considered

| Threat | Answer |
|---|---|
| Credential stuffing | 16-character minimum, TOTP, 5 failures per account and per IP in 15 minutes, generic error, dummy scrypt |
| Stolen session cookie | `__Host-`, `HttpOnly`, `Secure`, `SameSite=Strict`, 8 hours absolute and 30 minutes idle, token hashed in the database, logout deletes the row |
| Replayed codes | `lastTotpStep` compare-and-set; only steps after the last one are accepted |
| The admin reached on a tenant host | `/platform` is 404 on any host but the bare one; the cookie is host-only and never sent to subdomains |
| A tenant page reached on the bare host | The bare host never resolves a tenant; every other path there stays 404 |
| CSRF | Server Actions' Origin check, `SameSite=Strict`, every mutation a POST Server Action, no GET logout |
| A leaked database | `totpSecret` is AES-256-GCM encrypted under a key that is not in the database; session tokens and passwords are hashed |
| Scanning for `/admin` | The path is `/platform` (noise only; not a security control) |

## Slices (one commit each)

1. This decision record.
2. `PlatformAdmin` and `PlatformSession` tables and migration; CLI `admins create`,
   `admins enroll-totp`, `admins reset-totp`.
3. `/platform` routing in `src/proxy.ts`, with isolation tests.
4. Login (password and code), sessions, limits, logout.
5. Stadiums list and detail (read-only).
6. Create a stadium, suspend and resume, all audited.
7. Security review pass and a RUNBOOK section.

## Rejected

- *A `/admin` path or a subdomain such as `admin.<domain>`.* A subdomain would be resolved as a
  tenant slug by the existing host check and needs DNS, a certificate and nginx changes; `/admin` is
  what scanners try first.
- *Reusing owner `User`/`Session`.* One table or cookie for both would let a bug in the owner app
  become an admin session.
- *Web password or TOTP recovery.* It would be the weakest link; the CLI over SSH is the recovery.
- *A third-party identity provider.* A dependency, a vendor outage and an account to protect, for
  a handful of operators.
- *Roles for admins.* One kind of admin until a second person needs less than everything.
