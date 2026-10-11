# Progress log

Entries are appended at the end, newest last, and kept short (a heading, **When**, **What**, **Why**, **Files**, **How it connects**, **How to verify**). Never edit an old entry; add a **Correction** entry instead. When this file passes about 300 lines, move it to `docs/archive/progress-<year>[-n].md` with `git mv` and start a new one. The earlier log (to `v1.0.0` and the refactor steps 1 to 6c) is [archive/progress-2026.md](./archive/progress-2026.md); read it with `tail`, never in full.

## Docs reset 4: agent instructions and the log

**When:** 2026-10-14

**What:** Rewrote `CLAUDE.md` (read first, non-negotiables, placement rules, clean-code checklist, workflow, `test/architecture/rules.ts` as the source of truth). `AGENTS.md` now starts with "Read CLAUDE.md first". The old `docs/progress.md` (7,000+ lines) moved with `git mv` to `docs/archive/progress-2026.md`; this file starts again.

**Why:** One short instruction file for every coding agent, and a log small enough to read.

**Files:** `CLAUDE.md`, `AGENTS.md`, `docs/progress.md`, `docs/archive/progress-2026.md`.

**How it connects:** Docs only.

**How to verify:** `npx tsc --noEmit`; `npx jest test/architecture`.

## Docs reset 5: a docs check

**When:** 2026-10-14

**What:** `test/docs/docs.test.ts` (6 tests): the core docs and `docs/domain/*` have the three header lines; every backticked path starting with `src/`, `test/`, `docs/`, `scripts/` or `prisma7.config.ts` in the core docs and `CLAUDE.md` exists (patterns with `*`, `<>`, `{}` are skipped); `docs/CODEMAP.md` lists every folder under `src/modules` and names none that does not exist; every relative link resolves. The first run found stale paths (`src/lib/qr.ts` in the RUNBOOK, `src/app/owner/layout.tsx` and a folder-structure link in owner-ia), now fixed. `docs/guides/testing-jest.md` describes the architecture and docs checks.

**Why:** Keep the living docs true after the cleanup.

**Files:** `test/docs/docs.test.ts`, `docs/guides/testing-jest.md`, `docs/RUNBOOK.md`, `docs/owner-ia.md`.

**How it connects:** The test reads files only; it imports nothing from `src/`.

**How to verify:** `npx jest test/docs` (6 passed); `npx tsc --noEmit`; `npx jest test/architecture` (12 passed).

## Key files: docs/KEY-FILES.md

**When:** 2026-10-14

**What:** New `docs/KEY-FILES.md`: the 15 files where a mistake would break money, bookings, tenant isolation or login (proxy, tenant-context, db, platform-db, can, login and session, rate-limit, the exclusion migration, bookings.ts, approve, request-public-slot, create-owner-booking, availability, record-payment, shop pricing). Each has Does, Why, Used by, Never change without (the invariant and the test files, all checked to exist). From your list `booking/domain/series.ts` was left out (feature-level, not isolation or money core; noted in the file) and "the payment collection use case" became `payment/application/record-payment.ts`, which writes payment, tenders and ledger for every collection path. Linked under Start here in `docs/README.md` and added to the core docs checked by `test/docs/docs.test.ts`. Branched from `refactor/08-docs` because `main` does not yet have the docs index or the docs test.

**Why:** A new developer should know which files to treat with care and what proves them safe.

**Files:** `docs/KEY-FILES.md`, `docs/README.md`, `test/docs/docs.test.ts`.

**How it connects:** Docs only; no code under `src/` changed.

**How to verify:** `npx jest test/docs` (6 passed). Claims marked UNVERIFIED in the file were not traced to code.

## Step 7a: bookings.ts split by topic (branch `refactor/07a-bookings`)

**When:** 2026-10-14

