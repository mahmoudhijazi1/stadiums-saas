/**
 * Store phones as digits only so "03 123 456" and "+961…" hit the same Person row.
 * Length (8–15) is Zod at the public form (SPEC-03 step 6), not here.
 */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}
