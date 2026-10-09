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
