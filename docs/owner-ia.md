# Owner dashboard — information architecture

Living reference for `/owner` structure. **Update this file when tabs or routes change.** It is not a SPEC or DR; those stay in `docs/specs/` and `docs/decisions/`.

---

## Tabs (Phase 1)

Five real routes behind a shared layout. Bottom tab bar is `<Link>` navigation (icon + label), not client state. **Do not add a sixth tab** when later products ship — they become rows inside More.

| Tab | URL | Contains | Does **not** contain |
|---|---|---|---|
| Home | `/owner/today` | All pending requests (any date); overdue unpaid APPROVED (BR-49); today’s confirmed (compact status tags, tap-in collect/cancel); inline next 7 civil days | Book date picker, waitlist, rate, period, expenses |
| Book | `/owner/book` | Date picker + slot grid; create form in a dialog | Home lists, waitlist, Reports, Settings |
| Waitlist | `/owner/waitlist` | Open slot-interest groups + WhatsApp notify | Rate, period, expenses, Book |
| Reports | `/owner/money` | Period summary (hero difference, In/Out tiles + CSS bars); GET period form behind “Change period”; expenses as rows; record form behind “Add expense” | Exchange-rate **set** form, waitlist, Book, Home, Settings |
| More | `/owner/more` | Hub list of destinations. Today: Settings | Tab content for Home / Book / Waitlist / Reports |

`/owner` itself has no UI: it redirects to `/owner/today?tenant=`. Login lands on `/owner/today` (not `/owner`) so Server Action `redirect()` does not stack a second hop (`redirect.md`: actions **push** history).

Staff without `bookings.create`: Book tab is omitted. Hitting `/owner/book` directly shows an EmptyState, not slots.

Waitlist **tab label** is short (`owner.waitlistTab` = انتظار / Waitlist). The page heading stays the full `owner.waitlist` (قائمة الانتظار). Same pattern as Home (رئيسية vs الرئيسية).

Do not grow a tab by stacking another product’s UI on it. If it is not in the “Contains” column, it belongs on another tab or a **More list row** (see Phase 2+).

---

## Reports vs Settings

**Reports** (`/owner/money` — URL kept; label is تقارير / Reports):

- Period summary: difference is the hero; In = Volt, Out = due-muted; CSS In/Out bars from the two totals (no library, no extra query). Default range is this Beirut calendar month when `from`/`to` are omitted
- Period GET form (From/To/View/Display rate) collapsed behind “Change period”
- Recent expenses as compact rows (category icon, description, date, amount). Record form collapsed behind “Add expense”
- `getCurrentRate()` is a **read** for the LBP display fallback only

**Settings** (`/owner/more/settings`):

- Exchange rate: current value + OWNER-only set form (moved from Money). Staff see the current rate, not the form.
- Reserved for later (do not build in this slice):
  - Company / stadium info and images — **Phase 2+**. Lives on `tenant.settings` (DR-002 §2.6); that jsonb is still deferred.
  - Staff permissions UI — flags already exist on membership jsonb (DR-003 / BR-98); there is no owner screen to edit them yet.
  - Pitch create/edit (name, opening hours, game length, price — BR-3–BR-5) — **known gap**. Data exists (`Pitch.name` + `scheduleConfig`), seed is the only writer, availability engine reads it. No owner form and no write use case. Belongs in Settings once built.
  - Pitch blocks (BR-6, maintenance / private / academy) — **open question**. No `pitch_blocks` table yet (SPEC-02 deferred). Not the same as editing a pitch’s weekly hours.

---

## More is the standing home for later products

The bottom bar does not change again after this restructure. New products are **list rows on More**, not new tabs:

| Concern | Where |
|---|---|
| Settings (rate now; company / pitches / staff later) | More → Settings |
| Tournaments (future bounded context; seam via `pitch_blocks` like Academy) | More list row when that SPEC exists |
| Shop (Phase 2) | More list row — not a Reports subsection |
| Academy (Phase 3) | More list row — seam is `pitch_blocks`, not a Reports subsection |

---

## Routing decision

**Real App Router routes + `src/app/owner/layout.tsx`, never a client tab switcher.**

Why:

- Back button, bookmarks, and per-tab URLs work.
- Shared chrome (header + tab bar) does not remount on tab `<Link>` (local `layout.md`: layouts are cached on the client and do not rerender).
- Independent in-page `<Suspense>` per tab. **No `loading.tsx` under `/owner` or a tab folder** — that file wraps the whole `page.js` and would unmount Money GET date fields and Book day chips (already burned once; see `docs/progress.md`).

The only `"use client"` owner chrome is the tab bar (`usePathname` for the active tab, including prefix match so `/owner/more/settings` keeps More selected), `FlashToast` (`useSearchParams`), the Book calendar chip (same Popover as public), and `LangToggle` (same cookie + `html` lang/dir as public). Tab **content** lists stay Server Components.

Layouts cannot read `searchParams` or pathname (they would go stale). Tenant for tab Links comes from `getCurrentTenant()` (header). Flash toasts read `ok`/`error` in a Client child.

---

## Query params (per tab, not one mega-query)

