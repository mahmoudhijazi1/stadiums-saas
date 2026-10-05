# Architecture review (short)

**Historical snapshot.** Written 2026-10-05 on `audit/final-review`. It ranks the security-audit-2 findings together with the open items in [../ROADMAP.md](../ROADMAP.md) and [logic-findings.md](./logic-findings.md).

## What was checked
- **Import direction.** A throwaway script read every `from "@/…"` in `src/` (generated client excluded) and compared each module edge with the table in [../ARCHITECTURE.md](../ARCHITECTURE.md) §1.
  - **Result:** no module edge points up, and nothing imports `platform`.
  - The only edges outside that table are:
    - 17 `application → <other module>/infrastructure` imports;
    - 7 imports of `@/app/generated/prisma`;
    - `lib/request-fields.ts → people/domain/phone`;
    - `components/day-chips.tsx → venue/domain/availability`.
  - Also: `app/` never imports an `infrastructure` file.
- **Rules duplicated across layers.** Checked for fees, owed/remaining, day bucketing, and UI-versus-server status gating.

## Do before owner #3 (ranked)

| # | Problem | Evidence | Fix | Effort |
|---|---|---|---|---|
| 1 | `next` 16.3.4 is inside a critical RCE advisory range | security-audit-2 **N-1**; `package.json` | Bump `next` and `eslint-config-next` to 16.3.8, run the suites, deploy | S |
| 2 | The public request path can be flooded: limits are per phone only without the IP header, and there is no booking horizon. Junk pushes real requests past the 200-row inbox cap | **N-2**, **N-9**; `request-public-slot.ts` `assertRequestRate`; `bookings.ts` `listPendingInbox` (LIMIT `PENDING_INBOX_UPCOMING_MAX`); a run accepted a request 400 days ahead | Set `TRUSTED_CLIENT_IP_HEADER` in nginx. Reject `start > now + N days`. Show "N more" when the inbox is capped | M |
| 3 | Backups and a restore drill are not verified. One droplet holds all tenants' money | security-audit-2 "Not done yet" c) (backups UNVERIFIED) | Nightly `pg_dump` off-box, plus one timed restore into a scratch DB, written into the RUNBOOK | S |
| 4 | Staff without `reports.view` see every expense amount and each player's paid and expected totals | **N-6**; `money/panel.tsx` `OwnerMoney` → `listRecentExpenses`; `get-person-booking-stats.ts` | Gate the list on `reports.view` or `expenses.record`, and hide person totals likewise (one-line owner decision) | S |
| 5 | Money paid before a per-player split credits nobody. Person pages under-report what the booker paid | ROADMAP #1, **F-1**; `person-owed.ts` `personOwedOnBooking` / `personPaidOnBooking` | Take the proposed rule (Unassigned credited to the booker) as a SPEC-15 amendment, then change the two functions | M |
| 6 | Pool pressure. The extension's `update`/`delete` pre-check takes a **second** pool connection inside a transaction (pool default 10), and every open owner tab polls `/owner/requests/live`. With 20 tenants on one process, this is the first thing to stall | ARCHITECTURE §3 "Risk in layer 2"; `lib/db.ts` (`op === "update" \|\| "delete"` branch); `venue/infrastructure/pitches.ts` (`tx.pitch.update`); `prisma-base.ts` `createPrismaBase` (`PG_POOL_MAX` 10); `app/owner/live-queue.tsx` | Switch `pitches.ts` to `updateMany({ where: { id } })` and forbid `update`/`delete` inside tx (lint or test). Set `PG_POOL_MAX` explicitly with Postgres `max_connections`, and back the poll off when the tab is hidden | S |
| 7 | Isolation rests on hand-stamped raw SQL in one 1,539-line file. No RLS | `booking/infrastructure/bookings.ts` (about 30 raw statements); ROADMAP #11 | Now: a unit test that fails if any `$queryRaw`/`$executeRaw` block in `src/modules` lacks `"tenantId" = ${tenantId}`. Later: RLS per ROADMAP #11 | S (test) / L (RLS) |
| 8 | The ledger is append-only by convention only, with no FK to its payment | ROADMAP #2, **F-2**; money.md M2/M3 | Add `LedgerEntry.paymentId` (FK), plus a trigger refusing UPDATE/DELETE on ledger, payment, tender and due-change tables | M |
| 9 | Two copies of one fact: the WHOLE requester participant's `amountDueUsd` is not updated by due changes | money.md **M16**; `write-due-change.ts` `writeDueIfChanged` | Update the requester row in `writeDueIfChanged` when the mode is WHOLE, or null the column for WHOLE and read only the booking | S |
| 10 | Use-case inputs are trusted to be pre-validated, and `RateLimit` rows are pruned only at owner login | **N-8**, **N-4**; `request-public-slot.ts` `requestPublicSlot`; `login.ts` → `pruneRateLimits` | Parse inside the use case. Prune in `requestPublicSlot` as well | S |

**Not ranked (fine for 3 owners):**
- F-3: relabel the old rows when convenient.
- F-4: lint errors, UI only.
- `listPersonStatRows` has no LIMIT. That is fine below a few hundred bookings per player.
- The suspended 503 is deferred by decision.

## Looks bad but is fine: do not touch

1. **Booking use cases import other modules' `infrastructure` directly** (17 edges, for example `collect-booking-payment.ts → payment/infrastructure/payments`). The direction is still down. A facade in `application` would only forward `tx`, and it would tempt a second `$transaction`. Keep it.
2. **The Today UI re-derives cancel, no-show and fee affordances** (`today/lists.tsx`: `isCancelWindowClosed`, `isNoShowWindowEnded`, `suggestFee`). It calls the same `booking/domain/decision.ts` and `suggest-fee.ts` functions that the server re-checks under the row lock. This is one rule in one place, not a copy.
3. **Day bucketing looks scattered**, but every caller (public `page.tsx`, `book/page.tsx`, `load-owner-day`, `load-free-strip`) uses `booking/domain/business-day.ts` `businessDate`. Only the `"Asia/Beirut"` literal repeats, which is fine while every tenant is in Lebanon.
4. **Modules import `@/app/generated/prisma`**, and `lib/request-fields.ts → people/domain/phone`. The first is the generated client (not app code); the second is a pure function. Neither creates a runtime cycle.
5. **Staff `{}` can read pitch hours and prices, the waitlist, names and phones** (security-audit-2 N-7). Answering the phone needs it, and nothing there is money.