**What:** `src/modules/booking/infrastructure/bookings.ts` (1,830 lines) became the folder `bookings/` (`git mv` to `bookings/index.ts`, then 14 topic files plus `_shared.ts`): create, locks, pending, single, ranges, status, due, interests, day, person-history, debts, owed, per-player, labels. `index.ts` is `export *` of each, so no importer changed. Code moved as is: no SQL, logic, name or signature change; the only text differences are `export` added to four helpers that two files share (`asDate`, `BookingSqlRow`, `toBookingForDecision`, `RECENT_WINDOW_MS`, now in `_shared.ts`, which is not re-exported) and a top comment on `locks.ts` pointing to the lock-order table. A line-by-line comparison of the old and new files (imports excluded) shows exactly those differences, and `queryRaw` / `executeRaw` / `Prisma.sql` occurs 38 times before and after. `TABS_REMAINING_SQL` went next to its only user (`day.ts`).

**Why:** One 1,800-line file mixing inserts, locks, queries and per-player writes was hard to review; locks now have their own small file.

**Files:** `src/modules/booking/infrastructure/bookings/*`, `docs/CODEMAP.md`, `docs/KEY-FILES.md`, `docs/ARCHITECTURE.md` (the P lock line).

**How it connects:** Same imports as before in each file (Prisma, tenant context, domain pending-inbox); no file imports `application`.

**How to verify:** `npx tsc --noEmit`; `npx jest test/architecture test/docs test/modules/booking`. Integration tests (Docker Postgres) were not run.

## Step 7b: upcoming-panel split and action groups (branch `refactor/07b-panel`)

**When:** 2026-10-14

**What:** `booking/ui/upcoming-panel.tsx` (1,030 lines) is now `upcoming-panel.tsx` (the lists, the open-sheet state, 282 lines), `upcoming-rows.tsx` (86) and the folder `booking-sheet/`: `booking-sheet.tsx` (215, the composition), `sheet-header.tsx` (128), `sheet-details.tsx` (88, `UpcomingRowActions`), `money-block.tsx` (198), `shop-tabs.tsx` (36), `series-row.tsx` (17), `extend-entry.tsx` (20), `more-actions.tsx` (96), `action-row.tsx` (41) and `row-view.ts` (85, `UpcomingRowView`, `owesCash`, and two small helpers for rules that two parts share). JSX and logic copied as it was. The 18 flat action props became five typed groups, each type next to the component that uses it: `CollectActions` (money-block: submitCollectPayment, submitSwitchToPerPlayer, submitSwitchToWhole, submitCollectSlot, submitCollectAllRemaining), `ExtendActions` (extend-form: submitExtendBooking), `ItemsActions` (booking-items: searchPayers, submitAddBookingItems, submitCollectTab, submitRemoveBookingItem), `SeriesActions` (series-manage: loadSeriesSheetAction, previewCancelRestAction, previewSeriesAction, submitCancelRest, submitSeriesSave), `FeeActions` (fee-forms: submitCancelBooking, submitRecordNoShow, submitAdjustBookingDue). The panel takes the five objects; the sheet hands each child its own group (spread where the child already takes those names, explicit for the fee forms and the weekly confirm). The only route that renders the panel, `today/_components/lists.tsx`, builds the five objects from the same actions. `UpcomingRowView` is still exported from `upcoming-panel.tsx`.

**Why:** One 1,000-line client component mixed the lists, the sheet state, the header, the money block and every action prop.

**Files:** `src/modules/booking/ui/{upcoming-panel,upcoming-rows}.tsx`, `src/modules/booking/ui/booking-sheet/*`, the four group-owning components, `today/_components/lists.tsx`, `docs/CODEMAP.md`.

**How it connects:** booking/ui still imports no application, infrastructure or `@/app` code (architecture test passes).

**How to verify:** `npx tsc --noEmit` (clean, checked with `.next` excluded: a half-written `.next/dev/types/validator.ts` from a running dev server breaks the plain command); `npx jest test/architecture test/docs test/modules/booking test/app test/components` (46 suites, 360 tests). The sheet was not rendered in a browser and there is no component test for it: UNVERIFIED at runtime.

## Release v1.1.0

**When:** 2026-10-14

