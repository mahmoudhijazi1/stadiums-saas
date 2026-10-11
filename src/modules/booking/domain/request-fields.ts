import { toCanonicalPhone } from "@/modules/people/domain/phone";

export type PublicRequestFieldKey = "public.errName" | "public.errPhone";

export type PublicRequestFieldErrors = {
  name?: PublicRequestFieldKey;
  phone?: PublicRequestFieldKey;
};

/**
 * Client-side field checks (the same canonical phone rule as the Zod schemas; `country` is the
 * selected dialling code, default Lebanon).
 * Keys, not sentences — the picker looks up ui(key, locale).
 */
export function publicRequestFieldErrors(
  name: string,
  phone: string,
  country?: string,
): PublicRequestFieldErrors {
  const errors: PublicRequestFieldErrors = {};
  if (name.trim().length < 1) errors.name = "public.errName";
  if (toCanonicalPhone(phone, country) === null) {
    errors.phone = "public.errPhone";
  }
  return errors;
}

export function hasPublicRequestFieldErrors(
  errors: PublicRequestFieldErrors,
): boolean {
  return Boolean(errors.name || errors.phone);
}
