# theme.md — concrete token values

The hex values, font plan and file layout for the migration. Roles and rules live in `ui-foundations.md`; this file is what those roles resolve to.

Stack facts this is written against: Tailwind v4 (no config file — tokens live in `src/app/globals.css`), shadcn with `cssVariables: true`, `next/font/google`, Arabic-default with a `dir` cookie.

---

## 1. Three layers, one file

All of it lives in `src/app/globals.css`. Components **only ever** read layer 3 or the role names in layer 2. Nothing reads layer 1.

```
Layer 1  primitives   raw hex, no meaning        --ls-carbon-900, --ls-volt-500 …
Layer 2  roles        meaning, theme-dependent   --bg, --surface, --ink, --accent …
Layer 3  aliases      shadcn/library names       --background, --primary, --border …
```

Why three: layer 1 lets you change a shade once. Layer 2 is what the docs talk about and what a tenant overrides. Layer 3 keeps every shadcn component working without touching a single component file.

### Layer 1 — primitives

```css
:root {
  /* neutrals — warm */
  --ls-paper-50:  #FFFFFF;
  --ls-paper-100: #F6F5EF;
  --ls-paper-200: #E9E8E0;
  --ls-paper-300: #E2E1D8;
  --ls-paper-400: #D5D4CA;
  --ls-paper-500: #C9C8BD;

  /* neutrals — carbon */
  --ls-carbon-900: #111412;
  --ls-carbon-800: #1A1F1C;
  --ls-carbon-700: #232B26;
  --ls-carbon-600: #3A443D;
  --ls-carbon-500: #5A6168;   /* muted ink on light */
  --ls-carbon-300: #A9B0A8;   /* muted ink on dark  */
  --ls-carbon-200: #C9CEC6;

  /* brand + signals */
  --ls-volt-500:    #D7FF3F;
  --ls-coral-500:   #FF6B3D;
  --ls-emerald-500: #10B981;  /* kept: money-in / success, NOT the action colour */
  --ls-slate-600:   #2E3A46;
  --ls-turf-700:    #1B4628;
}
```

### Layer 2 — roles (light)

```css
:root {
  --brand: var(--ls-volt-500);      /* the single tenant-overridable value */
  --brand-ink: var(--ls-carbon-900); /* text/icon on top of --brand */

  --bg:            var(--ls-paper-100);
  --surface:       var(--ls-paper-50);
  --surface-2:     var(--ls-paper-200);
  --line:          var(--ls-paper-300);
  --line-strong:   var(--ls-paper-400);
  --line-dashed:   var(--ls-paper-500);

  --ink:           var(--ls-carbon-900);
  --ink-muted:     var(--ls-carbon-500);

  --inverse:       var(--ls-carbon-900);  /* dark block on a light page */
  --inverse-ink:   var(--ls-paper-100);
  --inverse-2:     var(--ls-carbon-700);  /* chips inside an inverse block */
  --inverse-muted: var(--ls-carbon-300);

  --accent:        var(--brand);
  --accent-ink:    var(--brand-ink);
  --accent-hover:  color-mix(in oklab, var(--brand) 92%, black);
  --accent-press:  color-mix(in oklab, var(--brand) 84%, black);
  --accent-subtle: color-mix(in oklab, var(--brand) 16%, var(--surface));

  --alert:         var(--ls-coral-500);
  --alert-ink:     var(--ls-carbon-900);
  --alert-surface: color-mix(in oklab, var(--ls-coral-500) 12%, var(--surface));

  --success:       var(--ls-emerald-500);
  --deep:          var(--ls-turf-700);
  --deep-alt:      var(--ls-slate-600);

  /* striped fill for unavailable states */
  --stripe-a: #EEEDE6;
  --stripe-b: #E6E5DD;

  --radius-control: 999px;
  --radius-sm: 12px;
  --radius-md: 16px;
  --radius-lg: 20px;
  --radius-xl: 28px;

  --control-h: 44px;
  --control-h-lg: 54px;
}
```

### Layer 2 — roles (dark)

Surfaces step **up** from the page, they do not invert.

```css
.dark {
  --bg:            var(--ls-carbon-900);
  --surface:       var(--ls-carbon-800);
  --surface-2:     var(--ls-carbon-700);
  --line:          var(--ls-carbon-700);
  --line-strong:   var(--ls-carbon-600);
  --line-dashed:   var(--ls-carbon-600);

  --ink:           var(--ls-paper-100);
  --ink-muted:     var(--ls-carbon-300);

  --inverse:       var(--ls-carbon-800);  /* was carbon-on-white; now a raised block */
  --inverse-ink:   var(--ls-paper-100);
  --inverse-2:     var(--ls-carbon-700);
  --inverse-muted: var(--ls-carbon-300);

  --accent-subtle: color-mix(in oklab, var(--brand) 22%, var(--surface));
  --alert-surface: color-mix(in oklab, var(--ls-coral-500) 18%, var(--surface));

  --stripe-a: #1A1F1C;
  --stripe-b: #232B26;
}
```

`--brand`, `--brand-ink`, `--accent*`, `--alert`, `--success` do not change between themes.

**The selected-state rule in code:** a component that is `--inverse` in light and must swap on selection uses `--selected` / `--selected-ink`, defined as:

```css
:root { --selected: var(--inverse);  --selected-ink: var(--inverse-ink); }
.dark { --selected: var(--accent);   --selected-ink: var(--accent-ink); }
```

So `bg-[var(--selected)]` is correct in both themes and no component branches on theme.

