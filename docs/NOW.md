# Where this project stands

**Read this first.** Everything else under `docs/` is reachable from here — not duplicated into this page.

## Status

SPEC-01…14 are shipped on `main`: multi-tenant proxy → Prisma tenant guard (with RULE-7 isolation integration tests), public PENDING slot request, owner Today / Book / Waitlist / Money / Settings (Arabic-first + cookie EN/ع on public and owner), cash collect / expense / ledger period, no-show, waitlist WhatsApp prepare links.

Shipped since (details and dates in `progress.md`):

- **UX-01** ([owner-ux.md](./owner-ux.md)) — shell (header, business sheet, offline pill, Today / Requests / ＋ / Money / More, `lg` rail), More hub, Today request banner and card states, Requests tab (slot interests, reject chips, approve notify sheet, missed requests, "starts soon" flag, precise relative time, live badge with 20s poll).
- **UX-02** ([ux-02-history.md](./ux-02-history.md)) slices 1–2 — Beirut day navigation + `summarizeDay` line; person page + header search results.
- **SPEC-15** slices 1–2 — per-player foundation (`collectionMode`, `Booking.amountDueUsd`, `splitEvenly` / `personOwedOnBooking`), then per-player mode: `Pitch.defaultPlayerCount` (1–30, default 10), switch Whole ⇄ Per player in the booking sheet, slot list with one-tap USD pay, "Booker pays all remaining", "N of M paid". P1–P5 settled at the spec defaults.
- **SPEC-16** slices 1–3 — `BookingDueChange` log + `adjustDue`, fee suggestions from tenant policy, cancel / no-show / adjust sheets and Booking rules settings, request-card debt warning, public policy line, WhatsApp fee text.
- **Design system** ([MIGRATION.md](./MIGRATION.md)) — token layer, typography, responsive shell. Component restyles still open there.

That is still the scoped product slice — **not** full Phase 1 BRD (no group pay or mixed currency per player, pitch blocks, subscriptions, etc.). Honest line for a paying owner: pilot-with-supervision, not production-ready — see the MVP readiness audit.

## Start here by topic

| Need | Go to |
|------|--------|
| Product rules / phases | [requirements/brd.md](./requirements/brd.md) |
| Why architecture | [decisions/](./decisions/) (esp. DR-001, DR-002) |
| How a slice was built | [specs/SPEC-NN](./specs/) (historical — do not rewrite bodies) |
| Owner UX structure (wins on conflict) | [owner-ux.md](./owner-ux.md) (UX-01), [ux-02-history.md](./ux-02-history.md) (UX-02) |
| Owner tabs / routes | [owner-ia.md](./owner-ia.md) |
| Per-player split, slot pay, cancel / no-show on a split booking | [per-player-payments.md](./per-player-payments.md) (living, as built) |
| Visual design | [ui-foundations.md](./ui-foundations.md), [ui-components.md](./ui-components.md), [theme.md](./theme.md), [MIGRATION.md](./MIGRATION.md) |
| Current file tree | [guides/folder-structure.md](./guides/folder-structure.md) |
| Module roles + request walks | [guides/module-map-and-request-walkthroughs.md](./guides/module-map-and-request-walkthroughs.md) |
| Mentor oral map | [guides/mentor-defense-backend.md](./guides/mentor-defense-backend.md) |
| Tests / Docker Postgres | [guides/testing-jest.md](./guides/testing-jest.md) |
| Journey / defend a choice | [progress.md](./progress.md) |
| Docs catalog (all DRs/SPECs/guides) | [README.md](./README.md) |
| Launch gaps / ordered backlog | [guides/mvp-readiness-audit.md](./guides/mvp-readiness-audit.md) (dated; read the banner) |

## What’s next

**Product, next up:** SPEC-15 slices 3–5 (pay together + mixed currency, naming unpaid slots + due editing, assign Unassigned + "Same as last time"). Cancel and no-show on a per-player booking collapse it to whole. Per-player split is offered only after the game has ended (intentional for now), so in the UI the collapse runs mainly on no-show; cancel reaches it only for a fully paid game. Details in [per-player-payments.md](./per-player-payments.md).

**Product, not started:** UX-02 slices 3–5 — Money → Transactions, month overview, booking-sheet timeline (actor columns).

Remaining **MVP audit P0** (isolation proof is done):

1. **Backup** — minimal droplet / Postgres snapshot or `pg_dump` cadence, written in one place and followed.
2. **Deploy truth** — root README already points here for status; finish a short prod env checklist (host, HTTPS, DNS, `DATABASE_URL`, log disk, never seed prod).

Then either more P1 from that audit (concurrent collect race, Booking indexes) or a product BRD gap when you choose one.

## How we work

Decision → spec → code. Append [progress.md](./progress.md) after a finished slice. Framework APIs: read `AGENTS.md` and local Next/Prisma docs — not training memory.
