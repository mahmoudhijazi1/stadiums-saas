# UX-02: History

**Type:** UX decision record + screen spec
**Depends on:** UX-01 (owner interface structure)
**Governing rule:** RULE-12. Every owner-facing action must be faster than writing it on paper.

**Amended after audit** (2026-09-24), D1–D11:

- **D1.** Today (the selected day is today) keeps **To collect**: ended bookings with remaining > 0 from any start day, oldest first, max 5, then See all. That link goes to Money until who-owes exists. The same games also appear on their start day.
- **D2.** The day list loads `APPROVED`, `CANCELLED`, and `NO_SHOW` for that Beirut start day. `deriveCardDisplay` gains cancelled and no-show. `listDueBookings` stays as it is. The day view is a new named query.
- **D3.** Slice 1 extends the card list. No slot grid.
- **D4.** Past days have no limit. Owner future navigation is 60 days (`OWNER_FUTURE_DAYS`). Public `DayChips` stay as they are.
- **D5.** Slice 2 includes real search results (name, case-insensitive contains, or phone digits) that open the person page.
- **D6.** Slice 5: `rejectOverlappingPending` stamps the approver as `rejected_by`.
- **D7.** Ledger keyset is `(occurredAt, id)`, not `createdAt`.
- **D8.** Day summary "collected" is payments for that day's games, any collection date. "Owed" is remaining on those games.
- **D8 correction (2026-09-24).** The day line is `summarizeDay` over the rows the day list already loaded. Games are APPROVED only. No-shows are a separate count. Owed is remaining on ended APPROVED games plus remaining on no-shows. Expected is remaining on APPROVED games that have not ended, including one in progress. Cancelled money still counts as collected. Zero owed, expected, and no-shows are omitted.
- **SPEC-16 supersedes “a cancellation is not a debt”.** A cancelled booking with remaining above zero is owed, through the same `classifyDue` rule. Collected cash on that game still counts as collected. The due-change backfill sets older cancelled dues down to what was already collected, so those rows show no debt.
- **D9.** Transaction rows are USD plus the recorded tenders. The Money summary LBP toggle stays.
- **D10.** Indexes: `("tenantId", lower(during))`, `BookingParticipant ("tenantId", "personId")`, ledger `("tenantId", "occurredAt", "id")`. Each ships in the slice that first needs it.
- **D11.** Actor FKs are `ON DELETE RESTRICT`. Slice 5 fixes `seed.ts` delete order. No `deactivatedAt` yet.

---

## 1. Principle: history is a direction, not a place

There is **no History tab** and no global activity feed. Every view that answers "now" can also go back in time.

**Why:** a History section becomes a dump of everything, sorted by nothing the owner thinks in. He does not ask "show me all events." He asks about a day, a person, or money. Each question already has a home.

| His question | Lens | Where it lives |
|---|---|---|
| "What happened last Friday?" | By day | Today: day navigation + month overview (§2, §3) |
| "Does Sami always pay? How many no-shows?" | By person | Person page, opened by tapping any name (§4) |
| "Where did the money come from and go?" | By money | Money tab → Transactions (§5) |
| "Who approved / collected this?" | By booking | Timeline inside the booking sheet (§6) |

---

## 2. By day: Today walks backwards

### 2.1 Day navigation
- The selected day lives in the URL: `/owner/today?date=YYYY-MM-DD`. No param = today.
  **Why:** the back button works, a day can be reopened, and the Server Component reads it directly.
- The day strip moves one day at a time (‹ ›) and has a **calendar icon** that opens the month overview (§3).
- A "Today" chip appears whenever the selected day is not today, to jump back in one tap.
- When the selected day is today, the center label is "Today · <date>" (اليوم · التاريخ).
- Past days: **no limit**. Future days: **60** (`OWNER_FUTURE_DAYS`). An invalid or further-future `date` opens today. Public `DayChips` are not this strip.

