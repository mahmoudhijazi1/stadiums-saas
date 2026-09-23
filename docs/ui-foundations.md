# UI foundations

The rules every component obeys. Read this before adding or refactoring any component; the per-component contracts live in `ui-components.md`.

---

## 1. Colour roles

Never hardcode a hex in a component. Use the role; the role resolves per theme.

| Role | Meaning | Light | Dark |
|---|---|---|---|
| `bg` | Page ground | Warm off-white | Near-black carbon |
| `surface` | Card, row, sheet | White | One step lighter than `bg` |
| `surface-2` | Inset wells, segmented track, skeletons | Warm grey | Two steps lighter than `bg` |
| `line` | Hairline borders | Warm grey line | Low-contrast dark line |
| `line-strong` | Chip outlines, dashed states | Darker warm grey | Mid dark line |
| `ink` | Primary text | Carbon | Off-white |
| `ink-muted` | Secondary text, captions | Mid grey | Warm light grey |
| `accent` | The one action colour (volt) | Same in both | Same in both |
| `accent-ink` | Text/icon on `accent` | Carbon | Carbon |
| `inverse` | Blocks that flip against the page | Carbon surface | Elevated dark surface |
| `inverse-ink` | Text on `inverse` | Off-white | Off-white |
| `alert` | Destructive, prime-time, warnings (coral) | Same | Same |
| `deep` | Optional secondary dark surface (slate / turf) | Same | Same |

Hard rules:

- **The accent is a surface colour, not a text colour on light grounds.** Accent text is only legal on `inverse`, `deep`, or dark `bg`.
- Text on accent is always `accent-ink`.
- `alert` is reserved: prime-time tags and destructive buttons. Never a generic highlight.
- One accent element per view region. If two things are accent, one of them is wrong.
- No shadows. Depth comes from `inverse` vs `bg`, and 1px `line` borders.
- No gradients anywhere.

### Dark is not an inversion

Light already puts dark blocks on a light page. In dark:

- `bg` becomes the darkest value; `surface` steps **up**, not down, so blocks stay separated from the page.
- A component that is `inverse` in light (dark block on light page) becomes `surface` in dark — it can't stay carbon on carbon.
- A **selected** state that uses `inverse` in light must switch to `accent` in dark, or it disappears.
- Striped/disabled fills restripe using the two nearest dark steps.

### Tenant override

Tenants may override `accent` only, plus a contrast-derived `accent-ink`. Grounds, inks and greys are locked so no tenant can break legibility.

---

## 2. Type roles

Three roles, three families. A component picks a role, never a font name.

| Role | Family | Used for |
|---|---|---|
| `display` | Condensed sports display face | Numerals and short all-caps titles: times, prices, amounts, counts, screen and section titles |
| `ui` | Neutral sans | Everything else: labels, body, buttons, captions |
| `arabic` | Kufi/Arabic face | All Arabic text, replacing `ui` **and** `display` for words |

Rules:

- Any **number** a user compares (time, price, amount, count, date number) is `display`, weight 800, `line-height: 0.9–1`, `font-variant-numeric: tabular-nums`.
- Numbers stay Latin digits in Arabic and sit in an `ltr` span, so currency and ranges don't reorder.
- `display` never sets body copy; `ui` never sets a big number.
- Uppercase is for `display` titles and micro-labels only. Never uppercase a sentence.
- Arabic gets looser line-height (≈1.4) and one step smaller size than the Latin equivalent.

Size ladder (mobile): screen title 36–40 · section title 24–26 · big number 32–42 · secondary number 20–26 · body 14–15 · label 12–13 · micro 10–11 (weight 800, tracked 0.06–0.18em).

---

## 3. Shape, size, spacing

- Radius scales with the block: control/chip = pill · small tile = 16 · card/row = 18–22 · sheet/panel = 24–28 (sheets round the top only) · icon tile = 12.
- Minimum interactive height **44px**. Primary actions 52–56.
- Spacing steps: 4 6 8 10 12 14 16 20 24 28 32 40.
- Screen padding 16 (mobile) / 80 (desktop). Card padding 14–20. Gap between tiles 10, between cards 16–20.
- Grids: `repeat(N, minmax(0, 1fr))`. Never fixed pixel columns.

---

## 4. State model

Every interactive component defines these, and only these:

| State | How it reads |
|---|---|
| `default` | Base surface |
| `hover` | One step of surface change, colour only |
| `pressed` | Slightly darker/lighter accent or surface |
| `selected` | **A full fill swap** — the whole block changes ground and text colour. Never a ring, outline, shadow or checkmark bolted onto the default |
| `disabled` | Muted surface + muted ink. Not a button element at all when the thing is truly inert |
| `unavailable` | Striped fill + struck-through number + a short status word |
| `focus-visible` | 2px accent outline, 2px offset (accent-ink outline when on accent) |

A state must survive greyscale: colour alone never carries meaning. Anything marked by accent also changes its label text ("Select" → "Selected").

---

## 5. Motion

- 150ms ease on colour and background only.
- Sheets slide up, modals fade+scale from 0.98. Nothing else animates on entry.
- No hover-lift on cards, no scroll reveals.
- Respect `prefers-reduced-motion`: drop transforms, keep opacity.

---

## 6. RTL

- `dir` on the document; use logical properties (`padding-inline`, `margin-inline-start`, `text-align: start`).
- Mirror direction-bearing icons (arrows, chevrons, back, sign-out). Never mirror clocks, balls, pins, logos.
- Replace arrow glyphs in copy with a word ("until …") — arrows in text don't flip reliably.
- Latin numbers and currency get `dir="ltr"` on their own span.
- Test every component in both directions before it ships.

---

## 7. Accessibility floor

- Real `<button>`, `<a href>`, `<input>` + `<label>`. Never a clickable `div`.
- Toggles carry `aria-pressed`; groups carry `role="group"` + `aria-label`.
- Icon-only buttons carry `aria-label`.
- Inert states are not buttons; they carry an `aria-label` describing the status.
- Contrast: 4.5:1 body, 3:1 for 24px+ display text. Use only the muted inks defined above.

---

## 8. Adding a new component

Answer these before writing markup; if any answer is "something new", it needs a decision, not an invention:

1. Which **surface role** is its ground — `surface`, `inverse`, or `accent`?
2. What is its **radius tier** by size?
3. Which numbers in it are `display`, and are they tabular?
4. What are its states from the table in §4, and does `selected` swap the whole fill?
5. Does it hold an accent element, and is it the only one in its region?
6. How does it look in dark (remember §1: surfaces step up)?
7. How does it look in Arabic RTL (mirrored icons, `ltr` numbers, looser leading)?
8. Are all targets ≥44px, and is every control a real element?

If it passes all eight, it will look like it belongs without anyone tuning it.