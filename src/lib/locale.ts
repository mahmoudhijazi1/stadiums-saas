/** Locale cookie. Not next-intl — cookie + html lang/dir only. */

export type UiLocale = "ar" | "en";

export const LOCALE_COOKIE = "stadium_locale";
export const LOCALE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export function parseUiLocale(value: string | undefined): UiLocale {
  return value === "en" ? "en" : "ar";
}

export function htmlLang(locale: UiLocale): string {
  return locale;
}

export function htmlDir(locale: UiLocale): "rtl" | "ltr" {
  return locale === "en" ? "ltr" : "rtl";
}

export function otherUiLocale(locale: UiLocale): UiLocale {
  return locale === "ar" ? "en" : "ar";
}

/**
 * The request header the proxy sets on the bare host's landing routes ("ar" or "en"). The proxy
 * deletes any incoming one on every request, so only the proxy can set it.
 */
export const LANDING_HEADER = "x-lebstads-landing";

/** The landing language named by the header, or null for anything else. */
export function parseLandingLocale(value: string | null | undefined): UiLocale | null {
  return value === "ar" || value === "en" ? value : null;
}
