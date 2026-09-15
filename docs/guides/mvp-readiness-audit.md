# MVP readiness audit — requirements, integrity, launch

> **Superseded note:** Isolation integration test landed after this date (`test/integration/isolation.integration.test.ts`); other P0 items (backup, deploy docs) still open.

**When:** 2026-09-15  
**Scope:** read-only. Correctness and launch readiness on top of architecture (companion to `engineering-audit.md` and `error-handling-logging-audit.md`).  
**Method:** BRD walk + code/test greps + file reads. Isolation test **not executed** (harness gap — §3).  
**Standard:** every claim cites a path; “generally fine” without an example checked is out of bounds.

---

# 1. Requirements traceability (Phase 1 BRD)

**Source:** `docs/requirements/brd.md` §5.1 / §6 Phase 1 + §7 RULEs.  
**Out of Phase 1 (do not score as MVP gaps):** BR-60, 67, 72–95, 100; Phase 4 marketplace/card pay; explicit OOS (shared marketplace, auto FX, translating owner content).

**Legend:** **Verified** = code + Jest unit and/or integration · **Untested** = code, no dedicated test · **Partial** · **Missing** · **Cannot verify** from static reading.

## 6.1 Stadium / pitch

| ID | Status | Evidence |
|---|---|---|
| BR-1 Multi-pitch (+ multi-location) | **Partial** | Multi-pitch: `Pitch` in `src/prisma/schema.prisma`; create/list `create-pitch.ts`, `list-pitch-summaries.ts`, Settings UI. **No** Location / `tenant.settings` (DR-002 / owner-ia defer). |
| BR-2 Booking → pitch | **Verified** | `Booking.pitchId`; inserts in `bookings.ts`. |
| BR-3 Weekly hours | **Verified** | `schedule-config.ts`; `availability.test.ts`. |
| BR-4 Game length | **Verified** | `slotDurationMinutes` + availability tests. |
| BR-5 Price + day/time rules | **Partial** | Default + day `priceRules` + UI `price-rules.tsx`; tests for day rules. **Time-window** `start`/`end` on rules deferred (owner-ia). |
| BR-6 Pitch blocks | **Missing** | No `pitch_blocks` table; SPEC-02 / owner-ia defer. |
| BR-7 Past midnight | **Verified** | `availability.test.ts` midnight window case. |

## 6.2 Availability / schedule

| ID | Status | Evidence |
|---|---|---|
| BR-8 Booked vs free day | **Untested** (UI) | `get-day-availability.ts`, public/owner Book; domain tests only. |
| BR-9 Today first | **Untested** | `/owner` → today; login redirect to today. |
| BR-10 Slots from hours | **Verified** | `generateSlotsForDay` / `resolveOfferedSlot` + tests. |
| BR-11 Edit/move booking | **Missing** | No update-booking use case (SPEC-09/10/14 defer). |
| BR-12 Asia/Beirut | **Verified** | Constants + `format-local-hm` / period tests. |

## 6.3 Booking create / approve

| ID | Status | Evidence |
|---|---|---|
| BR-13 Owner create fast | **Untested** | `create-owner-booking.ts` + `/owner/book`; schema test only. |
| BR-14 Owner → APPROVED | **Untested** | `insertApprovedOwnerBooking`. |
| BR-15 Public → PENDING | **Untested** | `request-public-slot.ts`; schema test only. |
| BR-16 Name + phone | **Verified** | `public-slot-request` schema + tests. |
| BR-17 Pending order | **Partial** | SQL `ORDER BY lower(during), requestedAt` in `bookings.ts` — not pure global FIFO. |
| BR-18 Approve / reject | **Partial** | Approve **integration** `approve-booking.integration.test.ts`. Reject use case **untested**. |
| BR-19 Pending may share; does not hold | **Verified** | Exclusion `WHERE status = APPROVED` migration; dual-PENDING integration. |
| BR-20 Auto-reject overlap | **Verified** | `reject-overlapping-pending.ts` + integration. |
| BR-21 Interest on auto-reject | **Verified** | `insertSlotInterest` + integration count. |
| BR-22 No-show ≠ cancel | **Partial** | `record-no-show.ts` + domain `decision.test.ts`; **no** application/integration test. |

