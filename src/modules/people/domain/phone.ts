import { DEFAULT_COUNTRY, isKnownCountry } from "@/modules/people/domain/countries";

/** Arabic-Indic (٠-٩) and Persian (۰-۹) digits to Latin, so a phone typed on an Arabic keyboard is the same number. */
function latinDigits(raw: string): string {
  return raw
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));
}

/**
 * Store phones as digits only so "03 123 456" and "+961…" hit the same Person row.
 * Length (8–15) is Zod at the public form (SPEC-03 step 6), not here.
 */
export function normalizePhone(raw: string): string {
  return latinDigits(raw).replace(/\D/g, "");
}

/** What a phone may be typed with: digits, + - ( ) . and spaces. No letters. */
const PHONE_TEXT = /^[0-9\u0660-\u0669\u06f0-\u06f9+\-().\s]*$/;

export function isPhoneText(raw: string): boolean {
  return PHONE_TEXT.test(raw);
}

/** For the input box: drop everything a phone cannot contain as the user types or pastes. */
export function sanitizePhoneInput(raw: string): string {
  return latinDigits(raw).replace(/[^0-9+\-().\s]/g, "");
}

/**
 * A Lebanese number as international digits (961…), or null when it cannot be one. Input is
 * digits only (see normalizePhone above). "03…" becomes "9613…", a number that
 * already starts with 961 stays, anything else is taken as the national number. At least 7 digits
 * after 961. The WhatsApp links and the stadium's published phones share this one rule.
 */
export function toLebanonNumber(phoneDigits: string): string | null {
  if (!/^\d+$/.test(phoneDigits)) return null;
  let e164: string;
  if (phoneDigits.startsWith("961")) {
    e164 = phoneDigits;
  } else if (phoneDigits.startsWith("0")) {
    e164 = `961${phoneDigits.slice(1)}`;
  } else {
    e164 = `961${phoneDigits}`;
  }
  return /^961\d{7,}$/.test(e164) ? e164 : null;
}

/** A Lebanese national number: 7 digits, or 8 digits starting with 7 or 8. */
function isLebaneseNational(national: string): boolean {
  return /^\d{7}$/.test(national) || /^[78]\d{7}$/.test(national);
}

/** "961" + a national number (one leading 0 dropped), or null when the national part is not valid. */
function lebaneseCanonical(rest: string): string | null {
  const national = rest.startsWith("0") ? rest.slice(1) : rest;
  return isLebaneseNational(national) ? `961${national}` : null;
}

/**
 * The one canonical form of a phone, or null when it cannot be one. Lebanese numbers become
 * "961" + the national number ("71123456", "03123456", "+961 71 123 456" and "0096171123456" are
 * each one number); a number from another country becomes its international digits. Arabic-Indic
 * and Persian digits are converted; spaces, dashes, dots and parentheses are ignored; any letter,
 * an empty string or an invalid length gives null.
 *
 * - "+" or "00" in front means international. "961": the rest, minus one leading 0, must be 7
 *   digits or 8 digits starting with 7 or 8. Another country: 8 to 15 digits in all.
 * - No prefix, country 961 (the default): 961 followed by 10 or 11 digits in all is read as
 *   international Lebanese; anything else loses one leading 0 and must be a valid national number.
 * - No prefix, another known country: digits that start with its code and have 8 or more after it
 *   already include the code; otherwise one leading 0 is dropped and the code put in front. The
 *   result must be 10 to 15 digits. A "+" or "00" prefix ignores `country`. An unknown country is null.
 *
 * Pure: not used by any caller yet (normalizePhone is still what is stored).
 */
export function toCanonicalPhone(raw: string, country: string = DEFAULT_COUNTRY): string | null {
  if (!isKnownCountry(country)) return null;
  const text = latinDigits(raw).trim();
  if (text === "" || !/^[0-9+\-().\s]+$/.test(text)) return null;
  const compact = text.replace(/[\s\-().]/g, "");

  let international = false;
  let digits = compact;
  if (compact.startsWith("+")) {
    international = true;
    digits = compact.slice(1);
  } else if (compact.startsWith("00")) {
    international = true;
    digits = compact.slice(2);
  }
  if (!/^\d+$/.test(digits)) return null;

  if (international) {
    if (digits.startsWith("961")) return lebaneseCanonical(digits.slice(3));
    return digits.length >= 8 && digits.length <= 15 ? digits : null;
  }
  if (country !== "961") return otherCountryCanonical(digits, country);
  if (digits.startsWith("961") && (digits.length === 10 || digits.length === 11)) {
    return lebaneseCanonical(digits.slice(3));
  }
  return lebaneseCanonical(digits);
}

/**
 * A number typed with no prefix for a country other than Lebanon. Digits that start with the
 * country code and have at least 8 more are taken as already including the code; otherwise one
 * leading 0 is dropped and the code is put in front. The whole must be 10 to 15 digits.
 */
function otherCountryCanonical(digits: string, country: string): string | null {
  const full =
    digits.startsWith(country) && digits.length - country.length >= 8
      ? digits
      : `${country}${digits.startsWith("0") ? digits.slice(1) : digits}`;
  return full.length >= 10 && full.length <= 15 ? full : null;
}

/**
 * What a search box query becomes for a substring match against stored phones: digits only
 * (Arabic-Indic and Persian converted), minus a leading "00" or else one leading "0". Never throws.
 */
export function toPhoneSearchDigits(query: string): string {
  const digits = latinDigits(query).replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  return digits.startsWith("0") ? digits.slice(1) : digits;
}

/**
 * A stored phone for the screen. International Lebanese digits get spaces: 961 plus 8 digits is
 * "+961 XX XXX XXX", 961 plus 7 digits is "+961 X XXX XXX", and another country's 10 to 15 digit
 * canonical number gets a "+". Anything else (a local "03..." or 8-digit number, empty, already
 * formatted, not digits) comes back unchanged. Display only: the stored
 * value and the tel: / WhatsApp links keep the raw digits.
 */
export function formatPhoneDisplay(digits: string): string {
  const match = /^961(\d{7,8})$/.exec(digits);
  // Another country's canonical number: "+" in front. A leading 0 or fewer than 10 digits is a
  // legacy local number (03123456, 71123456), not a canonical foreign one, so it stays as stored.
  if (!match) return /^[1-9]\d{9,14}$/.test(digits) && !digits.startsWith("961") ? `+${digits}` : digits;
  const rest = match[1]!;
  return rest.length === 8
    ? `+961 ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5)}`
    : `+961 ${rest.slice(0, 1)} ${rest.slice(1, 4)} ${rest.slice(4)}`;
}
