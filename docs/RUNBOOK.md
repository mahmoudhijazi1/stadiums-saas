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