## 6.4 Overlap rule

| ID | Status | Evidence |
|---|---|---|
| BR-23 / RULE-1 | **Verified** | GiST exclusion + `exclusion.integration.test.ts`. |
| BR-24 Concurrent | **Verified** (simulated) | Integration TOCTOU → `23P01` → DomainError. True multi-connection race not run. |
| BR-25 / RULE-2 | **Verified** | Exclusion APPROVED-only. |

## 6.5 Cancel / waitlist

| ID | Status | Evidence |
|---|---|---|
| BR-26 Owner cancel | **Partial** | `cancel-booking.ts` + UI; domain tests; **no** app/integration test. |
| BR-27–28 Cancellation policy | **Missing** | No `tenant.settings` / hours policy; player self-cancel absent. |
| BR-29 Interest after cancel | **Untested** | `list-open-waitlist.ts` + `/owner/waitlist`; domain `waitlist.test.ts` only. |
| BR-30 Notify ready message | **Verified** | `whatsapp-link.ts` + waitlist `<a>`; unit tests. |

## 6.6–6.7 Money

| ID | Status | Evidence |
|---|---|---|
| BR-31–35 / RULE-4–6 | **Verified** (domain) / rate **Untested** | Decimal ledger, freeze tenders, owner `set-exchange-rate.ts` (no use-case test). |
| BR-36 Rate always visible | **Partial** | Settings only, not every owner tab. |
| BR-37 Past tenders frozen | **Untested** | Append-only rates + `rateAtTime` by design. |
| BR-38 Live remaining while typing | **Partial** | Server remaining shown; no client recalculation on mixed inputs (`upcoming-panel.tsx`). |
| BR-39 Two-tap collect | **Cannot verify** | One-tap Collect exists; UX timing not assertable. |
| BR-40 No float | **Verified** | `money.test.ts`, Decimal columns. |
| BR-41–47 Per-player split | **Missing** | Schema stub `BookingParticipant`; only full-price requester; SPEC-06 defers. |
| BR-48–49 Due / who owes | **Untested** | `list-due-bookings.ts` + Home UI; domain remaining tested. |

## 6.8–6.9 Expenses / reports

| ID | Status | Evidence |
|---|---|---|
| BR-50–52 Expense record | **Untested** (use case) | `record-expense.ts` + Money sheet; schema/date tests. |
| BR-53 Money out | **Verified** (domain) | Ledger OUT + net tests. |
| BR-54–56 Period in/out/net + LBP display | **Verified** (domain) | `summarize-ledger-period.ts`, period/totals tests, Money UI. |
| BR-57 Games played / busy | **Missing** | Explicitly parked. |
| BR-58 Outstanding | **Partial** | Home due list, not a Reports total (SPEC-08). |
| BR-59 Fast reports | **Cannot verify** | Single SUM; no perf test. |

## 6.10–6.11 Public + WhatsApp

| ID | Status | Evidence |
|---|---|---|
| BR-61 Own page | **Verified** | Slug + `(public)/page.tsx` + slug tests. |
| BR-62 Name/location/contact | **Partial** | Name + slots; **no** location/contact fields. |
| BR-63 Request | **Untested** (E2E) | Implemented; schema tested. |
| BR-64 / RULE-7 Isolation | **Untested** (automated) | Extension + proxy; **no** cross-tenant Jest (§3). |
| BR-65 Weak network | **Cannot verify** | `max-w-lg` only. |
| BR-66 QR | **Missing** | No QR UI. |
| BR-68–69 WhatsApp prepare | **Verified** | `wa.me` only. |
| BR-70 In-app ping | **Missing** | List/badge only. |
| BR-71 Message set | **Partial** | Confirmed + slot-available tested; **no** rejected / cancelled / payment-reminder templates. |

## 6.14–6.15 Access / platform