**What:** The app is marked version 1.1.0: `package.json` and `package-lock.json` say `1.1.0` (were `1.0.0`), `docs/NOW.md` names `v1.1.0`, and the commit is tagged `v1.1.0` in git. It includes the whole architecture cleanup (steps 1 to 7b and the docs reset).

**Why:** A named release point after the refactor, so the server can deploy a tag and roll back to `v1.0.0` (RUNBOOK, "Roll back to a tag").

**Files:** `package.json`, `package-lock.json`, `docs/NOW.md`, `docs/progress.md`.

**How it connects:** Version label and status text only; no code or behaviour changes.

**How to verify:** `git tag -l v1.1.0`; `npm pkg get version` prints `"1.1.0"`. Nothing was run for the release itself; the full suites, the integration tests and the build were not run in this session (CI runs them).

## System bars follow the app theme (branch `feat/system-bars`)

**When:** 2026-10-14

**What:** The `theme-color` tags were keyed to the phone's light/dark setting only, so an owner who forced the app light or dark against the phone got a mismatched status bar. New `src/lib/theme-color.ts` (the two colours, `applyThemeColor`, and `themeColorScript`), `components/shell/system-bars.tsx` (follows next-themes' resolved theme and rewrites every tag) and a pre-paint script at the start of `<body>` in `app/layout.tsx`; the layout's viewport uses the same constants. Decided with the owner of the repo: keep the theme toggle and fix what the web can fix. Not changed: the manifest `theme_color` (stadium accent) and `background_color`, and no `black-translucent` iOS style. `docs/theme.md` has a "System bars" section with what is and is not controllable (UNVERIFIED on a real iPhone and Android).

**Why:** Icons, clock and battery must never vanish into a bar of the same colour.

**Files:** `src/lib/theme-color.ts`, `src/components/shell/system-bars.tsx`, `src/app/layout.tsx`, `test/lib/theme-color.test.ts` (6 tests: constants equal the CSS tokens, clearly light and dark, every tag is set, the script for stored/forced/system/blocked storage), `docs/theme.md`, `docs/CODEMAP.md`.

**How it connects:** `lib/theme-color.ts` imports nothing; the shell component imports it and `next-themes` only.

**How to verify:** `npx jest test/lib/theme-color test/architecture test/docs`; then by hand on a phone: set the phone to dark and the app to light (and the reverse) and check the status bar colour and its clock on Android Chrome and the installed app, and on iOS Safari and the installed app.

## Public page: date strip and free-time chips (branch `feat/public-page`, 1 of 3)

**When:** 2026-10-14

**What:** The public page now shows a day strip from today to `PUBLIC_FUTURE_DAYS` (same stacked day tabs as the owner, no past days; `clampPublicDay` now sends a past `?date=` to today) and, under it, only the free times as compact chips: start time only, at least 44px, body font. The heading is "Available times · $20 per game" with the most common price among the day's free times; a chip priced differently shows its own price. Taken and already-started times are not listed. A day with no free time says so and links "Next free: Fri 9" (`findNextFreeDay`: one extra query, the pitches, walked in memory against the occupied windows the page already loaded). `requestPublicSlot`, `getDayAvailability` and `priceForSlot` are unchanged. The tap still opens the existing request sheet (commit 2 replaces it).

**Why:** A player wants to see what is free and tap it; the grid of 96px tiles with taken ones struck through hid the answer.

**Files:** `booking/domain/free-times.ts`, `booking/domain/public-window.ts`, `booking/ui/time-chips.tsx`, `venue/application/find-next-free-day.ts`, `venue/ui/day-strip.tsx`, `venue/ui/weekday-label.ts`, `app/(public)/_components/{times,no-free-times,hours}.tsx` and `page.tsx`; removed `app/(public)/_components/{day-chips,slot-picker}.tsx`; copy in `lib/copy/public.ts`; tests `free-times`, `public-window`, `time-chips`, `day-strip`, `find-next-free-day`.

**How it connects:** The page passes only free pitches to `TimeChips`; the sheet and the action are wired in `_components/times.tsx`. The owner's `DayChips` is untouched.

