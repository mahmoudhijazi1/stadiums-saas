# Runbook

**Living.** Operator procedures for the production server. Extend this file section by section; never overwrite it.

## Passwords

Set or reset a login's password with `scripts/set-password.ts`. The password is typed only at a hidden prompt, twice. It is never accepted as an argument or an environment variable, and it must be at least 12 characters. The tool hashes it with the app's own `hashPassword`, deletes **every** session of that user (they must log in again), and prints only `updated <identifier>`.

Before it changes anything, it shows the database name from `DATABASE_URL` and refuses to continue until you type that name exactly.

**Requirements:** run from the app directory, where `.env` holds the production `DATABASE_URL`. The script runs with `tsx`, which is a **dev dependency**, and it also needs the generated Prisma client (`src/app/generated`, from `prisma generate`, which is also a dev dependency). If the server was installed with `npm ci --omit=dev` or `NODE_ENV=production npm ci`, run `npm ci` (with dev dependencies) first. It needs an interactive terminal (an SSH session); piped input is refused.

```bash
cd /path/to/stadiums-saas          # the deployed app directory
npx tsx scripts/set-password.ts --list
#   owner@ahmad    OWNER  ahmad     (identifier, role, tenant slug; never hashes)

npx tsx scripts/set-password.ts owner@ahmad
#   Database: <name from DATABASE_URL>
#   Type the database name to continue: <type it>
#   New password:          (hidden)
#   Repeat new password:   (hidden)
#   updated owner@ahmad
```

A wrong database name, a password under 12 characters, two entries that differ, or an unknown identifier all stop the tool with exit code 1 and change nothing.

After the seed's `dev-owner` accounts have ever existed on a server, reset every one of them with this tool (security audit S-1).

## Login lockout

After 8 failed logins for one account within 15 minutes, that account's logins are refused for 15 minutes with "Too many attempts". This also applies to identifiers that do not exist. Sessions that are already logged in keep working. When `TRUSTED_CLIENT_IP_HEADER` is set, 40 failures from one IP address in 15 minutes block that IP the same way.

To lift a block early (for example, an owner locked out by someone guessing at their account), delete the counters for that identifier:

```bash
# psql does not accept Prisma's ?schema=public suffix, so strip the query string.
psql "${DATABASE_URL%%\?*}" -c "DELETE FROM \"RateLimit\" WHERE key IN ('login:block:acct:owner@ahmad', 'login:fail:acct:owner@ahmad');"
```

**`TRUSTED_CLIENT_IP_HEADER`:** set it only when nginx overwrites that header with the real client address, for example `proxy_set_header X-Real-IP $remote_addr;` together with `TRUSTED_CLIENT_IP_HEADER=x-real-ip`. When it is unset, no per-IP limit applies. Never point it at a header the client can set by itself.

## Password hash cost

Passwords are hashed with scrypt, N = 2^`PASSWORD_HASH_COST` (14 to 20, default 16). On the 4-core build machine one hash took about 190 ms and used 64 MB. If login feels slow on the server, set `PASSWORD_HASH_COST=15` (about half the time) in `.env` and restart the app. Each stored hash records its own cost. On a user's next successful login, a hash made with a different cost is rehashed with the current one, and old hashes keep verifying until then.

To time one hash on the server:

```bash
node -e 'const c=require("crypto");const N=2**16;const t=Date.now();c.scryptSync("x","saltsaltsaltsalt",64,{N,r:8,p:1,maxmem:256*N*8});console.log(Date.now()-t,"ms")'
```

## Hosts

The app serves only the bare `APP_BASE_DOMAIN` (for example `lebstads.com`) and single-label subdomains of it (`ahmad.lebstads.com`). Any other `Host` gets a 404 before any database lookup. The tenant comes from that validated host only.

- nginx must pass the real host: `proxy_set_header Host $host;`.
- If nginx instead sends `Host: 127.0.0.1:3000` and the real host in `X-Forwarded-Host`, set `TRUST_PROXY_HEADERS=true`. Do this only when nginx overwrites that header (`proxy_set_header X-Forwarded-Host $host;`). Otherwise a client could choose the host.
- Without `TRUST_PROXY_HEADERS`, `X-Forwarded-Host` is ignored.

## Environment

The server checks its environment once at start (`src/lib/env.ts`, from `src/instrumentation.ts`). In production it **exits** when a required variable is missing or malformed, and the log line names the variable, never its value.

- **Required:** `DATABASE_URL` (a `postgres://` URL), `APP_BASE_DOMAIN` (a host name, optionally with `:port`, no scheme), `APP_PROTOCOL` (`http` or `https`).
- **Optional:** `PASSWORD_HASH_COST` (14–20), `TRUSTED_CLIENT_IP_HEADER`, `TRUST_PROXY_HEADERS` (`true` or `false`), `PG_POOL_MAX`.
- There is no session secret: session tokens are random and stored hashed.

`.env.example` lists them all.

## Listen on localhost only

`npm start` runs `next start -H 127.0.0.1 -p 3000`. Next.js otherwise listens on `0.0.0.0` (every interface), which would let anyone reach the app directly on port 3000 and skip nginx: its TLS, HSTS, `limit_req`, and the `Host` / `X-Real-IP` / `X-Forwarded-Host` headers the app trusts. Bound to 127.0.0.1, only nginx on the same machine can reach it.

