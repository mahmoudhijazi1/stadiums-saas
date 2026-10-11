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
