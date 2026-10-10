import { presetOf, type AccentSet } from "@/lib/brand-presets";

/**
 * The CSS that sets a stadium's accent. Pure and closed: the only inputs are a preset KEY (looked
 * up in BRAND_PRESETS; an unknown key, null or undefined is the default) and constants. Every
 * value in the output is a #RRGGBB string from the constant, so no tenant text can reach the CSS.
 *
 * It sets the four role variables the rest of the app already reads (--brand, --brand-ink,
 * --action-ink, --ring) for both themes. `html:root` / `html.dark` outrank globals.css's plain
 * `:root` / `.dark`, so it wins whichever stylesheet loads first. Status colours (--paid, --owed,
 * --alert, ...) are not touched.
 */
function declarations(set: AccentSet): string {
  return `--brand:${set.fill};--brand-ink:${set.onFill};--action-ink:${set.ink};--ring:${set.ring};`;
}

const DARK = 'html.dark,html[data-theme="dark"]';

/** The style block for the root layout: light variables, then dark ones. */
export function accentCss(key: unknown): string {
  const preset = presetOf(key);
  return `html:root{${declarations(preset.light)}}${DARK}{${declarations(preset.dark)}}`;
}

/** The dark-theme fill: the manifest's theme_color. */
export function accentThemeColor(key: unknown): string {
  return presetOf(key).dark.fill;
}

/**
 * Rules for the Stadium info preview only. The preview renders the app's REAL components (the
 * primary button, the day pill, a link, the status pills), so they must see the previewed preset
 * and not the stadium's saved one. Custom properties that already resolved on <html> (for example
 * --color-primary, which Tailwind built from var(--primary)) are inherited as plain values, so
 * overriding --brand on a wrapper would change nothing. The wrapper therefore sets, as literal
 * #RRGGBB values from the constant, the role variables AND the Tailwind colour variables the real
 * components read. The dark theme also sets --selected, because the active pill takes the accent
 * only there; in the light theme it stays the inverse pill, exactly as in the app. The status
 * variables (--paid, --owed, --expected, --alert) are never set: the pills beside the accent show
 * the fixed colours.
 */
function previewDeclarations(set: AccentSet, withSelected: boolean): string {
  return (
    `--brand:${set.fill};--brand-ink:${set.onFill};--action-ink:${set.ink};--ring:${set.ring};` +
    `--primary:${set.fill};--primary-foreground:${set.onFill};` +
    `--color-primary:${set.fill};--color-primary-foreground:${set.onFill};` +
    `--color-accent-brand:${set.fill};--color-accent-ink:${set.onFill};` +
    `--color-action-ink:${set.ink};--color-ring:${set.ring};` +
    (withSelected
      ? `--selected:${set.fill};--selected-ink:${set.onFill};--color-selected:${set.fill};--color-selected-ink:${set.onFill};`
      : "")
  );
}

export function accentPreviewCss(key: unknown): string {
  const { light, dark } = presetOf(key);
  return (
    `html:root .accent-preview{${previewDeclarations(light, false)}}` +
    `html.dark .accent-preview{${previewDeclarations(dark, true)}}` +
    `html[data-theme="dark"] .accent-preview{${previewDeclarations(dark, true)}}`
  );
}
