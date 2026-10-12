# Runbook

**Purpose:** operator procedures for the production server: deploy, backup, rollback, secrets.
**Read when:** you deploy, restore, rotate a secret or debug production.
**Last verified:** `f01c9bf` (main, after refactor step 6c).

**Living.** Operator procedures for the production server. Extend this file section by section; never overwrite it.

## Passwords

Set or reset a login's password with `scripts/set-password.ts`. The password is typed only at a hidden prompt, twice. It is never accepted as an argument or an environment variable, and it must pass the shared password policy (at least 12 characters; not the login, its first part or the stadium slug; not a common password). The tool hashes it with the app's own `hashPassword`, deletes **every** session of that user (they must log in again), and prints only `updated <identifier>`.

Before it changes anything, it shows the database name from `DATABASE_URL` and refuses to continue until you type that name exactly.

**Requirements:** run from the app directory, where `.env` holds the production `DATABASE_URL`. The script runs with `tsx`, which is a **dev dependency**, and it also needs the generated Prisma client (`src/generated`, from `prisma generate`, which is also a dev dependency). If the server was installed with `npm ci --omit=dev` or `NODE_ENV=production npm ci`, run `npm ci` (with dev dependencies) first. It needs an interactive terminal (an SSH session); piped input is refused.

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

## Owner account self-service

Any logged-in user (owner or staff, whatever their permissions) can change their OWN credentials in the app: **More → Account**. Nobody can change anyone else's there. The acting user always comes from the session; a suspended tenant is refused.

- **Change password:** current password + new password (show/hide, no confirm field). Same policy as the scripts. On success every OTHER session of that user is logged out; the current one stays.
- **Log out other devices:** closes every other session of the user (with a confirm step and the count).
- **Change login:** only the part before the `@` is editable; the `@slug` suffix is the tenant's and is added by the server. Lowercase letters and digits, one `.` `_` or `-` between parts, up to 32 characters. Needs the current password. Sessions stay valid.
- **Wrong current password:** 5 failures in 15 minutes block these two actions for 15 minutes (`RateLimit` keys `pwchange:<userId>` and `pwchange:block:<userId>`). It is separate from the login limit and never locks login. A success resets it.

### Forgotten password (operator procedure)

1. Confirm who is asking, by phone, against the number you have for the owner. Do not reset on a message alone.
2. `npx tsx scripts/set-password.ts --list` shows the exact identifier (for example `owner@ahmad`).
3. `npx tsx scripts/set-password.ts <identifier>`: type the database name, then the new password twice (hidden). It deletes all of that user's sessions.
4. Tell the owner the new password on the phone and ask them to change it in the app (More → Account → Change password) straight away.

## Login lockout

After 8 failed logins for one account within 15 minutes, that account's logins are refused for 15 minutes with "Too many attempts". This also applies to identifiers that do not exist. Sessions that are already logged in keep working. When `TRUSTED_CLIENT_IP_HEADER` is set, 40 failures from one IP address in 15 minutes block that IP the same way.

To lift a block early (for example, an owner locked out by someone guessing at their account), delete the counters for that identifier:

```bash
# The password comes from ~/.pgpass (see "Database commands" below), never from the command line.
psql -h 127.0.0.1 -U stadiums_user -d stadiums_saas -c "DELETE FROM \"RateLimit\" WHERE key IN ('login:block:acct:owner@ahmad', 'login:fail:acct:owner@ahmad');"
```

**`TRUSTED_CLIENT_IP_HEADER`:** set it only when nginx overwrites that header with the real client address, for example `proxy_set_header X-Real-IP $remote_addr;` together with `TRUSTED_CLIENT_IP_HEADER=x-real-ip`. When it is unset, no per-IP limit applies. Never point it at a header the client can set by itself.

## Database commands (psql, pg_dump): no password on the command line

**Rule:** no command in this runbook, in a script, in cron or in shell history may carry the database password in its arguments: not `psql "postgres://user:password@..."`, not `psql "$DATABASE_URL"` when that URL has the password in it, not `-W password`, not `PGPASSWORD=... psql ...` typed inline.

**Why:** the server is shared. Any other account on it can read the arguments of a running process (`ps aux`, `/proc/<pid>/cmdline`), and a command typed in a shell is also written to its history file. A password in either place is readable by people who should not have it.

**Instead, use `~/.pgpass`** of the user who runs the command (the password is read from the file, not from the arguments):

