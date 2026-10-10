/**
 * A Lebanese number as international digits (961…), or null when it cannot be one. Input is
 * digits only (see people/domain/phone.ts normalizePhone). "03…" becomes "9613…", a number that
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
