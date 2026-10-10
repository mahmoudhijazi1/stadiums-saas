# Code map

**Purpose:** one line per top-level folder under `src/` and per module, so you can find where code lives without opening the tree. **Read it** before adding a file or when unsure which folder owns something. It is a map, not a spec: rules are in [ARCHITECTURE.md](./ARCHITECTURE.md) and enforced by `test/architecture/`. Refactor steps update their own lines.
**Last verified commit:** `39ba8be` (main, after the dependency-rules guard).

## `src/` folders
| Folder | Purpose |
|---|---|
| `app/` | Next.js routes, Server Actions, layouts; thin (validate, authorize, delegate) |
| `components/` | Shared React components (`ui/` primitives, pickers, chips, theme) |
| `lib/` | Cross-cutting helpers: db clients, env, logger, locale and copy, money display, errors |
| `modules/` | Business logic per context, each with `domain/ application/ infrastructure/ schemas/` |
| `fonts/` | Font files (`brand/` TTFs for generated icons) |
| `prisma/` | Prisma schema, migrations, seed |
| `proxy.ts` | Request proxy: host check, tenant slug, cookie renewal |
| `instrumentation.ts` | Next.js startup hook |

## `src/modules/`
| Module | Purpose |
|---|---|
| `access` | Login, sessions, permissions (`can()`), passwords, tenant settings |
| `booking` | Requests, owner bookings, series, cancel, no-show, waitlist, booking items |
| `expense` | Expenses and categories |
| `ledger` | Append-only USD ledger entries and period bounds |
| `notification` | WhatsApp link composition |
| `payment` | Collect, tenders, rates, per-player payments, due adjustments |
| `people` | Persons, phones, names |
| `platform` | Operator-only tenant management and stadium info |
| `push` | Web push to owners (new-request alert) |
| `shop` | Products, sales, tabs, supplies, items on a booking |
| `venue` | Pitches, hours, schedule config, availability |
