# Code map

**Purpose:** one line per folder under `src/` and per module layer, so you can find where code lives and where a new file goes.
**Read when:** you add a file, or are unsure which folder owns something. Rules behind the placement are in [ARCHITECTURE.md](./ARCHITECTURE.md) and enforced by `test/architecture/`.
**Last verified:** `f01c9bf` (main, after refactor step 6c).

## Where a new file goes (the placement rules)
1. A **business word** (booking, payment, shop, stadium, pitch…) -> `src/modules/<module>/` in the right layer.
2. A **URL** (page, route handler, Server Action) -> `src/app/`, thin: validate, authorize, delegate.
3. **Generic UI** with no business word -> `src/components/ui`.
4. The **app frame** (tab bar, header, theme, service worker, language toggle) -> `src/components/shell`.
5. Used by **one route only** -> that route's `_components` folder.
6. **Data and actions reach `ui/` through props**: a module `ui/` file never imports application, infrastructure, db, the Prisma client or `@/app`; the page passes data and the real Server Action.

## `src/`
| Folder | What is in it |
|---|---|
| `app/` | Next.js routes: `(public)` (the stadium page a player sees), `owner` (the owner app: `(app)` tabs, `login`, `qr`, `suspended`), `brand` (icon route), `dev` (dev-only mockups). Convention files plus a `_components` folder per route (rule 7). |
| `components/ui/` | Generic primitives (button, input, sheet, dialog, calendar…) plus `settings-list`, `money-input`, `scrollbar-peek` |
| `components/shell/` | The app frame: tab-bar, header, back-link, business-menu, offline-pill, theme-provider, theme-toggle, owner-service-worker, lang-toggle, unavailable-notice |
| `lib/` | Cross-cutting helpers with no business word (below) |
| `modules/` | Business logic, one folder per context (below) |
| `generated/` | The Prisma client, made by `prisma generate`; gitignored |
| `prisma/` | `schema.prisma`, `migrations/`, `seed.ts`, `seed-guard.ts` |
| `fonts/` | Font files (`brand/` TTFs for the generated icon) |
| `proxy.ts` | Request proxy: host check, tenant slug, cookie renewal |
| `instrumentation.ts` | Startup hook (environment check) |

## `src/lib/`
| Path | What is in it |
|---|---|
| `format/money.ts`, `format/parse-money.ts` | Money display and money input checks |
| `format/time.ts` | Dates, clock times and ranges, relative time; the owner time zone |
| `copy/` | All interface text by area (`common today requests money shop settings public account`), `ui()`, counted nouns, phrase helpers, `errors.ts`, `success.ts`; import from `@/lib/copy` |
| `db.ts`, `platform-db.ts`, `prisma-base.ts`, `tenant-context.ts`, `tenant-slug.ts`, `tenant-settings.ts` | Prisma clients, the tenant of the request, tenant settings parsing |
| `env.ts`, `logger.ts`, `errors.ts`, `use-case-error.ts`, `rate-limit.ts`, `client-ip.ts`, `dev-only.ts` | Runtime support |
| `form-query.ts`, `search-params.ts`, `get-ui-locale.ts`, `locale.ts`, `plural.ts`, `utils.ts` | Form, query and locale helpers |

## `src/modules/<module>/`
Layers: `domain/` (pure functions, no await, no db), `application/` (use cases, transactions), `infrastructure/` (all queries), `schemas/` (Zod), `ui/` (components that get data and actions through props). A module has only the layers it needs.

| Module | Purpose | Layers present |
|---|---|---|
| `access` | Login, sessions, permissions (`can()`), passwords, tenant settings writes | domain application infrastructure schemas |
| `booking` | Requests, owner bookings, series, cancel, no-show, waitlist, booking items | domain application infrastructure schemas ui |
| `expense` | Expenses and categories | domain application infrastructure schemas ui |
| `ledger` | Append-only USD ledger entries and period bounds | domain application infrastructure schemas ui |
| `notification` | WhatsApp link composition | domain |
| `payment` | Collect, tenders, rates, per-player payments, due adjustments | domain application infrastructure schemas ui |
| `people` | Persons, phones, names | domain application infrastructure ui |
| `platform` | Operator-only tenant management; `application/tenant-profile` serves the stadium module | domain application infrastructure |
| `push` | Web push to owners (new-request alert) | domain application infrastructure |
| `shop` | Products, sales, tabs, supplies, items on a booking | domain application infrastructure schemas ui |
| `stadium` | The stadium's own name and info, brand (presets, accent, logo plan), links (map, public URL, QR text), PWA short name | domain application ui |
| `venue` | Pitches, hours, schedule config, availability | domain application infrastructure schemas ui |

`ui/` contents today: `booking` (booking rows, day sheet, day strip and tabs, free strip, fee forms, extend form, per-player collect, booking items, add-items sheet, upcoming panel, series components, request and book components, slot picker, `action-types.ts` for the action props), `expense` (expense-sheet), `ledger` (period-label), `payment` (cash-today, tender-balance, tonal-collect), `people` (person-link), `shop` (item-tiles, parts-balance, sell-screen), `stadium` (qr-sheet, share-card), `venue` (day-chips, date-calendar-chip, day-chip-class).

## Elsewhere
| Folder | What is in it |
|---|---|
| `test/` | Jest: `app`, `components`, `lib`, `modules` (mirrors `src/modules`), `architecture` (import rules and the app-thin rule), `docs` (docs check), `integration` (Docker Postgres), `e2e`, `prisma`, `helpers` |
| `scripts/` | Operator tools run with `tsx` (`platform.ts`, `set-password.ts`) |
| `docs/` | Documentation; index in [README.md](./README.md) |