| ID | Status | Evidence |
|---|---|---|
| BR-96–97 Owner / staff | **Verified** | `can.test.ts` + UI gates. |
| BR-98 Adjust staff without rebuild | **Partial** | jsonb permissions; **no** owner UI (DB/seed only). |
| BR-99 Non-email identifier | **Verified** | `identifier.ts` + tests. |
| BR-101–104 Subscription / suspend | **Missing** | No Plan/Subscription/admin; `platform-db` comment only. |

## Arabic / RTL (Phase 1)

| Item | Status | Evidence |
|---|---|---|
| Arabic + RTL shell | **Verified** (plumbing) | `layout.tsx` lang/dir; `locale.ts` tests; `ui-copy` ar/en. |
| Full visual RTL quality | **Cannot verify** | Needs click QA (§5). |

## Phase 1 coverage snapshot

| Bucket | Rough count |
|---|---|
| Verified | ~25–30 (engine, exclusion, Decimal, approve+interest, access `can`, locale helpers) |
| Untested but coded | ~15–20 (owner-create, public request, cancel/no-show/collect/expense apps, rate set, due list) |
| Partial | ~15 |
| Missing | ~15+ (blocks, edit booking, cancel policy, split BR-41–47, BR-57, QR, BR-70, WA templates, subscriptions) |
| Cannot verify | BR-39, 59, 65, RULE-12, RTL polish |

---

# 2. Data integrity

## Money writers

| Path | Payment + ledger? | Same `$transaction`? | Evidence |
|---|---|---|---|
| `collectBookingPayment` | Yes (IN via `recordPayment`) | Yes | `collect-booking-payment.ts` ~37–57 |
| `recordExpense` | Yes (expense + OUT via `recordPayment`) | Yes | `record-expense.ts` ~40–63 |
| `cancelBooking` | Neither (status only) | N/A | `cancel-booking.ts` comment “No refund / Payment write” |
| `recordNoShow` | Neither | N/A | `record-no-show.ts` “No Payment write” |
| `setExchangeRate` | Rate row only | Single create | OK — not cash |

**Shared kitchen:** `record-payment.ts` inserts payment+tenders then ledger on the **same** `tx`. Grep shows no other `payment.create` / `ledgerEntry.create` callers. Mid-step throw → interactive tx rollback → **no orphan payment/ledger pair** under current callers.

**Discipline caveat:** `recordPayment` does not open its own tx. Today both callers pass interactive `tx`. A future `db` call would auto-commit payment before ledger.

## `remainingDue` / double-collect

```45:66:src/modules/payment/domain/collect.ts
export function remainingDue(...) { return priceUsd.minus(collectedUsd); }
export function assertHasDue(remaining) {
  if (remaining.lte(0)) throw new DomainError("payment.nothing_due");
}
```

| Question | Answer | Evidence |
|---|---|---|
| Can remaining go negative? | **Yes** | Pure subtract; UI treats `lte(0)` as paid (`home-inbox.ts`). SPEC-06 / progress: overpay parked. |
| Sequential double-collect | **Blocked** | `assertHasDue` before write (`collect-booking-payment.ts` 46–47). |
| Cap tenders ≤ remaining? | **No** | `freezeTenders` ignores remaining — intentional overpay. |
| Concurrent double-collect | **Gap** | Plain `findBookingForCollect` SELECT; no `FOR UPDATE`, no version, no unique “one open collect.” Two txs can both pass `assertHasDue` and both insert. |

## Decimal / float

- No `parseFloat` / `.toNumber(` on money in `src/`.
- Forms: string → `parseUsd` / `parseLbp` (`lib/money.ts`); DB `@db.Decimal(12,2)` / LBP `(18,0)`.
- `Number(...)` hits are calendar/date only.
- Known quirk: tiny LBP can freeze to `0.00` USD equivalent (tested) — rare, not float leakage.

---

# 3. Isolation — verify in practice

## Design (present)

