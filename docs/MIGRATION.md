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

- Component restyles (Phase 2).
- Day picker selected state is a full fill (`bg-selected` / `text-selected-ink`): carbon in light, volt in dark. No ring. Unselected is surface + line.
- Empty state: dashed `line-strong` outline, panel radius, centred display title, muted sentence. No icon tile and no action — those need new props; existing callers only pass `title` and `next`.
- Expense category tiles (`money/panel.tsx` amber/sky/…) — need `--category-*` decision (`theme.md` §4).
- Chart `--chart-1…5` and sidebar block — still primitives, no chart contract.
- `global-error.tsx` four hardcoded hex values — owns its own `<html>`, cannot read tokens.
- Shadows, gradients, scroll-lift on header/tab-bar — Phase 2 chrome.
- Tenant `brandHex` injection in layout — built for, not shipped.

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
