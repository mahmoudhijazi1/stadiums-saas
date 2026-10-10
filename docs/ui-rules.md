# UI rules for owner screens

The rules every owner screen follows, on top of [ui-foundations.md](./ui-foundations.md) (roles, type, states), [ui-components.md](./ui-components.md) (component contracts) and [theme.md](./theme.md) (token values). Those three stay the source for colours, fonts and components. This page adds rules about **what a screen says and how it ranks things**. Where a rule here sits uneasily with them, the last section lists it; nothing above was edited.

Owner copy is Arabic first (DR-005). Every example gives both. All copy goes through `ui()` / `uiCount()`; numbers and currency sit in `LtrIsolate`.

**Status:** rules 1–8 are **approved** (2026-10-01).

**Decisions recorded 2026-10-01**

1. **Display font: rule 7 wins.** `LtrIsolate` handles text direction only. Digits are tabular from the body (`font-variant-numeric: tabular-nums` in `globals.css`). `<Figure>` (`components/ui/figure.tsx`) is display + tabular + LTR-isolated, for the one big figure per screen. Used for: Remaining in the booking sheet, Net on Money. Page titles keep `font-display`. `ui-foundations.md` §2 and `theme.md` §3 carry a one-line "amended" note; their bodies are unchanged.
2. **Money tokens** (`globals.css`, exposed to Tailwind as `paid`, `owed`, `expected`, each with `-subtle`): paid = green, owed = amber (never red), expected = neutral. Destructive stays `alert` (coral) and separate.

   | Token | Light text / subtle | Dark text / subtle |
   |---|---|---|
   | `paid` | `#047857` / `#d6f0e4` | `#34d399` / `#123528` |
   | `owed` | `#92400e` / `#fbe8c2` | `#fbbf24` / `#3b2e0c` |
   | `expected` | `ink-muted` / `surface-2` | `carbon-300` / `carbon-700` |

   WCAG AA (contrast of text on page, card and its own subtle background): light paid 5.0 / 5.5 / 4.6, owed 6.5 / 7.1 / 5.9, expected 5.8 / 6.3 / 5.1; dark paid 9.6 / 8.7 / 7.0, owed 11.1 / 10.0 / 8.0, expected 8.4 / 7.5 / 6.6. All at or above 4.5:1.
3. **Money-in** uses `paid`. **Money-out and Net** are neutral; Net is labelled "Net = in − out" / "الصافي = الداخل − الخارج". Decorative leading icons on list rows are dropped (clock and pin on cards, the category tile on expenses); status icons stay (check, alert). Destructive actions in sheets stay last, as secondary red text, never primary.

---

## Rules

### 1. Money colours

| Meaning | Colour | When |
|---|---|---|
| Fully paid and settled | green (`success`) | Nothing left to collect on this booking or person |
| Owed now | amber | The game has ended, or a cancellation / no-show fee is due |
| Expected | neutral (`ink` / `ink-muted`) | The game has not been played yet. Money is planned, not owed |

Colour never carries the meaning alone. Every coloured amount sits next to a word (**Paid**, **Owed**, **Expected**) or an icon (check, alert) that says the same thing. It must read in greyscale ([ui-foundations §4](./ui-foundations.md)).

| | AR | EN |
|---|---|---|
| Settled | ✓ مدفوع · `$30` (green) | ✓ Paid · `$30` (green) |
| Owed | مستحق · `$30` (amber, alert icon) | Owed · `$30` (amber, alert icon) |
| Expected | متوقع · `$30` (neutral) | Expected · `$30` (neutral) |

### 2. Every money number says whose it is

A bare `$30` is never enough. The label names the owner of the figure: the game, a person's share, or the day's cash.

| | AR | EN |
|---|---|---|
| Whole booking | المباراة `$30` | Game `$30` |
| One player | حصته `$3` | His share `$3` |
| Cash taken | محصّل `$12` | Collected `$12` |

The label is short and sits before the number in reading order. In a dense row the label may be the column or group title, as long as it is always visible.

**Cards (amended 2026-10-07).** A booking card shows money only when it signals a state: an owed or partial amount (`$30 due`, `$12 left`), Paid, a no-show or cancel fee. A plain upcoming game shows no price and no pill; the "Game `$30`" label is gone from cards. The booking sheet always shows the game price, labelled. One component, `BookingRow` (`app/owner/booking-row.tsx`), draws every booking card; the pill is the only money on it.

### 3. Counts say what they count

State the condition behind the count. Never a bare "1 game" when the list below shows more rows than that.

