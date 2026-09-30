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
