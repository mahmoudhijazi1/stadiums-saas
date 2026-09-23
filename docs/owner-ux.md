# UX-01: Owner Interface Structure

**Type:** UX decision record + screen spec
**Scope:** Owner back-office (mobile-first PWA). Staff view is derived from it via permissions.
**Supersedes:** the previous bottom tab bar (Home, Book, Waitlist, Reports, More), and `docs/owner-ia.md` wherever they disagree. Update `owner-ia.md` in the shell slice so the living route list matches this file.
**Governing rule:** RULE-12. Every owner-facing action must be faster than writing it on paper.

**Amended after audit** (2026-09-23). Header content is this file; the bar stays floating below `lg` and a dark block at `lg`, and it never hides on scroll. The `lg` rail stays: same five destinations, with ＋ a primary button at the top of the rail. "Didn't happen" is No-show only (SPEC-14: money stays due, Collect still works; no waive; do not change `recordNoShow` or `cancelBooking`). Settings use `settings.manage` (`OWNER` already passes `can()`). Language lives under Account in the business menu. No "Switch business" and no cross-tenant membership query. Session length is unchanged here (a later access task: rolling 30 days). Copy goes through `ui()`. Cancel visibility uses `isPastUnpaidCancel` / `assertApprovedForCancel`. Edit / Move is out of scope. `deriveDisplayState` ships with Today. Person search ships with phone autocomplete; the header search screen is its own later slice. Outstanding-by-person and pitch activity ship with Money.

---

## 1. Organizing principle

Structure the app by the owner's **moment**, not by database entity. He opens the app for one of four reasons:

| Moment | Where it lives |
|---|---|
| "What's happening now?" | **Today** tab |
| "Someone wants a slot" | **Requests** tab |
| "I need to write this down" | Center **＋** button |
| "How am I doing?" | **Money** tab |

Everything else (setup, later phases) lives in **More**.

**Why:** entity-based navigation (Bookings / Payments / Persons) makes the owner translate his situation into our data model. Moment-based navigation matches what he is doing when he picks up the phone.

---

## 2. Global shell

### 2.1 Header (sticky, same content on every screen)

**Visual treatment (kept):** below `lg` the bar is a floating inverse sheet, inset from the edges. At `lg` it is the full-width dark block on the content column. `position: sticky; top: 0`. It must not hide on scroll.

```
┌─────────────────────────────────────────┐
│ (أ) ملاعب أحمد ▾                    🔍   │
└─────────────────────────────────────────┘
```

| Element | Position | Behavior |
|---|---|---|
| Tenant avatar + name + ▾ | start | One tappable control. Opens the **business menu** (bottom sheet). There is no `Tenant.logo` field: the avatar is his initial on a colored circle. |
| Search | end | The control sits in the header from the shell slice. The results screen (people and bookings by name or phone) is a later slice. Do not ship a fake results page in the shell. |
| Offline pill | under header | Shows "بدون اتصال" **only** while offline. Invisible the rest of the time. |

**Business menu contents:**
- My public page: open, copy link, show QR, share to WhatsApp
- Settings (shortcut; also in More). Hidden without `settings.manage`.
- Account: theme (light / dark / system), language toggle, then log out

There is no "Switch business". Do not query memberships across tenants.

**Why this shape:**
- Identity and business-level actions share one control (the workspace-menu pattern from Slack/Notion/Shopify mobile). One identity control, not two.
- Search is the only question that belongs to no single tab. The real scenario: the phone rings, "I'm Sami, do I still owe you?" He needs the answer in 3 seconds from any screen.
- The offline pill exists because village connectivity is unreliable (A-4, A-5). He must know when a tap will not reach the server.

**Deliberately excluded from the header:**

| Excluded | Reason |
|---|---|
| Notification bell | The Requests tab badge already does this. Two indicators for one thing split attention. |
| Hamburger menu | The More tab is the menu. Two menus mean guessing which holds what. |
| Page title | The active tab already says where he is. |
| Language switch in the header | Lives under Account in the business menu. |
| Exchange rate | Lives in Settings. Shown read-only inside the Collect sheet, where it matters (§6.1). |
| Separate profile avatar | Merged into the business menu. |