| | AR | EN |
|---|---|---|
| Right | مباراة واحدة لُعبت · مباراة واحدة قادمة | 1 game played · 1 upcoming |
| Wrong | مباراة واحدة | 1 game |

Counts come from `uiCount()` with a qualifier key (`played`, `upcoming`, `to collect`). A count that equals the number of rows under it may stay short, because nothing is hidden.

### 4. No heading or label for an action that is not available now

If the action is not available (game not ended, no permission, nothing owed), the heading that introduces it is not rendered either. A heading promises a control. Empty promises teach the owner to ignore headings.

| | AR | EN |
|---|---|---|
| Upcoming game, nothing to collect yet | no "تحصيل" heading; show the expected amount only | no "Collect" heading; show the expected amount only |
| Game ended, `$30` owed, may collect | "تحصيل" + the collect button | "Collect" + the collect button |

Gate the heading on the same condition as the control (`mayCollect && owes`), in the same expression.

### 5. One primary button per screen or sheet

- One primary (`accent` fill). Everything else is secondary (outline) or ghost.
- Destructive actions come **last** and are red (`alert` ink). In a sheet they are an outline or ghost in `alert`, not a second fill.
- The destructive confirm inside a modal is the only `alert` fill in the app ([ui-components: Modal](./ui-components.md)).

| | AR | EN |
|---|---|---|
| Sheet, game owes `$30` | **تحصيل $30** (primary) · دفع بعملتين (secondary) · تعديل المبلغ (secondary) · إلغاء الحجز (red, last) | **Collect $30** (primary) · Pay in two currencies (secondary) · Adjust amount (secondary) · Cancel booking (red, last) |

### 6. Icons only when they add meaning

An icon earns its place when it changes what the row says: a check for settled, an alert for owed, a pin that marks the pitch among other text, a phone that marks a number as callable. A repeated icon that only fills space is removed. An icon is never the only carrier of a state (rule 1).

| | AR | EN |
|---|---|---|
| Keep | ✓ مدفوع | ✓ Paid |
| Drop | ◷ 5:00–6:00 م (the clock beside a time range) | ◷ 5:00–6:00 PM |

### 7. Typography

- The **display** font is for page titles and the **single biggest figure** on a screen. One per screen.
- Everything else, including every other amount, time, count and date, is the body font with `tabular-nums` so columns align.
- Numbers stay Latin and LTR-isolated in Arabic.

| | AR | EN |
|---|---|---|
| Page title | اسم اللاعب (display) | Player name (display) |
| Biggest figure | `$30.00` المتبقي (display, one per screen) | Remaining `$30.00` (display, one per screen) |
| Everything else | `$30` · 5:00–6:00 م (body, tabular) | `$30` · 5:00–6:00 PM (body, tabular) |

> **Amended 2026-10-08, type roles.** Page titles use the UI face at 600 (display is only for the one big figure, English). Screens under More use nine role classes, defined once in `globals.css`, built only from the sizes 12 / 14 / 16 / 20 px and the weights 400 / 600 (Latin line-height 1.4, Arabic about 10% taller). Muted text is `--muted-foreground` (5.1:1 or better in light, 6.5:1 or better in dark).
>
> | Role | Class | Size / weight | Used for |
> |---|---|---|---|
> | Title | `type-title` | 20 / 600 | page and sheet titles, the one figure |
> | Section | `type-section` | 12 / 600 muted | group headings and legends |
> | Body | `type-body` | 16 / 400 | row labels, running text |
> | Strong | `type-strong` | 16 / 600 | a name in a list |
> | Label | `type-label` | 14 / 600 | field labels, chips, small controls |
> | Secondary | `type-secondary` | 14 / 400 muted | row values, summaries, hints |
> | Caption | `type-caption` | 12 / 400 muted | fine print |
> | Field | `type-field` | 16 / 400 | inputs and selects (never below 16px, so iOS does not zoom) |
> | Button | `type-button` | 16 / 600 | buttons |
>
> `test/app/owner/more-type-guard.test.ts` fails, with `file:line`, on any raw `text-xs` to `text-9xl`, `text-[<size>]`, `font-medium/bold/semibold/...`, `fontSize` or `fontWeight` under `src/app/owner/(app)/more/**`. Other screens move to the roles one at a time.

### 8. Hierarchy: the current task first

Order every screen by what needs the owner **now**, then reference information.

1. Things that need action: new requests, games to collect, the live game.
2. What is coming and what is free.
3. History and reference (past days, totals, contact details).

| | AR | EN |
|---|---|---|
| Today | طلبات جديدة → للتحصيل → المباراة الحالية → الملخص → الساعات المتاحة → الحجوزات | New requests → To collect → Live game → Day summary → Available hours → Bookings |

