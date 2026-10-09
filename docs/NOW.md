# Where this project stands

**Read this first.** Everything else under `docs/` is reachable from here — not duplicated into this page.

## Status

SPEC-01…14 are shipped on `main`: multi-tenant proxy → Prisma tenant guard (with RULE-7 isolation integration tests), public PENDING slot request, owner Today / Book / Waitlist / Money / Settings (Arabic-first + cookie EN/ع on public and owner), cash collect / expense / ledger period, no-show, waitlist WhatsApp prepare links.

Shipped since (details and dates in `progress.md`):

- **UX-01** ([owner-ux.md](./owner-ux.md)) — shell (header, business sheet, offline pill, Today / Requests / Money / More (the ＋ was removed 2026-10-10: a shop button beside search opens the counter), `lg` rail), More hub, Today request banner and card states, Requests tab (slot interests, reject chips, approve notify sheet, missed requests, "starts soon" flag, precise relative time, live badge with 20s poll).
- **UX-02** ([ux-02-history.md](./ux-02-history.md)) slices 1–2 — Beirut day navigation + `summarizeDay` line; person page + header search results.
- **SPEC-15** slices 1–2 — per-player foundation (`collectionMode`, `Booking.amountDueUsd`, `splitEvenly` / `personOwedOnBooking`), then per-player mode: `Pitch.defaultPlayerCount` (1–30, default 10), switch Whole ⇄ Per player in the booking sheet, slot list with one-tap USD pay, "Booker pays all remaining", "N of M paid". P1–P5 settled at the spec defaults.
- **SPEC-16** slices 1–3 — `BookingDueChange` log + `adjustDue`, fee suggestions from tenant policy, cancel / no-show / adjust sheets and Booking rules settings, request-card debt warning, public policy line, WhatsApp fee text.
- **Today free-slot strip (2026-10-01)** — one line per pitch of time chips for what is still free (start after now, not overlapped by an APPROVED booking; PENDING keeps the chip and adds a count). Tap opens the same booking sheet as Book, prefilled, and returns to Today. Chips show a price only when it differs from the pitch default; without `bookings.create` they show and do nothing. To collect became one amber row ("N games to collect · $X") that expands to the same cards. Past days show no strip; a day with no hours shows "Closed". Three batched reads, in their own Suspense. Trade-off: a window that starts after midnight (e.g. 00:00–06:00 on Saturday) is listed under Saturday, its window day, while its bookings sit on Friday.
- **Account self-service (2026-10-08)** — More → Account: change your own password (shared policy with the operator scripts; other sessions are logged out), log out other devices, change the part of your login before the `@`. Any role, own credentials only; wrong-password attempts counted separately from login (5 in 15 minutes). See [RUNBOOK.md](./RUNBOOK.md) "Owner account self-service".
- **Type roles (2026-10-08)** — nine role classes (`type-title`, `type-body`, `type-label`, ...) built from 12/14/16/20 px and weights 400/600 in `globals.css`; More, its sheets and the pitch editor use them, with one `SettingsSection`/`SettingsRow` for every list and a guard test against raw sizes and weights ([ui-rules.md](./ui-rules.md) rule 7 amended). Pitch editor: one line per day, just the switch (no Open/Closed word), the two times as a range.
- **Money tab refactor (2026-10-09)** — period chip and a profit/loss headline with a comparison; Activity replaces the expenses list (every ledger movement, by day, filters, keyset paging, one mapping per source type with a generic fallback); an amber "Owed to you" card and `/owner/money/owed` (by person, WhatsApp reminders). reports.view is checked inside every use case. Details: [ux-02-history.md](./ux-02-history.md) §5 note and progress.md.
- **Public page QR (2026-10-09)** — the QR button in the business menu opens a sheet with the real QR of the public page (generated on the server by `GET /owner/qr?format=svg|png`, any logged-in role), Share (native share sheet with the PNG, download as a fallback), Download PNG, and a printable A4 poster at `/owner/qr/print` (outside the app shell, Arabic and English). The Copy, WhatsApp and QR buttons all use the same canonical link, `publicPageUrl(slug)`. See [RUNBOOK.md](./RUNBOOK.md) "Public page QR".
- **Mini shop, slice 1 (2026-10-09, branch `feat/shop-slice-1`)** — More → Shop: the item catalog (owner only, `shop.manage`; archive instead of delete). The "+" sheet gets **Sell** (`shop.sell`, which existing staff were granted by the migration): tap items, Collect, pay in USD / LBP; the sale, its lines, the SALE payment and the ledger entry are one transaction and the price always comes from the server. Money gets a **Shop card** (Sales and Supplies for the period, plus the per-item list; never a profit) and sales appear in Activity as "Shop · N items" with a sheet. New expense category **Shop supplies**. The "+" button had been hidden on purpose (`HIDE_RECORD` in `tab-bar.tsx`); it is shown again because Sell lives in its sheet. See progress.md parts 1 to 3.
- **Mini shop, slice 2: items on a game (2026-10-10, branch `feat/shop-slice-1`)** — in the booking sheet, "Add items" charges a game's items to a **tab**: "On the game (booker)", a named player, a found person or a typed name. A tab is paid on its own with Collect and never changes the game amount or a slot. Unpaid tabs count in the Today pill, the earlier-debts section, the Owed page and Money's "Owed to you". Removing an item (needs adjust due) is allowed only while the tab has no payment. Cancel, no-show and the split ignore tabs; they stay owed. See progress.md part 5.
- **Shop items in LBP (2026-10-10)** — an item is priced in pounds (the default in the item sheet, switch "ل.ل | $") or dollars. Tiles, sale totals and tabs show the item's own currency ("20,000 ل.ل", "60,000 ل.ل + $1.50"); the tender sheet is prefilled with exactly those parts. What is owed stays in the currency of the item, so a rate change never changes the pounds owed; reports, the ledger and every total stay in USD from the value frozen when the item was added. Without an exchange rate, LBP items cannot be sold ("Set the exchange rate first"). See [domain/money.md](./domain/money.md).
- **Change at the counter (2026-10-10)** — a walk-in sale or a tab collection no longer records cash beyond what is owed: the last tender is reduced and the sheet and the toast say "Change: X" in the currency it was handed over in. Booking collection is unchanged.
- **Push notifications, slice A (2026-10-11, branch `feat/push-foundation`)** — More → Notifications: enable web push on this device, send yourself a test, turn off. Foundation only: the `push` module (endpoint allowlist, payload, `PushSender` port), the `PushSubscription` table tied to the login session by cascade, VAPID keys required in production, service worker `push` and `notificationclick` handlers. No booking hook in slice A; slice B (below) adds the alert. Guide: [push-notifications.md](./push-notifications.md); keys: [RUNBOOK.md](./RUNBOOK.md) "Push keys". Delivery to a real phone is not yet verified.
- **Extend a booking by 30 minutes (2026-10-12, branch `feat/extend-booking`)** — in the booking sheet, "Extend 30 min" on a confirmed, whole-pay game that has not ended: repeatable up to 3 hours in total, refused when another confirmed game starts before the new end or the new end passes closing time (shown as a disabled button with the reason). Pending requests inside the added time are declined and kept as interests (the confirm step says how many). The price rises proportionally (`priceUsd / minutes x 30`) through a due change with the new reason `EXTENSION`; a member with `bookings.adjust_due` may edit it. New permission `bookings.extend` (owner yes, staff default off). A double tap adds 30 minutes once (`expectedEndsAt`). Rules: [domain/money.md](./domain/money.md) §4, lock order: [ARCHITECTURE.md](./ARCHITECTURE.md) §6. **Written but its tests were not run**; the migration is not applied anywhere yet.
- **Security fixes** (PRs #7–#11) — audit S-1…S-18 fixed or deferred with reasons ([audits/security-audit.md](./audits/security-audit.md), status addendum): random hashed session tokens, rolling 30-day session, login and public request limits, strict hosts, security headers, env validation, localhost-only server.
- **Tenant management** — platform operator CLI `scripts/platform.ts` (tenants list / create / suspend / resume, subscriptions set), append-only `PlatformAuditLog` and `Subscription`, suspension enforced at the tenant choke point (`/owner/suspended`, neutral public page). Plans are a label only (BR-103 partial by decision). See [RUNBOOK.md](./RUNBOOK.md) "Tenant management".
- **Design system** ([MIGRATION.md](./MIGRATION.md)) — token layer, typography, responsive shell. Component restyles still open there.

That is still the scoped product slice — **not** full Phase 1 BRD (no group pay or mixed currency per player, pitch blocks, plan limits or pricing, etc.). Honest line for a paying owner: pilot-with-supervision, not production-ready — see the MVP readiness audit.

## Start here by topic

| Need | Go to |
|------|--------|
| Product rules / phases | [requirements/brd.md](./requirements/brd.md) |
| Why architecture | [decisions/](./decisions/) (esp. DR-001, DR-002) |
| How a slice was built | [specs/SPEC-NN](./specs/) (historical — do not rewrite bodies) |
| Owner UX structure (wins on conflict) | [owner-ux.md](./owner-ux.md) (UX-01), [ux-02-history.md](./ux-02-history.md) (UX-02) |
| Owner tabs / routes | [owner-ia.md](./owner-ia.md) |
| Per-player split, slot pay, cancel / no-show on a split booking | [per-player-payments.md](./per-player-payments.md) (living, as built) |
| Visual design | [ui-foundations.md](./ui-foundations.md), [ui-components.md](./ui-components.md), [ui-rules.md](./ui-rules.md), [theme.md](./theme.md), [MIGRATION.md](./MIGRATION.md) |
| Current file tree | [guides/folder-structure.md](./guides/folder-structure.md) |
| Module roles + request walks | [guides/module-map-and-request-walkthroughs.md](./guides/module-map-and-request-walkthroughs.md) |
| Mentor oral map | [guides/mentor-defense-backend.md](./guides/mentor-defense-backend.md) |
| Tests / Docker Postgres | [guides/testing-jest.md](./guides/testing-jest.md) |
| Journey / defend a choice | [progress.md](./progress.md) |
| Docs catalog (all DRs/SPECs/guides) | [README.md](./README.md) |
| Launch gaps / ordered backlog | [guides/mvp-readiness-audit.md](./guides/mvp-readiness-audit.md) (dated; read the banner) |
| Known open logic items (not product slices) | [ROADMAP.md](./ROADMAP.md), details in [audits/logic-findings.md](./audits/logic-findings.md) |
| Security audit (findings, server checklist) | [audits/security-audit.md](./audits/security-audit.md); open items in [ROADMAP.md](./ROADMAP.md) from #5 |
| Operator procedures (passwords, tenants, hosts, env) | [RUNBOOK.md](./RUNBOOK.md) |

## What’s next

**Business day, 2026-09-30:** a game belongs to the business day it starts in, and a business day runs **06:00 to 06:00 Beirut** (`businessDate` in `booking/domain/business-day.ts`, `BUSINESS_DAY_ROLLOVER_HOUR = 6`). A game at 00:30 Saturday is on **Friday** in Today, the day strip and the day summary. Before 06:00, Today opens on the previous business date and shows "After midnight: Today runs until 6:00 AM." Cards, person rows and WhatsApp keep the real date and clock, plus "night of Friday" / "ليلة الجمعة" for a 00:00–05:59 start.
- **Money is different on purpose:** the ledger and the Money tab bucket cash by the **calendar day of the payment**. A payment taken at 00:45 for Friday night's game counts on **Saturday** in Money and on **Friday** in Today.
- **Trade-offs:** a stadium that opens before 06:00 (a 05:00 game) would see that game on the previous day; that needs the owner to set an earlier start: since 2026-10-08 the day start is a per-tenant setting (`dayStartHour`, 0 to 6, default 6, no migration; More → Business → Booking rules, or `tenants create --day-start-hour`). Everything above says 06:00 for a tenant on the default. The schedule engine still lists slots under the day of their hours window. The public page and the Book page open on the business date too (2026-09-30), so between 00:00 and 06:00 the rest of last night's window is still on their "Today" chip; started slots are never offered. Instant rules (live, ended, owed, missed requests, cancel and no-show windows) are unchanged.

**Rule, 2026-09-30:** Cancel is offered only **before the game starts**, paid or not. BR-26 "at any time" is read as "any time before the game starts". After the start, No-show is the way to say it did not happen (BR-22).

**Known gap:** there is no clean path today for an owner-initiated "it rained, refund or waive a prepaid game" once the game has started. Cancel is closed after the start, Adjust amount cannot go below what was collected, and refunds are out of scope. Revisit later, possibly as a no-show variant with a $0 default fee suggestion rather than by touching cancel.

**Per-player split is now a tenant setting (2026-10-07), off by default** (Booking rules sheet, `perPlayerSplitEnabled`). Off hides the switch and the pitch "Players per game" field and refuses `switchToPerPlayer`; bookings already split keep working. See [per-player-payments.md](./per-player-payments.md).

**Product, next up:** SPEC-15 slices 3–5 (pay together + mixed currency, naming unpaid slots + due editing, assign Unassigned + "Same as last time"). Cancel and no-show on a per-player booking collapse it to whole. Per-player split is offered only after the game has ended (intentional for now), so in the UI the collapse runs on no-show only; cancel can no longer reach it (see the cancel rule below). Details in [per-player-payments.md](./per-player-payments.md).

**Push, slice B (2026-10-11, branch `feat/push-new-request`):** a player's new public request alerts every device of the members who may approve (`bookings.approve`), generic text in each device's language, at most one alert per device per 120 s (a skipped one is merged into the next count). Composed in `app/(public)/alert-owners.ts`, scheduled with `after()`. **Written but its tests were not run**, and no push has been received on a real device: run the checks in [push-notifications.md](./push-notifications.md). Later: other alert kinds, a badge on the app icon from the worker, offline level 1 ([ROADMAP.md](./ROADMAP.md)).

**Product, next (shop):** later, each its own spec: stock counts, lot purchases and cost, variants, a public price list, voiding a sale (needs the expense-void spec first), walk-in credit.

**Product, not started:** UX-02 slices 3–5 — Money → Transactions, month overview, booking-sheet timeline (actor columns).

**Next, security:** forced password change at first login (needs a `User` flag, so a migration; see [ROADMAP.md](./ROADMAP.md)).

Remaining **MVP audit P0** (isolation proof is done):

1. **Backup** — minimal droplet / Postgres snapshot or `pg_dump` cadence, written in one place and followed.
2. **Deploy truth** — root README already points here for status; finish a short prod env checklist (host, HTTPS, DNS, `DATABASE_URL`, log disk, never seed prod).

Then either more P1 from that audit (Booking indexes; the concurrent collect race is closed, see progress.md "Booking row lock on every money path") or a product BRD gap when you choose one. The booking and payments production audit is [audits/booking-payments-production-audit.md](./audits/booking-payments-production-audit.md).

## How we work

Decision → spec → code. Append [progress.md](./progress.md) after a finished slice. Framework APIs: read `AGENTS.md` and local Next/Prisma docs — not training memory.
