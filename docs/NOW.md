# Where this project stands

**Purpose:** the short status: what is live, what is in progress, what is next.
**Read when:** you start a session; read it before anything else under `docs/`.
**Last verified:** `f01c9bf` (main, after refactor step 6c).

## What is live (tag `v1.0.0`)
Tag `v1.0.0` is the release commit after the Money page v2 merge. The product it contains, in order of the build (dates and details are in [progress.md](./progress.md) and [archive/progress-2026.md](./archive/progress-2026.md)):
- **Booking:** a public page per stadium where players request slots; the owner approves, creates, cancels, records no-shows, runs a waitlist, extends a game by 30 minutes, and makes weekly recurring bookings.
- **Money:** collection in USD, LBP or both with change, per-player payments, fees, waivers and due changes, expenses, a Money page with profit or loss, an activity list and cash today, all on an append-only USD ledger.
- **Shop:** a catalog, walk-in sales and items charged to a game or a named player (USD or LBP).
- **Stadium:** name, address, map link, phones, a generated logo and one of five accent presets; a QR of the public page.
- **Owner app:** Arabic-first (RTL) with an English toggle, Today / Requests / Money / More tabs, push notifications for new requests, account self-service.
- **Security:** audit findings fixed or deferred with reasons ([audits/security-audit.md](./audits/security-audit.md)).

## In progress: the architecture cleanup (no behaviour change)
Merged on `main`: the dependency-rules guard (step 1), easy cleanup (2), the Prisma client at `src/generated` (3), one money formatter, one time formatter and copy by area (4), the stadium module (5), module `ui/` folders, the shell, `_components` and the app-thin guard (6a to 6c). This branch (`refactor/08-docs`) is step 8, the documentation reset. The import rules live in `test/architecture/rules.ts`; the docs are checked by `test/docs/docs.test.ts`.

## Next three steps
1. **Step 7, file splits:** split the files over about 300 lines that do more than one job (`booking/ui/upcoming-panel.tsx` first), moving code as is.
2. **Server safety:** run the deploy order and the backup and rollback steps in [RUNBOOK.md](./RUNBOOK.md) on the production droplet. UNVERIFIED: the current state of the server (backups, pm2, `.env`) was not checked from this repo.
3. **The pilot owner:** put one real stadium owner on the app and use their feedback to order the open items in [ROADMAP.md](./ROADMAP.md).