Reference information never pushes an action below the fold. A collapsed row may hold the detail (for example the To collect accordion), but the row itself stays visible and amber.

---

### 9. The accent is per stadium; status colours are not

Buttons, highlights, accent text and the focus ring take their colour from the stadium's preset (More > Business > Stadium info), through the tokens `--brand`, `--brand-ink`, `--action-ink` and `--ring` only. A component never writes an accent hex or a `lime-*` class: `test/app/accent-guard.test.ts` fails on it. **Paid, owed, expected and the destructive coral are fixed** (rule 1): they never come from a preset.

**Reserved hues.** Green is *paid*, amber/orange/gold is *owed* and red/coral is *destructive*. An accent in those hues would be mistaken for a status (a green "Book" button reads as "paid"; an orange one as "owed"), so no preset is offered in them. The five presets are lime (the default, unchanged), royal blue, sky blue, indigo and mono (graphite). Every chromatic fill must stay at least 40 degrees of OKLCH hue and 0.15 OKLab away from the paid, owed and destructive tokens, in both themes, and the tests read those tokens from `globals.css` so a changed status colour re-runs the check. Teal was tried and dropped: no teal with a real chroma clears the paid green in the light theme. Meaning still never rests on colour alone.

### 10. The Money page layout

Top to bottom: period chip and $ / LBP toggle; one summary card (profit or loss as the one big figure); the Owed card; the cash-today line; the actions row; recent activity (5 rows); the shop row. Rules that follow from the numbered ones above: **one primary button** (rule 5) is "+ Expense", Sell is secondary; the comparison and the source split **hide themselves** when they would say nothing (rule 4: an empty previous period, a single source); a **loss is neutral**, never red (rule 1: red is destructive); sales and shop supplies are **never side by side** on the page (supplies are bought in lots), the shop row shows sales only and the detail page has both; **cash today is the one figure in a currency other than USD** (per currency, never converted, one business day), a documented exception in [domain/money.md](./domain/money.md), shown only to members with reports.view.

## Audit

Checked against the code on `feat/today-free-slots` (2026-10-01). "Verified" means I read the code path; the booking sheet and Today card were also seen in a screenshot.

