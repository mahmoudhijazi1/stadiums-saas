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
 * Rules for the Stadium info preview only: three sample parts (a primary button, the dark-theme
 * active pill, a link) coloured by one preset, scoped under `.accent-preview` so they do not leak
 * into the page. They use literal colours because custom properties already resolved on <html>
 * would not change inside the preview.
 */
export function accentPreviewCss(key: unknown): string {
  const { light, dark } = presetOf(key);
  const rules = (set: AccentSet, prefix: string, pill: boolean) =>
    `${prefix}.accent-preview .pv-button{background:${set.fill};color:${set.onFill}}` +
    // The active pill takes the accent only in the dark theme; in the light theme it is the
    // inverse (carbon) pill, exactly as in the app.
    (pill ? `${prefix}.accent-preview .pv-pill{background:${set.fill};color:${set.onFill}}` : "") +
    `${prefix}.accent-preview .pv-link{color:${set.ink}}`;
  return (
    rules(light, "html:root ", false) +
    rules(dark, "html.dark ", true) +
    rules(dark, 'html[data-theme="dark"] ', true)
  );
}