### 2.2 Past-day view
- Same card list as today (not a slot grid), showing paid, partially paid, unpaid, no-show, and cancelled for that start day.
- Unpaid no-show: "No-show · $X due" and Collect. Paid no-show: "No-show · ✓ Paid". Cancelled: the time is struck through. The name, the pitch, and the Cancelled label are grey, on one card surface.
- On **today only**: the requests banner, then **To collect** (D1), then that day's games. Other days hide the banner and To collect.
- **Day summary line** at the top of every day, from `summarizeDay` on the day-list rows (D8 correction):
  `5 games · $150 collected · $30 owed · $40 expected`
  Game and no-show counts use plural forms. Omit every zero money figure, including collected. Omit the no-show count when it is zero. If there are no games and every amount is zero, the line is only "لا مباريات" / "No games". Whole dollars have no cents (`$30`); a fraction stays (`$12.50`) on this line and on card trails.
- **Actions kept on past days:** Collect and No-show (debts outlive the day).
  **Not allowed on past days:** editing time, pitch, or price.

### 2.3 Which day a game belongs to
A game belongs to the day it **starts** in `Asia/Beirut`. A game from 23:00 to 00:30 appears on its start day only.
This rule lives once, as a pure domain function, and is used by the day view, the day summary, and the month overview.

---

## 3. Month overview

Route: `/owner/today/month?m=YYYY-MM`. Opened from the calendar icon.

```
        September 2026
 Sun Mon Tue Wed Thu Fri Sat
          1   2   3   4   5
          3   5   2   6   8●
 ...
```

- Each day cell shows the **game count**.
- An **amber dot** marks days with money still owed (dot + accessible label, never color alone).
- Tapping a day opens `/owner/today?date=...`.
- Month header shows the month's totals: games, collected, owed.
- ‹ › moves between months.

**Why:** this is the "overview" from the owner's list. He scans a month in one glance and jumps to a day, instead of swiping 30 times.

**Data rule:** the whole month is **one grouped query** (count + owed per start-day), never one query per day.

---

## 4. By person: the person page

Route: `/owner/people/[personId]`. Opened by **tapping a player's name anywhere**: game cards, booking sheet, requests, who-owes list, header search results.

**Why a page, not a sheet:** the history is long and paginated, and a page gives a real back button and a reopenable URL.

### 4.1 Layout
1. **Header:** name, phone (tap → call / WhatsApp).
2. **Stats row:**
   `Games played · No-shows · Total paid · Owes now`
   "Owes now" is amber when > 0, with a Collect / WhatsApp reminder action.
3. **Sections, one per module, newest first:**
   - **Games** (booking module): date, time, pitch, price, payment state.
   - Later: **Purchases** (shop), **Academy** (academy). Absent sections are not rendered.
4. **Load more** at the end of each section (cursor pagination, §7).

### 4.2 Definitions
- **Games played:** approved bookings by this person whose start is in the past, excluding cancelled and no-show.
- **No-shows:** bookings marked no-show.
- **Total paid:** sum of USD-equivalent of tenders on this person's booking payments.
- **Owes now:** sum of remaining due across this person's bookings.
- MVP scope: the person is the **booker**. Participants are added when per-player payments ship.

### 4.3 Module boundary
`people` must not import `booking`. So:
- Each module exposes its own read for one person, e.g. `booking` exposes `listPersonBookings(personId, cursor)` and `getPersonBookingStats(personId)`.
- The person page (in `app/`) calls them **in parallel** and renders one section per module.
- Adding shop or academy = adding a section. Nothing existing changes.

### 4.4 Header search
Header search (UX-01 §2.1) opens real results (D5): name contains, case-insensitive, or phone digits. Each result opens the person page.

---

## 5. By money: Transactions

The ledger is append-only, so it already **is** the money history. No new history table.

### 5.1 In the Money tab
Below the summary card, a **Transactions** section for the selected period: the latest 10 entries, then "All transactions".