```bash
# one line per database: host:port:database:user:password
echo '127.0.0.1:5432:stadiums_saas:stadiums_user:THE_PASSWORD' >> ~/.pgpass   # type it in an editor instead, so the password is not in history
chmod 600 ~/.pgpass                                                            # psql ignores the file if group/others can read it

psql -h 127.0.0.1 -U stadiums_user -d stadiums_saas -c 'SELECT 1;'
pg_dump -h 127.0.0.1 -U stadiums_user -d stadiums_saas -Fc -f /var/backups/stadiums-$(date +%F).dump
```

Use the same host name in `.pgpass` as in the command (`localhost` and `127.0.0.1` do not match each other). The app itself reads `DATABASE_URL` from `.env` (mode 600, owned by the app user), which is not a command argument. Prisma's `?schema=public` suffix is not accepted by psql, which is another reason to pass host, user and database as separate options.

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
- **Required in production only:** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (a `mailto:` address or an https URL), and `PLATFORM_TOTP_KEY` (32 random bytes in base64; see "Platform admin" below). Optional in development: without them the Notifications row is hidden. See "Push keys" below.
- **Optional:** `PASSWORD_HASH_COST` (14–20), `TRUSTED_CLIENT_IP_HEADER`, `TRUST_PROXY_HEADERS` (`true` or `false`), `PG_POOL_MAX`.
- There is no session secret: session tokens are random and stored hashed.

`.env.example` lists them all.

## Push keys

Owner notifications are signed with a VAPID key pair ([push-notifications.md](./push-notifications.md)).

- **Generate** one pair per environment, once: `npx web-push generate-vapid-keys`. Put `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT="mailto:ops@your-domain"` in the server's `.env` (the file on the droplet, outside git; `.env.example` shows the names only).
- **Never commit** the private key, paste it in a ticket or chat, or print it in a log. The app never logs it or sends it to the browser; the browser gets only the public key.
- **Production refuses to start** without all three (the log names the missing variable).
- **Do not rotate casually.** Every device subscribed with the old public key stops receiving alerts; each owner must open More → Notifications and tap Enable again. If the private key leaks, rotate and tell the owners.
- **Back up** the pair with the rest of the server secrets: losing it has the same effect as rotating it.

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

A platform operator manages stadiums (tenants) from the server with `scripts/platform.ts`. Access is SSH plus `DATABASE_URL`; the web admin ("Platform admin" below) covers the common cases. Like `set-password`, it runs with `tsx` (a dev dependency) from the app directory.

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

## Platform admin

The web admin ([DR-006](./decisions/DR-006-platform-admin.md)) lives at `https://<APP_BASE_DOMAIN>/platform`, on the bare domain only: any other host, and any host in production unless `APP_PROTOCOL=https`, gets a 404. It lists the stadiums, shows one, creates a stadium with its owner, and suspends or resumes it. Its accounts exist only through the CLI below. Review: [audits/platform-admin-review.md](./audits/platform-admin-review.md).

### The TOTP key

