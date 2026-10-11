/**
 * The countries a phone number can be entered for: the international dialling code (digits only)
 * and a key for the name, which comes later from copy. Lebanon is first and the default.
 */
export const COUNTRIES = [
  { code: "961", key: "lb" },
  { code: "963", key: "sy" },
  { code: "970", key: "ps" },
  { code: "962", key: "jo" },
  { code: "964", key: "iq" },
  { code: "20", key: "eg" },
  { code: "966", key: "sa" },
  { code: "971", key: "ae" },
  { code: "974", key: "qa" },
  { code: "965", key: "kw" },
  { code: "33", key: "fr" },
  { code: "49", key: "de" },
  { code: "1", key: "us" },
] as const satisfies ReadonlyArray<{ code: string; key: string }>;

export type CountryCode = (typeof COUNTRIES)[number]["code"];

/** What a phone without a country means: Lebanon. */
export const DEFAULT_COUNTRY: CountryCode = "961";

export function isKnownCountry(code: string): code is CountryCode {
  return COUNTRIES.some((country) => country.code === code);
}
