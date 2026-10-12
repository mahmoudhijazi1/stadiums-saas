# Where this project stands

**Purpose:** the short status: what is live, what is in progress, what is next.
**Read when:** you start a session; read it before anything else under `docs/`.
**Last verified:** `f01c9bf` (main, after refactor step 6c).

## What is live (tag `v1.3.0`)
Tag `v1.3.0` is the public page UI refinement on top of `v1.1.0` (the architecture cleanup, steps 1 to 7b and the docs reset, with no behaviour change; `v1.0.0` was the release after the Money page v2 merge). There is no `v1.2.0` tag: the version number jumped on purpose. The product it contains, in order of the build (dates and details are in [progress.md](./progress.md) and [archive/progress-2026.md](./archive/progress-2026.md)):
- **Booking:** a public page per stadium where players request slots; the owner approves, creates, cancels, records no-shows, runs a waitlist, extends a game by 30 minutes, and makes weekly recurring bookings.
- **Money:** collection in USD, LBP or both with change, per-player payments, fees, waivers and due changes, expenses, a Money page with profit or loss, an activity list and cash today, all on an append-only USD ledger.
- **Shop:** a catalog, walk-in sales and items charged to a game or a named player (USD or LBP).
- **Stadium:** name, address, map link, phones, a generated logo and one of five accent presets; a QR of the public page.
- **Owner app:** Arabic-first (RTL) with an English toggle, Today / Requests / Money / More tabs, push notifications for new requests, account self-service.
- **Security:** audit findings fixed or deferred with reasons ([audits/security-audit.md](./audits/security-audit.md)).

## Done in `v1.1.0`: the architecture cleanup (no behaviour change)
Merged on `main`: the dependency-rules guard (step 1), easy cleanup (2), the Prisma client at `src/generated` (3), one money formatter, one time formatter and copy by area (4), the stadium module (5), module `ui/` folders, the shell, `_components` and the app-thin guard (6a to 6c), the documentation reset (8), `bookings.ts` split by topic (7a) and the upcoming panel split with grouped action props (7b). The import rules live in `test/architecture/rules.ts`; the docs are checked by `test/docs/docs.test.ts`.

## Done in `v1.3.0`: public page UI refinement
The stadium's public page now has a day strip from today to 60 days ahead, the day as one list of rows with a "Nearest" badge (taken ones faded), availability dots on the days, a gradient header with an action bar (Map, Call, WhatsApp), a request sheet that confirms in place and explains errors, and per-stadium share metadata (title, description, Open Graph, Twitter, canonical; indexable). It also carries the two-option language toggle (public page, login, suspended page, business menu), system bars that follow the app theme, and a backdrop that darkens (not lightens) behind sheets and modals in the dark theme. The booking rules and use cases did not change. Details in [progress.md](./progress.md); open follow-ups in [ROADMAP.md](./ROADMAP.md) "Public page: later".

## In progress
- **Web platform admin** ([DR-006](./decisions/DR-006-platform-admin.md)): built on `feat/platform-admin` (slices 1 to 7: tables and CLI, `/platform` routing, login, stadiums list and detail, create, suspend and resume, security review). Deploy waits for the DR-006 preconditions in the RUNBOOK ("Platform admin").

## Next three steps
1. **Step 7, the remaining file splits:** the other files over about 300 lines that do more than one job, moving code as is (`bookings.ts` and `upcoming-panel.tsx` are done).
2. **Server safety:** run the deploy order and the backup and rollback steps in [RUNBOOK.md](./RUNBOOK.md) on the production droplet. UNVERIFIED: the current state of the server (backups, pm2, `.env`) was not checked from this repo.
3. **The pilot owner:** put one real stadium owner on the app and use their feedback to order the open items in [ROADMAP.md](./ROADMAP.md).
