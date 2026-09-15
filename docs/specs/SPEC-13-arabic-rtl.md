# SPEC-13 — Arabic-first UI (RTL + copy)

> **Superseded note:** Cookie EN/ع toggle shipped later on public + owner; next-intl / `[locale]` still out.

**Type:** Build Spec — precise, boring instructions to hand to Cursor.
**Depends on:** [DR-005](../decisions/DR-005-arabic-rtl.md), DR-004 (keys stay),
BRD A-1, A-2, R-4, RULE-11, `.cursor/rules/100-rtl-i18n.mdc`.
**Builds on:** SPEC-01–12. Do not re-open booking, collect, expense, ledger, waitlist, or
error-handling **rules**. Copy and `dir` only.
**Scope:** Root `dir="rtl"` `lang="ar"`; Arabic dictionaries for errors, success toasts,
chrome, and the one existing WhatsApp template. Western digits. Tenant-authored strings
untouched.
**No** next-intl, no `[locale]` routes, no language switch, no `tenant.settings`, no new
WhatsApp templates, no no-show, no Prisma.

> **Framework note:** Before `layout.tsx` / `global-error.tsx`, read
> `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md`
> and `error.md`. `global-error` still includes `<html>` + `<body>`. Do not invent a
> next-intl plugin from memory.

> **Comments:** every exported function gets a short human comment — why it exists.

---



## What this slice delivers

Ahmad opens `/?tenant=ahmad` and `/owner` after login. The page is **right-to-left**.
Buttons and labels are Arabic. Pitch name “Pitch 1” (or whatever he stored) is unchanged.
Times and money stay `18:00` and `$30.00`. A failed Request still uses `?error=booking.slot_ended`
and the toast/banner shows the Arabic dictionary line. Notify still opens WhatsApp; the
prefilled body is Arabic with the same stadium / pitch / times.

English chrome is gone from product screens. `error.tsx` is Arabic-first (short English
second line may stay so a crashed i18n dictionary cannot leave a blank screen — pin below).

---



## Prerequisites

- SPEC-12 click-proofed. Dictionaries already keyed.
- Fonts already load Noto Kufi + IBM Plex Sans Arabic (ch.99).
- `src/` has no `pl-`/`pr-`/`ml-`/`mr-`/`text-left` (RTL rule). Confirm in step 2.
- `npm test` green.

---



## Pins this spec must make

**Arabic-only UI.** No switch. Routes stay `/`, `/login`, `/owner`.

**`html`:** `lang="ar"` `dir="rtl"`. `global-error.tsx` the same.

**Western digits.** DateField / Calendar stay `en-GB` (existing Latin numerals pin). Do
not set `ar` on `react-day-picker` this slice.

**error.tsx / global-error:** Arabic heading + Arabic retry first. Keep the existing English
as a **second** muted line (crash screen is bilingual on purpose — SPEC-12; do not drop
English here until next-intl exists). Button label: `حاول مرة أخرى / Try again`.

**Catalogs — use these Arabic strings; do not invent parallel copy.**

### `errorMessage` (same keys)

| Key | Arabic |
| --- | --- |
| `error.generic` | حدث خطأ. حاول مرة أخرى. |
| `form.invalid` | راجع النموذج وحاول مرة أخرى. |
| `access.not_allowed` | لا يمكنك فعل ذلك. |
| `access.invalid_login` | تسجيل الدخول غير صالح. |
| `booking.not_found` | الحجز غير موجود. |
| `booking.pending_only` | يمكن الموافقة على طلب معلّق أو رفضه فقط. |
| `booking.confirmed_only` | يمكن إلغاء حجز مؤكد فقط. |
| `booking.slot_not_offered` | هذه الساعة غير معروضة. |
| `booking.slot_taken` | هذه الساعة محجوزة. |
| `booking.slot_ended` | هذه الساعة انتهت. |
| `booking.slot_unavailable` | الساعة لم تعد متاحة. |
| `booking.pitch_not_found` | الملعب غير موجود. |
| `booking.requester_not_found` | صاحب الطلب غير موجود. |
| `payment.collect_unapproved` | يمكن التحصيل من حجز موافق عليه فقط. |
| `payment.nothing_due` | لا يوجد مبلغ مستحق. |
| `payment.rate_required` | عيّن سعر الصرف أولاً. |
| `payment.amount_required` | المبلغ مطلوب. |
| `payment.amount_positive` | يجب أن يكون المبلغ أكبر من صفر. |
| `notification.bad_phone` | لا يمكن استخدام هذا الرقم لواتساب. |
| `ledger.invalid_period` | الفترة غير صالحة. |
| `expense.invalid_date` | تاريخ المصروف غير صالح. |

Unknown key / `error=1` → `حدث خطأ. حاول مرة أخرى.`