Tab bar Links carry **`tenant` only** (local-dev; not isolation).

| Param | Lives on |
|---|---|
| `tenant` | every owner URL |
| `bookOn` | `/owner/book` only |
| `from` `to` `view` `displayRate` | `/owner/money` only |
| `ok` / `error` | the tab the action redirected to; FlashToast strips them |

### Server Action redirects

Use-case logic is unchanged. Only the redirect path:

| Action | Lands on |
|---|---|
| `submitApproveBooking` / `submitRejectBooking` / `submitCancelBooking` / `submitCollectPayment` | `/owner/today` |
| `submitCreateOwnerBooking` | `/owner/book` (keeps `bookOn`) |
| `submitRecordExpense` | `/owner/money` |
| `submitSetExchangeRate` | `/owner/more/settings` |
| `submitLogin` | `/owner/today` |
| Waitlist notify | WhatsApp `<a>` — no action |

GET forms: period → `action="/owner/money"`. Book day is Link chips + calendar (`?bookOn=`), same interaction as public `?date=` — not a GET form.

---

## Component map

| Piece | Where |
|---|---|
| Auth gate + header + logout + lang toggle | `src/app/owner/layout.tsx` |
| Tab bar | `src/app/owner/tab-bar.tsx` (`"use client"`, `usePathname`) |
| Index redirect | `src/app/owner/page.tsx` → `/owner/today` |
| `OwnerHome` (`today/lists.tsx` + `today/upcoming-panel.tsx`) + `today/actions.ts` | `/owner/today` |
| Date chips + `OwnerBookSlots` (`book/slots.tsx`) + `OwnerSlotPicker` (`book/picker.tsx`) + `book/actions.ts` | `/owner/book` |
| Shared slot grid | `src/components/slot-picker.tsx` (public + owner Book; name/phone in a Dialog; no booking/access/venue types) |
| Shared day chips | `src/components/day-chips.tsx` (public `?date=` + owner `?bookOn=`) |
| `OwnerWaitlist` (`waitlist/list.tsx`) | `/owner/waitlist` (no Server Action) |
| `OwnerMoney` (`money/panel.tsx`, `reveal.tsx`, `bars.ts`) + `money/actions.ts` | `/owner/money` (Reports) |
| More hub | `src/app/owner/more/page.tsx` |
| `OwnerSettings` (`more/settings/panel.tsx`) + `more/settings/actions.ts` | `/owner/more/settings` |
| Shared membership / tenant slug / `queryString` / `formatLocalRange` | `src/app/owner/shared.tsx` |
| Form field + POST keep-query / `redirectOwner` | `src/app/owner/form-query.ts` (today + book + money + settings) |
| Per-tab Suspense fallbacks | `today/skeleton.tsx`, `book/skeleton.tsx`, `waitlist/skeleton.tsx`, `money/skeleton.tsx`, `more/settings/skeleton.tsx` |
| FlashToast | layout Client child; reads URL (`useSearchParams`) |

If a helper is used by exactly one tab, it lives in that tab folder (or is folded into that tab’s TSX). There is no root `actions.ts` or `skeletons.tsx`.

`getCurrentMembership` is React `cache()`’d so layout + page share one lookup per request. Layouts cannot pass membership to `children`.

---

## Which tab does X belong in?

Add a row here when a module grows a screen. Do not invent a fifth scrolling section on Home. Do not add a sixth bottom tab.

| Concern | Tab / note |
|---|---|
| Pending + today’s confirmed + overdue unpaid | Home (`/owner/today`) |
| Phone-call / walk-in create | Book |
| Waitlist after cancel | Waitlist |
| Period P&L, expenses | Reports (`/owner/money`) |
| Exchange rate (set) | More → Settings |
| Pitch create/edit (BR-3–5) | Settings when built — **missing today** |
| Pitch blocks (BR-6) | Open — no table yet; not Settings until a SPEC |
| Company / stadium info | Settings — Phase 2+ / `tenant.settings` |
| Staff permission flags UI | Settings later |
| **Tournaments** | **More list row** (future; `pitch_blocks` seam) |
| **Shop (Phase 2)** | **More list row** |
| **Academy (Phase 3)** | **More list row** |
| No-show (parked SPEC-14) | Likely Home (ops on a confirmed booking) — confirm in the SPEC |
| Public booking request | Not owner — public `/` |

---

## TODO — Proxy vs middleware (do not forget)

Next.js 16 local docs (`file-conventions/proxy`, `loading.md`, `use-pathname.md`) say **Proxy**. This repo already runs tenant resolution in **`src/proxy.ts`**.

Training data, SPEC-01 step 2, DR-001 §2, and `docs/guides/folder-structure.md` still say **`middleware.ts`**.

That is a **documentation drift**, not a runtime bug today. **Next time anyone touches tenant resolution**, update SPEC-01 / DR-001 / folder-structure to `proxy.ts` so agents do not recreate `middleware.ts`. Do not “fix” it in an unrelated owner-UI slice.

---

## Update rule

When you add, rename, merge, or drop a tab: edit **this file in the same change**. `docs/progress.md` still gets an append for the slice.
