# Roadmap: open items

**Living.** Short, ordered list of known open work that is not a product slice. Details and proposed fixes are in [audits/logic-findings.md](./audits/logic-findings.md); product slices are in [NOW.md](./NOW.md). When an item is fixed, mark it done here with the commit, and in the findings file.

| # | Item | Status | Details |
|---|---|---|---|
| 1 | Money paid before a per-player split credits nobody. Proposed rule: Unassigned is credited to the booker (Total paid includes it; Owes now = max(own slot remaining − Unassigned, 0); any excess stays Unassigned on the booking until SPEC-15 slice 5 reassigns it). | Open, needs a short decision (amends SPEC-15 §2.3) | [F-1](./audits/logic-findings.md#f-1-money-paid-before-a-split-credits-nobody-audit-punch-list-6), audit #6 |
| 2 | Ledger hardening: `paymentId` on `LedgerEntry`, DB-level append-only for ledger, payments, tenders and due changes | Deferred: needs a migration and a design decision (DR-002 §2.21) | [F-2](./audits/logic-findings.md#f-2-ledger-hardening-deferred-audit-punch-list-9), audit #9 |
| 3 | Old no-show fee rows labelled `CANCELLATION_NO_FEE` (before `48a3ce8`) | Recorded, not fixed: relabeling needs the suggestion at that time; SQL in progress.md | [F-3](./audits/logic-findings.md#f-3-old-no-show-fee-rows-labelled-cancellation_no_fee) |
| 4 | Three setState-in-effect lint errors (`fee-forms.tsx` ×2, `upcoming-panel.tsx`) and an unused import in `list-debt-warnings.ts` | Open, UI-only | [F-4](./audits/logic-findings.md#f-4-lint-errors-left-in-the-owner-today-ui) |
| 5 | Seed wipes any database, including production, and recreates known passwords | Fixed on `audit/security` (progress.md "Seed refuses production and unknown databases") | [S-1](./audits/security-audit.md#s-1-the-seed-wipes-any-database-it-is-pointed-at-including-production) |
| 6 | Session ids are cuid v1 (`Math.random`, about 41 random bits): switch to 256-bit random tokens, ideally stored hashed | Fixed `08da596` (PR #9) | [S-2](./audits/security-audit.md#s-2-session-ids-are-cuid-v1-not-cryptographically-random) |
| 7 | Rate limits: login brute force, public request flooding, bounded pending/range queries | Fixed `dcffb84` (login), `cb9049a` (public), `bed1538` (queries) | [S-3](./audits/security-audit.md#s-3-no-brute-force-protection-on-login), [S-5](./audits/security-audit.md#s-5-public-requests-can-be-flooded-and-names-are-unbounded), [S-8](./audits/security-audit.md#s-8-unbounded-queries-on-hot-paths) |
| 8 | Login timing reveals which identifiers exist (dummy scrypt on unknown user) | Fixed `06ae591` (PR #9) | [S-4](./audits/security-audit.md#s-4-login-reveals-which-identifiers-exist-by-timing) |
| 9 | Public request under someone else's phone; name length and control characters | Fixed `3707fd6` (typed name on the card), `2efbfbd` (names) | [S-6](./audits/security-audit.md#s-6-anyone-can-file-a-public-request-under-someone-elses-phone), [S-14](./audits/security-audit.md#s-14-names-accept-bidi-overrides-and-control-characters) |
| 10 | Security headers (HSTS, frame-ancestors, nosniff, Referrer-Policy, Permissions-Policy) and a nonce CSP | Fixed `0c69947` except an enforced CSP (nonces deferred); HSTS in nginx | [S-7](./audits/security-audit.md#s-7-no-security-headers) |
| 11 | Postgres RLS behind the Prisma extension (DR-001 trigger effectively met) | Deferred by decision; needs a DR-001 amendment, about 2–3 days | [§10](./audits/security-audit.md#10-rls) |
| 12a | Pitch editor: show, before saving, how many upcoming bookings fall outside new hours. Today `updatePitch` refuses the save when a future APPROVED booking would be outside (`venue.hours_approved`) and asks for a confirm for PENDING ones, so a non-blocking "they stay booked" note would be wrong. A pre-save count needs `listLivePitchWindows` on the client path (a new query design). | Open, UI-only follow-up (2026-10-08) | `modules/venue/application/update-pitch.ts` |
| 12 | Low findings: host allowlist, header trust, `X-Powered-By`, scrypt cost, session and log cleanup, env validation, guard gaps | Partly fixed: S-9–S-11 `c13403e`, S-13 `0c69947`, S-14 `2efbfbd`, S-16 `6879627`, S-18 `ed99634`; the rest deferred (see the audit's status addendum) | [S-9 … S-21](./audits/security-audit.md#findings) |

## Money tab: next specs (recorded 2026-10-09)

Not started, each its own spec; the Money refactor left room for them.

| Item | Note |
|---|---|
| Expense void / correction | The ledger is append-only and expenses have no edit or delete. A mistaken expense needs a reversing entry (its own spec: who may, how it shows in Activity, how it affects the period totals). |
| Category breakdown | Out by expense category for the period, from the same ledger and expense reads. |
| Occupancy | Games played vs hours open per pitch for the period. Needs Booking and Venue reads composed in `app/`. |
| CSV export | Activity for a period as a file. Needs a decision on columns and on LBP tenders. |
| Owed vs Unassigned (F-1) | The Owed page adds up per-slot amounts; on a per-player booking with money paid before the split they can exceed the booking remaining that Today shows. Closes with F-1. |

## Shop: next specs (recorded 2026-10-09)

Slice 1 (catalog, walk-in sale, shop supplies, the Money card) is built. Not started, each its own spec:

| Item | Note |
|---|---|
| Slice 2 follow-ups | Built: items on a game, both kinds. Not done: the debt warning on request cards and the person page do not yet include a person's unpaid tabs (Today, the Owed page and Money do); a booking timeline entry for items (there is no timeline yet); a tab cannot be collected partly from the Owed page (it opens the booking). |
| Sale void / correction | The ledger is append-only, so a mistaken sale needs a reversing entry. Waits for the same decision as expense void (above). |
| Stock, lot purchases, cost | Stock counts, buying in lots and cost per item. This is why the Shop card shows Sales and Supplies and never a profit. |
| Variants, public price list | Sizes or flavours of one item; a price list on the public page. |
| Walk-in credit | A walk-in sale is paid in full or refused today; "put it on my tab" needs a person and the Owed screen. |
| Append-only for Sale / SaleItem | Insert-only by code only, like Payment and LedgerEntry (F-2): no trigger. Revisit with F-2. |

## Extend a booking: next (recorded 2026-10-12)

The first version only adds 30 minutes. Not started, each its own slice:

| Item | Note |
|---|---|
| Shorten or undo an extension | There is no way back: Adjust amount can lower the due but the time range stays. Needs its own rules (a refund below collected is out of scope, the freed time becomes free again, who may do it, an `EXTENSION_UNDO` reason or a negative change). |
| Extend past closing | Closing time is a hard limit today (`booking.extend_closing`). An owner who lets a game run late must change the pitch hours or wait for this. Needs a decision on the price of time outside the schedule. |
| Move a booking | Change the start (and pitch) of a confirmed game. A different feature: it needs the same lock order and the pending-request rules, plus the player's notification. |
| A permission screen | `bookings.extend` is granted by editing the staff membership's `permissions` jsonb; there is no screen for it yet (same as the other flags). |

## Push notifications: next (recorded 2026-10-11)

Slices A (foundation and the test button) and B (the new-request alert) are built; see [push-notifications.md](./push-notifications.md). Slice B's tests are written but were not run when it was committed. Not started, each its own slice:

| Item | Note |
|---|---|
| Other alert kinds | A booking cancelled by the player, a payment received, a game starting soon, an unpaid game. Each is a new `PushKind` in `buildPushPayload`, its own recipients and throttle, composed in `app/`. Decide per kind who needs it, so alerts stay rare. |
| Badge on the app icon from the worker | Today the count badge is set only while the page is open (`LiveQueue` `applyAppBadge`). The worker could call `navigator.setAppBadge` from the push handler using a count in the payload, so the icon shows the number with the app closed. Needs the count added to the payload and a decision on clearing it. |
| Real notification icons and a badge icon | Today the notification uses the placeholder `icon-192.png`; no monochrome badge icon. Needs real artwork. |
| Offline, level 1 | The worker still caches only `/offline.html`. A read-only Today for a dropped connection needs a decision on what may be cached for an authenticated page (the security audit passed the worker because it caches none). |
| Prune dead subscriptions | Only a 404/410 at send time and the session cascade delete rows; a subscription that quietly stops working is kept until its session ends. Revisit with slice B's send results. |

## Deferred on purpose: tenant management

Recorded 2026-10-01 with the tenant-management CLI. These are deliberate decisions, not gaps.

| Item | Why deferred |
|---|---|
| Web platform admin | It needs its own identity and cookie (separate from owner sessions), 2FA, rate limits, audit and its own security review. Its backend already exists: the `src/modules/platform` use cases take an explicit actor (`admin:<id>` later) and never touch a terminal. |
| Date-based suspension (auto-suspend when `paidUntil` passes) | Suspension stays manual (decision 2). `paidUntil` is informational: `tenants list` flags OVERDUE. No cron. |
| Plan limits and pricing | A plan is a text label only (decision 5). BR-103 is PARTIAL by decision: no limits, no pricing, no enforcement. |
| Forced password change at first login | **Next job (2026-10-08).** Owners can now change their own password in the app (More → Account), but nothing forces it: the operator-set first password stays until they do. Forcing it needs a `mustChangePassword` flag on `User` (a migration), set by `tenants create` / `set-password`, and a redirect until it is cleared. |
| A real HTTP 503 for a suspended tenant's public pages | Next 16 pages cannot set 503 (local `loading.md`, "Status codes": only 200, or 404/401/403 through `notFound`/`unauthorized`/`forbidden`). Doing it in the proxy would add a database query per request. Every public path shows the neutral page with status 200, robots noindex and `Cache-Control: no-store`, and no tenant data. |

Other open audit items (isolation tests for `PaymentAllocation`, the WHOLE requester due drift, "They played" permission, staff money visibility) are tracked in the addendum of [audits/booking-payments-production-audit.md](./audits/booking-payments-production-audit.md).