### `successMessage` (same `ok=` keys)

| Key | Arabic |
| --- | --- |
| `approved` | تمت الموافقة. |
| `rejected` | تم الرفض. |
| `collected` | تم التحصيل. |
| `booked` | تم الحجز. |
| `cancelled` | تم الإلغاء. |
| `rate_set` | تم تعيين السعر. |
| `expense_recorded` | سُجّل المصروف. |
| `requested` | وصل الطلب. |

Unknown → `تم.`

### `ui(key)` chrome

| Key | Arabic |
| --- | --- |
| `doc.title` | ملاعب |
| `public.day` | اليوم |
| `public.showHours` | عرض الساعات |
| `public.hours` | الساعات |
| `public.taken` | محجوز |
| `public.name` | الاسم |
| `public.phone` | الهاتف |
| `public.request` | اطلب |
| `public.emptyPitches` | لا ملاعب بعد. |
| `public.emptyPitchesNext` | هذا الملعب لم يُدرج ملاعب. |
| `public.closed` | مغلق هذا اليوم. |
| `public.closedNext` | اختر يوماً آخر لرؤية الساعات. |
| `login.title` | تسجيل الدخول |
| `login.identifier` | المعرّف |
| `login.password` | كلمة السر |
| `login.submit` | دخول |
| `owner.logout` | خروج |
| `owner.today` | اليوم |
| `owner.pending` | قيد الانتظار |
| `owner.confirmed` | مؤكد |
| `owner.due` | مستحق |
| `owner.paid` | مدفوع |
| `owner.approve` | موافقة |
| `owner.reject` | رفض |
| `owner.collectUsd` | تحصيل $ + Latin `formatUsd` |
| `owner.collectMixed` | تحصيل مختلط |
| `owner.usd` | دولار |
| `owner.lbp` | ليرة |
| `owner.cancel` | إلغاء |
| `owner.bookHeading` | احجز ساعة |
| `owner.showSlots` | عرض الساعات |
| `owner.book` | احجز |
| `owner.waitlist` | قائمة الانتظار |
| `owner.notify` | إبلاغ |
| `owner.period` | هذه الفترة |
| `owner.difference` | الفرق |
| `owner.in` | داخل |
| `owner.out` | خارج |
| `owner.from` | من |
| `owner.to` | إلى |
| `owner.view` | العرض |
| `owner.displayRate` | سعر العرض |
| `owner.show` | عرض |
| `owner.rate` | سعر الصرف |
| `owner.noRate` | لم يُحدد سعر |
| `owner.newRate` | سعر جديد |
| `owner.setRate` | تعيين السعر |
| `owner.expenses` | المصاريف |
| `owner.recordExpense` | تسجيل مصروف |
| `owner.category` | الفئة |
| `owner.what` | البيان |
| `owner.when` | التاريخ |
| `owner.recordExpenseSubmit` | تسجيل المصروف |
| `empty.pending` | لا طلبات معلّقة. |
| `empty.pendingNext` | عندما يطلب أحدهم ساعة، تظهر هنا. |
| `empty.confirmed` | لا مباريات مؤكدة اليوم. |
| `empty.confirmedNext` | الساعات الموافق عليها تظهر هنا للتحصيل. |
| `empty.pitches` | لا ملاعب بعد. |
| `empty.pitchesNext` | تظهر الملاعب هنا عندما يُدرجها هذا الملعب. |
| `empty.waitlist` | لا قائمة انتظار. |
| `empty.waitlistNext` | من طلب ساعة محجوزة يظهر هنا بعد الإلغاء. |
| `empty.expenses` | لا مصاريف بعد. |
| `empty.expensesNextRecord` | سجّل واحداً أعلاه. |
| `empty.expensesNextStaff` | لا شيء في هذه القائمة. |
| `cat.ELECTRICITY` | كهرباء |
| `cat.WATER` | مياه |
| `cat.MAINTENANCE` | صيانة |
| `cat.SALARY` | راتب |
| `cat.EQUIPMENT` | تجهيزات |
| `cat.OTHER` | أخرى |
| `role.OWNER` | مالك |
| `role.STAFF` | موظف |
| `lbpNote` | عيّن سعر عرض (أو عيّن سعر الصرف أولاً) |
| `rate.lbpPerUsd` | {amount} ليرة لكل دولار |

`owner.pendingCount` / `owner.confirmedCount`: `قيد الانتظار · {n}` / `مؤكد · {n}` with
Western `{n}`.

`owner.collectUsd`: interpolate `formatUsd(remaining)` — Latin digits, keep `$`.
Today’s “Collect $30.00 USD” → `تحصيل $30.00`.

