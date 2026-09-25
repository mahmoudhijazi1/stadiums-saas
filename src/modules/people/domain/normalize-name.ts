const TASHKEEL_AND_TATWEEL = /[\u064B-\u0652\u0670\u0640]/g;

/**
 * Fold a person name for search. Latin case, Arabic diacritics, and the
 * alef / alef-maksura / teh-marbuta variants collapse to one form.
 */
export function normalizeName(s: string): string {
  return s
    .trim()
    .replace(TASHKEEL_AND_TATWEEL, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