Generate it once per environment and put it in the server `.env` (mode 600):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# PLATFORM_TOTP_KEY=<that value>
```

Production **refuses to start** without it (`src/lib/env.ts`). It encrypts each admin's TOTP secret (AES-256-GCM). **Losing or changing it makes every enrolled secret unreadable:** nobody can sign in, so run `admins reset-totp` and `admins enroll-totp` again for each admin. Never commit it, never print it.

### Admin accounts (CLI, over SSH)

Like the other platform commands these need an interactive terminal; each mutating one shows the database name from `DATABASE_URL`, refuses until you type it, and writes an audit row (actor `cli:<os user>@<host>`, never a password or secret).

```bash
npx tsx scripts/platform.ts admins list
npx tsx scripts/platform.ts admins create <identifier>
npx tsx scripts/platform.ts admins enroll-totp <identifier>
npx tsx scripts/platform.ts admins reset-totp <identifier>
npx tsx scripts/platform.ts admins set-password <identifier>
```

- **`create`** asks the password twice, hidden: **at least 16 characters** and the shared policy. The admin is created **not enrolled**: login is refused until `enroll-totp`.
- **`enroll-totp`** needs `PLATFORM_TOTP_KEY`. It draws a QR and the `otpauth://` URI in the terminal (shown once), then asks for the current 6-digit code; only a valid code saves the encrypted secret. It refuses an admin who is already enrolled.
- **`reset-totp`** (lost phone) asks you to type the identifier back, forgets the secret and **deletes that admin's sessions**. Then run `enroll-totp`.
- **`set-password`** asks the new password twice and **deletes that admin's sessions**.
- **`list`** shows identifier, enrolled yes or no, created. Never a hash or a secret.
- **Pick an identifier that appears nowhere else** (not `admin`, `root`, a person's name, the domain, a stadium slug): a long unrelated string. The per-account lockout is keyed by it, so a guessable identifier lets anyone lock you out.

### Unlock a blocked admin

After 5 failed logins for one identifier within 15 minutes, that identifier is refused for 15 minutes ("Too many attempts"), unknown identifiers included. To lift it early, delete the counters (the exact keys are `platform:fail:acct:<identifier>` and `platform:block:acct:<identifier>`, with the identifier lowercase):

```bash
# The password comes from ~/.pgpass (see "Database commands" below), never from the command line.
psql -h 127.0.0.1 -U stadiums_user -d stadiums_saas -c "DELETE FROM \"RateLimit\" WHERE key IN ('platform:fail:acct:<identifier>', 'platform:block:acct:<identifier>');"
```

The per-IP keys are `platform:fail:ip:<ip>` and `platform:block:ip:<ip>`; they exist only when `TRUSTED_CLIENT_IP_HEADER` is set.

### Deploy checklist (before the first deploy of `/platform`)

- [ ] The server safety work is done: the custom HestiaCP nginx proxy template, a rotated database password, a tested restore (see "Deploy order" and "Database commands").
- [ ] nginx overwrites `X-Real-IP` with the client address, and `TRUSTED_CLIENT_IP_HEADER=x-real-ip` is in `.env` (otherwise there is no per-IP limit).
- [ ] `PLATFORM_TOTP_KEY` is in the server `.env`, and `APP_PROTOCOL=https`.
- [ ] `timedatectl` shows `System clock synchronized: yes` (TOTP codes and session expiries depend on the clock).
- [ ] At least one admin exists and is enrolled (`admins list` shows `yes`).
- [ ] `npm run test:integration` was run green on the branch being deployed.

After the deploy:

```bash
curl -sI https://<APP_BASE_DOMAIN>/platform/login
```

It must show `HTTP/2 200`, a `Cache-Control` containing `no-store`, and `X-Robots-Tag: noindex, nofollow`. Also `curl -sI https://www.<APP_BASE_DOMAIN>/platform/login` and the same on a stadium subdomain must answer `404`. If `Cache-Control` has no `no-store`, Next replaced the proxy's header: stop and fix before announcing it.

## Server: nginx, backups, pm2, certificate

Recorded 2026-10-12 from the production server (HestiaCP, user `mahmoud`). The server is **shared with other sites**.

### nginx: the `nextjs` proxy template

`lebstads.com` uses a custom HestiaCP proxy template named `nextjs` (`/usr/local/hestia/data/templates/web/nginx/nextjs.tpl` and `nextjs.stpl`), applied on 2026-10-12 with:

```bash
v-change-web-domain-proxy-tpl mahmoud lebstads.com nextjs
```

- **What it does:** every request goes to `127.0.0.1:3000` with `Host`, `X-Real-IP` and `X-Forwarded-For` set from `$remote_addr`. No static file is served from the app folder, and Apache is not in the path.
- **Roll back** to Hestia's template with the same command and `default` instead of `nextjs`.
- **Always run `sudo nginx -t` first, and never restart or reload nginx with a failing config:** other sites share this nginx.
- **`chmod 700 ~/web/lebstads.com/public_html/.next`** (Deploy order, step 7) is no longer needed with this template. It is harmless; keep it.
- **`TRUSTED_CLIENT_IP_HEADER=x-real-ip`** is set in `.env` and is safe, because the template overwrites `X-Real-IP` with the real client address (see "Login lockout"). This is also what makes the per-IP login limits of the platform admin work.

### Backups

- **Script:** `~/bin/stadiums-backup.sh` runs `pg_dump -Fc` with `umask 077`, checks that the dump is not empty and that `pg_restore -l` can read it, and keeps 14 days in `~/backups`.
- **Schedule:** `mahmoud`'s crontab runs it at 03:15. The log is `~/backups/backup.log`: look at it after any change to the script, the crontab or the database password.
- **Limit:** backups stay on the same server. There is no off-server copy yet (ROADMAP, "Server and schema").

### Restore test (done on 2026-10-12)

Restore into a temporary database, never over the live one. `stadiums_user` has no `CREATEDB`, so the database is created as the postgres superuser, owned by `stadiums_user`:

```bash
# 1. create an empty temporary database (superuser; the owner is the app's database user)
sudo -u postgres createdb -O stadiums_user stadiums_restore_test

# 2. restore the newest dump into it (password from ~/.pgpass, never on the command line)
pg_restore -h 127.0.0.1 -U stadiums_user -d stadiums_restore_test --no-owner ~/backups/<newest>.dump

# 3. compare counts with the live database: Tenant, Person, Booking, Payment, LedgerEntry
for db in stadiums_saas stadiums_restore_test; do
  psql -h 127.0.0.1 -U stadiums_user -d "$db" -At -c 'SELECT (SELECT count(*) FROM "Tenant"), (SELECT count(*) FROM "Person"), (SELECT count(*) FROM "Booking"), (SELECT count(*) FROM "Payment"), (SELECT count(*) FROM "LedgerEntry");'
done
# and the ledger sum
for db in stadiums_saas stadiums_restore_test; do
  psql -h 127.0.0.1 -U stadiums_user -d "$db" -At -c 'SELECT direction, sum("amountUsd") FROM "LedgerEntry" GROUP BY direction ORDER BY direction;'
done

# 4. drop the temporary database
sudo -u postgres dropdb stadiums_restore_test
```

On 2026-10-12 the counts of `Tenant`, `Person`, `Booking`, `Payment`, `LedgerEntry` and the ledger sum matched the live database. If a count differs (the live database keeps changing after the dump, so a small difference in a young table can be real traffic; look at the newest rows before judging), do not trust the backup until you know why. UNVERIFIED: the steps above are written from the description of what was done; the exact `pg_restore` flags and the name of the temporary database used on the server were not recorded, and the ledger query sums `LedgerEntry.amountUsd` by `direction`.

### pm2

pm2 runs the app as the process `stadiums-saas`; the systemd unit `pm2-mahmoud` is enabled, so the process list comes back after a reboot. Run `pm2 save` only when the process list changes (a new or removed process), not after each deploy.

### Certificate (manual, does NOT renew by itself)

- The `*.lebstads.com` certificate is installed **manually** (`LETSENCRYPT='no'` on the domain). DNS is at Hostinger (`dns-parking.com`).
- **It expires on 2026-12-24 and does not renew by itself.** Reissue it well before then (ROADMAP: automatic renewal).
- **Never run `v-list-web-domain-ssl` in a shared terminal or paste its output:** it prints the private key.

## Fonts

Fonts are self-hosted with `next/font/local` (`src/app/layout.tsx`); the build and the app make no request to Google. The woff2 files and their SIL Open Font License texts are in `src/fonts/<family>/`: IBM Plex Sans Arabic (arabic + latin, 400 and 600), Manrope (latin, 400 and 600), Big Shoulders (latin, 800), IBM Plex Mono (latin, 400 and 600). They came from the `@fontsource/*` packages, which repackage the official Google Fonts OFL releases; each family folder has its `OFL.txt`. To add a weight or a family, copy the woff2 and licence into `src/fonts/`, add it to the loader in `layout.tsx`, and keep to weights 400 and 600 unless a design needs more.

## Public page QR

The QR button in the business menu shows a QR code of the stadium's public page and offers Share, Download PNG and a printable poster (`/owner/qr/print`). The code is generated on the server by `GET /owner/qr?format=svg|png`; the library never reaches the browser.

- **New runtime dependency: `qrcode`** (MIT, 1.5.4; its own dependencies `pngjs`, `yargs` and `dijkstrajs` are MIT too, and none of them has an install script). Used only in `src/modules/stadium/domain/qr.ts`, which only server code imports. Dev only: `jsqr` (Apache-2.0, decodes the PNG in tests), `pngjs`, `@types/qrcode`, `@types/pngjs`.
- **What it encodes:** `publicPageUrl(slug)`, the same link the Copy and WhatsApp buttons use: `APP_PROTOCOL://<slug>.APP_BASE_DOMAIN/`. So **the QR points at the production site only when `APP_PROTOCOL` and `APP_BASE_DOMAIN` are set correctly in the server `.env`** (`https` and `lebstads.com` in production). With `APP_BASE_DOMAIN` empty the route answers 503 rather than encode a wrong link. Printed posters keep working only as long as the domain and the slug do not change: check them before sending anything to print.
- The tenant is resolved from the host only; no query parameter can change the encoded text. Black on white, 4-module quiet zone, error correction Q, PNG 1024 x 1024.


## Framework version

**Next.js 16.3.8** (`next` and `eslint-config-next`, pinned exactly; React 19.2.8). Raised from 16.3.4 on 2026-10-14.

- 16.3.6 fixes GHSA-vcvr-r3jv-pc5j (remote code execution in `next/og` `ImageResponse`): do not use `ImageResponse` below it.
- 16.3.8 fixes image-optimization SSRF (GHSA-cjq9-62q9-8jv4), metadata image routes leaking through `dynamicParams` (GHSA-f87g-xv8r-7p7x), SSG/ISR cache poisoning (GHSA-4jqv-mc3x-m676, GHSA-mcj8-r9mp-w47p) and `use cache` leaks (GHSA-3w37-wq28-93x7, GHSA-h694-7cp9-m8p3).
- After any upgrade: `npm test`, `npm run test:integration`, `npm run build`, then check the installed app (service worker, manifest, push) by hand. The 16.3.4 to 16.3.8 upgrade itself was verified only with `npx tsc --noEmit`.

## Deploy order

One complete order, run from the app directory on the server as the app user. The password for `pg_dump` comes from `~/.pgpass` (see "Database commands"), never from the command line. The process manager is `pm2`, process `stadiums-saas` (verified on the server; it is not configured in this repo).

```bash
# 1. backup first (custom format, restorable with pg_restore), readable by the app user only
BACKUP=/var/backups/stadiums-$(date +%F).dump
pg_dump -h 127.0.0.1 -U stadiums_user -d stadiums_saas -Fc -f "$BACKUP"
chmod 600 "$BACKUP"
test -s "$BACKUP" && ls -lh "$BACKUP"    # the size must not be zero; stop here if it is

# 2. note what is running now (for the rollback), then update
git rev-parse --short HEAD
git pull --ff-only

# 3. the Prisma client moved out of src/app: remove the old folder if it is still there
rm -rf src/app/generated

# 4. install with dev dependencies (prisma, tsx and the build need them)
npm ci

# 5. the client is not in git: generate it before the build
npx prisma generate --config prisma7.config.ts

# 6. what would migrate, then migrate
npx prisma migrate status --config prisma7.config.ts
npx prisma migrate deploy --config prisma7.config.ts

# 7. build, lock the build folder, restart, look at the logs
npm run build
# Why: the server is a HestiaCP domain whose nginx serves static extensions (json, js, txt and more)
# straight from the app folder; this is a stopgap until a custom proxy template sends every request
# to 127.0.0.1:3000. The nginx template of 2026-10-12 does that, so this line is no longer needed
# (see "Server: nginx"); it is harmless.
chmod 700 ~/web/lebstads.com/public_html/.next
pm2 restart stadiums-saas
pm2 logs stadiums-saas --lines 100
npx next --version
```

The first verified backup (a real `pg_dump` with the values above) was taken on 2026-10-12.

Check after the restart: the logs show no `Invalid environment` or `Missing` line at startup (the server refuses to start in production with a bad `.env`), `npx next --version` prints the version in `package.json` (16.3.8 at the time of writing; never older than 16.3.6, see "Framework version"), and the public page of one stadium loads.

**`.env` on the server** (mode 600): `DATABASE_URL`, `APP_BASE_DOMAIN`, `APP_PROTOCOL=https`, the three VAPID values (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`; see "Push keys") and, only when nginx overwrites the header with the real client address, `TRUSTED_CLIENT_IP_HEADER="x-real-ip"` (see "Login lockout"). Missing or malformed required values stop the server at start.

### Roll back to a tag
Releases are git tags (`v1.0.0` is the first). To go back to a tag:

```bash
git fetch --tags
git checkout v1.0.0            # a tag, or the hash noted in step 2
rm -rf src/app/generated       # only needed when going back past the move of the client
npm ci
npx prisma generate --config prisma7.config.ts
npm run build
chmod 700 ~/web/lebstads.com/public_html/.next   # see step 7 of the deploy order for why
pm2 restart stadiums-saas
```

Migrations only go forward. If the tag is older than a migration that has already been applied, the old code may not run on the new schema: restore the backup from step 1 instead (`pg_restore -h 127.0.0.1 -U stadiums_user -d stadiums_saas --clean --if-exists /var/backups/stadiums-YYYY-MM-DD.dump`), which loses everything written after the backup. UNVERIFIED: this restore was not run from this repo. To return to the latest release: `git checkout main && git pull --ff-only`, then steps 4 to 7.