Confirmed due line: keep `Due $… · remaining $…` structure with Arabic words:
`المستحق $X · المتبقي $Y`.

Period amounts stay `$12.00` / `90000 LBP` (A-2). Prefix words `الفرق` / `داخل` / `خارج`.

**WhatsApp `slotAvailableMessage`:**

```
{stadiumName}: {pitchName} {startLocal}–{endLocal} أصبحت متاحة مجدداً إذا ما زلت تريدها.
```

Stadium / pitch interpolated as stored (RULE-11). Times Latin.

**Do not** change Server Action names, `ok=` / `error=` keys, or hidden fields.

**Jest:** update `error-messages`, `success-messages`, `whatsapp-link` string assertions.
Add `test/lib/ui-copy.test.ts` — known key returns catalog Arabic; unknown key returns the key itself (developer-visible, not a blank button).

---



## Step 1 — Dictionaries (no pages yet)

- `error-messages.ts` / `success-messages.ts`: Arabic values. Comments: Arabic is the UI
  language (DR-005); keys unchanged.
- `src/lib/ui-copy.ts`: `ui(key: string): string` + the chrome table above. `collectUsd` /
  counts / rate line can be small helpers next to `ui` if interpolation is cleaner —
  still no React.
- Jest: catalog samples + unknown fallbacks.

**Definition of done:** `npm test` green. No `layout.tsx` / page edits yet.

---



## Step 2 — `dir` + crash screens + CSS audit

- `src/app/layout.tsx`: `lang="ar"` `dir="rtl"`; `metadata.title` via `ui("doc.title")`
  (layout is a Server Component — `ui` is sync, fine).
- `global-error.tsx`: `lang="ar"` `dir="rtl"`; Arabic-first; English second line; bilingual
  button as pinned. **Do not import `ui-copy` if that file tree is unsafe on the crash
  path** — hardcode the same Arabic/English already in the catalog (crash screen may load
  without the rest of the app).
- Grep `src/` for `pl-` `pr-` `ml-` `mr-` `text-left` `text-right` `left-0` `right-0`. Fix
  any hits with logical properties.

**Definition of done:** View source of `/` shows `dir="rtl"` `lang="ar"`. Login still
English chrome until step 3 (acceptable).

---



## Step 3 — Public + login chrome

Replace English labels / empty states / badges / buttons with `ui(...)`. Keep GET
`name="date"` and Request Server Action. Tenant name untranslated.

**Definition of done:** `/?tenant=ahmad` — Arabic Day / Show hours / Hours / Request.
Pitch names as stored. `/login?tenant=ahmad` — Arabic Log in. Invalid login toast/in-card
is Arabic `access.invalid_login`.

---



## Step 4 — Owner chrome

`today.tsx`, `book-slots.tsx`, `rest.tsx`, `page.tsx`, `categoryLabel` → `ui("cat.*")`.
Role via `ui("role.OWNER")` etc. GET forms unchanged.

**Definition of done:** `/owner` after login is Arabic. Approve / Collect / Book / Notify
still work. Toast Arabic. Pitch / requester names unchanged.

---



## Step 5 — WhatsApp Arabic body

Change `slotAvailableMessage` to the pinned template. Update Jest. No other BR-71 copy.

**Definition of done:** Notify `wa.me` text decodes to the Arabic sentence with Latin times.

---



## Tests

| Area | File |
| --- | --- |
| error / success Arabic | `test/lib/error-messages.test.ts`, `success-messages.test.ts` |
| chrome `ui` | `test/lib/ui-copy.test.ts` |
| WhatsApp body | `test/modules/notification/domain/whatsapp-link.test.ts` |

Do not add Playwright. Pages stay thin.

---



## Whole-slice acceptance

1. `npm test` green.
2. `/?tenant=ahmad` — RTL, Arabic chrome, Latin times/money, Request still pending.
3. `/login?tenant=ahmad` — Arabic; bad password in-card Arabic.
4. `/owner` — Arabic; Approve toast Arabic; header stays (Suspense unchanged).
5. Notify link body Arabic; stadium/pitch as stored.
6. Pages still no Prisma / no `tenantId`. Payment still does not import Booking.
7. `src/components/ui` still must not import `src/modules/*`.

---



## Out of scope

- next-intl / `[locale]` / language switch
- `tenant.settings`
- Arabic-Indic digits / `ar` calendar locale
- Translating tenant-authored content
- No-show, remaining BR-71 templates, overpay, refunds, shop, academy
- Changing use cases / Prisma / `ok=` keys

---



## After this slice

English secondary via next-intl when product asks. Then no-show / remaining WhatsApp
templates as product asks.

---



## Step order for the agent

One numbered step at a time. Wait for OK. Do not scaffold `shop/` or `academy`.
Do not add next-intl “while we’re here.”
