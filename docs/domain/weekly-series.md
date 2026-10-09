# Weekly recurring bookings

**Living.** Written 2026-10-13 with the feature (branch `feat/weekly-series`). Code: `src/modules/booking/domain/series.ts` (pure rules), `booking/application/{create-series,make-weekly,renew-series,cancel-rest-of-series,preview-series,series-weeks,series-sheet,list-weekly-bookings,load-series-info,load-series-created}.ts`, `booking/infrastructure/series.ts`, UI in `app/owner/(app)/series/` and `more/weekly/`.

## The idea

A team that plays every Tuesday at 8:00 PM is booked once, not every week. Choosing **Repeat weekly** creates the next 4, 8 or 12 weeks **now**, as ordinary bookings:

- Each week is a **real `Booking`**: APPROVED, `source = OWNER`, priced at its own time and frozen like any owner booking, with the booker as requester. Everything that works on a booking (collect, cancel, extend, no-show, the shop) works on a week, unchanged.
- A **series** (`BookingSeries`) is only the link: `Booking.seriesId` points at it. It stores the booker, the pitch, the anchor (the first week's local date and time) and the length. No background job runs, and there are no "virtual" bookings: if the owner does nothing, the weeks that exist stay and nothing new appears.

## When each week starts

Week `k` starts at the anchor's **local wall-clock time** (Asia/Beirut) on `anchor date + 7k calendar days`, converted to UTC **for that day** (`seriesOccurrences`). So:

- a 20:00 game stays at 20:00 across the clock change in late October and late March (the UTC time moves by one hour, the local time does not);
- a game after midnight (00:30) stays on the **same night** every week;
- weeks are numbered from 0 (the anchor). Renewing continues from the latest game's number plus one (`occurrenceIndex` reads the number back from the date).

## Which weeks can be booked

For each week (`classifyOccurrence`, used both by the preview and, again, under the lock by the use case):

| State | Meaning |
|---|---|
| `free` | A grid slot starts at that time, the game fits the opening hours (`bookingFitsOpenHours`), no APPROVED game overlaps it, and it starts in the future. |
| `taken` | An APPROVED game overlaps it. |
| `outside_hours` | No slot starts at that time that day, or the game would run past closing. |
| `past` | It is not in the future. |

Price: the price of the grid slot starting at that time, scaled to the series length (a 90-minute series on a 60-minute grid pays 1.5 slots), half up to cents. Pending requests overlapping a created week are **declined and kept as interests**, exactly as approving a game does (`rejectOverlappingPending`); the preview says how many.

## Creating, extending the series, ending it

| Action | Needs | What it does |
|---|---|---|
| `createSeries` (quick-booking sheet, "Repeat weekly") | `bookings.create` | One pitch lock for the whole series; the owner's accepted weeks are re-checked under it. A week that became taken since the preview is **skipped and reported**, never a failure. Nothing bookable: nothing is written (`booking.series_none`). |
| `makeWeekly` ("Repeat weekly" in a game's More actions) | `bookings.create` | An APPROVED game not already in a series becomes week 0 (its own start is the anchor); the next 4, 8 or 12 weeks are created. |
| `renewSeries` ("Renew 8 more weeks") | `bookings.create` | Continues after the series' latest game, same rules. |
| `cancelRestOfSeries` ("Cancel the rest") | `bookings.cancel` | Cancels every upcoming APPROVED week **with no fee** (due goes to 0, reason `CANCELLATION_NO_FEE`). A week with any collected money is **left alone** and listed: cancel it on its own to choose a fee. A week that has started is never touched. |

The exclusion constraint on APPROVED games stays the backstop: if two requests still collide, the loser gets `booking.series_retry` ("the schedule changed while saving, try again"). Lock order is in [ARCHITECTURE.md](../ARCHITECTURE.md) §6.

## What the owner sees

- The quick-booking sheet and the "Repeat weekly" step: 4 / 8 / 12 chips (default 8), the weeks (date, and a mark for taken / outside hours / past / "N requests will be declined"), a primary button with the real count ("Book 7 games"), then the result and the WhatsApp confirmation (`SERIES_CONFIRMED`: the weekday, the time, the first date, the number of games).
- A game in a series: "↻" on its card and a row "↻ Weekly · every Tue 8:00 PM · 5 left · until Dec 1" in its sheet, opening the series sheet.
- More > Business > Weekly bookings; one reminder line on Today when a series has 2 games left or fewer; "Weekly every Tue 8:00 PM" on the person page.

There is no option list beyond 4 / 8 / 12: the code has no owner-booking horizon constant, so all three are always offered.

## Not covered

Players requesting a series from the public page, editing a series' day or time (cancel the rest and make a new series), and prepaid monthly series. See [ROADMAP.md](../ROADMAP.md).
