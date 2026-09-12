# Owner dashboard — information architecture

Living reference for `/owner` structure. **Update this file when tabs or routes change.** It is not a SPEC or DR; those stay in `docs/specs/` and `docs/decisions/`.

---

## Tabs (Phase 1)

Four real routes behind a shared layout. Bottom tab bar is `<Link>` navigation (icon + label), not client state.

| Tab | URL | Contains | Does **not** contain |
|---|---|---|---|
| Today | `/owner/today` | Pending requests + confirmed-today (approve / reject / collect / cancel) | Book date picker, waitlist, rate, period, expenses |
| Book | `/owner/book` | Date picker + slot grid + owner create form | Today lists, waitlist, money. Past `bookOn` is an empty state (create, not history) |
| Waitlist | `/owner/waitlist` | Open slot-interest groups + WhatsApp notify | Rate, period, expenses, Book |
| Money | `/owner/money` | Period report GET form, exchange rate, record expense + recent list | Waitlist, Book, Today |

`/owner` itself has no UI: it redirects to `/owner/today?tenant=`. Login lands on `/owner/today` (not `/owner`) so Server Action `redirect()` does not stack a second hop (`redirect.md`: actions **push** history).

Staff without `bookings.create`: Book tab is omitted. Hitting `/owner/book` directly shows an EmptyState, not slots.

Do not grow a tab by stacking another product’s UI on it. If it is not in the “Contains” column, it belongs on another tab or a new tab (see Phase 2+).

---

## Routing decision

**Real App Router routes + `src/app/owner/layout.tsx`, never a client tab switcher.**

Why:

- Back button, bookmarks, and per-tab URLs work.
- Shared chrome (header + tab bar) does not remount on tab `<Link>` (local `layout.md`: layouts are cached on the client and do not rerender).
- Independent in-page `<Suspense>` per tab. **No `loading.tsx` under `/owner` or a tab folder** — that file wraps the whole `page.js` and would unmount Book/Money GET date fields (already burned once; see `docs/progress.md`).

The only `"use client"` owner chrome is the tab bar (`usePathname` for the active tab) and `FlashToast` (`useSearchParams`). Tab **content** stays Server Components.

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
| `submitSetExchangeRate` / `submitRecordExpense` | `/owner/money` |
| `submitLogin` | `/owner/today` |
| Waitlist notify | WhatsApp `<a>` — no action |

GET forms: Book day → `action="/owner/book"`; period → `action="/owner/money"`.

---

## Component map

| Piece | Where |
|---|---|
| Auth gate + header + logout | `src/app/owner/layout.tsx` |
| Tab bar | `src/app/owner/tab-bar.tsx` (`"use client"`, `usePathname`) |
| Index redirect | `src/app/owner/page.tsx` → `/owner/today` |
| `OwnerToday` (`today/lists.tsx`) + `today/actions.ts` | `/owner/today` |
| Date GET form + `OwnerBookSlots` (`book/slots.tsx`) + `book/actions.ts` | `/owner/book` |
| `OwnerWaitlist` (`waitlist/list.tsx`) | `/owner/waitlist` (no Server Action) |
| `OwnerMoney` (`money/panel.tsx`) + `money/actions.ts` | `/owner/money` |
| Shared membership / tenant slug / `queryString` / `formatLocalRange` | `src/app/owner/shared.tsx` |
| Form field + POST keep-query / `redirectOwner` | `src/app/owner/form-query.ts` (today + book + money) |
| Per-tab Suspense fallbacks | `today/skeleton.tsx`, `book/skeleton.tsx`, `waitlist/skeleton.tsx`, `money/skeleton.tsx` |
| FlashToast | layout Client child; reads URL (`useSearchParams`) |

If a helper is used by exactly one tab, it lives in that tab folder (or is folded into that tab’s TSX). There is no root `actions.ts` or `skeletons.tsx`.

`getCurrentMembership` is React `cache()`’d so layout + page share one lookup per request. Layouts cannot pass membership to `children`.

---

## Which tab does X belong in?

Add a row here when a module grows a screen. Do not invent a fifth scrolling section on Today.

| Concern | Tab / note |
|---|---|
| Pending + today’s confirmed ops | Today |
| Phone-call / walk-in create | Book |
| Waitlist after cancel | Waitlist |
| Rate, period P&L, expenses | Money |
| **Shop (Phase 2)** | **Own tab** (do not hang products off Money or Today) |
| **Academy (Phase 3)** | **Own tab or group** — decide when that SPEC is written; not a Money subsection |
| No-show (parked SPEC-14) | Likely Today (ops on a confirmed booking) — confirm in the SPEC |
| Public booking request | Not owner — public `/` |

---

## TODO — Proxy vs middleware (do not forget)

Next.js 16 local docs (`file-conventions/proxy`, `loading.md`, `use-pathname.md`) say **Proxy**. This repo already runs tenant resolution in **`src/proxy.ts`**.

Training data, SPEC-01 step 2, DR-001 §2, and `docs/guides/folder-structure.md` still say **`middleware.ts`**.

That is a **documentation drift**, not a runtime bug today. **Next time anyone touches tenant resolution**, update SPEC-01 / DR-001 / folder-structure to `proxy.ts` so agents do not recreate `middleware.ts`. Do not “fix” it in an unrelated owner-UI slice.

---

## Update rule

When you add, rename, merge, or drop a tab: edit **this file in the same change**. `docs/progress.md` still gets an append for the slice.
