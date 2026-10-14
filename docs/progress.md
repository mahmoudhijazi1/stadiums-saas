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

## Language control: two-option segmented toggle (branch `feat/public-page`)

**When:** 2026-10-14

**What:** `components/shell/lang-toggle.tsx` is now a segmented control: "عربي" (Arabic font) and "EN" (Latin font), both always visible, the current one on a pill in the accent colour (`bg-accent-brand` / `text-accent-ink`) that slides by transform (200ms, none under reduced motion); 36px to the eye, 44px per option; a group named "Language / اللغة" with `aria-pressed`. The control is LTR so the two options never swap sides. Used on the public page header (unchanged slot), the suspended pages (`UnavailableNotice` takes the action as an optional prop), the business menu sheet (`OwnerHeader` and `BusinessMenu` take `onChangeLocale`) and the owner login page. Login used to be Arabic only; it now follows the stored language (Arabic by default) so the control means something. More > Language is untouched. Storage and application of the locale are unchanged: `switchLocale` sets `lang`/`dir` first, calls `setUiLocale`, then `router.refresh()` (the URL, path and query, never changes).

**Files:** `components/shell/{lang-toggle,business-menu,header,unavailable-notice}.tsx`, `app/owner/login/page.tsx`, `app/owner/suspended/page.tsx`, `app/owner/(app)/layout.tsx`, `app/(public)/{layout,page}.tsx`, `test/components/lang-toggle.test.ts`.

**How to verify:** `npx jest test/components/lang-toggle test/architecture test/docs`. UNVERIFIED in a browser: the pill animation and the absence of a direction flash.

## Public page: header band, availability dots, next-free card, time rows (branch `feat/public-page`)

**When:** 2026-10-14