**Ink-safe action colour.** Volt (`--brand` / `--primary`) is a fill. On light paper it fails as text or as a hairline (~1.3:1). Use `--action-ink` for text, borders, rings, and light washes that used to be `text-primary` / `border-primary` / `ring-primary` / `bg-primary/10`:

```css
:root { --action-ink: var(--ink);   --ring: var(--ink); }
.dark { --action-ink: var(--brand); --ring: var(--brand); }
```

Money-in figures use `--success` (emerald), not `--action-ink` and not `--primary`.

### Layer 3 — library aliases

Keep every existing shadcn variable name; only change what it points at. **Do not repoint `--accent`** — shadcn uses it for hover washes. Map it to `--surface-2`.

```css
:root {
  --background: var(--bg);
  --foreground: var(--ink);
  --card: var(--surface);
  --card-foreground: var(--ink);
  --popover: var(--surface);
  --popover-foreground: var(--ink);

  --primary: var(--accent);
  --primary-foreground: var(--accent-ink);

  --secondary: var(--surface-2);
  --secondary-foreground: var(--ink);
  --muted: var(--surface-2);
  --muted-foreground: var(--ink-muted);

  --accent: var(--surface-2);          /* library hover wash — NOT the brand */
  --accent-foreground: var(--ink);

  --destructive: var(--alert);
  --destructive-foreground: var(--alert-ink);

  --border: var(--line);
  --input: var(--line-strong);
  --ring: var(--ink);                  /* light; .dark sets --ring: var(--brand) */
}
```

Because `--primary-foreground` is now carbon, the `text-white` in `button.tsx` and `badge.tsx` destructive variants must become `text-[var(--destructive-foreground)]` — white on coral fails contrast.

### Tailwind v4 exposure

```css
@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-line: var(--line);
  --color-ink: var(--ink);
  --color-ink-muted: var(--ink-muted);
  --color-inverse: var(--inverse);
  --color-inverse-ink: var(--inverse-ink);
  --color-accent-brand: var(--accent);      /* name avoids the shadcn `accent` */
  --color-accent-ink: var(--accent-ink);
  --color-action-ink: var(--action-ink);
  --color-alert: var(--alert);
  --color-success: var(--success);
  --font-display: var(--font-display);
  --font-sans: var(--font-plex-arabic);
  --font-heading: var(--font-kufi);
  --font-mono: var(--font-plex-mono);
}
```

---

## 2. Tenant colour override (build for it now, ship it later)

A tenant can override **one value**: `--brand`. Everything else is locked, so no tenant can break legibility, and the whole ramp (hover, press, subtle, ring, selected-in-dark) recomputes from it through `color-mix`.

Store per tenant: `brandHex` (nullable) and `brandInk` (`'dark' | 'light'`, computed once at save time from contrast against the chosen hex — CSS can't do contrast yet).

Inject it server-side in the tenant layout, so there is no flash and no client JS:

```tsx
// resolved from the subdomain in the layout, alongside the theme class
{tenant.brandHex && (
  <style
    dangerouslySetInnerHTML={{
      __html: `:root{--brand:${tenant.brandHex};--brand-ink:${
        tenant.brandInk === 'light' ? 'var(--ls-paper-100)' : 'var(--ls-carbon-900)'
      }}`,
    }}
  />
)}
```

Validate `brandHex` against `/^#[0-9a-fA-F]{6}$/` before it ever reaches that string.

Rules that keep this cheap:

- No component may read `--brand` directly. Components read `--accent`, `--primary`, `--selected`. One indirection means the override lands everywhere at once.
- Never hardcode the brand as a literal in a component, a chart config, an email template or an SVG. Icons and logos take `currentColor` or `var(--accent)`.
- Grounds, inks, lines, `--alert` and `--success` are never overridable.
- Because `--brand` is theme-independent, a tenant colour works in light and dark without a second stored value — provided it passes contrast on both, which the `brandInk` flag handles.

---

## 3. Fonts

Keep both Arabic faces exactly as they are. Add one display face for numbers only.

| Variable | Family | Role |
|---|---|---|
| `--font-manrope` | Manrope (400–800), latin | Latin `ui` — body, labels, buttons |
| `--font-plex-arabic` | IBM Plex Sans Arabic | Arabic `ui` fallback after Manrope |
| `--font-kufi` | Noto Kufi Arabic | Arabic fallback for headings and display |
| `--font-display` / `--font-heading` | Big Shoulders (700–900), then Kufi, then Plex Arabic | `display` and headings. Arabic words fall through to Kufi |
| `--font-plex-mono` | IBM Plex Mono | IDs, codes, phone numbers |

Big Shoulders has no Arabic subset, which is fine: it only ever sets Latin digits. Arabic words fall back to Kufi automatically through the stack.

The existing `LtrIsolate` component is the migration hook — numbers already route through it. Switch its class from `font-mono` to `font-display` plus `tabular-nums`, and most of the number typography lands in one file.

---

## 4. Things this file deliberately does not cover

- **Expense category tiles** (5 ad-hoc Tailwind palette colours). They need a `--category-1…5` role set derived from the neutral and deep families, not from `--alert`. Decide before touching `money/panel.tsx`.
- **Chart tokens** `--chart-1…5` and the sidebar token block. Leave pointing at primitives until a chart contract exists.
- **`global-error.tsx`** renders its own `<html>` and cannot read the token layer. Leave its four hex values hardcoded and note it in `MIGRATION.md`.