# DR-005 — Arabic-first UI (RTL + copy, no locale URL)

**Status:** Accepted
**Date:** 2026-09-12
**Depends on:** BRD A-1, A-2, R-4, RULE-11; `.cursor/rules/100-rtl-i18n.mdc`;
DR-004 (message keys stay the seam).

## Why this exists

Users are Arabic speakers. Arabic is the **primary** language with full RTL. English is
secondary (A-1). Arabic layout bugs found by customers damage trust (R-4). The screens
are still English chrome with `dir="ltr"` on `<html>`.

This decision is **UI only**. No booking, money, or waitlist rules change.

## What we do this slice

1. **`lang="ar"` `dir="rtl"`** on the root `<html>` (and `global-error.tsx`, which replaces
   the layout).
2. **Arabic is the only product UI.** No language switch, no `?lang=`, no `/en`. English
   as a second locale is a later slice.
3. **Routes stay `/`, `/login`, `/owner`.** Do not add `src/app/[locale]/`. Folder-structure
   `[locale]` remains the long-term target. Proxy, GET `date`/`bookOn`, and Server Action
   redirects already assume those paths.
4. **No next-intl this slice.** It is not installed. DR-004 already reserved keys for it.
   Installing it now would force a Next 16 routing plugin we do not need for one language.
   Dictionaries stay in `src/lib/` and return Arabic. next-intl later wraps the **same keys**.
5. **Western digits (123)** even in Arabic (A-2). Money, times, and the date field stay
   Latin (`yyyy-mm-dd`, 24h `en-GB`, `$30.00`, LBP amounts). The calendar stays `en-GB`
   (already pinned so numerals are not Eastern Arabic).
6. **RULE-11:** stadium name, pitch names, person names, phones, identifiers — shown
   exactly as stored. Never translated.
7. **No `tenant.settings.locale`.** DR-002 still owns that knob; every tenant is Arabic
   until a later slice.
8. **WhatsApp “slot now available” body becomes Arabic.** Players are Arabic speakers
   (A-8). Other BR-71 templates stay out.

## Copy homes (keys, not sentences in JSX)

| Surface | File | Notes |
| --- | --- | --- |
| Domain / action errors | `src/lib/error-messages.ts` | Same keys as SPEC-12; values become Arabic |
| Success toasts | `src/lib/success-messages.ts` | Same `ok=` keys; values become Arabic |
| Chrome (labels, headings, empty states, badges, buttons) | `src/lib/ui-copy.ts` | `ui(key)` — pages pass keys, not Arabic literals |
| Waitlist WhatsApp | `slotAvailableMessage` in notification domain | One Arabic template; stadium/pitch/times interpolated |

`src/components/ui` still must not import `src/modules/*`. It may import `src/lib/*` only
if a primitive truly needs copy (prefer pages passing children).

Logs stay English (developer). `DomainError.message` stays the **key**.

## CSS

Logical properties only (`ps`/`pe`, `ms`/`me`, `text-start`/`text-end`). Never `pl`/`pr` /
`ml`/`mr` / `text-left` / `text-right`. Audit `src/` only — do not rewrite `node_modules`.

## Rejected alternatives

- **`/ar/owner` this slice** — breaks every redirect, GET form, and local `?tenant=` habit
  for no gain while English is not offered.
- **next-intl now “because the folder guide mentions it”** — the guide is a growth target;
  empty `[locale]` plus a plugin is a second product. Add it when English ships.
- **Keep English chrome + only flip `dir`** — R-4: not “translated at the end.”
- **Arabic-Indic numerals in the calendar** — contradicts A-2.

## What later slices add

- next-intl + English secondary (optional `[locale]` or cookie).
- `tenant.settings.locale` if a stadium ever wants English.
- Remaining BR-71 WhatsApp templates (Arabic from the start).