**What:** The public page got more pull. (1) A header band with faint football-pitch lines (inline SVG `stadium/ui/pitch-lines.tsx`, the accent at 15% opacity, no image files) behind logo, name (display face) and address, the language control at the top end, and the Maps / Call / WhatsApp buttons as pills under it (only those set). (2) Under each day number in the strip: three, two or one dot, or an empty ring for a full or closed day (`availabilityLevel` of the day's free count). (3) A "Next free time" card at the top of the day: the nearest free time from now (today first, then the window), as the one big figure, "$20 · 60 min" and "Book now" that opens the same request sheet (it can be another day than the one shown); hidden when nothing is free in the 60 days. (4) The day's times are full-width rows, 56px or more: range at the start, price and a small accent "Book" at the end; a taken time stays as a faded row with "Taken" and no button; started times are gone. Every row shows its price, and the heading still states the most common one. (5) Rows are grouped Evening (17:00 up to the business-day start, so 00:30 is evening), Afternoon (12:00-16:59), Morning, evening first, empty groups hidden, with a Moon / Sun / Sunrise icon; with several pitches one section per pitch.

**Queries:** the dots and the card come from one new function, `getWindowSummary` (venue): one query (the pitches), then the 61 days are generated in memory against the approved ranges the page already loads once and passes down. The page now loads the approved ranges and the summary before rendering (the strip and the card need them); the day's rows stay under Suspense. `findNextFreeDay` is removed: the empty day's "Next free" link reads the same summary (`firstFreeDayAfter`), which saves its extra query.

**Files:** `venue/application/get-window-summary.ts`, `venue/domain/availability-level.ts`, `venue/ui/day-strip.tsx` (optional `levels`), `booking/domain/day-periods.ts`, `booking/ui/{time-rows,next-free-card}.tsx` (replace `time-chips.tsx`), `stadium/ui/pitch-lines.tsx`, `app/(public)/_components/{header-band,booking,hours,skeletons,stadium-contact}.tsx`, `page.tsx`, `lib/copy/public.ts`, tests for each, `docs/CODEMAP.md`.

**How to verify:** `npx jest test/architecture test/docs test/modules/booking test/modules/venue test/modules/stadium`. Not run: the full suites, the build, a browser. UNVERIFIED on a device: how the pitch lines look in each accent preset and in dark mode, the 64px strip chips, and the dots' contrast.

## Public page: quieter layout (branch `feat/public-page`)

**When:** 2026-10-14

**What:** The public page layout was reworked; booking rules, use cases and the request flow are untouched. (1) The header has no card or border: the pitch lines (accent, 20% light / 25% dark) are the background of the whole full-width top area. Start side: logo and stadium name (display face, ellipsis), then the address on one line. End side: the "عربي | EN" control and a new sun/moon button (`ThemeIconButton`, same next-themes mechanism, both icons in the markup so no flash). Under them one non-wrapping row of 44px round icon-only buttons (Maps, Call, WhatsApp; only those set; aria-labels). (2) The day strip has no box per day, only the selected day is a pill; the dots are smaller and use `ink-muted` (the old accent dots had poor contrast on the light page). (3) The "Next free time" card is gone: the first free time of the day carries a "Nearest" / "الأقرب" badge, and a day with none shows one line, "No free times this day · Nearest: Fri 6:00 PM ›", linking to that day (`getWindowSummary.nextFree`; `firstFreeDayAfter` removed). (4) The times are one list in time order in one rounded container with thin dividers (no groups, headings or icons; `day-periods` removed): "5:00 – 6:00 PM" / "5:00 – 6:00 م" (`compactRange`), a chevron at the end, the whole row opens the request sheet, 56px or taller; taken rows stay faded with "Taken" and cannot be pressed; a row shows its price only when it differs from the heading's. (5) The heading is "Available times" with "$20 per game · 60 min" under it (`compactUsd`: whole dollars without .00, cents only when present). (6) Contrast: the Taken label is full ink inside a 60% faded row (muted text there fell under 4.5:1), the badge is ink on `accent-subtle`, dividers use the `line` token.

**Files:** `app/(public)/_components/{header-band,stadium-contact,no-free-times,booking,hours}.tsx`, `page.tsx`, `components/shell/theme-icon-button.tsx`, `booking/ui/time-rows.tsx`, `booking/domain/compact-range.ts`, `lib/format/money.ts` (`compactUsd`), `venue/ui/{day-strip.tsx,day-chip-class.ts}`, `venue/application/get-window-summary.ts`, `lib/copy/public.ts`; removed `booking/ui/next-free-card.tsx`, `booking/domain/day-periods.ts` and their tests; tests for each change.

**How to verify:** `npx jest test/architecture test/docs test/modules/booking test/modules/venue test/app/public`. UNVERIFIED (no browser): the fit at 360px in Arabic and English (by arithmetic: the end group is about 160px of the 328px content width, the name and address ellipsize), and the contrast of the pitch lines and the divider lines in light and dark.

## Public page: header redesign (branch `feat/public-page`)

**When:** 2026-10-14

**What:** No data or request-flow change. (1) The full pitch drawing is gone: the top area is a soft vertical gradient from a 10% tint of the stadium accent to the page background (`headerGradient`, no frame or border) with one decorative arc (a quarter of a centre circle, `PitchArc`, 30% opacity) in a box of its own at the end corner of the identity row, so it is never behind text or a button. (2) Top end: the "عربي | EN" control and the light/dark button, both a 36px disc/pill with the same surface fill and line border inside a 44px hit area, centred on one line. (3) One start-aligned column: logo 56px, the stadium name as the page title (the only display-face text), the address with a small map pin, muted, one line with ellipsis. (4) The actions are one bar of three equal parts with thin dividers (icon plus "الخريطة / Map", "اتصال / Call", "واتساب / WhatsApp"), 48px, never wrapping; unset parts are omitted and the rest share the width; same side margins as the day strip and the list (all inside `Container`). (5) The Arabic time range now has the marker once at the end ("4:00 – 5:00 م"): the Arabic formatter writes "مساءً", which the old compact range did not recognise; `compactRange` now uses the shared `splitDisplayedClock` and `shortPeriodOf`. (6) "Nearest" / "الأقرب" is a small pill: accent text (`--action-ink`) on a 6% accent tint of the surface.

**Contrast (computed in OKLab like `color-mix`, worst case over the five presets, tint at the top of the gradient 10%):** light theme ink 13.59:1 and muted ink 4.60:1; dark theme ink 14.03:1 and muted 6.91:1. At 12% the light muted text fell to 4.39:1, so the tint is capped at 10%. The Nearest pill needs 6%: at 16% (the app's `--accent-subtle`) a blue preset gave 4.13:1 and at 10% one still gave 4.49:1. `test/app/public/header-contrast.test.ts` holds all of this for every preset in both themes.

**Files:** `stadium/ui/pitch-arc.tsx` (replaces `pitch-lines.tsx`), `app/(public)/_components/{header-band,stadium-contact}.tsx`, `components/shell/theme-icon-button.tsx`, `booking/domain/compact-range.ts`, `booking/ui/time-rows.tsx`, `lib/copy/public.ts`, tests for each, `docs/{CODEMAP,NOW}.md`.

**How to verify:** `npx jest test/architecture test/docs test/app/public test/modules/booking test/modules/stadium`. UNVERIFIED (no browser): the layout at 360px and 390px in Arabic and English. By arithmetic at 360px the three action parts get about 109px each (the longest label plus icon is about 90px) and the name column keeps about 236px next to the arc box; the arc itself and the gradient were not looked at in either theme.

## Dark theme: sheet and modal backdrop darkens (branch `feat/public-page`)

**When:** 2026-10-14

**What:** Every bottom sheet and modal, public and owner, shares one overlay (`DialogOverlay` in `components/ui/dialog.tsx`, used by `BottomSheet` too). It was `bg-foreground/45` plus a blur: in the dark theme `foreground` is the light ink, so opening a sheet lightened the page. In the dark theme the overlay is now `bg-black/65` (the blur stays); the light theme is unchanged.

**Files:** `components/ui/dialog.tsx`, `test/components/overlay-dark.test.ts`.

**How to verify:** `npx jest test/components/overlay-dark`. UNVERIFIED by eye: open any sheet in dark mode and check the page behind it goes darker.

## Release v1.3.0

**When:** 2026-10-14

**What:** The app is marked version 1.3.0: `package.json` and `package-lock.json` say `1.3.0` (were `1.1.0`), `docs/NOW.md` names `v1.3.0`, and the merge of `feat/public-page` is tagged `v1.3.0` (annotated, with a description). The jump over 1.2.0 is on purpose. Release notes: public page UI refinement: a pitch-gradient header with logo, name, address and a Map / Call / WhatsApp action bar; a day strip to 60 days ahead with availability dots; the day as one list of times with a "Nearest" badge, taken times faded; a request sheet that confirms in place and explains errors; per-stadium share metadata (indexable public page, noindex owner app). Also in it: the two-option language toggle, system bars that follow the app theme, and a darker (not lighter) sheet and modal backdrop in the dark theme.

**Why:** A named release point for the public page work, so the server can deploy a tag and roll back to `v1.1.0` (RUNBOOK, "Roll back to a tag").

**Files:** `package.json`, `package-lock.json`, `docs/NOW.md`, `docs/progress.md`.

**How it connects:** Version label and status text only; no code changes.

**How to verify:** `git tag -n -l v1.3.0`; `npm pkg get version` prints `"1.3.0"`. The full suites, the integration tests and the build were not run in this session (CI runs them).

## Lint errors fixed (branch `fix/lint-errors`)

**When:** 2026-10-14

**What:** The 10 errors `npm run lint` reported are fixed with no behaviour change and no lint-config change or disable comment. CI (`.github/workflows/ci.yml`) runs `npm ci`, `prisma generate`, `npm test`, `npm run test:integration`, `npm run build` and `npm run test:e2e`; it does not run lint, which is why these went unnoticed. Patterns: `hub.tsx:88` and `theme-toggle.tsx:28` (mounted flag) use the new `useMounted()` (`useSyncExternalStore`, false on the server); `hub.tsx:161-162` (assigning `document.documentElement`) moved into a module-level `setDocumentLocale`; `fee-forms.tsx:54` (fee follows the initiator) resets during render when `exact` changes; `fee-forms.tsx:58` and `share-card.tsx:31` (browser origin) use the new `useBrowserOrigin()` (`useSyncExternalStore`, "" on the server), and `share-card` derives `publicUrl || origin`; `upcoming-panel.tsx:161` (open the saved outcome's sheet once) derives it during render with a `savedOpened` state in place of the ref and layout effect; `expense-sheet.tsx:117` (read the recent categories on open) moved into the `openSheet` click handler; `share-card.tsx:37` uses `next/link`. The unused `Decimal` import in `list-debt-warnings.ts` is removed. ROADMAP F-4 is marked done. Nothing left unfixed.

**Files:** `lib/use-mounted.ts`, `lib/use-browser-origin.ts`, `app/owner/(app)/more/_components/hub.tsx`, `components/shell/theme-toggle.tsx`, `booking/ui/{fee-forms,upcoming-panel}.tsx`, `expense/ui/expense-sheet.tsx`, `stadium/ui/share-card.tsx`, `booking/application/list-debt-warnings.ts`, `test/lib/use-browser-hooks.test.ts`, `docs/ROADMAP.md`.

**How to verify:** `npx tsc --noEmit` was the only check run. The new hook tests are written and NOT run, and lint was NOT re-run, so the errors are fixed by reading the rules, not confirmed gone. UNVERIFIED in a browser: the saved-outcome sheet on Today, the cancel fee reset when the initiator changes, the expense sheet's category order, and the share card's link.

## Requests card: visual polish (branch `feat/requests-card-polish`)

**When:** 2026-10-14

**What:** Display only; no behaviour, data, action or use-case change. (1) Approve and Reject share the row equally: `RejectRequestButton` takes an optional `className` for its trigger (it already defaulted to `min-w-0 flex-1`; the page now passes it explicitly) and the Approve form is `min-w-0 flex-1`. (2) New pure `formatPhoneDisplay` in `people/domain/phone.ts`, used only for the phone line; the stored value and the tel: / WhatsApp links keep the raw digits. (3) The card reads top to bottom: time range (`type-strong`) with the request's age at the end of the same row, pitch and day (`type-secondary`), the person's name with the phone directly under it, then Approve / Reject. When several requests share one slot, the slot's time row has no age and each request shows its own age under its name. Logical properties and the existing `type-*` roles only; no copy key added. (4) `PersonLink` has an optional `plain` prop (default false) that hides the user icon and the chevron and keeps the underline and accent colour; only the pending card passes it.

**Files:** `app/owner/(app)/requests/_components/pending-list.tsx`, `booking/ui/reject-sheet.tsx`, `people/ui/person-link.tsx`, `people/domain/phone.ts`, `test/modules/people/domain/phone.test.ts`.

**How to verify:** `npx tsc --noEmit` was the only check run. The new `formatPhoneDisplay` tests are written and NOT run; no component test exists for the card. UNVERIFIED by eye in Arabic and English, light and dark.

## Requests card: Approve and Reject exactly equal (branch `feat/requests-card-polish`)

**When:** 2026-10-14

**What:** Display only. The decision row on the pending card is now `mt-3 grid grid-cols-2 gap-3`. The Approve `<form>` is a direct grid child (`min-w-0`) with a `w-full` button; the Reject trigger gets `w-full` through the existing `className` prop, and `RejectRequestButton` no longer defaults to `flex-1`. Before, the row was `flex gap-2` with the form as `min-w-0 flex-1` and the Reject button as `flex-1`; the form has no padding or border while the Reject button has `px-4` and a border, and a flex item's padding and border sit outside a `flex-basis: 0` share, so Reject came out about 34px wider (screenshot at 490px: Approve about 176px, Reject about 219px). This is my reading of the CSS, not something I measured. Approve/Reject logic, actions and use cases are untouched.

**Files:** `app/owner/(app)/requests/_components/pending-list.tsx`, `booking/ui/reject-sheet.tsx`, `test/app/owner/requests-decision-row.test.ts` (source-text checks).

**How to verify:** `npx tsc --noEmit` was the only check run; the new test is written and NOT run. UNVERIFIED by eye: open Requests at 490px and 360px and compare the two widths.

## Requests card: shorter layout (branch `feat/requests-card-polish`)

**When:** 2026-10-14

**What:** Display only; the grouping, actions, locks and use cases are untouched, and the grid Approve / Reject row is unchanged. A slot with one request has no slot header any more: row 1 is the name (`PersonLink plain`) at the start and the age at the end (`type-caption`, `shrink-0 whitespace-nowrap`; the name is `min-w-0` and truncates); row 2 is the time range in `type-label` ink, then the day, then the pitch name only when `showPitch`, then the "starts in" phrase when there is one, separated by middle dots and allowed to wrap; row 3 is the phone line. Rows are `gap-1`, the buttons `mt-3`, the card `p-3` (was `py-4` with `px-6` on the header and content). A slot with several requests keeps its header (time range, day, pitch), then each request shows name + own age, phone, buttons in the same styles. The name uses `text-base! font-semibold!` (the same size and weight as `type-strong`) because PersonLink's own `text-sm font-medium` utilities would otherwise beat the component-layer `type-strong`; PersonLink itself is untouched. The "starts in" phrase moved into row 2 of the single card so no information is lost; no copy key added.

**Files:** `app/owner/(app)/requests/_components/pending-list.tsx`.

**How to verify:** `npx tsc --noEmit` was the only check run. `test/app/owner/requests-decision-row.test.ts` (source-text checks of the grid row) was not edited and not run. UNVERIFIED in a browser: the card height, the wrapping of row 2 at 360px in Arabic and English, and the name truncation.

## Requests card: name with the person icon, no underline (branch `feat/requests-card-polish`)

**When:** 2026-10-14

**What:** On the pending card the name now shows the person icon and is not underlined. `PersonLink`'s `plain` prop changed meaning: it now keeps the icon and the accent colour and drops the underline and the chevron (before: it dropped the icon and the chevron and kept the underline). Only the pending card passes `plain`; the default look and `prominent` are unchanged.

**Files:** `people/ui/person-link.tsx`.

**How to verify:** `npx tsc --noEmit` only; no test touches `PersonLink`. UNVERIFIED by eye.

## Phone: canonical rule as pure functions (branch `feat/phone-canonical`)

**When:** 2026-10-14

**What:** Pure additions to `people/domain/phone.ts`; no caller, schema, use case or query uses them yet, and `normalizePhone`, `toLebanonNumber`, `isPhoneText` and `sanitizePhoneInput` are unchanged. `toCanonicalPhone(raw)` gives one form per number: Lebanese numbers become `961` + the national number (7 digits, or 8 starting with 7 or 8; one leading 0 dropped), so `71123456`, `03123456`, `+961 71 123 456` and `0096171123456` collapse; other countries keep their international digits (8 to 15); anything with a letter, an empty string or a bad length is null. `toPhoneSearchDigits(query)` gives digits only (Arabic-Indic converted) minus a leading `00` or one `0`, for substring search. `formatPhoneDisplay` also puts a `+` on a canonical foreign number. Branched from `feat/requests-card-polish` because `formatPhoneDisplay` is only there.

**Files:** `people/domain/phone.ts`, `test/modules/people/domain/phone.test.ts`.

**How to verify:** `npx tsc --noEmit` was the only check run; the new tests (one per row of the agreed table) are written and NOT run.

## Phone: country parameter for the canonical rule (branch `feat/phone-canonical`)

**When:** 2026-10-14

**What:** Pure domain only; no caller, schema, use case, query or UI changed. New `people/domain/countries.ts` (13 dialling codes with a key each, `DEFAULT_COUNTRY = "961"`, `isKnownCountry`; names come later from copy). `toCanonicalPhone(raw, country = "961")`: an unknown country is null; a `+` or `00` prefix ignores the country (the previous rule); no prefix with 961 is the previous Lebanese rule; no prefix with another country takes digits that start with its code and have 8 or more after it as already including the code, otherwise drops one leading 0 and puts the code in front, and the result must be 10 to 15 digits. Calls without a country behave as before.

**Files:** `people/domain/countries.ts`, `people/domain/phone.ts`, `test/modules/people/domain/phone.test.ts`.

**How to verify:** `npx tsc --noEmit` was the only check run; the new tests (the ten agreed rows, a no-country regression, a contract test, the country list) are written and NOT run.

## Phone: canonical rule closed before wiring (branch `feat/phone-canonical`)

**When:** 2026-10-14

**What:** Pure domain only; no caller, schema, use case, query or UI changed, and `normalizePhone`, `toLebanonNumber`, `isPhoneText` and `sanitizePhoneInput` are untouched. (1) `toCanonicalPhone` with a `+` or `00` prefix for a number that is not 961 now needs 10 to 15 digits (was 8 to 15), and the first digit may not be 0 (needed for the contract below; `+0123456789` is null). Country parameter and no-prefix rules unchanged. (2) New explicit `isCanonicalPhone(digits)`: true only for `961` + 7 digits, `961` + 8 digits starting 7 or 8, or 10 to 15 digits starting 1 to 9 and not `961`; any non-digit (including `+` or a space) is false and nothing is converted. (3) Contract: every value `toCanonicalPhone` returns is `isCanonicalPhone`-true; downstream code checks stored phones with `isCanonicalPhone` and never re-runs `toCanonicalPhone` on them.

**Files:** `people/domain/phone.ts`, `test/modules/people/domain/phone.test.ts`.

**How to verify:** `npx tsc --noEmit` was the only check run; the new tests (the agreed `toCanonicalPhone` and `isCanonicalPhone` rows, and a contract test over every row of the canonical and country tables) are written and NOT run.

## Phone: the canonical rule wired into every entry point (branch `feat/phone-wiring`, NOT merged)

**When:** 2026-10-14

**What:** Text becomes a phone only at the edge: `toCanonicalPhone(raw, country)`; everything after receives a canonical phone. No Prisma schema change, no migration, no data change. (1) Public request: `public-slot-request.ts` takes an optional `country` (default 961, must be known) and the canonical phone replaces `isPhoneText` + `normalizePhone` + the 8 to 15 check; `app/(public)/request-slot.ts` passes `country` only when the form sent one. (2) Owner booking: the same in `owner-create-booking.ts` and `app/owner/(app)/book/actions.ts`; its errors stay `form.invalid` through `actionErrorKey` (no phone-specific key was in use), and a new `owner.errPhone` copy key exists but is shown nowhere yet. (3) `request-fields.ts` (client check) takes the selected country. (4) `add-booking-items.ts`: a typed payer phone goes through `toCanonicalPhone`; null throws `form.invalid` (there was no phone error before). (5) `findOrCreatePerson` no longer normalizes and throws a plain Error if the phone is not `isCanonicalPhone`; its callers are `request-public-slot.ts`, `create-owner-booking.ts` and `create-series.ts` (series gets the owner action's parsed phone); `make-weekly` and `renew-series` use the requester's existing person id. (6) Stadium info: `toCanonicalPhone(raw, "961")` and it must start with 961 (`stadium.phone_invalid`); `parseTenantSettings` reads a stored stadium phone that is not canonical Lebanese as not set. (7) `whatsapp-link.ts`: `isCanonicalPhone(p) ? p : toCanonicalPhone(p, "961")`, null is `notification.bad_phone`. (8) `search-people.ts` uses `toPhoneSearchDigits`. (9) The phone rate-limit key `public:phone:${tenantId}:${phone}` is built from the parsed phone, so it is now the canonical one (`public-request-limits.ts` unchanged). Copy: `public.errPhone` text changed as asked; `docs/DATA-MODEL.md` Person row updated. `normalizePhone` and `toLebanonNumber` are not deleted.

**Not done / watch:** the country selector (UI), the data migration of stored phones and a green verify are still to come; until the migration, stored phones such as `03123456` are not canonical, so a stadium phone reads as not set and `findOrCreatePerson` cannot match an old Person by its old string. Do not merge before those. `prisma/seed.ts` was not checked.

**Tests (written, NOT run):** schema tests for public and owner (formats, `0933123456` refused without a country and accepted with 963, letters, unknown country), `request-fields`, `whatsapp-link` (963 number, `0096171123456`, `71123456`; the old rows "03 123 456 refused" and "31234567 gets 961" changed because the new rule accepts the first and refuses the second), `stadium-info`, `tenant-settings-stadium`, and the new `test/integration/phone-identity.integration.test.ts`. Raw local phones in the integration tests (`03xxxxxx`) were rewritten to canonical (`9613xxxxxx`) because the use cases now refuse a non-canonical phone. `npx tsc --noEmit` was the only check run.

## Phone: country code selector (branch `feat/phone-wiring`, NOT merged)

**When:** 2026-10-14

**What:** UI only; the rule, the schemas, the use cases and every other screen are unchanged. New `people/ui/phone-field.tsx`: a native `<select>` of the 13 countries (flag emoji + `+code`, default 961, submitted as `country`, labelled by the new copy key `phone.countryCode`: "Country code" / "رمز البلد", 16px `type-field`) beside the phone input, the whole group `dir="ltr"`; the input keeps `inputMode`, `autoComplete` and `sanitizePhoneInput`. It is used in the public request sheet (`public-request-view.tsx`; `public-request-sheet.tsx` needed no change because the view owns the form) and in the owner booking form, which is the request form inside `booking/ui/slot-picker.tsx` (`RequestForm`; it serves the owner Book grid and the Today free strip). Both pass the selected country to `publicRequestFieldErrors` (`toCanonicalPhone(phone, country)`). The owner form shows `owner.errPhone` under the phone; the public form keeps `public.errPhone`. Built on the wiring branch because the wiring commit is only there (`feat/phone-canonical` is already merged into `main`).

**Not wired:** when the owner action itself answers `form.invalid` (a server-side phone failure that the same client rule should have caught), the owner sees the generic flash message, not `owner.errPhone` under the field; that would need the action to return the failing field, which was out of scope.

**How to verify:** `npx tsc --noEmit` was the only check run; `test/modules/people/ui-phone-field.test.ts` (13 options, 961 selected by default, country/phone names, LTR, label) and the added `name="country"` check in `public-request-view.test.ts` are written and NOT run. The `request-fields` test for `"0933123456"` with `"963"` already existed from the wiring commit. UNVERIFIED by eye: the select width at 360px in Arabic and English.

## Phone: country selector uses the app's Select (branch `feat/phone-wiring`, NOT merged)

**When:** 2026-10-14

**What:** `people/ui/phone-field.tsx` no longer uses a native `<select>`: it uses the app's `Select` (`components/ui/select.tsx`, like `SelectField`) with a hidden `country` input, so the control looks like the other selects. The list opens as a popover capped at `max-h-56` (about six rows, it scrolls) with compact items (`py-1`), and the trigger is narrow (`w-auto px-2.5`) and keeps the same 44px height as the phone input beside it (I read "not that tall" as the long list; if the closed control itself should be shorter, `size="sm"` makes it 32px but it would no longer match the input). The options are exported as `PHONE_COUNTRY_OPTIONS` (13, flag + `+code`).

**Files:** `people/ui/phone-field.tsx`, `test/modules/people/ui-phone-field.test.ts` (rewritten: the app's Select renders its list only when open, so the options are tested as data and the trigger, hidden input, label and LTR in the markup).

**How to verify:** `npx tsc --noEmit` was the only check run; the tests are written and NOT run. UNVERIFIED by eye: the popover over the bottom sheet (it uses the same z-index as the sheet and `SelectField` already works inside sheets) and its height.

## Phone: data migration to canonical phones (branch `feat/phone-wiring`, NOT merged)

**When:** 2026-10-14

**What:** New hand-written migration `20261014090000_canonical_phones` (sorts after the newest folder, `20261013090000_booking_series`). (1) `people_canonical_phone(text)`, `CREATE OR REPLACE`, `IMMUTABLE`, kept permanently: the same rule as `toCanonicalPhone` for stored values with country 961 (it also tolerates spaces, dashes, a leading `+` and Arabic-Indic digits so the two can be compared directly); unconvertible gives NULL. (2) Every Person with a phone is mapped; NULL leaves the row alone. (3) People with the same (tenantId, canonical phone) are one group; the survivor is the earliest `createdAt` (Person has `createdAt`; ties by id). The migration raises, naming no phone, if two people of a group are participants of the same booking or payers of sales on the same booking. (4) `BookingParticipant`, `Sale.payerPersonId`, `SlotInterest`, `BookingSeries` and `UserPersonLink` are re-pointed to the survivor; duplicate `SlotInterest` (same tenant, pitch, window, person) and `UserPersonLink` rows of a survivor are reduced to one; the merged-away people are deleted; then `Person.phone` is set where it differs. (5) `Sale.payerPhone` is canonicalized where convertible. (6) `Tenant.settings` keys `phone` and `whatsapp` are canonicalized only when the result starts with 961. (7) A `RAISE NOTICE` with counts only. No amount, status, `during` or `tenantId` changes. Idempotent: every UPDATE and DELETE is conditioned on what still needs changing, and a second run finds no groups. Transactions: the foundation migration uses plain `DO $$ ... RAISE EXCEPTION` blocks with no `BEGIN`/`COMMIT`; Prisma runs a file as one multi-statement query, which Postgres treats as one implicit transaction (not verified here), and the merge is a single `DO` block, so it is atomic either way. `prisma/seed.ts` writes no phone, so nothing changed there. Person references found: only the five in the list above (FKs in the migrations match the schema); no others.

**Files:** `src/prisma/migrations/20261014090000_canonical_phones/migration.sql`, `docs/DATA-MODEL.md` (row 13 of section 3), `test/integration/canonical-phone-sql.integration.test.ts` (SQL equals TypeScript for 28 inputs), `test/integration/canonical-phone-migration.integration.test.ts` (merge and references, unconvertible and other-tenant rows, amounts, second run, the guard).

**How to verify:** `npx tsc --noEmit` was the only check run; the tests are written and NOT run, the migration was not applied anywhere, and the DATA-MODEL section 4 drift check (`prisma migrate diff`) is left for the verify run. Back up before running it on real data: merging people deletes rows.

## Phone: stale test expectations after the wiring (branch `feat/phone-wiring`, NOT merged)

**When:** 2026-10-14

**What:** Tests only. The verify run on `feat/phone-wiring` (after `2f12e50`) failed 5 tests, all test data that predates the canonical phone. Four expected the stadium WhatsApp number as `"71123456"`; the canonical value is `"96171123456"` (`test/lib/tenant-settings-stadium.test.ts` INFO, which also reads back as "not set" otherwise; `test/modules/stadium/domain/stadium-info.test.ts:106`; `test/integration/stadium-info.integration.test.ts` twice). The fifth, `test/integration/person-phone-race.integration.test.ts`, sent `961377NN001` (961 plus 8 digits starting 3), which is not a Lebanese number; `requestPublicSlot` is called without the schema, so `findOrCreatePerson` threw. The test now sends `96137NN001` (961 plus 7 digits). No source file changed; the race handling in `find-or-create-person.ts` was not the cause.

**Drift (read only, nothing changed):** `prisma migrate diff` after the migrations shows two foreign keys where the SQL says `ON DELETE RESTRICT` and `schema.prisma` has no `onDelete` on an optional relation (Prisma's default is `SET NULL`): `Booking_seriesId_fkey` (created by `20261013090000_booking_series`, in `ecd0063`) and `BookingParticipant_personId_fkey` (created RESTRICT by `20260909080100_person_booking`; `personId` became optional in `20260924060000_per_player_foundation`, which only dropped NOT NULL). Both are on `main`; neither comes from the phone work.

**How to verify:** `npx tsc --noEmit` was the only check run; the changed tests are written and NOT run.

## Today: the selected day stays centred (branch `feat/today-refine`)

**When:** 2026-10-14

**What:** The measure-and-`scrollBy` that centres the selected day moved unchanged from `booking/ui/day-tabs.tsx` into `keepSelectedTabCentred` (`booking/ui/centre-selected-tab.ts`). It runs at once (the existing effect on `selected`), again when `document.fonts.ready` resolves (font loading changes the tab widths; skipped if `document.fonts` is missing), and again from a `ResizeObserver` on the tab list (skipped if undefined). The effect's cleanup disconnects the observer and ignores a late `fonts.ready`. Behaviour stays `auto`. Tab markup, styles and the calendar picker are untouched.

**How to verify:** `npx tsc --noEmit` was the only check run. `test/modules/booking/centre-selected-tab.test.ts` (mocked boxes, `ResizeObserver` and `document.fonts`: centres at once, after fonts.ready, after a resize, stops after cleanup, works without both APIs) is written and NOT run. UNVERIFIED by eye in a browser, in Arabic and English.

## Today: money owed from earlier days shown once, first (branch `feat/today-refine`)

**When:** 2026-10-14

**What:** Display only; no query, money write or schema change. The owed pill at the top of `lists.tsx` is gone. The `#earlier-debts` section is now the first section of `UpcomingPanel`, before games and the free strip (so Today reads New requests, To collect, Games, Available hours; `docs/ui-rules.md` rule 8 amended). Its header is the new `booking/ui/earlier-debts-header.tsx`: alert icon, "To collect", the total, "from earlier days" (copy key `owner.owedFromEarlier` reworded), in the `owed` tokens; with several rows it is the toggle with the chevron, with one it is a plain row. `id`, `collectOpen`, `collectShown` and the single-row behaviour are unchanged. `CollectCount` (now unused) was removed.

**The total:** I did NOT reuse the Money Owed reader. `listOwed` (behind `/owner/money/owed`) needs `reports.view`, which Today does not require, and groups by person with per-player shares and shop tabs counted separately, while Today's rows are one per booking from `listEndedWithRemaining` (capped at 5, plus one to detect more), filtered to days before today. The definitions differ, so I kept the capped total and, when `toCollectHasMore`, it reads "at least $X" (new key `owner.owedAtLeast`, AR and EN) instead of a trailing "+". Whether the two totals happen to match was not checked.

**How to verify:** `npx tsc --noEmit` was the only check run. `test/modules/booking/earlier-debts-header.test.ts` (header text, tokens, "at least", toggle vs plain row, and a source-order check that the section precedes games and the free strip) is written and NOT run. UNVERIFIED by eye in both languages.

## Today: compact free hours (branch `feat/today-refine`)

**What:** UI only, in `booking/ui/free-strip.tsx` (used only by Today through `FreeStripSection`). The pitch filter chips are gone: every pitch is shown, one row each, with its name (`type-section`, when names are shown) above its free hours on a single line (`flex-nowrap overflow-x-auto no-scrollbar`; the row starts from the right in Arabic because flex follows the direction). The "+N more" chip and its state went too, since the line scrolls. Chips are soft filled (`bg-surface-2`), no border, `type-label` with `tabular-nums`, `min-h-10`; the pressed and picked states (lime) and the pending-requests badge are unchanged. `components/ui/scrollbar-peek` was NOT used: it is a vertical overlay for the page scroll and does not fit a horizontal row, so the native bar is hidden with the existing `no-scrollbar`. The component no longer reads `?pitch=`; `book/actions.ts` still keeps a `pitch` query value on redirect (`TODAY_KEEP`), which is harmless and was left alone. The copy key `owner.allPitches` is now unused and was left. Possible: the focus ring of a chip may be clipped by the row's overflow.

**How to verify:** `npx tsc --noEmit` was the only check run. The existing `test/modules/free-strip.test.ts` covers only the domain `buildFreeStrip` and needed no change; the new `test/modules/booking/ui-free-strip.test.ts` (rows, no filter chips, one scrolling line, chip classes, badge, states) is written and NOT run. UNVERIFIED by eye.

## Today: free hours wrap instead of scrolling (branch `feat/today-refine`)

**What:** Follows the compact free hours entry: the sideways-scrolling line was easy to miss, so each pitch's hours are now a grid of equal-width chips (`grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))]`, chips `w-full`, centred) that fill the line and wrap to the next, with no scrollbar. The whole section has `mt-3` more space above it. Chip look, states and badge are unchanged. A chip with a price and a badge may be tight at 5.5rem (88px); not checked on a 360px screen.

**How to verify:** `npx tsc --noEmit` was the only check run; `test/modules/booking/ui-free-strip.test.ts` was updated for the grid and the top space and is NOT run. UNVERIFIED by eye.

## Today: the To collect header wraps by parts (branch `feat/today-refine`)

**What:** The Arabic "To collect · total · from earlier days" header is long on a narrow screen. `earlier-debts-header.tsx` now lays its three parts ("To collect", the total or "at least $X", "from earlier days") in a wrapping row, each part unbreakable, so a long line moves a whole part to a second line instead of breaking inside a phrase or being cut. The "·" separators are replaced by a gap (a wrapped line would otherwise end with a stray dot). The row keeps its minimum height and grows to two lines.

**How to verify:** `npx tsc --noEmit` was the only check run; `test/modules/booking/earlier-debts-header.test.ts` was updated (text without dots, the wrapping row) and is NOT run. UNVERIFIED by eye at 360px in Arabic.

## Today: no "at least" words in Arabic (branch `feat/today-refine`)

**What:** Copy only. `owner.owedAtLeast` in Arabic is now `{amount}+` (was "على الأقل {amount}"), so the capped total in Arabic reads "$120+" while English keeps "at least $120". The plus keeps the signal that more is owed than the total shows.

**How to verify:** `npx tsc --noEmit` was the only check run; the header test was updated and is NOT run.

## Test: Arabic capped total assertion (branch `fix/earlier-debts-test`)

**What:** CI failed on `earlier-debts-header.test.ts` after v1.3.2: the test's tag-stripping helper puts a space where the `LtrIsolate` element ends, so the Arabic header reads "$120 +" in the test text (the markup is `$120` followed by `+`, no space). The assertion now expects "$120 +". Test only; the header is unchanged.

**How to verify:** `npx tsc --noEmit` was the only check run; the test is written and NOT run.

## More > Weekly bookings: the card opens the series sheet (branch `feat/series-card`)

**What:** UI only; no new use case or server action. The list is `src/app/owner/(app)/more/weekly/_components/weekly-list.tsx`; each card is now `weekly-card.tsx` (new), whose whole area is a button (a stretched `after:absolute after:inset-0` button, `aria-haspopup="dialog"`) that opens the same `SeriesManage` sheet the booking sheet's series row opens: the weeks, Renew more weeks, and Cancel the rest when the sheet's own `mayCancelRest` allows it. Renew stays its own button above the card (`relative z-10`, a sibling, not a child), so tapping it opens only the renew step as before. The page passes the five real series actions as one `seriesActions` prop (`loadSeriesSheetAction`, `previewCancelRestAction`, `previewSeriesAction`, `submitCancelRest`, `submitSeriesSave`); closing the sheet refreshes the list.

**How to verify:** `npx tsc --noEmit` was the only check run. `test/app/owner/weekly-card.test.ts` (calls the card component and taps its handlers: the card opens with the item, Renew does only Renew and is not inside the card button, no Renew without permission) is written and NOT run. UNVERIFIED by eye: the focus ring and tap targets, and the sheet over the list.
## Shop: items on a game open 60 minutes before the start (branch `feat/shop-window`)

**What:** New pure rule `mayAddItemsToBooking({ status, start, now })` in `booking/domain/shop-window.ts` (booking, not shop: it is about a booking's status and start, and shop does not import booking), with the named constant `ITEMS_OPEN_MINUTES_BEFORE_START = 60`. True only for APPROVED from `start - 60 min`, and it stays true during and after the game. `addBookingItems` checks it inside the transaction after the booking row is read under its lock (the existing "not APPROVED" check still answers `shop.booking_not_open` first; a confirmed game too early answers the new `shop.items_not_open`, AR and EN in `lib/copy/errors.ts`). Removal, pricing, tabs, payments, lock order and walk-in sales are untouched. UI: the one place "Add items" is offered is the Shop block of the booking sheet (`booking-sheet/shop-tabs.tsx` -> `BookingItems`, reached from Today and from the Book grid's sheet); its `canAdd` is now `shop.maySell && row.mayAddItems`, a new `UpcomingRowView.mayAddItems` computed on the server in `today/_components/lists.tsx`. Existing tabs and items stay visible and removable at any time; with no items and no add action the block renders nothing (it already returned null). `UpcomingRowView.approved` is now unused by the UI and was left.

**Tests changed:** the shop integration suites added items to games 30 days ahead, which the new rule refuses, so they now use `soonBooking` (new in `test/integration/shop-helpers.ts`: a game that starts in 30 minutes, moved by raw SQL on `during` only, stepping 90 minutes earlier if the pitch is busy). `shop-booking-items`, `shop-change`, `shop-lbp` and `shop-races` were edited this way; any assertion that depended on the game being far in the future is unverified.

**How to verify:** `npx tsc --noEmit` was the only check run. Written and NOT run: `test/modules/booking/domain/shop-window.test.ts` (61 min false, 60 true, during and after true, each non-APPROVED false) and `test/integration/shop-items-window.integration.test.ts` (2 hours: `shop.items_not_open` and nothing written; 30 minutes: ok; removing an item when the game is 2 hours away: ok). The four edited suites need the verify run.
## People: the owner can edit a person's name and phone (branch `feat/person-edit`)

**What:** No migration, no money table. New owner-only permission `people.edit` (`access/domain/can.ts`, in `OWNER_ONLY` like `shop.manage`: never granted to staff, even with the flag true). `people/schemas/update-person.ts` (strictObject: `personId`, `name` cleaned, optional `phone`, optional known `country`). `people/application/update-person.ts` (`updatePersonDetails`): authorizes before the transaction, loads the person (tenant-scoped; missing: `people.not_found`), writes the name with `searchName = normalizeName(name)`, and, when a phone is sent, `toCanonicalPhone(phone, country)` (null: `people.phone_invalid`); an empty phone is refused for a person who has one (`people.phone_required`) and ignored for one who has none; a number another person of the stadium has is `people.phone_taken` with that person's name, and the unique-index race (P2002) maps to the same error. The write is `updatePerson` in `people/infrastructure/persons.ts`. `DomainError` gained an optional `params` (used for `{name}`; the action passes it back as `name`). Action `people/[personId]/actions.ts` (`submitUpdatePerson`, thin, revalidates the person page). UI: an Edit button on the person page, only when `can(membership, "people.edit")`, opens `person-edit-sheet.tsx` (name, `PhoneField` prefilled with `+<digits>` for a canonical number, one Save, errors under their field). `PhoneField` gained an optional `defaultValue`. Copy: `person.edit/editTitle/name/phone/save` and the errors `people.not_found`, `people.phone_invalid`, `people.phone_required`, `people.phone_taken` (AR and EN). `docs/DATA-MODEL.md` Person row and `docs/ROADMAP.md` (the row did not exist; added as row 13, done) updated.

**Not wired:** no audit or history of the change (there is none for Person); an owner who renames a person does not change names already printed in notifications; the sheet is not offered to staff, and there is no screen to grant the flag (it cannot be granted).

**How to verify:** `npx tsc --noEmit` was the only check run. Written and NOT run: the `can` case, `test/modules/people/schemas/update-person.test.ts` and `test/integration/update-person.integration.test.ts` (rename and search, canonical phone, taken phone changes nothing, clearing refused, legacy phone fixed, staff refused, another tenant not found). UNVERIFIED by eye: the sheet in both languages.

## People: the edit button is a pencil beside the name (branch `feat/person-edit`)

**What:** UI only. The "Edit" outline button under the person header is gone. A ghost icon button (lucide `Pencil`, 20px, `text-muted-foreground`, no fill or border, 44x44 tap area through `size="icon"`, `aria-label` from `person.edit`) sits at the end of the name row in the page header, shown only when `can(membership, "people.edit")`, and opens the same `PersonEditSheet`. The name has `min-w-0 flex-1 truncate` and the icon `shrink-0`, so a long name is cut before the icon leaves the row; the row is a flex row, so the icon is at the end in both RTL and LTR. No test checked the old button.

**How to verify:** `npx tsc --noEmit` was the only check run; no test was run. UNVERIFIED by eye (hover state of the ghost button, a very long name, Arabic).

## Test: two shop suites after the 60-minute window (branch `fix/shop-window-tests`)

**What:** Test only. CI failed two tests after the merge. (1) `shop-booking-items` "the day line counts a tab on a game of that day" used `endedGame(fixture, 0)`, which is today's first slot: it is only "ended" when the clock is late enough, and otherwise the game is more than 60 minutes away, so `shop.items_not_open` is right. It now uses `bookingStartingIn(fixture, -30)` (a game that began 30 minutes ago). (2) `shop-races` "add x cancel": `bookingStartingIn` counted the earlier, cancelled games of the loop as in the way and moved the next game 90 minutes into the past, so `cancelBooking` answered `booking.cancel_started`. The helper now treats only APPROVED games as in the way, like the exclusion constraint, so a cancelled game frees its time. No source file changed.

**How to verify:** `npx tsc --noEmit` was the only check run; the two suites are NOT re-run.

## Release rule: a pushed tag is never moved (branch `docs/release-rules`, not merged)

**When:** 2026-10-12

**What:** Docs only. `CLAUDE.md` Workflow item 8: never move, delete or force-push a pushed tag; a release mistake is fixed by a new release with a new number; `v1.3.2` was moved twice by force push on 2026-10-12 and must never be deployed. `docs/RUNBOOK.md`: "Deploy order" (and "Roll back to a tag") say to deploy only a tag whose CI run on `main` was green, and to stop and ask if `git fetch --tags` reports "would clobber existing tag"; never fetch tags with `--force` on the server. `docs/ROADMAP.md`: a "Phones: open" row for the 11 stored production phones (person editing can fix them, shipping in `v1.4.0`). `docs/NOW.md`: the live tag line now says `v1.4.0` with what it adds.

**Held back:** this branch is based on `main`, where the "In progress" platform-admin line, the corrected server values and the other ROADMAP rows do not exist (they live only on the unmerged `feat/platform-admin`), so none of those was added here. NOW.md names `v1.4.0` as live: do not merge this branch before the tag exists.

**How to verify:** `npx tsc --noEmit` was the only check run; `test/docs` was NOT run.

## Web platform admin: decision record (branch `feat/platform-admin`)

**When:** 2026-10-12

**What:** Docs only, no code. New `docs/decisions/DR-006-platform-admin.md`, by the owner's decision of 2026-10-12, reversing the ROADMAP "Deferred on purpose: Web platform admin" row (now "In progress, see DR-006"; the other rows are unchanged). It records, with reasons: served only at `/platform` on the bare `APP_BASE_DOMAIN` host (404 anywhere else, noindex, no-store, not in robots.txt), a host-only `__Host-` cookie, same app with a `(platform)` route group over `src/modules/platform`; a new global `PlatformAdmin` (password of 16 or more characters, AES-256-GCM encrypted TOTP secret under `PLATFORM_TOTP_KEY`, `lastTotpStep`) created only by the CLI, with `admins reset-totp` as the only recovery; TOTP per RFC 6238 with `node:crypto`; `PlatformSession` (hashed 256-bit token, 8 hours absolute, 30 minutes idle); one login form with a generic error, a dummy scrypt and 5 failures in 15 minutes per account and per IP; audit with actor `admin:<id>`; the v1 scope (stadiums list and detail, create with a once-shown owner password, suspend and resume by typing the slug); the deploy preconditions; the threats; and the seven slices. `docs/README.md` lists DR-006 in the decisions line.

**Added by the record beyond the request (to confirm):** `/platform` is not listed in robots.txt; `src/proxy.ts` only routes and never reads the session (the layout and each action do); a development cookie name without the `__Host-` prefix and `Secure` (a `__Host-` cookie is refused over plain HTTP); a compare-and-set update of `lastTotpStep` so two simultaneous logins cannot reuse a code; reset-totp also deletes that admin's sessions and writes an audit row; the admin password minimum (16) is kept apart from the owner policy (12); `test/architecture/rules.ts` needs one line for the new route group; the per-account lockout lets someone who knows the identifier lock the admin out for 15 minutes at a time (accepted, written down); `lastSeenAt` is updated at most once a minute.

**How to verify:** `npx tsc --noEmit` was the only check run; no test was run (`test/docs` was not run, so the new links in the README and ROADMAP are unchecked by it).

## Web platform admin, slice 2: tables, TOTP and the admin CLI (branch `feat/platform-admin`)

**When:** 2026-10-12

**What:** DR-006 slice 2. No web route, no proxy change, no UI. DR-006 updated first: the `__Host-` cookie whenever `APP_PROTOCOL` is https (unprefixed only otherwise), `/platform` is 404 entirely in production unless https, the admin identifier must not be guessable (RUNBOOK documents the unlock), the server clock must be synchronised, and `admins set-password` deletes sessions and audits. Migration `20261015090000_platform_admin` (hand-written, additive): `PlatformAdmin` (identifier unique and lowercase by a SQL-only CHECK, `passwordHash`, `totpSecretEnc` nullable, `lastTotpStep` BIGINT nullable) and `PlatformSession` (`tokenHash` unique, `adminId` FK ON DELETE CASCADE with an index, `lastSeenAt`, `expiresAt`); both added to `PLATFORM_ONLY_MODELS` in `src/lib/db.ts` (the tenant-scoped client refuses them), to `test/integration/truncate.ts` and to DATA-MODEL section 1 ("Platform admin"). Env: `PLATFORM_TOTP_KEY` (base64 of exactly 32 bytes) validated in `src/lib/env.ts`, REQUIRED in production, in `.env.example`; messages never carry the value. Domain (pure): `platform/domain/totp.ts` (`hotp`, `totpCode`, `verifyTotp` with a constant-time compare of all three steps, `stepAt`, `otpauthUri` with issuer lebstads) and `base32.ts`. Infrastructure: `totp-crypto.ts` (AES-256-GCM, the row id as AAD, `loadTotpKey`, 20-byte base32 secrets) and `platform-admins.ts` (create, find, list, `setTotpSecret`, `clearTotp`, `setPassword`, `deleteSessionsForAdmin`, `consumeTotpStep` as one atomic UPDATE). Application: `platform/application/platform-admins.ts` (create with 16+ characters plus the shared policy, begin/finish enrollment, reset, set-password, list; every one audited in the same transaction with actor `cli:<user>@<host>`, never a secret). CLI: `scripts/platform-admins-cli.ts` wired into `scripts/platform-cli.ts` (`admins list | create | enroll-totp | reset-totp | set-password`). `enroll-totp` shows the QR and URI once and saves nothing until a valid code is typed. No allowlist or architecture-rules file changed: the CLI calls module use cases, so `scripts/` imports no `platformDb`.

**Deploy note:** `PLATFORM_TOTP_KEY` is required in production, so the server `.env` must have it BEFORE this is deployed, or the server refuses to start (`instrumentation.ts`).

**How to verify:** `npx prisma generate` and `npx tsc --noEmit` were the only commands run. Written and NOT run: `test/modules/platform/domain/totp.test.ts` (RFC 6238 and RFC 4226 vectors, window, base32, URI), `test/modules/platform/infrastructure/totp-crypto.test.ts`, the `PLATFORM_TOTP_KEY` cases in `test/lib/env.test.ts` (the existing production-valid case now sets the key), `test/integration/platform-admin.integration.test.ts` (consumeTotpStep once and under concurrency, create, enroll with a valid code, reset-totp, set-password, list, the CHECK and the cascade), and a throwaway key in `test/integration/setup-env.ts`. The migration was not applied and the DATA-MODEL section 4 drift check was not run.

## Web platform admin, slice 2 follow-ups (branch `feat/platform-admin`)

**What:** Tests and docs only. `platform-admin.integration.test.ts`: the `createAdmin` helper looked the admin up with the identifier as typed ("Ops.One") while the CLI stores it lowercase, so it now lowercases first (this was the one failing test of the verify run). `docs/DATA-MODEL.md`: `PlatformAdmin` and `PlatformSession` are kind P (they are in `PLATFORM_ONLY_MODELS`), not G; section 3 gets row 15 for the SQL-only CHECK `PlatformAdmin_identifier_lowercase` (migration `20261015090000_platform_admin`; `normalizeAdminIdentifier` lowercases before insert and lookup; if lost, two admins could differ only by case).

**Noticed, not changed:** section 3 now has two rows numbered 13 (the canonical-phones row from `feat/phone-wiring` and the append-only triggers row); renumbering was out of scope.

**How to verify:** `npx tsc --noEmit` was the only check run; the test is written and NOT run.

## Web platform admin, slice 3: /platform on the bare host only (branch `feat/platform-admin`)

**When:** 2026-10-12

**What:** DR-006 slice 3. No login, no session, no database access. `src/proxy.ts`: after the existing host check (still first, so a bad host is 404 before anything else), `/platform` and `/platform/...` are served only when `isBareHostFromHeaders` is true (new strict `isBareHost` in `lib/tenant-slug.ts`: exactly the bare `APP_BASE_DOMAIN`, X-Forwarded-Host only when trusted, never Origin or Referer, so the development fallback cannot make a tenant host look bare) and not in production with `APP_PROTOCOL` other than https; otherwise the same empty 404. Served responses get `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store` and skip the owner cookie renewal; `x-tenant-slug` is still deleted. New placeholder `src/app/(platform)/platform/page.tsx` ("Platform", robots noindex, `force-dynamic`, imports nothing from tenant-context or the database). `test/architecture/rules.ts`: a comment-only line describing the route group (no rule or exception was needed: the placeholder imports no module, so nothing is excused). `docs/KEY-FILES.md` entry 1 gains the /platform sentence. `/platform` is not in robots.txt.

**Unverified / to look at in slice 4:** the root layout still runs on /platform (brand lookup returns the neutral icon for the bare host without a query, but it also mounts the owner service worker and the theme code); whether Next lets the proxy's `Cache-Control: no-store` stand on a dynamic page; whether `/platform` needs its own layout instead of the root's.

**How to verify:** `npx tsc --noEmit` was the only check run. Written and NOT run: the new `proxy /platform` cases in `test/proxy.test.ts` (no existing case was changed; the `afterEach` and two node imports were added to the import lines) and the `isBareHost` cases in `test/lib/tenant-slug.test.ts`. The bare host's tenant pages stay 404 through `loadTenant`, which `integration/host-tenant.integration.test.ts` covers; the proxy test only shows the proxy does not touch other paths there.

## Web platform admin, slice 4: login, sessions, limits, logout, guards (branch `feat/platform-admin`)

**When:** 2026-10-12

**What:** DR-006 slice 4. The slice 3 test that read the placeholder page's comments now checks import statements only (and scans every file of the route group). Domain: `admin-session.ts` (8 hours absolute, 30 minutes idle, `isSessionAlive`, `shouldTouch` at 1 minute) and `admin-login-limits.ts` (5 failures in 15 minutes, 15-minute block, keys `platform:fail|block:acct|ip:...`). Infrastructure: `platform-sessions.ts` (256-bit token, only its SHA-256 stored, find, touch, delete, delete expired; `deleteSessionsForAdmin` from slice 2 is reused) and `platform-session-cookie.ts` (`__Host-lebstads_admin` + Secure when `APP_PROTOCOL` is https, else `lebstads_admin_dev` without Secure; HttpOnly, SameSite=Strict, Path=/, 8 hours). Application: `platformLogin` (limits first and outside any transaction, a dummy scrypt for an unknown identifier, password, enrolled secret, decrypt, `verifyTotp`, then the atomic `consumeTotpStep`; one error `platform.login_failed`, `platform.login_blocked` when blocked; on success ONE transaction creates the session and writes `admin.login` with actor `admin:<id>`), `resolvePlatformSession` / `getCurrentPlatformAdmin` (a dead session is deleted, a live one touched at most once a minute), `endPlatformSession` / `platformLogout`. Host guard: `platformServed` (the proxy's rule, now in `lib/tenant-slug.ts`) and `requirePlatformHost()` in `src/lib/require-platform-host.ts` (notFound unless bare host and, in production, https). It lives in `src/lib` because it imports only lib code and a module may not import `app`; `rules.ts` needed no change. It runs first in the /platform layout, in both pages and in both Server Actions. The proxy now decodes the path first (`isPlatformPath`), so `/%70latform` and `/platform%2F` on a tenant host are 404. Routes under `src/app/(platform)/platform/`: `layout.tsx`, `page.tsx` (signed in as ..., Log out; no session redirects to the login), `login/page.tsx` (identifier, password, code; only the two known error keys are shown), `actions.ts` (login and logout; logout needs a session). English only, plus the Arabic table every copy area carries (`lib/copy/platform.ts`). The owner service worker already registered only under /owner; `shouldRegisterOwnerWorker` now also excludes /platform explicitly.

**Not done / to know:** the admin password hash is not re-hashed when its cost changes (the owner login does); the layout guard is repeated in each page because a layout can be skipped on a client-side navigation; the root layout still renders around /platform (neutral brand, no owner pieces besides the worker component, which does nothing there); `Cache-Control: no-store` from the proxy may be replaced by Next's own header on dynamic pages (seen in dev); logout is not written to the audit log.

**How to verify:** `npx tsc --noEmit` was the only check run. Written and NOT run: `admin-session.test.ts`, `platform-login.integration.test.ts`, `test/lib/platform-host.test.ts` (rule, path decoding, the guard with `next/headers` mocked), `platform-session-cookie.test.ts`, `test/components/shell/owner-service-worker.test.ts`, and the new cases in `test/proxy.test.ts`. Nothing was checked in a browser.

## Web platform admin, slice 5: stadiums list and detail, logout audit (branch `feat/platform-admin`)

**When:** 2026-10-12

**What:** DR-006 slice 5, read only. `endPlatformSession` (so `platformLogout`) now writes `admin.logout` (actor `admin:<id>`) in the same transaction as the session delete, and nothing when there was no session. `list-tenants.ts` is UNCHANGED (the CLI output is identical); the web order (suspended, then overdue, then the rest by name) is a new pure `platform/domain/tenant-order.ts` (`orderTenantsForAdmin`) the page applies. New read use case `platform/application/get-tenant-detail.ts` (+ `infrastructure/platform-tenant-detail.ts`, explicit selects, platformDb read only): name, slug, status, `suspendedAt`/`suspendedReason`, created, subscription history (newest first), OWNER login identifiers, counts (pitches, people, bookings requested in 30 days) and the latest 10 audit rows of that tenant as action, actor and time only (never the `detail` JSON); unknown slug throws `platform.tenant_not_found`, which the page turns into a 404. The public page URL is built in the page with `publicPageUrl(slug)`, not in the use case: `platform` may not import `stadium` (`stadium` imports `platform`), so `rules.ts` is unchanged. Routes under `src/app/(platform)/platform/`: `page.tsx` (list as cards, empty state), `stadiums/[slug]/page.tsx` (detail in sections, public URL in a new tab), `_components/` `platform-frame.tsx` (centred column up to 720px, signed-in line, Log out), `stadium-card.tsx` (the whole card links to the detail), `status-badges.tsx` (suspended = alert tokens, overdue = owed tokens, active = neutral; always a word), `detail-section.tsx`. Every page runs `requirePlatformHost` and then `getCurrentPlatformAdmin`; no session redirects to /platform/login. Copy added to `lib/copy/platform.ts` (English and the Arabic table).

**Not done:** no suspend, resume or create (slice 6); no pagination or search (the list is every stadium); the audit rows of the detail page are the tenant's own (`tenantId` set), so admin logins (no tenant) are not shown there; times are shown in UTC.

**How to verify:** `npx tsc --noEmit` was the only check run. Written and NOT run: `platform-tenants.integration.test.ts` (detail fields, no audit detail JSON, 10-row cap per tenant, unknown slug, list order), the logout audit case in `platform-login.integration.test.ts`, `platform-pages.integration.test.ts` (both pages redirect to the login without a session and 404 off the bare host, with `next/headers` mocked) and `test/modules/platform/domain/tenant-order.test.ts`. Nothing was checked in a browser.

## Web platform admin, slice 6: create, suspend, resume (branch `feat/platform-admin`)

**When:** 2026-10-12

**What:** DR-006 slice 6. Times on the platform pages now go through `formatDisplayDate` / `formatLocalClock` in the owner time zone (Asia/Beirut), not UTC (paid-until dates included). `createTenant`, `suspendTenant` and `resumeTenant` are reused with actor `admin:<id>`. Platform use case changes, CLI behaviour identical: `suspendTenant` takes an optional `reasonMax` (default 200, the CLI's) and `assertCanSuspend` an optional third argument; the web passes 500. New `platform/application/admin-tenant-actions.ts`: `createStadiumAsAdmin` (checks the slug with `validateSlug` so the page can say length / format / reserved, then `createTenant` with a generated password; taken still comes from `createTenant`), `suspendStadiumAsAdmin` and `resumeStadiumAsAdmin` (the typed slug is compared again on the server: `platform.slug_mismatch`). The owner's first password is `generateOwnerPassword` (pure, `platform/domain/owner-password.ts`: 16 characters from a 56-character alphabet without I O l o 0 1, rejection sampling, re-checked with `checkPassword`); it is returned once to the page, shown with a copy button and "Shown once. Give it to the owner in person; they change it in More > Account.", held only in component state, and is never in a URL, a log, the audit detail or the database (only the scrypt hash). `requirePlatformAdmin` (platform-session.ts) refuses an action without a session (`platform.not_signed_in`). `actions.ts` gains `submitCreateStadium`, `submitSuspendStadium`, `submitResumeStadium` (host guard first, then the session, then the use case; errors come back as copy keys). New under `src/app/(platform)/platform/`: `stadiums/new/page.tsx`, `_components/create-stadium-form.tsx` (shows `owner@<slug>` as the slug is typed; errors under the field), `_components/suspend-resume-panel.tsx` (red secondary Suspend, last on the detail page, or Resume; a confirm with a reason and the slug typed back; the confirm button is disabled until the slug matches). The list page links to New stadium. Copy: `lib/copy/platform.ts` and 17 error keys in `lib/copy/errors.ts` (English and Arabic tables).

**Not done:** no edit of a stadium, no delete, no owner password reset from the web (the "Later" list of DR-006); the generated password cannot be shown again (lose it and the CLI `set-password` resets it); no audit row records that a password was generated beyond `tenant.create`.

**How to verify:** `npx tsc --noEmit` was the only check run. Written and NOT run: `test/modules/platform/domain/owner-password.test.ts` and `test/integration/platform-stadium-actions.integration.test.ts` (create makes tenant, owner, membership and one audit row by `admin:<id>`; the password passes the policy, is only hashed and absent from every audit row; reserved, malformed and taken slugs write nothing; suspend needs reason and slug; resume; no session is refused; off the bare host 404). Nothing was checked in a browser.

## Test: the platform integration suites use the shared request stubs (branch `feat/platform-admin`)

**What:** Tests only, no source change. The verify run failed `platform-pages` and `platform-stadium-actions` (10 tests) with `NEXT_HTTP_ERROR_FALLBACK;404`: integration suites already mock `next/headers` globally (`test/integration/setup-mocks.ts`), and my own file-level `jest.mock("next/headers")` plus `mockHeaders` did not replace that stub, so the host guard saw no host. Both files now drop the local mock and set the host with `setRequestHeader("host", "lebstads.test")` (a tenant host where a case needs one), and call `clearRequestStubs()` in `beforeEach` (this also clears the `React.cache` memo that `getCurrentPlatformAdmin` uses). `request-stubs.ts` gets a generic `setCookie(name, value)` (`setSessionCookie` is unchanged); the actions test sets the admin cookie with it (`adminCookie().name`, the dev name over http). Only `next/cache` stays mocked in the actions test (`revalidatePath` needs a request). The "no session" case clears the stubs and sets the host again. No assertion was removed or changed.

**How to verify:** `npx tsc --noEmit` was the only check run; the two suites are written and NOT re-run.

## Web platform admin, slice 7: security review and docs (branch `feat/platform-admin`)

**When:** 2026-10-12

**What:** Docs only; no code or test changed. New `docs/audits/platform-admin-review.md`: each DR-006 threat (credential stuffing, stolen cookie, replayed codes, admin on a tenant host, a tenant page on the bare host, CSRF, a leaked database) against the code (file and function), the test that proves it, and the gap. No real bug found. Gaps recorded: no re-hash when the password cost changes; no web reset of an owner password; the per-IP limit is inactive until `TRUSTED_CLIENT_IP_HEADER` is set; failed logins are counted but not audited; `Cache-Control: no-store` unconfirmed in production (Next replaced it in dev); no concurrent-session cap; the account lockout can annoy the admin (accepted); UNVERIFIED: other path spellings Next normalises, Next's Origin check behind nginx, and whether Prisma error logs can include a hash or ciphertext. `docs/RUNBOOK.md`: new "Platform admin" section (PLATFORM_TOTP_KEY with the exact command, the five `admins` commands, an unlock command with the exact keys `platform:fail:acct:<identifier>` and `platform:block:acct:<identifier>` (per-IP: `platform:fail:ip:<ip>`, `platform:block:ip:<ip>`), a deploy checklist and the post-deploy `curl` check); "Environment" now lists `PLATFORM_TOTP_KEY` as required in production and "Tenant management" no longer says there is no web admin. `docs/DATA-MODEL.md` section 3 rows renumbered 1 to 16 (13 was used twice). `docs/KEY-FILES.md`: entry 16 (the admin login and `require-platform-host.ts`), and the count 15 to 16 here and in `docs/README.md`. `docs/NOW.md`: an "In progress" line.

**Note:** the unlock command uses the database and user names the RUNBOOK already uses (`-U stadiums -d stadiums`, password from `~/.pgpass`), not the `stadiums_user` / `stadiums_saas` of the request; use whatever your `~/.pgpass` names.

**How to verify:** `npx tsc --noEmit` was the only check run; `test/docs` was NOT run (new links and paths are unchecked by it). The two integration files fixed in `f7aa67f` have not been run since.

## Docs: server values corrected (branch `feat/platform-admin`)

**When:** 2026-10-12

**What:** Docs only. The production values, verified on the server (a real `pg_dump` succeeded with them, `pm2 restart` used this name), replace the placeholders in `docs/RUNBOOK.md`: database `-h 127.0.0.1 -U stadiums_user -d stadiums_saas` in every `psql`, `pg_dump` and `pg_restore` command (Login lockout, Database commands, the Platform admin unlock, Deploy order, Roll back), the `.pgpass` example line `127.0.0.1:5432:stadiums_saas:stadiums_user:THE_PASSWORD`, and the pm2 process `stadiums-saas` everywhere (the rollback block said `stadiums`; the UNVERIFIED note about the name is gone). Deploy order: after `npm run build`, `chmod 700 ~/web/lebstads.com/public_html/.next` with the reason (HestiaCP nginx serves static extensions straight from the app folder; a stopgap until a custom proxy template), the same line in the rollback block; the backup step now sets `chmod 600` on the dump and checks it is not empty, and says the first verified backup was taken on 2026-10-12. `docs/NOW.md`: the live tag is `v1.3.1` (canonical phones with the country code selector and the merge of duplicate people, the Requests card polish, the lint fixes); the slice 7 "In progress" line is kept. `docs/ROADMAP.md`: a new section "Server and schema: open" with three rows (the custom nginx template, moving the app out of `public_html`, rotating the database password, testing a restore, lint in CI; the two foreign keys `ON DELETE RESTRICT` versus the schema default; the 11 production phones that could not be made canonical). The older archived progress entries still show the old placeholder names; they are history and were not touched.

**How to verify:** `npx tsc --noEmit` was the only check run; `test/docs` was NOT run.

## Docs: today's server changes recorded (branch `feat/platform-admin`)

**When:** 2026-10-12

**What:** Docs only, from the server work done today. `docs/RUNBOOK.md`, new section "Server: nginx, backups, pm2, certificate": the custom HestiaCP proxy template `nextjs` (applied with `v-change-web-domain-proxy-tpl mahmoud lebstads.com nextjs`; every request to `127.0.0.1:3000` with `Host`, `X-Real-IP` and `X-Forwarded-For` from `$remote_addr`; no static files from the app folder; rollback with `default`; always `sudo nginx -t` because the server is shared; the `chmod 700 .next` stopgap is harmless but no longer needed); `TRUSTED_CLIENT_IP_HEADER=x-real-ip` is safe because the template overwrites it; the backup script (`~/bin/stadiums-backup.sh`, `pg_dump -Fc`, `umask 077`, size and `pg_restore -l` checks, 14 days in `~/backups`, crontab 03:15, log `~/backups/backup.log`, same server only); the restore test of 2026-10-12 with its steps (temporary database created with `sudo -u postgres createdb -O stadiums_user`, counts and ledger sum compared); pm2 (`pm2-mahmoud` systemd unit, `pm2 save` only when the process list changes); the certificate (manual, `LETSENCRYPT='no'`, DNS at Hostinger, expires 2026-12-24, does not renew; never run `v-list-web-domain-ssl` in a shared terminal). The deploy-order comment about `chmod 700 .next` now says the template makes it unnecessary. `docs/ROADMAP.md`, "Server and schema: open": the nginx template, the database password rotation and the restore test are marked done; added rows for automatic renewal of the wildcard certificate (Cloudflare DNS plus acme.sh, reissue with a new private key because the current one was exposed in a chat, deadline well before 2026-12-24) and an automatic off-server backup copy (before the first real owner).

**Unsure:** the restore steps are written from the description given, not from a recorded session: the exact `pg_restore` flags and the temporary database name were not recorded (marked UNVERIFIED in the RUNBOOK), and the ledger comparison sums `LedgerEntry.amountUsd` by `direction`.

**How to verify:** `npx tsc --noEmit` was the only check run; `test/docs` was NOT run.

## Docs: the certificate notes corrected (branch `feat/platform-admin`)

**When:** 2026-10-12

**What:** Docs only. The previous commit (`9b5b170`) said the `*.lebstads.com` certificate was installed manually, expired on 2026-12-24 and did not renew. That was wrong. `docs/RUNBOOK.md`, "Certificate": the heading and its three bullets are replaced by what was verified on the server on 2026-10-12: certbot (`/opt/certbot`, authenticator `dns-hostinger` with the Hostinger DNS API, credentials in `/root/.secrets/certbot/hostinger.ini`, mode 600 root); root's crontab runs `certbot renew -q --deploy-hook /usr/local/bin/lebstads-cert-deploy.sh` daily at 03:00 and the hook installs the files into Hestia with `v-change-web-domain-sslcert`; Hestia shows `LETSENCRYPT='no'` on purpose (never tick "Use Let's Encrypt" for this domain); the check command `sudo /opt/certbot/bin/certbot renew --dry-run --cert-name lebstads.com`; the key exposed in a chat on 2026-10-12 was replaced (new certificate `cert2`, old `cert1` revoked with reason `keyCompromise`); never run `v-list-web-domain-ssl` or open the Hestia SSL page where others can see it. `docs/ROADMAP.md`: the certificate row is now "done on 2026-10-12" (renewal verified with a dry run, key replaced, old certificate revoked) and no longer says it does not renew; the off-server backup row stays open. Nowhere else in the docs said the certificate does not renew.

**How to verify:** `npx tsc --noEmit` was the only check run; `test/docs` was NOT run. The facts are as given from the server; nothing was checked on it from here.

## Release v1.5.0: feat/platform-admin merged into main

**When:** 2026-10-12

**What:** Merged `feat/platform-admin` into `main` with `--no-ff` (merge commit `34abe48`): the web platform admin (DR-006, slices 1 to 7). Only four docs files conflicted (NOW, ROADMAP, RUNBOOK, progress); no source file. Kept both sides: NOW keeps main's `v1.4.0` live text, ROADMAP keeps the branch's server table with main's phones wording, RUNBOOK keeps the tag rule and the verified pm2 sentence, progress keeps every entry. `docs/NOW.md` "In progress" now says the platform admin ships in `v1.5.0`. No tag was created, moved or pushed.

**How to verify:** `npx tsc --noEmit` was the only check run. No test suite, build or lint was run; the platform integration suites have not been re-run since the shared-request-stubs fix (`f7aa67f`). `test/docs` was NOT run.

## Docs: v1.5.0 is live (branch `main`)

**When:** 2026-10-12

**What:** Docs only. `docs/NOW.md`: the live tag is `v1.5.0` (the web platform admin at `/platform` on the bare domain, with password and authenticator code; stadiums list, detail, create, suspend and resume). The "In progress" section (the platform admin line and the note that deploy waits for the DR-006 preconditions) is removed: the preconditions were all met on 2026-10-12. `docs/ROADMAP.md`: the "Web platform admin" row now says done in `v1.5.0`. No tag was created or moved.

**Unsure:** that v1.5.0 is live and that the preconditions were met is as stated by the owner; nothing was checked on the server. The RUNBOOK "Platform admin" section still lists the DR-006 preconditions as a deploy checklist; it was not changed.

**How to verify:** `npx tsc --noEmit` was the only check run; `test/docs` was NOT run.

## Web platform admin: record a subscription payment (branch `feat/admin-subscriptions`)

**When:** 2026-10-12

**What:** On the stadium detail page, the Subscriptions section has a "Record payment" button that opens a form: plan (filled with the current plan), paid until (the current paid-until plus one month, or today plus one month when there is none, clamped to the month's last day), amount in USD (optional) and note (optional), and one primary "Record payment" button. New `submitRecordSubscription` in `platform/actions.ts`: host guard, then `requirePlatformAdmin`, then the existing `setSubscription` use case (the one behind `subscriptions set`) with actor `admin:<id>`; errors come back as copy keys shown under their field; it revalidates the list and the detail, and the form refreshes the page, so the new row is first in the history and OVERDUE follows the latest row. New: `domain/paid-until.ts` (pure date helpers), `parseRecordSubscription` in `schemas/stadium-actions.ts`, `_components/record-subscription-panel.tsx`, copy for the button and for three errors that had no text (`plan_required`, `amount_invalid`, `note_too_long`; they showed the generic message). **The use case and the CLI did not change.** The use case does not refuse a paid-until in the past (neither does the CLI), so the web accepts one and the stadium stays OVERDUE; a lapsed current paid-until plus one month can itself be in the past, and the admin can change the date. Subscription rows stay append-only.

**Tests:** `test/integration/platform-subscriptions.integration.test.ts` (one Subscription row and one audit row by `admin:<id>`, history order and OVERDUE in the detail and the list, earlier rows untouched, a past date accepted, each input refusal writes nothing, no session refused, off the bare host 404, the CLI path unchanged) and `test/modules/platform/domain/paid-until.test.ts`. **Written and NOT run.**

**Not done:** no page or component test for the form (the form is not rendered by any test); no change to the RUNBOOK or KEY-FILES.

**How to verify:** `npx tsc --noEmit` was the only check run (clean). No test suite, build or lint was run. Run `npm test` and `npm run test:integration`, then record a payment on a stadium in the browser.

## Web platform admin: the paid-until prefill starts from today when it lapsed (branch `feat/admin-subscriptions`)

**When:** 2026-10-12

**What:** `defaultPaidUntil` in `modules/platform/domain/paid-until.ts` is now one month after the LATER of the current paid-until and today (the calendar date in the owner time zone); with no paid-until, one month after today. Before, a lapsed paid-until plus one month could itself be in the past (the quirk noted in the previous entry). The page, the action and the use case did not change. Tests in `test/modules/platform/domain/paid-until.test.ts` replaced for this function: lapsed two months ago, next week, today and none, a month-end case (31 Jan to 28 Feb), and the owner time zone against UTC. **Written and NOT run.** The branch is pushed; not merged.

**How to verify:** `npx tsc --noEmit` was the only check run. No test suite, build or lint was run. Run `npm test`.

## Merge: feat/admin-subscriptions into main (record a subscription payment)

**When:** 2026-10-12

**What:** Merged `feat/admin-subscriptions` into `main` with `--no-ff` (merge commit `e6f89ca`), no conflicts. `docs/NOW.md` gets a section "In the next release" with one line: the admin can record a subscription payment. No tag was created, moved or pushed.

**How to verify:** `npx tsc --noEmit` was the only check run. No test suite, build or lint was run; the new integration and unit tests have never been run.

## Landing page, slice 1: route "/" and "/en" on the bare host (branch `feat/landing`)

**When:** 2026-10-12

**What:** Placeholder only. `src/proxy.ts`: a client-sent `x-lebstads-landing` is always deleted; `www.<base>` gets a 308 to `<APP_PROTOCOL>://<APP_BASE_DOMAIN>` with the same path and query (no tenant lookup), except `/platform`, which stays a 404 there (the platform invariant wins); `/landing` and under it are a 404 on every host; on the bare host `/` is rewritten to `/landing` with the header `ar` and `/en` or `/en/` to `/landing/en` with `en`; tenant hosts are untouched; the landing rewrite does not renew the owner cookie. Helpers `isWwwHostFromHeaders`, `isLandingPath`, `landingRouteFor` in `lib/tenant-slug.ts`; `LANDING_HEADER` and `parseLandingLocale` in `lib/locale.ts`. `src/app/layout.tsx`: `lang` and `dir` follow the header, but only on the bare host and only for `ar` or `en`, otherwise the cookie as before; `generateMetadata` sets `manifest: null` on the bare host. New route group `src/app/(marketing)/landing` (`page.tsx`, `en/page.tsx`, `_components`): host guard (`isBareHostFromHeaders`, else 404), heading "LebStads" and one line through `ui()` with a constant locale, noindex; copy area `landing`. Docs: KEY-FILES entry 1, CODEMAP; `rules.ts` header comment only (no rule changed).

**Unsure:** in Next's metadata merge (`resolve-metadata.js`, `mergeStaticMetadata`) a root `manifest.ts` file is applied after the root layout's `generateMetadata`, so `manifest: null` there does not remove the link; it works from a deeper segment, so the two landing pages set `manifest: null` too. Not confirmed in a running app. `/manifest.webmanifest` itself still answers on the bare host (neutral manifest).

**Tests (written, NOT run):** `test/proxy.test.ts` (landing routes, www, header removal, /landing 404, tenant host unchanged, /platform, invalid host), `test/app/root-layout.test.ts` (lang and dir, manifest), `test/app/marketing-guard.test.ts`.

**How to verify:** `npx tsc --noEmit` only (run before and after the tests were added). No test suite, build or lint was run. Run `npm test`, then open `/` and `/en` on the bare host and check the page source for `<html lang dir>` and no manifest link.

## Landing page, slice 2: content, design, logo and metadata (branch `feat/landing`)

**When:** 2026-10-12

**What:** The two landing pages (`/` Arabic, `/en` English, through the slice 1 rewrite) now have the content: hero with a WhatsApp button, paper versus the app, six features with phone mock-ups, three steps, price ("depends on your stadium, let's talk", no number), a four-question FAQ and a footer with WhatsApp and the AR/EN switch (links to `/` and `/en`). Copy is the `landing` area, simple standard Arabic first, only what is built (no offline, no off-site backups, no prices, no counts). The WhatsApp link is the existing `whatsAppHref` (the name in the request, `whatsAppChatHref`, does not exist) with the number as a constant in `_components/landing-contact.ts` and a short prefilled message per language. Design: the app's tokens and `Container` only (Tailwind token classes, SVG with `fill-primary` and the like; no raw colour, no screenshots), two primary buttons (hero, price) and a secondary one in the footer. Metadata per language: title, description, canonical, hreflang (ar, en, x-default to `/`), Open Graph, Twitter (the `og.png` card only if the file exists; it does not), one inline JSON-LD Organization with a WhatsApp contact point; robots stay noindex and no manifest link. The bare host's favicon and apple-touch icon are static files in `public/brand/lebstads/` (root layout metadata and `favicon.ico/route.ts`, paths in `src/lib/lebstads-brand.ts`); a stadium's host keeps its generated letter logo. `docs/ARCHITECTURE.md` brand paragraph: one sentence.

**Unsure:** the logo inputs were NOT in `public/brand/lebstads/` (no `logo.svg`, no `icon-1024.png`, no `og.png`). I drew `logo.svg` and `icon-1024.png` from the SVG pasted in the request (BRAND = `#D7FF3F`, INK = `#111412`, the neutral brand's values) with sharp, then made `icon-32`, `icon-180` (corners filled with the brand colour: a full square for the OS to round) and `icon-512` from `icon-1024.png`. Replace `icon-1024.png` with the real file and re-run the sizes if it differs. sharp was already installed (Next's optional dependency, not in `package.json`); no dependency was added. `.svg` is not scanned by the accent guard, so its allowlist did not change. The number `96178862587` is read from the request (`<961 78862587>`).

**Tests (written, NOT run):** `test/app/landing/landing-content.test.ts` (headings in both languages, WhatsApp href, switch, no number or claims, tokens only, JSON-LD), `test/app/landing/landing-metadata.test.ts` (canonical, alternates, Open Graph, Twitter, noindex), `test/app/root-layout.test.ts` (icons, PNG sizes), `test/app/favicon-route.test.ts`. The slice 1 guard test is unchanged.

**How to verify:** `npx tsc --noEmit` was the only check run. No test suite, build or lint was run. Run `npm test`, then open `/` and `/en` on the bare host, in both themes and on a phone, and check the tab icon.

## Landing page: a Stravon Solutions footer link (branch `feat/landing`)

**When:** 2026-10-12

**What:** The landing footer (both languages) has one more line, "LebStads × Stravon Solutions", where "Stravon Solutions" links to `https://stravonsolutions.com` (same tab, `rel="noopener"`, no parameters). New `_components/stravon-credit.tsx`: the line is one `LtrIsolate`, so it reads correctly in the Arabic page; muted text, the name in the foreground colour with an underline; the name is copy key `landing.stravonName` (Latin letters in both languages). Their logo is shown (about 20px high, `alt="Stravon Solutions"`, before the name) only if `public/brand/stravon/logo.svg` or `logo.png` exists; it does not exist, so the line is text only, and nothing was drawn. No "by", "powered by", partnership or support wording anywhere, and nothing about them in the JSON-LD or the metadata.

**Tests (written, NOT run):** `test/app/landing/landing-stravon.test.ts` (the exact link in both languages, same tab and no parameters, the logo only when the file exists, no other mention in the page text, no JSON-LD or metadata entry).

**How to verify:** `npx tsc --noEmit` was the only check run. No test suite, build or lint was run. Run `npm test`, then look at the footer of `/` and `/en`, in both themes.

## Landing page, slice 3: robots.txt, sitemap.xml, indexing (branch `feat/landing`)

**When:** 2026-10-12

**What:** `src/app/robots.ts` and `src/app/sitemap.ts` read the host themselves (`hostAudience` in `lib/tenant-slug.ts`: bare, tenant or other; strict, `www` is never a stadium). robots: bare host allows `/` and names `https://<base>/sitemap.xml`, with no `/platform` in any line (a Disallow would advertise it; it keeps its `noindex, nofollow`, `no-store` and the layout's robots meta); a stadium's host allows `/`, disallows `/owner/`, no Sitemap; www or anything else disallows all. sitemap: bare host lists `/` and `/en` with `ar` and `en` alternates; any other host an empty sitemap. No database query. The two landing pages no longer say noindex (canonical and hreflang kept; `x-default` stays in the page metadata, the sitemap carries `ar` and `en` as asked). `bareUrl` moved to `lib/bare-url.ts` (`landingUrl` is the same function). `robots` and `sitemap` were already in `APP_CONVENTION_NAMES` (`rules.ts`), checked, no change. Through the proxy, `www` gets a 308 to the bare domain before it reaches robots.txt, so the "disallow all" answer is for a request the proxy did not see.

**Unsure:** a stadium's host now serves a robots.txt (before: a 404); the public page there stays as it was.

**Tests (written, NOT run):** `test/app/robots-sitemap.test.ts` (robots and sitemap by host, no database imports, convention names, landing metadata has no robots, `/platform` still noindex); `landing-metadata.test.ts` updated from noindex to indexable.

**How to verify:** `npx tsc --noEmit` was the only check run. No test suite, build or lint was run. Run `npm test`, then open `/robots.txt` and `/sitemap.xml` on the bare host and on a stadium's host.

## Landing page redesign: copy, header, hero, sections, footer (branch `feat/landing`)

**When:** 2026-10-12

**What:** The landing page (same routes, metadata, canonical, hreflang, JSON-LD, robots, sitemap and WhatsApp constant) is redesigned. A sticky slim header (translucent `bg-background/80`, hairline below): mark and name at the start; from 1024px the links to `#features`, `#how`, `#pricing`, `#faq`; at the end the language switch (the other language only) and a small WhatsApp button, icon only below 640px with its `aria-label`, with the text from 640px. Hero: two columns from 1024px (the text, then a phone drawn in HTML and CSS with the app's tokens: a Today screen with a new request, a confirmed game and an amber "To collect" row, with made-up names); stacked below. The "Paper or the app?" section is removed. New "How a day runs" (`#how`, three numbered steps), the six features (`#features`, the current phone mock-up cards are kept as they were liked, with the new one-line titles and texts), pricing (`#pricing`, one centred card, 560px), FAQ (`#faq`, 720px, same four questions), a closing band, and a footer centred on every width: mark and name, "LebStads × Stravon Solutions" (unchanged), WhatsApp and the language switch, "© 2026 LebStads". The column is 1120px with 20px padding (`PageColumn`, not the owner `Container`), sections 64px on phones and 96px from 1024px, text lines at most 60ch, tap targets 44px, logical properties and tokens only. Copy: exactly the brief's text (AR then EN) through `ui()`. Files: new `landing-header.tsx`, `landing-hero.tsx`, `hero-phone.tsx`, `landing-footer.tsx`, `language-link.tsx`, `page-column.tsx`; rewritten `landing-sections.tsx`, `landing-content.tsx`, `lib/copy/landing.ts`; the test `landing-content.test.ts`.

**Copy keys removed:** `landing.paperTitle`, `paperHeading`, `appHeading`, `paper1` to `paper3`, `app1` to `app3`, `footerContact`. **Added:** `navLabel`, `navFeatures`, `navHow`, `navPricing`, `navFaq`, `heroSecondary`, `mockToday`, `mockNew`, `mockApprove`, `mockReject`, `mockConfirmed`, `mockToCollect`, `mockPitch1`, `mockPitch2`, `mockPlayer1` to `mockPlayer3`, `mockTime1`, `mockTime2`, `mockAmount`, `closingTitle`, `copyright`. Changed text: `whatsappCta`, `heroTitle`, `heroSub`, the steps, the features, `priceTitle`, `priceText`.

**Unsure:** layout at 360, 390, 768 and 1280px was checked by reasoning only (header: logo, name, language link and a 44px icon button come to about 250px of the 320px available at 360px), not in a browser. The header's WhatsApp button is a secondary style so each area keeps one primary button (hero, pricing and the closing band each have one). The feature mock-ups were kept instead of the brief's per-card icons, as asked.

**Tests (written, NOT run):** `test/app/landing/landing-content.test.ts` (headings and ids in both languages, no Paper text or keys, header, footer, WhatsApp links, responsive classes, tokens only, JSON-LD). `landing-stravon.test.ts`, the metadata, robots and sitemap tests are unchanged.

**How to verify:** `npx tsc --noEmit` was the only check run. No test suite, build or lint was run. Run `npm test`, then look at `/` and `/en` at 360, 390, 768 and 1280px, in both themes.

## Merge: feat/landing into main for v1.7.0 (the landing page)

**When:** 2026-10-12

**What:** Merged `feat/landing` into `main` with `--no-ff`, no conflicts: the landing page slices 1 to 3, the Stravon footer link and the redesign. `docs/NOW.md`: the "next release" section becomes "Tagged after `v1.5.0`" with `v1.6.0` (subscription payment, tagged by the owner) and `v1.7.0` (landing page). The tag `v1.7.0` is created only after CI is green on the pushed head; no existing tag was touched.

**How to verify:** `npx tsc --noEmit` was the only check run locally. No test suite, build or lint was run here: the landing tests were written and never run, so the first run is CI on `main`.

## Fix: the five landing test failures from CI on main (after v1.7.0)

**When:** 2026-10-12

**What:** CI on `c95360a` (tagged `v1.7.0`) failed 4 tests and 2 suites, all in the landing tests written and never run. (1) `src/proxy.ts`: the rewrite of `/en/` kept the trailing slash (`/landing/en/`); the target is now built with `new URL(landing.rewriteTo, request.url)`, so it is exactly `/landing/en` for `/en` and `/en/` (a real, if small, behaviour fix). (2) `landing-content.test.ts` and `landing-stravon.test.ts` rendered the page while the describe blocks were collected, before `beforeAll` set `APP_BASE_DOMAIN`, so the JSON-LD URLs were `https:///`; the env is now set at module level. (3) `root-layout.test.ts` and `favicon-route.test.ts`: `jest.mock("@/app/brand/current-brand")` did not resolve; they mock it by relative path. (4) `public-metadata.test.ts` still expected `lang={htmlLang(locale)}` in the root layout; it now expects `pageLocale`. Nothing else changed.

**Tag:** `v1.7.0` points at the failing commit and was not moved. The fix needs a new tag number.

**How to verify:** `npx tsc --noEmit` clean. I ran only the affected test files (proxy, landing, root layout, favicon, robots and sitemap, marketing guard, public metadata): 9 suites, 112 tests, all passed. The full suite, the build and lint were not run here; CI on this commit is the full run.

## Fix: the landing rewrite is an internal rewrite again (branch `fix/landing-rewrite-origin`)

**When:** 2026-10-12

**What:** In production, behind nginx (`X-Forwarded-Proto: https`, the app on plain http), the rewrite of `/` to `/landing` was treated as an external rewrite to `https://localhost:3000/landing` and failed with EPROTO. Next treats a rewrite whose target has another origin as external. `src/proxy.ts` now builds the target from `request.nextUrl.clone()` and sets its path, keeping the search; never from `request.url`, a host header or `APP_PROTOCOL`. Before: `const url = new URL(landing.rewriteTo, request.url); url.search = request.nextUrl.search;` (after `a16ddef`; `c95360a` and `v1.7.0` used a clone). After: `const url = request.nextUrl.clone(); url.pathname = landing.rewriteTo; url.href = ...own origin, pathname and search...`. The `href` line is there because `NextURL` keeps the trailing slash of the request path (`/en/` became `/landing/en/`, the CI failure fixed in `a16ddef`); it re-parses the clone's own origin, so the origin cannot change. The request header `x-lebstads-landing` and the www redirect (a redirect, built from `APP_PROTOCOL` and `APP_BASE_DOMAIN`) are unchanged. The only `NextResponse.rewrite` in `src` is this one; no other file has the problem. No tag was created or moved.

**Tests (written, NOT run):** `test/proxy.test.ts`, new describe "proxy landing rewrite stays internal": a request with `x-forwarded-proto: https` and `nextUrl` `http://127.0.0.1:3000/` gets a target with the same origin and the path `/landing` (`/landing/en` for `/en` and `/en/`), the query is kept, and the proxy function builds no target from `request.url`, `new URL(` or `APP_PROTOCOL`. The existing proxy tests are unchanged.

**How to verify:** `npx tsc --noEmit` was the only check run. No test suite, build or lint was run. Run `npm test`; after deploying, open `/` and `/en` on the bare domain.

## Merge: fix/landing-rewrite-origin into main for v1.7.1

**When:** 2026-10-12

**What:** Merged `fix/landing-rewrite-origin` into `main` with `--no-ff`, no conflicts: the internal landing rewrite and its tests. `docs/NOW.md` lists `v1.7.1` and says `v1.7.0` (tagged on a commit whose CI run failed) was not moved and is superseded. The tag `v1.7.1` is created on the pushed head of `main`.

**How to verify:** `npx tsc --noEmit` was the only check run for this merge. No test suite, build or lint was run here; CI on `main` is the full run.

## Fix: two proxy test mistakes found by CI on v1.7.1 (test only)

**When:** 2026-10-12

**What:** CI on `a3644ac` (tagged `v1.7.1`) failed 2 tests in `test/proxy.test.ts`, both mistakes in the new "landing rewrite stays internal" tests, not in `src/proxy.ts`. (1) The test expected the origin `http://127.0.0.1:3000`, but `NextRequest` writes the host as `localhost:3000`; it now only checks the target has the request's own origin and not the forwarded `https`. (2) The source check sliced the proxy function up to the next function and so included the redirect's doc comment, which names `APP_PROTOCOL`; it now strips block comments as well as line comments. The code of the rewrite is unchanged. `v1.7.1` was not moved; it contains the correct fix but its CI run was red because of these tests.

**How to verify:** `npx tsc --noEmit` was not needed (test only). I ran the whole unit suite once with `npx jest`: 163 suites, 1493 tests, all passed. The build, lint and the integration tests were not run.

## Fix: the landing rewrite moves from the proxy to next.config.ts (branch `fix/landing-rewrite`)

**When:** 2026-10-13

**What:** In production, behind nginx, every proxy rewrite of the bare host's `/` and `/en` was treated as an external rewrite (to `https://localhost:3000/landing`) and failed with EPROTO; the three earlier versions (`c311f01` a `nextUrl` clone, `a16ddef` `new URL(path, request.url)`, `6a916e6` a clone re-parsed from its own origin) all built the target from the proxy's request URL, which Next builds from `X-Forwarded-Proto` and its own host name, not the `Host` the router compares with. The local docs (`03-file-conventions/proxy.md`, "Execution order") put the proxy (3) before `beforeFiles` rewrites (4), and `rewrites.md` says a `host` value is "a regex like string"; Next's `matchHas` reads the `Host` header without its port, lower-cased, and wraps the value in `^...$`. So `next.config.ts` now has `rewrites().beforeFiles`: `/` to `/landing` and `/en` to `/landing/en`, each with `has: [{ type: "host", value: <APP_BASE_DOMAIN without port, dots escaped> }]` (`landingRewrites`, exported for the test); no entry when `APP_BASE_DOMAIN` is missing at build time. `src/proxy.ts` no longer rewrites: for the bare host's `/` and `/en` it returns `NextResponse.next` with `x-lebstads-landing` set. Unchanged: the deletion of a client-sent header on every request, the 404 for a direct `/landing` on every host (the proxy sees the original path), the www redirect, `/platform`, the host check, `x-tenant-slug` and the cookie renewal. Docs: KEY-FILES entry 1; RUNBOOK "Check after the restart" adds the two `curl` checks (200 on `/` and `/en`) and says that changing `APP_BASE_DOMAIN` needs a rebuild.

**Unsure:** not confirmed on the server. `beforeFiles` matches the real `Host` header (nginx sets it to `$host`); a request whose `Host` is not the bare domain is not rewritten, whatever `X-Forwarded-Host` says.

**Tests (written, NOT run):** `test/proxy.test.ts` (the bare host's `/` and `/en` pass through with the header, behind nginx too; no `NextResponse.rewrite` in `src/proxy.ts`; the old "stays internal" tests are replaced); `test/next-config-rewrites.test.ts` (exactly two entries, the escaped host, port dropped, bare host only, none without `APP_BASE_DOMAIN`).

**How to verify:** `npx tsc --noEmit` was the only check run. No test suite, build or lint was run. After deploying: the two `curl` checks in the RUNBOOK.

## Landing page: hero band, pitch lines, shorter top copy, compact on phones (branch `feat/landing-polish`)

**When:** 2026-10-13

**What:** The hero is now a full-width band with the public page's soft gradient (a tint of the accent to the page background, as a Tailwind arbitrary value from tokens, no inline style) and half a football pitch drawn in thin lines behind it at the end side (`_components/pitch-lines.tsx`, `currentColor` at 7% opacity, so it works in both themes and mirrors in RTL). A small eyebrow pill ("For football stadiums in Lebanon", key `landing.heroEyebrow`). Shorter copy: the headline, the sub-line and the three steps (titles and texts). Smaller on phones: headline 28px (36px from 640px, 48px from 1024px), sections 48px of space (96px from 1024px), headings 20px, the hero phone 240px wide, the feature mock-ups 144px tall, the steps as one compact row each (number beside the text) below 1024px. Cards get rounded-2xl and a soft shadow; the closing band takes the same gradient. Nothing else changed (routes, metadata, rewrites, WhatsApp links).

**Tests:** `landing-content.test.ts` updated (new headline, 48px sections, hero band). Ran `npx jest test/app test/architecture test/lib/copy test/proxy.test.ts`: 28 suites, 220 tests, passed. `npx tsc --noEmit` clean. Build and lint not run. Not looked at in a browser.

## Landing page: not only football (branch `feat/landing-polish`)

**When:** 2026-10-13

**What:** The hero pill now names football, padel and basketball (`landing.heroEyebrow`): the app books any sport with hourly slots, not only football. The rest of the copy already said "stadium" and "pitch" without naming a sport. The background shape is still half a football pitch.

**How to verify:** `npx tsc --noEmit` and `npx jest test/app/landing test/lib/copy` passed.

## Landing page: the hero fits a phone screen (branch `feat/landing-polish`)

**When:** 2026-10-13

**What:** Below 640px the hero's example is a full-width card instead of a narrow phone frame (the frame, its notch and the confirmed game come back from 640px), so the words are no longer squeezed; it shows the new request and the "To collect" row. Less height: tighter padding and gaps, a 26px headline, a smaller sub-line, and the "See how it works" link hidden on phones (the header and the page below still lead there). From 640px nothing changed.

**How to verify:** `npx tsc --noEmit` and the landing tests passed. Not looked at on a phone.

## Landing page: shorter WhatsApp button, footer links, plain Stravon line (branch `feat/landing-polish`)

**When:** 2026-10-13

**What:** The hero sub-line and the third step no longer name dollars and pounds (the features still do), and the hero pill no longer lists sports ("For venue owners in Lebanon" / "لأصحاب الملاعب في لبنان"). The WhatsApp button says one word with an icon ("WhatsApp" / "واتساب") and appears less: the header, the hero and the closing band (not in pricing any more). The footer has no big button: small links to Instagram (`@lebstads`, `https://www.instagram.com/lebstads/`), WhatsApp (the same number and message) and the other language. "LebStads × Stravon Solutions" is plain text, no link and no logo code. Copy keys added: `footerInstagram`, `footerWhatsapp`; changed: `whatsappCta`, `heroEyebrow`, `heroSub`, `step3Text`.

**How to verify:** `npx tsc --noEmit` and the landing tests passed. Not looked at in a browser.

## Landing page: no WhatsApp button in the hero (branch `feat/landing-polish`)

**When:** 2026-10-13

**What:** The hero has no WhatsApp button; its only action is the "See how it works" link (now shown on phones too). WhatsApp stays in the header (small), the closing band and the footer links.

**How to verify:** `npx tsc --noEmit` and the landing tests passed.

## Landing page: a snapshot of a stadium's public page (branch `feat/landing-polish`)

**When:** 2026-10-13

**What:** New section after "How a day runs" (`id="page"`): the title "Your stadium's booking page" with one line, and a drawn snapshot of the public page (`_components/public-page-preview.tsx`, HTML and CSS with tokens, aria-hidden, no screenshot): the header band with the accent gradient, a letter logo, a sample name and address, the Map / Call / WhatsApp bar, three day pills with availability dots, and five hours (one "Nearest", two taken and faded, "Request" on the free ones). Sample data only. Copy keys `landing.pageTitle`, `pageText` and the `landing.preview*` keys.

**How to verify:** `npx tsc --noEmit` and the landing tests passed. Not looked at in a browser.

## Landing page: the snapshot uses placeholder names (branch `feat/landing-polish`)

**When:** 2026-10-13

**What:** The public page snapshot shows "Your Arena" / "ملعبك" with "Your address" / "عنوان ملعبك" and the letter Y / م, instead of a made-up stadium name and a real neighbourhood.

## Landing page: the public page snapshot uses the public page's own pieces (branch `feat/landing-polish`)

**When:** 2026-10-13

**What:** The snapshot is rebuilt from the public page's own classes and copy: the header band's gradient and pitch arc (`PitchArc`), the display-face name, the address with a map pin, the action bar (Map, Call, WhatsApp with their icons and dividers), the day tabs (`dayTabClass`, weekday, date and the availability dots), "Available times", and the time rows in one bordered list with the "Nearest" pill and the faded "Taken" rows (chevrons, no buttons). Copy reuses the `public.*` keys; the landing keeps only the placeholder name, address, logo letter and four weekday names (`previewDay2` to `previewDay5`; the Map, Call, WhatsApp, Nearest, Taken, Request and Day1/Day3 preview keys are removed).

**How to verify:** `npx tsc --noEmit` and the landing tests passed. Not looked at in a browser.

## Merge: feat/landing-polish into main for v1.7.4

**When:** 2026-10-13

**What:** Merged `feat/landing-polish` into `main` with `--no-ff`, no conflicts. `docs/NOW.md` lists `v1.7.4`. The tag `v1.7.4` is created on the pushed head.

**How to verify:** `npx tsc --noEmit` and the whole unit suite (`npx jest`) were run before tagging. Build, lint and integration tests not run.

## Status pages: 404, error and server error in the app's look (branch `feat/status-pages`)

**When:** 2026-10-13

**What:** One frame for the three status pages (`src/components/shell/status-page.tsx`): full height, the public page's soft accent gradient, a pitch's centre circle and halfway line in thin lines behind, one centred column, Arabic headline and line first with the English line under it, a primary action and at most one quiet one; tokens only. `error.tsx` (render failure) and `global-error.tsx` (the server could not build the frame) no longer show the error digest (the "weird number"; it stays in the server log) and `global-error.tsx` no longer uses raw grey hex colours. New `src/app/not-found.tsx`: a large "404" in the display face, the copy through `ui()` (`notFound.title`, `notFound.line`, `notFound.home` in the common area), and a link to `/` (the stadium's page or the landing page); noindex. Before, a 404 was Next's default page.

**Tests:** `test/app/status-pages.test.ts` (both languages, no digest or message, the gradient, 404 and the home link, no raw colours). `npx tsc --noEmit` and `npx jest test/app test/architecture test/lib` passed. Not looked at in a browser.

## Status pages: back to where the visitor was, compact buttons (branch `feat/status-pages`)

**When:** 2026-10-13

**What:** The 404 page's action is "رجوع · Go back" (back in this tab's history, so an owner stays in the owner app; "/" only when there is no earlier page), not a link to the home page, which sent an owner to the public page. Shared `components/shell/back-button.tsx` (with a chevron that flips in RTL), also used by the error page. The buttons are compact pills: 44px high, as wide as their label, a soft hover and a slight press (no motion with reduced motion). Copy key `notFound.home` becomes `notFound.back`.

**Tests:** `status-pages.test.ts` updated; `npx tsc --noEmit` and the app tests passed.

## Landing page: the "For venue owners in Lebanon" line moves to the footer (branch `feat/landing-tagline`)

**When:** 2026-10-13

**What:** The pill above the hero headline is removed; the same line is now a plain tagline under the logo and name in the footer (small muted text). The hero starts with the headline.

**Tests:** `landing-content.test.ts` updated; `npx tsc --noEmit` and the landing tests passed.

## Learning guide: the owner approves a booking request (branch `docs/learning-approve`)

**When:** 2026-10-13

**What:** New `docs/learning/approve-a-request.md`, listed under "Start here" in `docs/README.md`: one feature end to end (the public request as a prologue, then `approveBooking`) for a developer who knows Laravel and Vue. Laravel-to-Next map, step-by-step request, server vs client components, tenant isolation, the tables and the `Booking_approved_during_excl` constraint with ER and race diagrams, lock order, errors, the tests, the decisions, 12 hard questions, 6 exercises and a glossary. Every claim cites `file:line`; points not traced in code are marked UNVERIFIED. No code changed.

**Tests:** none run (docs only, not a living doc checked by `test/docs`).

## Owner Help page under More (branch `feat/owner-help`)

**When:** 2026-10-14

**What:** New `/owner/more/help` (Server Component, no client JavaScript) and a Help row at the end of the More hub. Ten groups and 32 topics, each a closed native `<details>`: what it does, a "Where" link to the real screen, at most 3 steps, one "Good to know" line for a real pitfall (split before collecting, expenses and sales cannot be edited, items from 60 minutes before a game, Cancel the rest keeps weeks with a payment, the frozen exchange rate, iPhone notifications need the Home Screen, and others). Every rule was checked in the code. Topics are hidden when the member lacks the permission the real screen checks (`can()`); Notifications shows only when push is configured. A WhatsApp support line ends the page, with a message naming the stadium. The support number moved to `src/lib/support-contact.ts`; the landing page's `LEBSTADS_WHATSAPP` now reads it (same value). Copy area `src/lib/copy/help.ts`, Arabic first. `docs/owner-ia.md` updated.

**Tests:** `test/app/owner/help-page.test.ts` written and **not run**. Only `npx tsc --noEmit` was run (clean).
