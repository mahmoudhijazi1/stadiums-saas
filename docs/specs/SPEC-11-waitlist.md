# SPEC-11 — Waitlist on a freed slot

**Type:** Build Spec — precise, boring instructions to hand to Cursor.
**Depends on:** DR-001 §4 (Booking owns interests; Notification owns WhatsApp links;
arrows down — Notification never imports Booking),
DR-002 §2.13 (`slot_interests` is `pitch_id + during`, not a rejected-booking id),
DR-003 §5–6 (`can(...)`; Access never imports Booking),
BR-21, BR-29, BR-30, BR-69, BR-71 (“slot now available” only), RULE-1.
**Builds on:** SPEC-01–10. Do not re-open cancel, Book, approve, collect, expenses, or
This period.
**Scope:** Logged-in owner (or staff who can open `/owner`) **sees who wanted a slot that
is free again**, and can open WhatsApp with a ready-made “slot available” message in one
tap.
**No** WhatsApp Cloud API / server send, no consume/delete of interest rows, no other
BR-71 messages (confirmed / rejected / cancelled / payment reminder), no in-app ping
(BR-70), no `tenant.settings`, no Arabic/RTL, no public waitlist.

> **Framework note:** Next.js / Prisma in this repo differ from training data. Before
> Server Actions / `$queryRaw`, read `node_modules/next/dist/docs/` and installed Prisma docs.
> This spec is WHAT and WHY.

> **Comments:** every exported function gets a short human comment — why it exists. No essays.

> **Transactions:** this slice is **read + a link**. No `$transaction` unless you add a write
> (do not). Notifications are not DB writes; `wa.me` is built in domain, rendered as `<a>`.

---



## What this slice delivers

Two people requested the same hour. Ahmad approved one. The loser already has a
`slot_interests` row (SPEC-05 / SPEC-09). Ahmad later **Cancels** that confirmed game.
`/owner` shows the freed hour and the loser’s **name + phone**, with **Notify** opening
WhatsApp (`wa.me`) and a prefilled English message. The owner taps send in WhatsApp himself
(BR-69). Sami never sees Ahmad’s waitlist.

If nobody lost that hour, the Waitlist section is empty. Public Request does not show other
people’s names.

---



## Prerequisites

- SPEC-01–10 click-proofed. `SlotInterest` table exists; writes happen on auto-reject only
  (manual reject does not). `CANCELLED` does not occupy.
- `npm test` green.

---



## Pins this spec must make (BRD / DRs left them loose)

**When it shows (BR-29):** a waitlist row is listed only if **all** of:

1. It is a `SlotInterest` on this tenant (guard / ALS).
2. The window has **not ended** (`end > now`, Beirut “now” via `Date`).
3. That pitch + window is **not occupied** — no APPROVED range on that pitch whose `during`
   overlaps the interest window (reuse Booking `overlaps()`). CANCELLED / PENDING /
   REJECTED do not occupy (already true).

Do **not** show interests on an hour that is still APPROVED. The freed slot, not the dead
booking, is the key (DR-002 §2.13).

**Match:** interest `during` is the **filled** window copied at approve / owner-create. Match
that range with `overlaps()`, not string-equal labels.

**Who may see it:** any membership that can open `/owner` (same as the pending inbox). No
new `can()` flag this slice — listing names is not a mutation. Do **not** reuse
`"bookings.cancel"` / `"bookings.create"` as a gate. Staff `staff@ahmad` **can see** the
list and Notify (they already see pending phones). They still cannot Cancel / Book unless
those flags are set.

**Notify (BR-30 / BR-69):** **no** Server Action, no WhatsApp API, no row write. `<a href>`
to `https://wa.me/<e164>?text=...`. Owner sends in WhatsApp. Message situation this slice:
**slot now available** only (BR-71). Other templates stay out.

**WhatsApp number:** Person.phone is digits-only (`normalizePhone`). Lebanon this slice:

- digits starting `961` → use as-is
- digits starting `0` → drop the `0`, prefix `961`
- else → prefix `961`

Notification domain owns this. Booking must not format `wa.me`.

**Message (English):** stadium name, pitch name, local start–end (`Asia/Beirut`). Example
shape: `{stadium}: {pitch} {start}–{end} is free again if you still want it.` No Arabic this
slice. Encode the query with `encodeURIComponent`.

**Do not consume interests:** Notify does not delete the row. Re-booking that hour (Book or
Approve) occupies it again so the waitlist **hides** (rule 3) until the new booking is
cancelled. Same people can reappear. Do not invent “notified_at”.

**Do not write interests on cancel:** already written on auto-reject. Cancel stays as SPEC-10.

**Public page:** no waitlist. Other players must not see who wanted the hour.

**UI:** stay on `/owner`. New heading **Waitlist**. Group by pitch + window, soonest start
first. Inside a group: people **oldest `createdAt` first** (who was rejected first). Dedupe
`personId` per window. Empty: “No waitlist.” Book a slot / Confirmed / pending / expenses /
This period unchanged. No waitlist names on PENDING rows. No extra query params required
after Cancel (the section lists every open window).

**Notification module:** first real files in `src/modules/notification/domain/` (DR-001).
Do **not** scaffold `shop/` or `academy/`. Notification never imports Booking / Payment.
Booking application may import Notification.