| Layer | File |
|---|---|
| Host / `?tenant=` → slug | `tenant-slug.ts`, `proxy.ts` sets `x-tenant-slug` |
| Header → Tenant row | `tenant-context.ts` |
| Prisma stamp/filter | `db.ts` extension on `TENANT_SCOPED_MODELS` |
| Session ≠ stadium | `get-current-membership.ts` — membership for **URL** tenant |

Raw SQL on Booking/SlotInterest stamps `tenantId` manually (`bookings.ts`) — extension does **not** wrap `$queryRaw`.

## Automated proof today

**None.** Integration suite: smoke, exclusion, approve — no two-tenant case (`test/integration/`, `test/modules/booking/`). SPEC-01 still lists isolation as manual acceptance.

## Could we run it now?

**Not without writing new fixture code** (out of scope for this audit).

`seedMinimalFixture()` hardcodes one slug/identifier (`test/integration/fixtures.ts` 44–63). Calling it twice hits unique constraints. Stubs (`setTenantSlug` / `setSessionCookie`) already support switching tenants.

**Setup needed to run a real proof:**

1. Parameterize fixture (`slug`, `identifier`, pitch name).
2. Seed A + B after `truncateAll()`.
3. Under A: create visible pitch/booking; under B’s slug: assert A ids absent / `null` / DomainError; B’s own rows visible.
4. Optional: A session cookie + B slug → `getCurrentMembership()` null.

**Verdict this audit:** isolation is **architecturally coherent and unproven by automation**. Do not claim “verified in practice” until that test (or a documented manual checklist) exists.

---

# 4. Performance (droplet)

## N+1

| Site | Pattern | Evidence |
|---|---|---|
| `rejectOverlappingPending` | Per loser: update + find requester + insert interest | `reject-overlapping-pending.ts` 32–44 — scales with overlapping PENDING |
| `insertPaymentWithTenders` | Sequential tender creates | Fine for 1–2 tenders |

## Extra round-trips (not classic N+1)

| Surface | Issue | Evidence |
|---|---|---|
| Owner Today | Sequential pending then due | `lists.tsx` ~45–46 — could `Promise.all` |
| Money panel | Sequential expenses → rate → ledger | `panel.tsx` ~121–129 |
| Waitlist | Sequential occupied then interests | `list-open-waitlist.ts` ~51–52 |
| `listDueBookings` | 2 booking queries parallel + 1 payment batch | Good batching |

## Unbounded growth (worse than N+1 at volume)

1. `listApprovedRanges` — all APPROVED for tenant (`bookings.ts` ~230–235).
2. `listApprovedBookingsStartingBefore` — all past APPROVED/NO_SHOW for overdue (`bookings.ts` ~466–484) — **grows forever**.
3. `listPendingBookings` / `listSlotInterestsWithPeople` — all rows for tenant.

## Indexes vs filters

| Present | Gap |
|---|---|
| `(tenantId, occurredAt)` on Ledger/Expense | Booking: only `tenantId` — no `(tenantId, status)` or time on `during` |
| Payment `(sourceType, sourceId)` | Prefer leading `tenantId` |
| ExchangeRate `tenantId` | Prefer `(tenantId, createdAt DESC)` for “latest rate” |
| GiST exclusion | Correctness, not list filters |

**MVP seed volume:** fine. **Paying multi-month history on one droplet:** past-due query + missing status indexes are the first cliff.

---

# 5. i18n / RTL completeness

## Locale toggle

| Surface | Toggle | Locale-aware copy |
|---|---|---|
| Public | Yes | Yes |
| Owner layout | Yes | Yes |
| Login | **No** | Defaults Arabic via `ui()` / `errorMessage()` without `getUiLocale` (`login/page.tsx`) |

Root `lang`/`dir` follow cookie (`layout.tsx`) → after public EN, login can be **LTR shell + Arabic labels**.

## Bidi — checked examples

**Good:** pending/waitlist phones, slot times/prices, money amounts, upcoming sheet times use `LtrIsolate` (`lists.tsx`, `waitlist/list.tsx`, `slot-picker.tsx`, `money/panel.tsx`, `upcoming-panel.tsx`).

