import { normalizePhone } from "@/modules/people/domain/phone";

export type PublicRequestFieldKey = "public.errName" | "public.errPhone";

export type PublicRequestFieldErrors = {
  name?: PublicRequestFieldKey;
  phone?: PublicRequestFieldKey;
};

/**
 * Client-side field checks (same 8–15 digit phone rule as Zod).
 * Keys, not sentences — the picker looks up ui(key, locale).
 */
export function publicRequestFieldErrors(
  name: string,
  phone: string,
): PublicRequestFieldErrors {
  const errors: PublicRequestFieldErrors = {};
  if (name.trim().length < 1) errors.name = "public.errName";
  const digits = normalizePhone(phone);
  if (digits.length < 8 || digits.length > 15) {
    errors.phone = "public.errPhone";
  }
  return errors;
}

export function hasPublicRequestFieldErrors(
  errors: PublicRequestFieldErrors,
): boolean {
  return Boolean(errors.name || errors.phone);
}
