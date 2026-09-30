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