**Header rules:**
- Fixed. **Never hide-on-scroll.** He uses one hand while standing; a header that slides away moves the controls he is reaching for.
- Height 56px + `env(safe-area-inset-top)` (installed PWA sits under the OS status bar).
- Tap targets ≥ 44px.
- Menus open as **bottom sheets**, not dropdowns. The thumb lives at the bottom of the screen.
- Logical positioning only (`start` / `end`). In Arabic the name sits on the right automatically.
- Staff see the same header. Menu items they lack permission for are hidden.

### 2.2 Contextual sub-bar (per tab, sticky under the header)

Contextual controls belong to the tab's content, not the global header.

| Tab | Sub-bar |
|---|---|
| Today | Day strip (‹ yesterday · **today** · tomorrow ›) + pitch chips if the tenant has more than one pitch. This strip is a **new** Today control. Do not change the public `DayChips` (or the owner Book row that shares it). |
| Requests | none |
| Money | Period switcher: Today / Week / Month / Custom |
| More | none |

### 2.3 Bottom tab bar (5 slots)

| Slot | Label (ar / en) | Badge |
|---|---|---|
| 1 | اليوم / Today | — |
| 2 | الطلبات / Requests | pending request count |
| 3 | ＋ (center action button) | — |
| 4 | المال / Money | — |
| 5 | المزيد / More | — |

**Changes from the previous bar, with reasons:**
1. **Waitlist → Requests.** The waitlist matters only right after a cancellation; as a tab it would be empty most days. Requests are the high-priority inbox checked many times a day. The waitlist appears contextually (§6.3).
2. **Book → center ＋.** Booking is an action, a tab is a place. Most bookings start from tapping a free slot on Today. The ＋ covers "no context, just record it" (phone booking, expense, later shop sale), so adding the shop costs no new tab.
3. **Reports → Money.** The owner thinks "money," not "reports." The tab also holds debts and expenses, which are not reports. The URL stays `/owner/money`.

**At `lg` and up** the same five destinations are a start-side rail (right in Arabic). ＋ is a primary button at the **top** of the rail, then Today, Requests, Money, More. It is not a fifth equal nav row.

Tab root pages (Today, Requests, Money, More) have **no large page title**. The active destination already names the screen. Nested pages (Settings, pitch create/edit, and the Book and waitlist routes, which are no longer tabs) keep a title and a back button.

`/owner/book` and `/owner/waitlist` stay real routes. They are not tabs. Requests is `/owner/requests`. The shell may show the existing pending list there; the notify sheet and reject reasons are the Requests slice. Today's pending inbox stays until that slice replaces it.

---

## 3. Today tab (landing screen)

**The owner lands here after login and every time he opens the app (BR-9).**

One vertical timeline. Defaults to today. The day strip moves to past and future days. **Past, present and future use the same view**, so there is no separate schedule screen. He learns one screen, not two.

### 3.1 Layout, top to bottom

1. **Requests banner** — only when pending requests exist: "3 طلبات جديدة". Tapping goes to Requests. He must never miss a request because he opened Today first.
2. **Live card** — only when a game is in progress: pitch, player, time remaining. Scoreboard visual language.
3. **Needs collection** — ended games with money still due. Highest-value cards after the live game.
4. **Timeline** — every slot of the day, per pitch, filtered by pitch chips.

Sections 1–3 appear only on **today**. On other days, only the timeline shows.

### 3.2 Slot / card states

Every state uses **color + icon + label together**. Never color alone (sunlight, colorblindness).