- **Source of the flag:** `next start --help` and `node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md` ("`next start` options"). They document `-H, --hostname <hostname>` (default `0.0.0.0`) and `-p, --port <port>` (default 3000, env `PORT`).
- **No `HOSTNAME` for `next start`:** the `HOSTNAME` env var is documented only for the standalone `server.js` (`output.md`), not for `next start`, so the script uses the flag.
- **Check on the server** after every restart:

  ```bash
  sudo ss -tlnp | grep ':3000'
  ```

  It must show `127.0.0.1:3000`. `0.0.0.0:3000`, `*:3000` or `[::]:3000` means the app is exposed; check how it was started, for example the process manager running `next start` directly instead of `npm start`.
- **nginx** keeps proxying to `http://127.0.0.1:3000`.

## Tenant management

A platform operator manages stadiums (tenants) from the server with `scripts/platform.ts`. There is no web admin: access is SSH plus `DATABASE_URL`. Like `set-password`, it runs with `tsx` (a dev dependency) from the app directory.

```bash
npx tsx scripts/platform.ts tenants list
npx tsx scripts/platform.ts tenants create --slug al-nour --name "Al Nour" [--plan basic] [--paid-until 2026-12-31] [--owner-identifier owner@al-nour]
npx tsx scripts/platform.ts tenants suspend al-nour --reason "Unpaid since September"
npx tsx scripts/platform.ts tenants resume al-nour
npx tsx scripts/platform.ts subscriptions set al-nour --plan basic --paid-until 2027-01-31 [--amount 25] [--note "cash"]
```

- **`list`** is read-only and needs no confirmation. It shows slug, name, status, plan, paid-until (with `OVERDUE` once that day is over), created, pitch count, and bookings requested in the last 30 days. It never prints hashes, tokens or suspension reasons.
- **Every mutating command** needs an interactive terminal. It shows the database name from `DATABASE_URL` and refuses until you type it. `suspend` and `resume` also ask you to type the slug.
- **`create`** asks the owner's first password twice, hidden, at least 12 characters. It never takes it as an argument or env var.
- **Audit:** each mutating command writes one row to `PlatformAuditLog` (append-only: action, tenant, actor `cli:<os user>@<host>`, details, never a password).
- **Password resets** stay in `scripts/set-password.ts` ("Passwords" above).
- **Plans** are a label only: no limits and no pricing. `paidUntil` never blocks anything. Suspension is manual.

### Onboarding checklist

1. Ask the owner: **"When does your business day start?"** (the hour after which a late game stops counting as last night's: midnight, or 1 to 6 AM; most answer 6 AM). Then `tenants create --slug <slug> --name "<name>" --paid-until <date> [--day-start-hour <0-6>]` (omit it for the default, 6), and give the owner their login (`owner@<slug>`) and password in person. They can change it later: More → Business → Booking rules.
2. The owner opens `https://<slug>.<APP_BASE_DOMAIN>/owner/login` and logs in.
3. The owner sets the exchange rate: More → Settings.
4. The owner adds pitches, with hours and prices: More → Settings → Pitches.
5. Share the public link `https://<slug>.<APP_BASE_DOMAIN>/` (or its QR code) with players.

### Suspend and resume

- **`tenants suspend <slug> --reason "..."`:**
  - Owner pages go to a neutral "account suspended" page.
  - The live poll stops (403).
  - Every public path shows a neutral "temporarily unavailable" page (status 200, noindex, no tenant data).
  - Public requests are refused.
  - The reason is for the operator only and is never shown.
- **`tenants resume <slug>`** restores everything instantly. Suspension deletes nothing: sessions stay valid and no data is touched.
- **Check:** `tenants list` shows `SUSPENDED` or `ACTIVE`.

### Slugs

- **Format:** 3–30 characters, lowercase letters, digits and single inner hyphens. No leading or trailing hyphen, no `--`, no `xn--`, so that `owner@<slug>` is always a valid login.
- **Reserved** (their explicit DNS records override the wildcard, or they are kept for the platform): www, mail, webmail, ftp, smtp, imap, pop, ns1, ns2, admin, api, app, static, assets, cdn, status, support, help, dashboard, login, panel, cpanel, test.
- **Slugs are immutable.** There is no rename command: printed QR codes, installed PWAs and shared links use the slug.

## Fonts

Fonts are self-hosted with `next/font/local` (`src/app/layout.tsx`); the build and the app make no request to Google. The woff2 files and their SIL Open Font License texts are in `src/fonts/<family>/`: IBM Plex Sans Arabic (arabic + latin, 400 and 600), Manrope (latin, 400 and 600), Big Shoulders (latin, 800), IBM Plex Mono (latin, 400 and 600). They came from the `@fontsource/*` packages, which repackage the official Google Fonts OFL releases; each family folder has its `OFL.txt`. To add a weight or a family, copy the woff2 and licence into `src/fonts/`, add it to the loader in `layout.tsx`, and keep to weights 400 and 600 unless a design needs more.