### 5.2 Transactions page
Route: `/owner/money/transactions?from=...&to=...&type=...`
- Filters: period (same switcher as Money), type (All / Bookings / Expenses; later Sales).
- Each row: date, description (player name or expense category), direction (in / out), amount in USD.
- Tap a row → its source: the booking sheet or the expense detail.
- Row detail shows the **tender breakdown** exactly as recorded:
  `$20 + 900,000 LBP @ 90,000 = $30.00`

**Rules:** row amounts from the ledger in USD; LBP only as recorded tenders with their frozen rate (D9). Never sum LBP. The Money summary LBP toggle stays a display conversion. Keyset is `(occurredAt, id)` (D7).

---

## 6. By booking: timeline inside the booking sheet

At the bottom of the booking sheet:

```
Requested   Tue 14:02  · public page
Approved    Tue 15:10  · Mahmoud
Collected   Fri 22:05  · Ali · $20 + 900,000 LBP
Cancelled   —
```

### 6.1 Data needed
Timestamp **and actor** per status change, plus who recorded each payment:

| Table | Columns |
|---|---|
| bookings | `approved_at`, `approved_by_membership_id`, `rejected_at`, `rejected_by_membership_id`, `cancelled_at`, `cancelled_by_membership_id`, `no_show_at`, `no_show_by_membership_id`, `created_by_membership_id` (owner-created bookings) |
| payments (or tenders, whichever holds each collection act) | `recorded_by_membership_id` |

- All nullable. Public requests have no actor. Existing rows stay null and display "—". No backfill.
- Actor is a **membership**, not a user: the action happened inside this tenant. FKs are `ON DELETE RESTRICT` (D11). Slice 5 fixes seed delete order. No `deactivatedAt` yet.
- `rejectOverlappingPending` stamps the approver as `rejected_by` (D6).

**Why columns, not an event table:** columns answer every question the owner has today ("who approved", "who collected") at zero query cost. A full event/audit table is YAGNI until a real audit need appears. Adding columns now is cheap; backfilling actors later is impossible.

This also answers BRD open question **Q-7** ("which staff member collected which payment").

---

## 7. Performance rules

- **Cursor (keyset) pagination** on `(lower(during), id)` for bookings and `(occurredAt, id)` for ledger entries (D7). Never `OFFSET`.
- **Indexes** (D10), each in the slice that first needs it:
  - `Booking ("tenantId", lower(during))` expression index
  - `BookingParticipant ("tenantId", "personId")`
  - `LedgerEntry ("tenantId", "occurredAt", "id")`
- Day summary, month overview, and person stats are **single aggregate queries**.
- Every history read is a named repository function (query-discipline rule).
- Scoped Suspense per section: the stats row never waits for the list.

---

## 8. Cross-cutting UI rules

Same as UX-01 §10: Arabic first, logical properties, LTR isolation for dates, times, phones, and amounts, copy through `ui()`, color + icon + label for every state, permissions via `can()`.

Staff: person page and day history follow existing booking permissions. Transactions follow `reports.view`.

---

## 9. Out of scope

- Global activity feed / History tab
- Export (CSV / PDF)
- Merging duplicate persons
- Editing past bookings' time, pitch, or price
- Full audit/event table

## 10. Open decisions

| ID | Question | Default |
|---|---|---|
| UX2-Q1 | Can the owner collect on a past day, or only from the who-owes list? | Both |
| UX2-Q2 | Show rejected requests / slot interests on the person page? | No in MVP |
| UX2-Q3 | Month overview: show money collected per day, or only count + owed dot? | Count + owed dot |

## 11. Build order (one slice per prompt)

1. Day navigation via `?date=` + day summary line + start-day rule
2. Person page (games section + stats), linked from every name; header search results link to it
3. Money → Transactions section and page
4. Month overview
5. Actor/timestamp columns (migration) + booking sheet timeline