| State | Shows | Primary tap |
|---|---|---|
| Free | time + price | Book here (opens quick booking with slot prefilled) |
| Free + requests | "2 طلبات" chip | Opens Requests filtered to that slot |
| Free + interested (after a cancellation) | "3 مهتمين" chip | Opens the interested list (§6.3) |
| Confirmed, upcoming | player name | Booking sheet |
| Live | live indicator, time left | Booking sheet |
| Ended, unpaid | amber, "$30 مستحق" | Two buttons: **Collect** / **Didn't happen** |
| Partially paid | "$10 متبقي" | Collect |
| Paid | green check | Booking sheet |
| Cancelled / no-show | greyed, struck through | Booking sheet |

**Live / Ended are derived from the clock at render time, never stored.** Same principle as computed slots: no cron job, no status to keep in sync. The derivation is a pure domain function (`deriveDisplayState(booking, payment, now)`), used by every card. It ships with the Today slice, in `booking/domain`, with Jest coverage for a booking that crosses midnight.

### 3.3 Booking sheet (tap any booking)

The single place for everything about one booking.

- Player name, phone (tap → call or WhatsApp), pitch, time, price
- Payment progress (due / paid / remaining, in USD)
- Actions: **Collect**, **Cancel**, **Didn't happen**, **Notify**
- Edit / Move is out of scope. Do not put it on the sheet.
- Actions are shown or hidden by permission and by the domain rules the mutation already uses: `isPastUnpaidCancel` and `assertApprovedForCancel` (there is no `canCancel`)

---

## 4. Requests tab

**Grouped by slot, ordered by `requested_at` inside each group** (BR-17). The owner is choosing between people for a slot, so the slot is the unit.

```
الجمعة 8:00–9:00 · ملعب 1 · $30
  ① أحمد  · قبل ساعتين      [✓]  [✗]
  ② سامي  · قبل 40 د        [✓]  [✗]
```

### 4.1 Approve
One tap on ✓. The booking is confirmed, siblings are auto-rejected and become slot interests (BR-20, BR-21). A **notify sheet** opens:
- "Notify Ahmad: confirmed"
- "Notify Sami: slot taken"

### 4.2 Reject
Tap ✗ → reason chips: الملعب محجوز / مغلق / سبب آخر (free text). The reason is inserted into the prebuilt WhatsApp message.

### 4.3 Notify list pattern (used everywhere)

A `wa.me` link opens **one chat at a time**. "Notify everyone" cannot be one tap. So every multi-recipient notification is a short list:

```
أحمد    تم التأكيد      [إرسال]  → ✓ after tap
سامي    الموعد محجوز   [إرسال]
```

Each row's button turns into ✓ once tapped. That state is what makes the list usable: without it he loses track of who was messaged. MVP: the ✓ state is local to the open sheet (not persisted).

### 4.4 Empty state
"لا طلبات جديدة" + a secondary action to share the public page link. An empty inbox is an invitation to get more requests.

---

## 5. Center ＋ (quick record)

Opens an action sheet: **Booking**, **Expense**, (later) **Sale**.

The shell slice only opens that sheet. Booking goes to the existing `/owner/book` screen. Expense goes to the existing expense entry on Money. The quick-booking form below ships after person search (phone autocomplete). The header search screen is a separate later slice. Do not add a cross-tenant membership list.

### 5.1 Quick booking (phone-call case, BR-13)
1. Day (defaults to today)
2. Tap a free slot
3. Name + phone. Existing persons autocomplete by phone (per-tenant matching key)
4. Save → **confirmed immediately** (RULE-3)

Target: under 10 seconds.

### 5.2 Expense (BR-50)
Amount → category chips → optional note → Save. Date defaults to today. Tenders work like payments (USD / LBP).

---

## 6. Flows

### 6.1 Collect (BR-38, BR-39)

Tap an ended game → Collect sheet:

```
Due $30
[ Whole game | Per player ]      ← mode switch
[ Paid in full ($) ]              ← the 2-tap path
+ Add LBP  + Add USD
Remaining: $0.00
Rate: 90,000 (read-only)
[ Save ]
```

