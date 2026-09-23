# Design-system migration log

Running notes for the UI token / component migration (`docs/ui-foundations.md`, `docs/ui-components.md`, `docs/theme.md`).

## Converted

### Phase 1 — token layer (this commit)

- Three-layer tokens in `src/app/globals.css`: primitives → roles → shadcn aliases.
- Light + dark (`.dark` and `[data-theme="dark"]`). Dark surfaces step **up** from `bg`.
- `--brand` / `--brand-ink` tenant-override hooks (injection later; no tenant field yet).
- `--success` = `#10B981` (money-in). Action colour is volt via `--brand` → `--primary`.
- Tailwind `@theme` exposes role utilities (`bg-bg`, `text-ink`, `bg-accent-brand`, `bg-selected`, …).
- Old shadcn names kept (`--background`, `--primary`, `--accent` as hover wash, …).
- `next-themes` ThemeProvider: light / dark / system, localStorage, no FOUC script.
- `ThemeToggle` + `/dev/palette` preview page.
- Fonts: IBM Plex Sans Arabic, Noto Kufi Arabic, Big Shoulders (`--font-big-shoulders` → `font-display`), IBM Plex Mono.
- `LtrIsolate` uses `font-display tabular-nums`.
- Latin UI face is Manrope (`--font-manrope`). `--font-sans` is Manrope, then Plex Arabic. `--font-heading` and `--font-display` are Big Shoulders, then Kufi, then Plex Arabic.
- `:lang(ar)` loosens line-height, steps the text-xs/sm/base sizes, and forces `letter-spacing: normal` so tracking cannot break Arabic joining.
- Viewport `themeColor` light `#F6F5EF` / dark `#111412`; `colorScheme: "light dark"`.
- Sonner follows `resolvedTheme` (no hardcoded `theme="light"`).
- Destructive button/badge text → `var(--destructive-foreground)` (coral needs carbon ink).

### Volt-on-light ink

- `--action-ink` is `--ink` in light and `--brand` in dark. `--ring` matches (ink / brand).
- Call sites that used primary as text, border, ring, or a `/10`–`/15` wash now use `action-ink`. Solid `bg-primary` fills stay volt.
- Money-in text, washes, the in-bar, owed figures, and the paid check use `success` (emerald), not volt and not action-ink.

## Deliberately left

- Component restyles still ahead: buttons, inputs, list row, sheet chrome, modal, toast visuals. Segmented control and list row have no shared component yet.
- Empty state: dashed `line-strong` outline, panel radius, centred display title, muted sentence. No icon tile and no action — those need new props; existing callers only pass `title` and `next`.
- Expense category tiles (`money/panel.tsx` amber/sky/…) — need `--category-*` decision (`theme.md` §4).
- Chart `--chart-1…5` and sidebar block — still primitives, no chart contract.
- `global-error.tsx` four hardcoded hex values — owns its own `<html>`, cannot read tokens. It uses `Container` for width only.
- Shadows remain on dialog, card, and inputs. Header and tab bar no longer use shadow or blur.
- Tenant `brandHex` injection in layout — built for, not shipped.
- Login card is full width of `Container`. Dialog `sm:max-w-sm` is the shadcn modal, unused by the slot request (that uses the sheet).

## Layout (one commit)

- `Container` is the only page max-width: `max-w-[520px] md:max-w-3xl lg:max-w-5xl xl:max-w-6xl` with `px-4 md:px-6 lg:px-8`.
- Owner nav is one component. Below `lg` it is a fixed bottom bar with safe-area padding. At `lg` it is a 240px sticky rail (`top: 0`, `height: 100dvh`) on the inline-start edge, `border-inline-end`, active `bg-accent-brand text-accent-ink`.
- Main clears the bar with `padding-block-end: calc(88px + env(safe-area-inset-bottom))` below `lg` only.
- Viewport meta includes `viewport-fit=cover` (`Viewport.viewportFit` in this Next version).
- Slot tile is two zones, `min-h-[96px]`, padding `12px 14px`, gap `10px`. Time is `leading-[0.9]` and the only accent. Duration is `h-5 px-2 text-[10px]` on `surface-2` / `ink-muted`.
- `:lang(ar) .leading-[0.9]` and `.leading-none` sit after the Arabic line-height rules so those utilities still apply. The text-xs/sm/base overrides are unchanged.
- Day row: equal cells, no horizontal scroll. Today stays first and the calendar cell stays last. Later days appear only when the row is wide enough to hold them.
- Pitches stack until `lg`, then two columns. Slot tracks from `lg` are `repeat(auto-fill, minmax(220px, 1fr))` and each tile is `max-w-[320px]`.
- Sheet is a bottom sheet below `lg` and a centred `max-w-md` dialog at `lg`.
- Toast is bottom centre below `lg` (offset above the bar) and bottom inline-end at `lg`.
- Screen titles `text-3xl lg:text-4xl`. Section titles `text-xl lg:text-2xl`. Prices and slot numbers do not change size by breakpoint.

## Hardcoded values that could not map to a role

| Value / pattern | Where | Why |
|---|---|---|
| `#f8f9fa`, `#1a1d20`, `#495057` | `src/app/global-error.tsx` | Standalone document; leave until error shell can share tokens |
| Tailwind palette (`amber-500`, `sky-500`, …) | `src/app/owner/money/panel.tsx` | No category role set yet |
| Stripe hex `#EEEDE6` / `#E6E5DD` (light) and carbon pair (dark) | `globals.css` `--stripe-a/b` | Intentional primitives for unavailable fill; not a named foundation role beyond the stripe pair |
| `themeColor` hex in `layout.tsx` | viewport meta | Must be concrete colours; mirrored from `--ls-paper-100` / `--ls-carbon-900` |

## Cascade note (`--accent`)

Layer 2 defines the brand role as `--accent: var(--brand)`. Layer 3 then sets `--accent: var(--surface-2)` for shadcn hover washes. Because `var()` resolves at computed-value time, anything left as `var(--accent)` after that overwrite would become the wash, not volt.

Therefore `--primary`, `--ring`, dark `--selected`, and `--color-accent-brand` point at `--brand` / `--brand-ink`. Components should use `bg-primary`, `bg-accent-brand`, or `bg-selected` — not raw `var(--accent)` — for the action colour.