**Gaps:**

1. Phone/money **inputs** often lack `dir="ltr"` (display isolated; typing not) — e.g. public/book `type="tel"` (`slot-picker.tsx`), expense USD/LBP fields.
2. `collectUsdLabel` / `dueRemainingLine` interpolate `$amount` into Arabic strings without `<bdi>` (`ui-copy.ts` ~366–378; Collect button raw in `upcoming-panel.tsx`).
3. Hardcoded English: `DateField` `"Pick a date"` (`date-field.tsx` 68); metadata `"Book a pitch. Collect in cash."` (`layout.tsx` 39).
4. Crash screens: intentional bilingual literals (SPEC-13) — OK.
5. Calendar chrome `enGB` — Western digits by design (DR-005).

No physical `pl-`/`pr-` Tailwind found under `src/` (logical properties).

---

# 6. Documentation accuracy

## Confirmed still accurate

- `docs/guides/folder-structure.md` — matches tree (`proxy.ts`, no `[locale]`, no `lib/auth.ts` / module `ui/`, no `platform/` module). Spot-checked 2026-09-15.

## Concrete stale / false claims

| Doc | Claim | Reality |
|---|---|---|
| **Root `README.md` L17** | “SPEC-01 and SPEC-02 implemented. Next: SPEC-03 …” | SPEC-03…14 shipped (`docs/README.md` specs list). |
| **`docs/README.md` L73–74** | “Parked: English switch …” | Cookie EN/ع on public + owner; next-intl/`[locale]` still parked. |
| **`docs/progress.md` journey header (~L35)** | Cannot: no-show / owner English | No-show is SPEC-14; owner has LangToggle + EN dictionaries. |
| **`docs/owner-ia.md` L178–180** | folder-structure still says `middleware.ts` | **False** after folder-structure rewrite. |
| **SPEC-01 ~L50–52** | Create `src/middleware.ts` | Code is `src/proxy.ts`. |
| **DR-001 §2** | “middleware resolves…” | Runtime Proxy. |
| **DR-005 / SPEC-13** | “No language switch” | Switch ships. |
| **`engineering-audit.md`** | folder-structure stale; `db-with-comments`; duplicate inserts | Fixed in code; **audit doc is now stale**. |
| **`prisma-transaction-tenant-guard.md` L172** | “Next slice is auth” | Auth + many SPECs shipped. |
| Historical SPECs citing `src/app/page.tsx` | Thin public page | Public is `src/app/(public)/page.tsx`. |

Still honest: no `modules/platform/`; backups open in DR-002; platform admin absent.

---

# 7. Deployment readiness

## Environment

| Item | Status |
|---|---|
| `.env.example` | `DATABASE_URL` + `DATABASE_URL_TEST` only (Docker 5433) |
| Also used, undocumented for prod | `NODE_ENV` (cookie secure), optional `PG_POOL_MAX` (`prisma-base.ts`) |
| Missing prod checklist | Public host/HTTPS, subdomain DNS, log disk path, “never seed prod”, backup |

No `SESSION_SECRET` — sessions are DB row + opaque cookie (OK if documented).

## Migrations from zero

Ten migrations under `src/prisma/migrations/` (init → tenancy → schedule → person/booking → exclusion → access → slot_interest → payment → expense → ledger index). Fresh DB path: Docker up → `.env` → `prisma migrate deploy` → optional `db:seed`. **Documented in `docs/guides/testing-jest.md`, not in root README.**

## Backup

**No plan.** DR-002 still “droplet backups out of scope.” No `pg_dump` cadence, no snapshot runbook.

## Dev-only surface in prod

- No `app/api` seed/debug routes found.
- Seed is CLI (`npm run db:seed`) — ops risk if run against prod URL, not a public endpoint.
- Compose is Postgres only — **no app Dockerfile / prod compose**.

## Docker Postgres for a stranger

**Yes if they find `testing-jest.md` + `.env.example` + `docker-compose.yml`.** **No** if they only read root README (dev/build/lint only; stale SPEC progress).