- **Common case: 2 taps** (Collect → Paid in full).
- Split currency: add an LBP tender, type the amount, watch Remaining drop live in USD.
- The rate is shown **read-only**. It is managed in Settings; showing it here lets him see what an LBP tender converts at before saving.
- **Mode switch is designed now:** MVP ships "Whole game" only (Per player disabled or hidden). When participants arrive, Per player shows a player list with an individual Paid tap per row. The sheet does not get redesigned later.

### 6.2 Didn't happen (BR-22, SPEC-14)

Shown on ended cards next to Collect. The only choice is **No-show** (they didn't come). There is no "Cancelled late" and no waive in MVP.

SPEC-14 wins: a no-show **stays due**. Collect still works. Do not change `recordNoShow` or `cancelBooking`.

### 6.3 Cancel (item: player asked to cancel)

Booking sheet → Cancel → reason (player asked / owner) → confirm. The same sheet then shows:

> "The slot is free. 3 people are interested."

Interested people are listed in interest order, each with a notify row (§4.3). The freed slot on Today also shows the "مهتمين" chip, so he can return to the list later.

### 6.4 Login
After login → Today. Installed PWA so he rarely sees the login screen.

Do not change session length in a UI slice. A later access task sets a rolling 30-day session. Until then the cookie stays as it is.

---

## 7. Money tab

- **Summary card:** In / Out / Net in USD for the selected period. LBP display toggle with a display rate (BR-56).
- **Who owes (المستحقات):** outstanding amounts across all games, grouped by person, with Collect and a WhatsApp reminder. (Today covers "this game"; this covers "all games", BR-49.)
- **Activity:** games played, busy-ness per pitch (BR-57).
- **Expenses list:** add from here too; ＋ is the fast path.

Reads **only from the ledger** (and outstanding from payments), per the existing architecture.

Outstanding-by-person and pitch activity ship with the Money slice, not the shell.

---

## 8. More tab

- Pitches (name, hours groups, slot length, pricing rules)
- Business settings (cancellation window, approval required, WhatsApp number, **exchange rate + history**)
- Public page (link, QR, share)
- Staff *(later)*
- Shop / Academy / Tournaments hubs *(as they arrive)*
- Account / log out

---

## 9. Staff view

Same shell, filtered by `can()`. Never a forked layout, never `role === ...` checks in UI.

| Area | Staff |
|---|---|
| Today | yes |
| ＋ | yes (booking, expense per permissions) |
| Requests | visible, **no approve** (BR-97) |
| Collect / Cancel | yes (current permission model) |
| Money | hidden until dashboard access is decided |
| More | settings items hidden without `settings.manage`. Never `role === "OWNER"` in UI. `OWNER` already passes `can()`. |

---

## 10. Cross-cutting UI rules

- Arabic-first, RTL, logical properties only (`ps`/`pe`, `ms`/`me`, `start`/`end`).
- Times, phones and amounts wrapped in LTR isolation (`<bdi>` / `dir="ltr"`).
- Western digits everywhere.
- Server Components by default; client components only where interaction requires it (slot picker, tender input, sheets).
- Scoped Suspense boundaries per section so one slow query never blocks the whole screen.
- Every sheet is a bottom sheet. Every primary action is reachable by thumb.
- Every card state = color + icon + label.
- Warn, never obstruct (RULE-10).
- Copy: plain verbs, sentence case, an action keeps its name through the flow ("Collect" button → "Collected" confirmation). Every string goes through `ui()` in `src/lib/ui-copy.ts`. `next-intl` is not installed.

---

## 11. Open decisions

| ID | Question | Current default |
|---|---|---|
| UX-Q2 | Persist the notify-list ✓ state? | No, local to the sheet in MVP |
| UX-Q3 | Search scope in MVP: persons only, or persons + bookings? | Phone autocomplete first (exact phone, then name). The header results screen is a later slice and may show that person's bookings and outstanding. |
| UX-Q4 | Show pending requests as ghost cards on the timeline, or only as a chip on the free slot? | Chip only |