| Screen | Element | Rule broken | Proposed fix |
|---|---|---|---|
| Person page | Stat "Paid `$3`" while the game row beside it reads `$30` "Paid". `stats.tsx` sums what this person paid; `games.tsx` prints `row.priceUsd` whenever the game is not owed | 2 (whose number), 1 | Row shows the person's own figure with its label: "His share `$3` · Paid" on a split game, "Game `$30` · Paid" on a whole one. Keep one source: use `personRemaining` / the person's paid amount, not `priceUsd` |
| Person page | Stat label "1 game" (`uiCount("owner.games")`) above a list that holds two rows, one of them upcoming | 3 | "1 game played · 1 upcoming". Add `played` and `upcoming` counted keys and show both |
| Booking sheet | "Remaining `$30.00`" is green (`text-success`, `bg-success/15`) on a game that has not been played. `DueRemainingFigures` uses green for *owed*, and grey when fully paid | 1 (colours inverted) | Not played: neutral "Expected `$30`". Ended and owed: amber "Owed `$30`" with alert icon. Fully paid: green "✓ Paid" |
| Booking sheet | "Collect" heading (`owner.moneyGroup`) renders on an upcoming game, where `canCollect` is false and there is no collect button | 4 | Render the heading only when `canCollect` or per-player collect is shown; otherwise show the Expected figure with no heading |
| Today | Booking card trail shows a bare `$30` beside a coin icon on an upcoming game | 2 | "Game `$30`" in the trail, or "Expected `$30`" while upcoming |
| Today | Day summary "2 games · `$60` expected" (`DaySummaryLine`): the count hides that one may be upcoming and one played | 3 | "1 game played · 1 upcoming · `$60` expected" (uses the same two counted keys as the person page) |
| Today | To collect row and cards use raw `amber-500` classes; Requests and Money do their own amber | 1 (no role) | Add one `owed` role pair to `globals.css` (light and dark), then replace raw `amber-*` with it. Needs a decision ([conflicts](#conflicts-with-the-existing-docs)) |
| Person page | Owed amounts use `text-alert` (coral) in the stat and in the game row. Coral is for destructive and warnings | 1 | Use the amber `owed` role with the "Owes now" / "Owed" label and alert icon |
| Person page | Game rows print a bare amount with only a status word at the end of a different line (`paymentLabel`), so the label is not next to its number | 2 | Put the label first in the same line: "Owed `$30`", "Game `$30`" |
| Requests | "Starts in N" line is amber (`amber-800` / `amber-200`). Amber now means money owed, and this is urgency | 1 | Neutral ink with a clock icon and the word "Starts in"; keep amber out of non-money text |
| Money | "Difference `$X`", "In", "Out" have no owner for the number | 2 | "Net `$X`" with the period in the heading; "Collected in `$X`" / "Expenses out `$X`" |
| Money | "In `$X`" uses green for cash collected in the period. Money-in is settled cash, so it is right, but it is a third meaning of green next to "Paid" | 1 (clarify) | Keep green for money-in and name it "Collected"; document it under rule 1 as the same meaning (cash received) |
| Money | Expense category tiles use five raw Tailwind palette colours (`amber-500/15`, `emerald-500/15`, …). Amber and green there are not money states | 1 | Give categories their own neutral role set (already flagged in [theme.md §4](./theme.md)); no amber or green on categories |
| All owner screens | `LtrIsolate` applies the display font to every number (`font-display tabular-nums`), so every amount, time and count is condensed display type | 7 | Make the body font with `tabular-nums` the `LtrIsolate` default and add an opt-in `display` prop for the one biggest figure and the page title |
| Booking sheet | Money block repeats `Due`, `Remaining` and (per-player) `Unassigned` as three same-size boxes | 7, 8 | One biggest figure (what is owed now, or Expected), the other two as plain lines below |

**Fixed in the tokens change (2026-10-01):** booking sheet Remaining now `paid` / `owed` / `expected` by state, with a check or alert icon; person page owed amounts `owed`, not coral; Today To collect row, Requests "starts in" (now neutral, not amber) and the requested-name notice; Money In (`paid`), Net (neutral, labelled), category tiles (removed); `LtrIsolate` typography; clock and pin icons on cards. **Still open (copy and labels, rules 2–4):** person page "Paid $3" vs row, "1 game", the "Collect" heading with no action, unlabeled `$30` on the Today card, Today summary counts, Money "In"/"Out" owners, the sheet's three same-size boxes.

Not audited: Requests amounts (the cards carry no money), the Money expense sheet, and the Settings tabs.

---

## Conflicts with the existing docs

**Resolved 2026-10-01:** 1 (rule 7 wins), 2 (amber is the `owed` token), 3 (green is `paid`, including money-in), 4 (decorative row icons dropped), 5 (destructive in sheets stays red secondary text). 6 stands: `owed` and `paid` were checked for contrast as text. The list below is kept as written.

Nothing was changed in the three source docs. These are the places where a rule here either extends them or pulls against them, for a decision.

1. **Numbers and the display font.** [ui-foundations §2](./ui-foundations.md) says every number a user compares is `display` 800, and [theme.md §3](./theme.md) routes all numbers through `LtrIsolate` with `font-display`. Rule 7 narrows display to page titles and the single biggest figure. Rule 7 is the newer, stricter request; if it is accepted, foundations §2 and theme.md §3 need a one-line amendment.
2. **Amber has no role.** Foundations defines `alert` (coral) as "destructive, prime-time, warnings" and `success` (emerald) for money-in. There is no amber. Rule 1 needs an `owed` role. Until then Today already uses raw `amber-500`, and Requests uses `amber-800`, which breaks "never hardcode a colour in a component" ([foundations §1](./ui-foundations.md)). Adding the role is a decision, not something to invent in a component.
3. **Green means more than "paid".** [theme.md §1](./theme.md) uses `success` for money-in figures and the Money bars. Rule 1 says green is "fully paid and settled". These agree if "money-in" is read as "cash received". If the owner wants Money's green to mean something else, this rule has to change.
4. **Icons on list rows.** [ui-components: List row](./ui-components.md) gives every row a leading icon tile. Rule 6 drops icons that do not add meaning. The two fit if the tile is kept only when it marks something (status, pitch), not when it is decoration.
5. **Destructive buttons.** [ui-components: Buttons](./ui-components.md) says a destructive primary uses `alert` fill and appears only in a modal. Rule 5 puts destructive actions in sheets too, as red outline or ghost, last. That is not a fill, so it stays inside the existing rule; it is listed because a reader could take it the other way.
6. **Accent as text.** Foundations bans accent text on light grounds. `PersonLink` (shipped earlier on this branch) uses `text-action-ink`, the ink-safe action colour from [theme.md §1](./theme.md), so it complies. Noted only so rule 1's "amber text on light grounds" is checked for contrast the same way: the `owed` role needs an ink-safe text value, like `action-ink`.