---

# 8. YAGNI / DRY / KISS — fresh check (2026-09-15)

## Priority 3 — confirmed landed

| Item | Evidence |
|---|---|
| `insertBookingDuring` | `bookings.ts` 21–68; public/owner wrappers |
| `format-local-hm` | `src/lib/format-local-hm.ts` + callers |
| `COMING_DAYS` vs `WINDOW_DAYS` | `list-due-bookings.ts` COMING_DAYS=7; `day-chips.tsx` comment + WINDOW_DAYS=5 |
| `db-with-comments.ts` | Deleted (absent) |

## Since Priority 3 (P0/P1 errors, expense sheet, hours editor)

| Finding | Verdict |
|---|---|
| Shared `actionErrorKey` / `rethrowUnexpected` on reads + mutators | **Good** — not new abstraction debt |
| `submitLogout` wrap | **Landed** (P0) — `login/actions.ts` 50–61 |
| `keepPeriodQuery` / `keepTenantQuery` duplicated across panels | Small KISS copy-paste — acceptable |
| Hours groups vs price-rules weekday UI parallel | Domain centralized; UI duplication mild |
| Schedule jsonb still richer than Settings UI (`gapMinutes: 0`, hidden time windows) | **Same YAGNI residual** as engineering audit — not regressed |
| No large new DRY fire from P0/P1 | Confirmed |

**Fresh verdict (2026-09-15):** Priority 3 goals hold. Post-P3 work did not reintroduce significant duplication. Highest YAGNI residual remains **schema/UI schedule power mismatch**; highest process smell is **stale docs**, not new code smell.

---

# Overall verdict

**Is this MVP ready to hand to a real paying owner?**

**Not if the contract is the full Phase 1 BRD.** Missing or stubbed: per-player split (BR-41–47), pitch blocks (BR-6), edit booking (BR-11), cancellation policy (BR-27–28), subscriptions/suspend (BR-101–104), public location/contact/QR, several WhatsApp templates, in-app ping. Isolation is designed but **not proven** by test. No backup plan. Root README cannot onboard a deployer.

**Closer if “MVP” means the scoped SPEC-01…14 product** (Arabic owner tabs + public request + cash collect/expense + waitlist links) for a **friendly pilot stadium** with one clerk and ops hand-holding. Even then, do not claim launch-ready until the ordered list below closes at least through P1.

## Ordered must-close list

1. **P0 — Isolation proof:** Parameterized two-tenant fixture + integration test (or signed manual checklist with screenshots). Without this, RULE-7 is faith.
2. **P0 — Backup:** Minimal droplet/Postgres snapshot or `pg_dump` cadence written in one place and followed.
3. **P0 — Deploy truth:** Fix root README (SPEC status + Docker migrate/seed); prod env checklist (host, HTTPS, DNS, `DATABASE_URL`, log disk, never seed prod).
4. **P1 — Concurrent collect race:** `SELECT … FOR UPDATE` (or equivalent) on booking/collected sums inside collect tx — or explicitly accept single-clerk risk in writing.
5. **P1 — Product honesty on BRD gaps:** Either park BR-41–47 / BR-6 / BR-101–104 formally in BRD “MVP cut” or implement the minimum the pilot owner needs (at least: “we don’t split yet” in UI copy).
6. **P1 — Unbounded Home past query + Booking `(tenantId, status)` index** before months of data accumulate.
7. **P2 — Login locale + Collect button bidi** (`getUiLocale` on login; isolate amounts in `collectUsdLabel`).
8. **P2 — Doc drift:** owner-ia middleware TODO, SPEC-01/DR-001 proxy wording, engineering-audit “folder-structure stale” section, progress journey header.
9. **P2 — Application tests** for cancel / no-show / collect / expense / owner-create / public-request (domain is ahead of use cases).
10. **P3 — Public contact/QR, BR-71 remaining templates, staff-permissions UI** — product polish after money/isolation/ops.

Until P0 items land, the honest line for a paying owner is: **“Pilot-ready with supervision, not production-ready.”**
