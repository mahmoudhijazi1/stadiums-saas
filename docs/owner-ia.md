# Owner dashboard — information architecture

**Purpose:** the owner app's information architecture: tabs, routes, query params and where each piece lives.
**Read when:** you add or move a screen, or change what a tab holds.
**Last verified:** `f01c9bf` (main, after refactor step 6c).

Living reference for `/owner` structure. **Update this file when tabs or routes change.** It is not a SPEC or DR; those stay in `docs/specs/` and `docs/decisions/`.

---

## Destinations (amended after the UX-01 audit)

UX-01 supersedes the earlier five tabs (Home, Book, Waitlist, Reports, More). Five destinations behind a shared layout: a floating bottom bar below `lg`, and a 240px start-side rail at `lg`. There is no ＋ button any more (removed 2026-10-10): the header carries a shop button beside search that opens the counter (`/owner/sell`, members with `shop.sell`). **Do not add a sixth destination** when later products ship — they become rows inside More.

Tab root pages have no large title. Nested pages keep a title and a back button.

| Destination | URL | Contains | Does **not** contain |
|---|---|---|---|
| Today | `/owner/today` | All pending requests (any date); overdue unpaid APPROVED / unpaid NO_SHOW (BR-49); today’s confirmed (compact rows with chevron; tap opens a bottom sheet: time-dominant header, إبلاغ on the phone row, one remaining hero unless partial, one-tap Collect, mixed-currency behind دفع بعملتين); inline next 7 civil days; `?ok=approved&highlight=` rings the new row | Book date picker, waitlist, rate, period, expenses |
| Requests | `/owner/requests` | The same pending list as Today, until the Requests slice adds the notify sheet and reject reasons. Badge is the pending count. | Waitlist, rate, period, expenses |
| (header) shop button | `/owner/sell` | Beside the search button; hidden without `shop.sell`. Booking and expense have no quick entry for now (Today's free hours and Money still reach them). | — |
| Money | `/owner/money` | Period summary (hero difference, In/Out tiles + CSS bars); GET period form behind “Change period”; expenses as rows; record form behind “Add expense”. Label is المال / Money. | Exchange-rate **set** form, waitlist, Book, Settings |
| More | `/owner/more` | Hub list of destinations. Today: Settings | Tab content for Today / Requests / Money |

`/owner/book` and `/owner/waitlist` stay real routes. They are not destinations in the bar. Book keeps its date picker and slot grid. Waitlist keeps open slot-interest groups. Both keep a title and a back button.

`/owner` itself has no UI: it redirects to `/owner/today`. Login lands on `/owner/today` (not `/owner`) so Server Action `redirect()` does not stack a second hop (`redirect.md`: actions **push** history). Tenant comes from the host (`ahmad.localhost` / subdomain), not `?tenant=`.

`/owner/suspended` sits outside the shell like `/owner/login`. While the platform has suspended the stadium, the shell, every owner page and `/owner/login` redirect there, and the live poll answers 403 `tenant_suspended`. It shows fixed copy with no tenant data and no reason. For an active stadium it redirects to `/owner/today`, and it never redirects to login, so there is no loop.

Staff without `bookings.create`: `/owner/book` shows an EmptyState, not slots. Staff without `shop.sell`: no shop button in the header.

Do not grow a destination by stacking another product’s UI on it. If it is not in the “Contains” column, it belongs on another destination or a **More list row** (see Phase 2+).

---

## Reports vs Settings

**Money** (`/owner/money` — URL kept; label is المال / Money):

Money page v2 (2026-10-15), top to bottom:

1. The period chip and the $ / LBP toggle (when a rate is known). Default range is this Beirut calendar month when `from`/`to` are omitted. With no `view` in the URL the page opens on the stadium's own currency (a stadium that prices games in pounds opens on LBP); an explicit `?view=usd` or `?view=lbp` wins, and every Money link carries the choice.
2. **Summary card:** "Profit in October" (or "Loss ...", neutral colour) as the one figure; a comparison line only when the previous period has a ledger row; "In $X · Out $Y" (each opens `/owner/money/activity` filtered); in the LBP view the figures count each payment at its own value (one line under the headline says so, and how many dollar payments had no stored rate and were counted at today's rate; see [domain/money.md](./domain/money.md)); a muted In-by-source line ("Games $175 · Shop $22") when there are two or more sources.
3. **Owed** card (unchanged), when something is owed.
4. **Cash today** line when the period contains today: net cash per currency for the current business day, never converted; a tap opens in / out / net per currency (`reports.view`; see [domain/money.md](./domain/money.md)).
5. **Actions row:** "+ Expense" (`expenses.record`, the one primary button: the sheet opens with the amount focused, category chips most recent first per member and browser, today, optional note) and "Sell" (`shop.sell`).
6. **Recent activity:** the 5 latest rows with "All activity ›". Each row's main amount is what the payment kept, in the currency it was paid in ("+2,000,000 LBP", "+$20", "+$20 + 1,500,000 LBP", "−500,000 LBP"), never added across currencies; the dollar equivalent and the rate stay in the row's details.
7. **Shop row** "Shop · sales $X this month ›" (in pounds in the LBP view) (only with shop sales or supplies) to `/owner/money/shop`.

Sub-pages: `/owner/money/activity` (day grouping, All/In/Out, keyset "Show more"; period and filter in the URL), `/owner/money/shop` (sales, supplies, items sold, caption) and `/owner/money/owed`. `getCurrentRate()` is a **read** for the LBP display fallback only.

**More** (`/owner/more`) is the settings hub. `/owner/more/settings` redirects here and keeps `ok` / `error`.

- Business rows (pitches, exchange rate, booking rules, public page) require `settings.manage`. The **Game prices in** row (USD or LBP; DR-007 decision 1) sits next to booking rules and shows only to an OWNER (`settings.game_currency`, never granted to staff): its sheet confirms the switch ("New bookings will be priced in LBP. Existing games keep their currency."), or, when a pitch has no price in the other currency, lists those pitches with a link to each editor and offers no confirm. `OWNER` passes `can()` with no jsonb flag.
- Exchange rate sheet reuses `submitSetExchangeRate`. Time format sheet reuses `submitSetTimeDisplay` and saves on tap. Language and appearance save on tap. Booking rules (BR-27) are not stored, so that sheet does not write.
- Time format (12h / 24h): tenant-level on `Tenant.settings.timeDisplay`. Owner Today / Book / Waitlist **and public** slot clocks follow it. WhatsApp message bodies stay 24h (Arabic AM/PM risk).
- **Stadium info** row (Business section, `settings.manage`) opens `/owner/more/stadium`: name, address, map link, phone, a "Same number for WhatsApp" switch with an optional separate number, and a colour from 8 presets, with a hint to set the name and colour before installing the app. The owner header avatar and the public header show the generated logo.
- **Weekly bookings** row (Business section, `settings.manage`) opens `/owner/more/weekly`: every weekly series that still has games left, with Renew (`bookings.create`). A weekly booking is created from the "Repeat weekly" switch in the quick-booking sheet, or from "Repeat weekly" in a game's More actions; a game that belongs to one shows a "↻ Weekly · every Tue 8:00 PM · 5 left · until Dec 1" row that opens the series sheet (weeks, Renew, Cancel the rest). Today shows one reminder line when a series has 2 games left or fewer. See [domain/weekly-series.md](./domain/weekly-series.md).
- **Notifications** row (Preferences section, any role; hidden when the server has no VAPID keys) opens a sheet: enable push on this device, send a test, turn off. Actions in `more/notifications/actions.ts`; see [push-notifications.md](./push-notifications.md).
- **Help** row (its own section at the end, any role) opens `/owner/more/help`: about ten groups of closed `<details>` topics (what it does, a "Where" link to the real screen, at most 3 steps, one "Good to know" line), with no client JavaScript. A topic is hidden when the member lacks the permission its action needs (`can()`, the same flags as the real screens); Notifications shows only when push is configured. The page ends with a WhatsApp link to support (`src/lib/support-contact.ts`, the number the landing page uses too). Topics and their flags live in `more/help/_components/topics.ts`.
- Pitch list is `/owner/more/settings/pitches`. Create/edit stay on the child routes (`settings.manage`). Each hours row is weekday checkboxes + one open/close; a day belongs to at most one row; days in no row are closed. Writes go through `parseScheduleConfig` with `gapMinutes: 0`. `priceRules` are edited in place and survive a default-price or duration-only save. Pending-in-removed-hours still uses the confirm second-submit. Live APPROVED in a removed window refuses. Approve re-checks `resolveOfferedSlot` against current hours.
- Still deferred:
  - Company / stadium info and images — **Phase 2+**. More keys on the same `tenant.settings` jsonb (DR-002 §2.6); only `timeDisplay` is live today.
  - Staff permissions UI — flags already exist on membership jsonb (DR-003 / BR-98); there is no owner screen to edit them yet.
  - Multiple windows on the same weekday — schema allows `hours[day]` to be several `{ start, end }` pairs; the editor is one pair per row and collapse uses `window[0]` if `length > 1`. A save writes that single window. Not this slice.
  - Time-of-day `priceRules` (`start`/`end` on a rule) — not this slice.
  - `gapMinutes` stays 0 (changing it moves the offered grid; hours-cover would not warn).
  - Pitch delete.
  - Pitch blocks (BR-6, maintenance / private / academy) — **open question**. No `pitch_blocks` table yet (SPEC-02 deferred). Not the same as editing a pitch’s weekly hours.

**Home** (`/owner/today`) — still deferred:

- Highlighted row (via `?highlight=`) has no `scrollIntoView` — if a future-day approve lands deep in an opened “coming days” list, the ring may render off-screen. Deferred deliberately, not forgotten. Add later: `scrollIntoView` on mount when highlight is set and the row exists, keyed off the same `highlight` prop already threaded through `upcoming-panel.tsx`.

---

## More is the standing home for later products

New products are **list rows on More**, not a sixth destination:

| Concern | Where |
|---|---|
| Settings (rate + time format + pitch list/create/edit; company / staff later) | More → Settings |
| Tournaments (future bounded context; seam via `pitch_blocks` like Academy) | More list row when that SPEC exists |
| Shop | More list row (`/owner/more/shop`, owner only); selling is `/owner/sell`, opened from the shop button in the header — not a Reports subsection |
| Academy (Phase 3) | More list row — seam is `pitch_blocks`, not a Reports subsection |

---

## Routing decision

**Real App Router routes + `src/app/owner/(app)/layout.tsx`, never a client tab switcher.**

Why:

- Back button, bookmarks, and per-tab URLs work.
- Shared chrome (header + tab bar) does not remount on tab `<Link>` (local `layout.md`: layouts are cached on the client and do not rerender).
- Independent in-page `<Suspense>` per tab. **No `loading.tsx` under `/owner` or a tab folder** — that file wraps the whole `page.js` and would unmount Money GET date fields and Book day chips (already burned once; see `docs/progress.md`).

The only `"use client"` owner chrome is the tab bar (`usePathname` for the active tab, including prefix match so `/owner/more/settings` keeps More selected), `FlashToast` (`useSearchParams`), the Book calendar chip (same Popover as public), `LangToggle` (same cookie + `html` lang/dir as public), pitch hours groups (`hours-groups.tsx`), and pitch day-price rows (`price-rules.tsx`). Tab **content** lists stay Server Components.

Layouts cannot read `searchParams` or pathname (they would go stale). Tenant for tab Links comes from `getCurrentTenant()` (header). Flash toasts read `ok`/`error` in a Client child.

---

## Query params (per tab, not one mega-query)

Tab bar Links carry **`tenant` only** (local-dev; not isolation).

| Param | Lives on |
|---|---|
| `tenant` | not used: the tenant comes from the validated Host |
| `bookOn` | `/owner/book` only |
| `from` `to` `view` `displayRate` | `/owner/money` only |
| `ok` / `error` | the tab the action redirected to; FlashToast strips them |
| `highlight` | `/owner/today` after Approve only (booking id). FlashToast does **not** strip this. |
| `name` `hoursGroupsJson` `slotDurationMinutes` `defaultPriceUsd` `priceRulesJson` `needPending` | pitch create/edit URLs after a refused save (`error` is stripped; pending confirm and draft JSON stay) |

### Server Action redirects

Use-case logic is unchanged. Only the redirect path:

| Action | Lands on |
|---|---|
| `submitApproveBooking` | `/owner/today` (`ok=approved` + `highlight=<bookingId>`) |
| `submitRejectBooking` / `submitCancelBooking` / `submitRecordNoShow` / `submitCollectPayment` | `/owner/today` |
| `submitCreateOwnerBooking` | `/owner/book` (keeps `bookOn`) |
| `submitRecordExpense` | `/owner/money` |
| `submitSetExchangeRate` | `/owner/more/settings` |
| `submitCreatePitch` | `/owner/more/settings` (`ok=pitch_created`) |
| `submitUpdatePitch` | `/owner/more/settings` on success; edit URL + draft/`needPending` on confirm or refuse |
| `submitLogin` | `/owner/today` |
| Waitlist notify | WhatsApp `<a>` — no action |

GET forms: period → `action="/owner/money"`. Book day is Link chips + calendar (`?bookOn=`), same interaction as public `?date=` — not a GET form.

---

## Component map

Routes live in `src/app/owner/(app)/<tab>/`; each route's private pieces are in its `_components` folder, Server Actions are in the route's `actions.ts` (Today also has `items-actions.ts` and `extend-actions.ts`). Module components are in `src/modules/<m>/ui/` and get data and actions through props (see [CODEMAP.md](./CODEMAP.md)).

| Piece | Where |
|---|---|
| Auth gate | `src/app/owner/require-owner.ts` (`requireOwnerMembership`) |
| Layout, sticky header, tab bar | `src/app/owner/(app)/layout.tsx`; `src/components/shell/{header,tab-bar,business-menu,offline-pill,back-link}.tsx` |
| Index redirect | `src/app/owner/(app)/page.tsx` -> `/owner/today` |
| Today | `today/page.tsx`, `today/_components/{lists,free-strip-section,date-label}`, `booking/ui/upcoming-panel` and the other `booking/ui` pieces, `today/{actions,items-actions,extend-actions}.ts` |
| Book | `book/page.tsx`, `book/_components/slots.tsx`, `booking/ui/book-picker.tsx`, `book/actions.ts` |
| Requests (inbox, waitlist, free slots) | `requests/page.tsx`, `requests/_components/{inbox,pending-list,free-slots}` |
| Money | `money/page.tsx`, `money/_components/panel.tsx` and its pieces, `money/{activity,owed,shop}/page.tsx`, `money/actions.ts`, `money/query.ts`; `expense/ui/expense-sheet`, `payment/ui/cash-today`, `ledger/ui/period-label` |
| More hub | `more/page.tsx`, `more/_components/hub.tsx`; sub-pages `more/{settings,settings/pitches,shop,stadium,weekly,account,notifications}` |
| Sell (walk-in shop sale) | `sell/page.tsx`, `shop/ui/sell-screen.tsx`, `sell/actions.ts` |
| People and search | `people/[personId]/page.tsx`, `search/page.tsx` and their `_components` |
| Weekly series | `series/actions.ts`, `booking/ui/{series-manage,weekly-confirm,weekly-preview}` |
| Slot grid and day chips (public and owner) | `booking/ui/slot-picker.tsx`, `venue/ui/day-chips.tsx` |
| Bottom sheet (shared) | `src/components/ui/bottom-sheet.tsx` |
| Settings list markup | `src/components/ui/settings-list.tsx` |
| Form field, POST keep-query, `redirectOwner` | `src/lib/form-query.ts` |
| `queryString`, owner time formatters | `src/lib/search-params.ts`, `src/lib/format/time.ts` |
| Per-tab Suspense fallbacks | `skeleton.tsx` in `today`, `money/_components`, `book/_components`, `more/settings` |
| FlashToast | `src/components/ui/flash-toast.tsx`; layout client child, reads the URL (`useSearchParams`) |

## Which tab does X belong in?

Add a row here when a module grows a screen. Do not invent a fifth scrolling section on Home. Do not add a sixth bottom tab.

| Concern | Tab / note |
|---|---|
| Pending + today’s confirmed + overdue unpaid | Home (`/owner/today`) |
| Confirm-notify WhatsApp (BR-71 “booking confirmed”) | Home — APPROVED sheet, compact إبلاغ on the phone row (not a separate section), then تحصيل |
| Cancel a confirmed booking | Home sheet — two-step: إلغاء الحجز replaces the sheet body (height eases, does not append). Confirm / تراجع stay on-screen. Close is still X / overlay / Esc (sheet slides down) |
| Phone-call / walk-in create | Book |
| Waitlist after cancel | Waitlist |
| Period P&L, expenses | Reports (`/owner/money`) |
| Exchange rate (set) | More → Settings |
| Time format 12h/24h (owner + public; WhatsApp stay 24h) | More → Settings |
| Pitch create/edit (BR-3–5) | Settings — hours groups + day price rows |
| Extra windows on one weekday / time-window priceRules / gapMinutes UI | Settings later (`gapMinutes` stays 0; editor uses `window[0]`) |
| Pitch delete | Settings later |
| Pitch blocks (BR-6) | Open — no table yet; not Settings until a SPEC |
| Company / stadium info | Settings — Phase 2+ / `tenant.settings` |
| Staff permission flags UI | Settings later |
| **Tournaments** | **More list row** (future; `pitch_blocks` seam) |
| **Shop** | **More list row** (catalog), **header shop button → Sell** (`/owner/sell`), **booking sheet → Add items / player tabs**; Money shows the Shop card |
| **Academy (Phase 3)** | **More list row** |
| No-show (BR-22 / SPEC-14) | Home — after the hour has ended; unpaid stays for Collect |
| Public booking request | Not owner — public `/` |

---

## TODO — Proxy vs middleware (historical note)

Next.js 16 uses **Proxy** (`src/proxy.ts`) for the host check (bare `APP_BASE_DOMAIN` or a one-label subdomain, else 404); `tenant-context` resolves the tenant from the same validated Host, never from a header. Living docs (`docs/CODEMAP.md`, [NOW.md](./NOW.md)) already say proxy.

SPEC-01 step 2 and DR-001 §2 still say **middleware** — that is **historical record**, not a bug and not a reason to recreate `middleware.ts`. Do not “fix” those SPEC/DR bodies; at most they carry a one-line superseded banner.

---

## Update rule

When you add, rename, merge, or drop a tab: edit **this file in the same change**. `docs/progress.md` still gets an append for the slice.