**How to verify:** `npx jest test/architecture test/docs test/modules/booking/domain/free-times test/modules/booking/domain/public-window test/modules/booking/ui test/modules/venue`. Not run: the full suites, the build, a browser. The strip is not scrolled to a far selected day on first load (no client JS added for it): UNVERIFIED on a phone.

## Public page: request sheet and confirmation (branch `feat/public-page`, 2 of 3)

**When:** 2026-10-14

**What:** Tapping a time opens a sheet with the day and time, name and phone (same fields and limits), one "Send request" button, "This is a request, not a confirmation. The owner will reply on WhatsApp." and the cancellation rule ("Cancel up to 24 hours before", plus the late-fee line when the fee is above 0). After a send it turns into "Request sent for Fri 16 8:00 PM. The owner will confirm on WhatsApp.", a plain WhatsApp chat button (only when the stadium has a number) and "Request another time". Friendly messages for a taken time (recorded as interest: "the owner knows you're interested"), too far ahead, too many requests, invalid input and anything else. `submitPublicSlotRequest` now returns `{ ok } | { ok: false, errorKey }` instead of redirecting with `?ok=`/`?error=`, so the page no longer needs `FlashToast`. `requestPublicSlot` is unchanged.

**Why:** The player should stay on the page, see exactly what was sent and what happens next, and never see a raw error.

**Files:** `booking/domain/public-request-errors.ts`, `booking/ui/public-request-{view,sheet}.tsx`, `app/(public)/request-slot.ts`, `_components/{times,hours,stadium-contact}.tsx`, `page.tsx`, `lib/copy/{public,helpers}.ts` (`cancelUpToLine`), `test/integration/push-new-request.integration.test.ts` (expects the result, not a redirect), `test/modules/booking/ui/public-request-view.test.ts`.

**How it connects:** The sheet is a pure view (`PublicRequestView`, tested by state) inside a wrapper that owns the pending state; the action is a prop wired in `_components/times.tsx`. `SlotBookSheet` stays for the owner's Book and Today strip.

**How to verify:** `npx jest test/architecture test/docs test/modules/booking/ui`. The integration file was edited, not run (`npm run test:integration` is CI's). The sheet was not opened in a browser: UNVERIFIED at runtime.

## Public page: share metadata and indexing (branch `feat/public-page`, 3 of 3)

**When:** 2026-10-14

**What:** The public page has per-stadium metadata built by `publicPageMetadata`: title "<stadium name> · احجز ملعبك" (as written, never translated), description from the address (a short line with the name when there is none), Open Graph and Twitter cards with the generated `/brand/icon/512` logo, and the canonical URL (from `APP_BASE_DOMAIN`, absolute image and canonical; relative image and no canonical when it is unset). The page is indexable. A suspended stadium and an unknown host get noindex and no tenant data. The owner app is noindex through a new pass-through `app/owner/layout.tsx` (the suspended page already was). `lang` and `dir` stay on `<html>` from the root layout. The page's client code is only the request sheet and the language toggle (`FlashToast` was dropped in commit 2); no dependency added. Docs: `CODEMAP`, `NOW`, `ROADMAP` ("Public page: later", including public shop items with a WhatsApp order link, BR-67).

**Why:** A link shared on WhatsApp should show the stadium's name and logo, and search engines should find the public page and nothing of the owner app.

**Files:** `app/(public)/_components/public-metadata.ts`, `app/(public)/layout.tsx`, `app/owner/layout.tsx`, `lib/copy/public.ts`, `test/app/public/public-metadata.test.ts`, `docs/{CODEMAP,NOW,ROADMAP,progress}.md`.

**How it connects:** The public layout's `generateMetadata` loads the tenant (catching the not-found of an unknown host) and calls the builder; the root layout's neutral metadata still applies to every other route.

**How to verify:** `npx jest test/architecture test/docs test/app/public`. UNVERIFIED: how WhatsApp, Facebook and Google actually render the card, and the real `APP_BASE_DOMAIN` canonical in production.
