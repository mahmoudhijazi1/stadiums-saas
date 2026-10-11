# Code map

**Purpose:** one line per top-level folder under `src/` and per module, so you can find where code lives without opening the tree. **Read it** before adding a file or when unsure which folder owns something. It is a map, not a spec: rules are in [ARCHITECTURE.md](./ARCHITECTURE.md) and enforced by `test/architecture/`. Refactor steps update their own lines.
**Last verified commit:** `39ba8be` (main, after the dependency-rules guard).

## `src/` folders
| Folder | Purpose |
|---|---|
| `generated/` | Prisma client, output of `prisma generate` (gitignored; run it after install and before build) |
| `app/` | Next.js routes, Server Actions, layouts; thin (validate, authorize, delegate). Route-private pieces live in a `_components` folder beside the route (rule 7) |
| `components/` | Shared React components: `ui/` primitives (plus settings-list, money-input, scrollbar-peek) and `shell/` (the app frame: tab-bar, header, back-link, business-menu, offline-pill, theme, service worker, lang-toggle, unavailable-notice; takes actions as props, may import a module's `ui/`) |
| `lib/` | Cross-cutting helpers: db clients, env, logger, locale and copy, money display, errors |
| `modules/` | Business logic per context, each with `domain/ application/ infrastructure/ schemas/` |
| `fonts/` | Font files (`brand/` TTFs for generated icons) |
| `prisma/` | Prisma schema, migrations, seed (client is generated to `generated/`) |
| `proxy.ts` | Request proxy: host check, tenant slug, cookie renewal |
| `instrumentation.ts` | Next.js startup hook |

## `src/modules/`
Each module has `domain/ application/ infrastructure/ schemas/` and, where it owns components, `ui/`. **ui gets data and actions through props** (rule 6): no application, infrastructure, db or `@/app` imports; a Server Action is a prop the page passes.

| Module | Purpose |
|---|---|
| `access` | Login, sessions, permissions (`can()`), passwords, tenant settings |
| `booking` | Requests, owner bookings, series, cancel, no-show, waitlist, booking items. `ui/`: booking-row, day-sheet/, day-strip/tabs/nav, free-strip, fee-forms, extend-form, per-player-collect, booking-items, add-items-sheet, upcoming-panel (to be split), series components, request and book components, slot-picker; `action-types.ts` types the action props |
| `expense` | Expenses and categories. `ui/`: expense-sheet |
| `ledger` | Append-only USD ledger entries and period bounds. `ui/`: period-label |
| `notification` | WhatsApp link composition |
| `payment` | Collect, tenders, rates, per-player payments, due adjustments. `ui/`: tender-balance, tonal-collect, cash-today |
| `people` | Persons, phones, names. `ui/`: person-link |
| `platform` | Operator-only tenant management; `application/tenant-profile` serves the stadium module |
| `push` | Web push to owners (new-request alert) |
| `stadium` | The stadium's own name and info, `ui/` qr-sheet and share-card, brand (presets, accent, logo plan), links (map, public URL, QR text), PWA short name. Moved here from `lib/` (brand-*, accent-css, map-link, public-page-url, qr, pwa-short-name) and `platform/` (stadium-info, brand-identity) |
| `shop` | Products, sales, tabs, supplies, items on a booking. `ui/`: item-tiles, parts-balance, sell-screen |
| `venue` | Pitches, hours, schedule config, availability. `ui/`: day-chips, date-calendar-chip |

`src/components/ui/` also holds the generic pieces moved in step 6b: settings-list (SettingsSection, SettingsRow), money-input, scrollbar-peek.

## `src/lib/`
| Path | Purpose |
|---|---|
| `form-query.ts`, `search-params.ts` | FormData and searchParams helpers (redirect keeping the tab's query) |
| `format/money.ts` | Money display: USD and LBP strings, mixed parts, change |
| `format/parse-money.ts` | Money input: USD and LBP string checks and parsing |
| `format/time.ts` | Time display: dates, clock times and ranges, relative time (Asia/Beirut) |
| `copy/` | All interface text by area (`common today requests money shop settings public account`), `ui()`, counted nouns (`counted.ts`), phrase helpers (`helpers.ts`), error and success messages (`errors.ts`, `success.ts`); import from `@/lib/copy` |
| `db.ts`, `platform-db.ts`, `prisma-base.ts`, `tenant-context.ts` | Prisma clients and the tenant context |
| `env.ts`, `logger.ts`, `errors.ts`, `use-case-error.ts`, `rate-limit.ts` | Runtime support |
| rest | Small pure helpers (locale, plural, map link, QR, brand presets, tenant settings, request fields) |
