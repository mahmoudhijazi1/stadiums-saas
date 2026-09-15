# Where this project stands

**Read this first.** Everything else under `docs/` is reachable from here — not duplicated into this page.

## Status

SPEC-01…14 are shipped on `main`: multi-tenant proxy → Prisma tenant guard (with RULE-7 isolation integration tests), public PENDING slot request, owner Today / Book / Waitlist / Money / Settings (Arabic-first + cookie EN/ع on public and owner), cash collect / expense / ledger period, no-show, waitlist WhatsApp prepare links. That is the scoped product slice — **not** full Phase 1 BRD (no per-player split, pitch blocks, subscriptions, etc.). Honest line for a paying owner: pilot-with-supervision, not production-ready — see the MVP readiness audit.

## Start here by topic

| Need | Go to |
|------|--------|
| Product rules / phases | [requirements/brd.md](./requirements/brd.md) |
| Why architecture | [decisions/](./decisions/) (esp. DR-001, DR-002) |
| How a slice was built | [specs/SPEC-NN](./specs/) (historical — do not rewrite bodies) |
| Owner tabs / routes | [owner-ia.md](./owner-ia.md) |
| Current file tree | [guides/folder-structure.md](./guides/folder-structure.md) |
| Module roles + request walks | [guides/module-map-and-request-walkthroughs.md](./guides/module-map-and-request-walkthroughs.md) |
| Mentor oral map | [guides/mentor-defense-backend.md](./guides/mentor-defense-backend.md) |
| Tests / Docker Postgres | [guides/testing-jest.md](./guides/testing-jest.md) |
| Journey / defend a choice | [progress.md](./progress.md) |
| Docs catalog (all DRs/SPECs/guides) | [README.md](./README.md) |
| Launch gaps / ordered backlog | [guides/mvp-readiness-audit.md](./guides/mvp-readiness-audit.md) (dated; read the banner) |

## What’s next

Remaining **MVP audit P0** (isolation proof is done):

1. **Backup** — minimal droplet / Postgres snapshot or `pg_dump` cadence, written in one place and followed.
2. **Deploy truth** — root README already points here for status; finish a short prod env checklist (host, HTTPS, DNS, `DATABASE_URL`, log disk, never seed prod).

Then either more P1 from that audit (concurrent collect race, Booking indexes) or a product BRD gap when you choose one.

## How we work

Decision → spec → code. Append [progress.md](./progress.md) after a finished slice. Framework APIs: read `AGENTS.md` and local Next/Prisma docs — not training memory.