**Seed:** no sample interests. Click-proof creates them via two public requests + approve +
cancel.

**Schema:** none. `SlotInterest` already exists. No unique index this slice.

---



## Step 1 — Notification domain (WhatsApp link + message)

`src/modules/notification/domain/whatsapp-link.ts` (name may vary):

- `whatsAppHref(phoneDigits, text)` → `https://wa.me/<e164>?text=<encoded>`
- E.164 rule as pinned (Lebanon).
- `slotAvailableMessage({ stadiumName, pitchName, startLocal, endLocal })` → the English
  string. Pure, no `await`.

Jest: `03…` → `961…`; already-`961` unchanged; message contains stadium + times; empty/garbage
phone is a thrown error or a documented skip — pick one and test it (prefer throw
`"Phone cannot be used for WhatsApp"` so a bad row does not render a broken link).

**Definition of done:** `npm test` includes those cases. No UI yet.

---



## Step 2 — Booking domain

Tiny helper in `src/modules/booking/domain/`: given an interest window and occupied APPROVED
ranges on that pitch, is the window **open** (not overlapping any occupied, and `end > now`)?
Jest: occupied overlap → closed; CANCELLED is not in the occupied list so open; past `end`
→ closed.

Reuse existing `overlaps()`. Do not import Prisma.

**Definition of done:** `npm test` includes those cases.

---



## Step 3 — Infrastructure

`listSlotInterestsWithPeople(tx)` (name may vary): raw `$queryRaw` because `during` is
Unsupported. Join Pitch + Person. `tenantId` from ALS (extension does not stamp raw SQL).
Return `pitchId`, pitch name, start, end, personId, name, phone, `createdAt`. Guard still
scopes if you also have a Client read — raw must pass `tenantId`.

No `tenantId` argument on the function. Do not add `SlotInterest.create` (still Unsupported).

**Definition of done:** app code can load this tenant’s interest rows with names; Sami’s
rows do not appear when ALS is Ahmad.

---



## Step 4 — Use case

`listOpenWaitlist()` (name may vary):

1. Membership required else `"Not allowed"` (same as pending list). **No** extra `can()`
   flag.
2. Load interests + `listApprovedRanges`.
3. Keep rows where domain says the window is open. Dedupe `personId` per pitch+start+end.
4. Group by pitch + window, soonest first; people oldest first.
5. Attach `whatsAppHref` + message using Notification domain + tenant name (from
   `getCurrentTenant`, not a Prisma import on the page).

No `$transaction`. No Payment. Do not log phone numbers.

**Definition of done:** owner sees groups after a real cancel of an hour that had losers;
an hour still APPROVED does not appear.

---



## Step 5 — Thin `/owner` UI

Keep the page a Server Component. No Prisma, no `tenantId`.

Call `listOpenWaitlist()`. Render **Waitlist**. Each group: pitch, local range, then people
(name, `code` phone, **Notify** as `<a href={whatsAppHref}>` — not a Server Action).
`target="_blank"` + `rel="noopener noreferrer"`.

Do not add waitlist to the public page. Do not add refund fields. Do not change Cancel.

Local Next docs: this is a GET render (`page.md` — Server Component, `searchParams` Promise).
No new mutation; no `redirect` for Notify.

**Definition of done:** Ahmad cancels an hour that had an auto-rejected loser; Waitlist
shows that person; Notify opens `wa.me`; public page has no names; `?tenant=sami` does not
show Ahmad’s people; Book / cancel / collect still work.

---



## Tests (Jest)

| Step | Jest |
| --- | --- |
| 1 Notification | `test/modules/notification/domain/` |
| 2 Booking domain | `test/modules/booking/domain/` |
| 3–5 Infra / use case / UI | No mandatory unit tests. Click + Studio. |

**Definition of done (Jest):** `npm test` includes SPEC-01–10 suites plus the new tests.

---



## Whole-slice acceptance

1. `npm test` green. ✅
2. Two PUBLIC PENDING same hour → approve one → cancel that APPROVED → Waitlist shows the
   other person (name + phone) for that pitch/window. ✅
3. Notify is `wa.me` with prefilled English text (stadium, pitch, local times). No new DB row.
   Interest row still in Studio. ✅
4. While the hour is APPROVED again, that window is **absent** from Waitlist. ✅
5. Manual reject (no interest row) does not invent a waitlist person. ✅
6. `?tenant=sami` does not show Ahmad’s interests. ✅
7. Public page has no waitlist. ✅
8. Pages have no Prisma / no `tenantId`. Notification does not import Booking. Cancel does
   not write Payment/Ledger. ✅

---



## Out of scope (do not build)

- WhatsApp Business / Cloud API / sending from the server (BR-72)
- Other BR-71 templates (confirmed, rejected, cancelled, payment reminder)
- In-app owner ping on new request (BR-70)
- Deleting or “marking notified” interest rows
- Player self-cancel / cancellation hours / `tenant.settings` (BR-27–28)
- Refunds, no-show, overpay warning
- Arabic / RTL

---



## After this slice

Arabic / no-show / remaining BR-71 templates as product asks. Overpay warning still parked.

---



## Step order for the agent

One numbered step at a time. Wait for OK. Do not scaffold `shop/` or `academy/`.
Do not send WhatsApp from the server “just in case.”
Do not add `tenant.settings` for a WhatsApp Business number.
