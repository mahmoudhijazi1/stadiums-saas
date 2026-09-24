export type PluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";

/** One template per Intl category. `{n}` is the count. `other` is required. */
export type PluralForms = Partial<Record<PluralCategory, string>> & {
  other: string;
};

/**
 * Pick a counted-noun template with Intl.PluralRules.
 * A `zero` form is used for count 0 even when the locale's category is `other`
 * (English), so "No games" does not become "0 games".
 */
export function plural(
  locale: string,
  count: number,
  forms: PluralForms,
): string {
  const category = new Intl.PluralRules(locale).select(count);
  const template =
    (count === 0 && forms.zero) || forms[category] || forms.other;
  return template.split("{n}").join(String(count));
}
