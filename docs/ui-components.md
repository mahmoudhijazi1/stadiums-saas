# UI components

Contracts for each component, written as "what it should become". Roles and rules come from `ui-foundations.md`; nothing here names a colour or a font directly.

Each entry lists: **ground · layout · type · states**. Where a component already exists, treat the entry as the target to refactor toward.

---

## Time slot

The signature component. Everything else follows its logic.

- **Ground:** `inverse` in light, `surface` in dark. Always a block with its own fill — never a bordered white card.
- **Layout:** a tile with two stacked zones. Top zone: the start time, with the end time directly under it as a muted line. Bottom zone: price on one side, a short meta tag (duration) on the other. Fixed minimum height so a grid of them stays even; two per row on mobile.
- **Type:** start time is the biggest thing in the tile, `display` 800, tabular, in `accent` (on the base state). End time is `ui` micro, muted. Price is `display` 800, one step smaller than the time, in the tile's own ink. Meta tag is micro, tracked.
- **Hierarchy rule:** time first, price second, everything else third. Never let the price compete with the time.
- **States:**
  - *available* — base fill, action word in the corner.
  - *selected* — whole tile swaps to `accent` with `accent-ink`; the time loses its accent colour (it becomes ink); the action word changes to a past-tense label.
  - *unavailable* — striped fill, ink muted, time struck through, status word replacing the action word. Not a button.
  - *passed* — dashed outline instead of a fill, muted ink, status word. Not a button.
- **Row variant:** for long or dense lists, the same data on one line — time, muted meta in the middle, price at the end — on a `surface` ground with a `line` border. Same type roles, smaller sizes.
- **Arabic:** the number spans stay `ltr`; the "until" line becomes a word, never an arrow.

## Day picker

- **Ground:** each day is its own control: `surface` + `line` border when unselected.
- **Layout:** a horizontally scrolling row of fixed-width cells, each holding a weekday label above a date number, optionally a marker dot below. The row bleeds to the screen edges and pads back in, so the last cell hints at scroll. A trailing dashed cell opens the full date picker.
- **Type:** weekday label is `ui` small and muted; the date number is `display` 800.
- **States:** selected swaps the whole cell to `inverse` in light / `accent` in dark, and the weekday label takes the contrasting highlight colour. A day carrying activity shows a small `alert` dot — the dot never replaces the label.
- **Rule:** selecting a day clears any slot selection, because the selection no longer exists on the new day.

## Segmented control

- **Ground:** a `surface-2` track holding pill segments.
- **Layout:** equal columns, small padding inside the track, pill radius on both track and segments.
- **Type:** `display` for short labels (codes, pitch names), `ui` for words.
- **States:** the active segment fills — `inverse` in light, `accent` in dark; inactive segments are transparent with plain ink. Two segments minimum, four maximum; beyond that use the day-picker scrolling pattern.

## App header

- **Ground:** always the dark block, in both themes (`inverse` in light, `surface` + `line` in dark). It is the one constant edge of the app.
- **Layout:** title block on the leading side (name, with a muted meta line under it), a cluster of circular icon buttons on the trailing side. Icon buttons sit on a slightly raised fill inside the header.
- **Type:** name is `display` 900 in Latin, `ui`/`arabic` 700 in Arabic; meta is `ui` micro, muted.
- **Rule:** never more than three icon buttons. A fourth means a "more" menu.

## Sub header (detail screens)

- **Ground:** `surface` with a `line` border.
- **Layout:** back button (circular, mirrored in RTL), title, trailing primary action.
- **Type:** title is `display`; action is a small pill button.

## Section header

- **Ground:** none — it sits on the page.
- **Layout:** title, then a `line` rule filling the remaining width, then an optional counter badge on the end. The rule is what makes it read as a divider; don't replace it with extra margin.
- **Type:** title `display`; badge micro on an `inverse` pill with `accent` text.

## List row

- **Ground:** `surface` + `line`, row radius.
- **Layout:** leading icon tile (small radius square), a two-line text block that grows, a trailing number.
- **Type:** primary line `ui` 700; secondary line `ui` small muted; trailing number `display` 800, tabular.
- **States:** rows are tappable only when they lead somewhere; a placeholder or pending row is the same row at reduced opacity.

## Bottom navigation

- **Ground:** a floating dark bar inset from the screen edges, `inverse` in light and `surface` + `line` in dark, with panel radius.
- **Layout:** equal columns, each an icon above a micro label, each column a full-height rounded hit area.
- **States:** the active item is a filled `accent` block with `accent-ink`; inactive items are muted ink. Only one item is ever active.
- **Rule:** five items maximum; labels always visible; height ≥60 per item.

## Bottom sheet

- **Ground:** `surface`, top corners at sheet radius, bottom flat against the screen.
- **Layout, in order:** grabber bar, title row with a close button, a summary block, inputs, then actions. The summary block is `inverse` — it restates what the user picked (the big number and its context) so they confirm against data, not memory.
- **Type:** title `display`; summary number `display` in `accent`; supporting line `ui` muted.
- **Actions:** a secondary button (auto width) and a primary button (fills the rest) on one row, primary on the trailing side. The primary label states the outcome and may carry the amount.
- **Rule:** sheets carry flows with input. If there's nothing to enter and nothing to review, use a modal or act directly.

## Modal

- **Ground:** `surface` panel, centred, panel radius.
- **Layout:** an icon tile in the alert role, title, one short paragraph of consequence, then two buttons of equal width.
- **Type:** title `display`; body `ui` with normal line-height.
- **Rule:** modals only ask destructive or irreversible questions, one per modal. The destructive button is the only `alert` fill in the app; the safe choice is the outlined button and is never the visually louder one.

## Toast

- **Ground:** success/info on `inverse`; error on a tinted alert surface with an `alert` border.
- **Layout:** small status circle, one line of text that grows, optional single action word at the end.
- **Type:** `ui` 600; the action word is `ui` 800 in `accent` (on `inverse`).
- **Rule:** one line, no titles, no icons beyond the status circle. Errors say what happened and what to do next.

## Empty state

- **Ground:** dashed `line-strong` outline on the page, panel radius.
- **Layout:** centred icon tile, a `display` title, one muted sentence, and optionally one action.
- **Rule:** the sentence tells the user what to do, not that something is missing.

## Buttons

- **Primary:** `accent` fill, `accent-ink` text, pill, 52–56 tall, `ui` 800.
- **Secondary:** transparent with a 1.5px ink border, same height.
- **Ghost:** no border, accent or ink text, 44 tall — for in-place actions like "Change".
- **Icon:** circular, 44 or 54, always `aria-label`ed.
- **Disabled:** muted surface fill, muted ink, no border.
- **Rule:** one primary per screen region. Destructive primary uses `alert` and appears only inside a modal.

## Chips and tags

- **Filter chip:** pill, `line-strong` border, `ui` 600. Active swaps to `accent` fill.
- **Status tag:** shorter pill, micro type, 800, tracked. Prime-time and warnings use `alert`; neutral counts use `surface-2`/`inverse` with muted ink.
- **Rule:** tags never wrap to two lines; if the label doesn't fit, shorten the label.

## Inputs

- **Ground:** `surface`, 1.5px `line-strong` border, control radius, 52 tall.
- **Layout:** visible label above the field, never a placeholder-as-label. Helper or error text below.
- **States:** focus shows the accent outline; error swaps the border to `alert` and shows a message.

---

## Missing components (add with the §8 checklist in foundations)

Waitlist row · pitch card · date-range picker · filter sheet · summary/stat card · avatar & initials · skeleton loaders · confirmation screen · pagination or "load more".