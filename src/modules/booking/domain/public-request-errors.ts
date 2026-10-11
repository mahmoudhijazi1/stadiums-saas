/**
 * What the player is told when a public request fails. The Server Action answers with the error key
 * of the use case (DomainError.key, or "form.invalid" for a Zod failure); the sheet needs only the
 * few cases that read differently to a player.
 */
export type PublicRequestErrorKind = "taken" | "tooFar" | "limit" | "invalid" | "other";

export function publicRequestErrorKind(errorKey: string): PublicRequestErrorKind {
  switch (errorKey) {
    // A taken time is recorded as interest by the use case before it throws.
    case "booking.slot_taken":
    case "booking.slot_taken_noted":
      return "taken";
    case "booking.too_far":
      return "tooFar";
    case "booking.request_limit":
      return "limit";
    case "form.invalid":
      return "invalid";
    default:
      return "other";
  }
}

/** The copy key of each kind. */
export const PUBLIC_REQUEST_ERROR_COPY: Record<PublicRequestErrorKind, string> = {
  taken: "public.errTaken",
  tooFar: "public.errTooFar",
  limit: "public.errLimit",
  invalid: "public.errInvalid",
  other: "public.errOther",
};

/** After these two the same time cannot be sent again: the sheet offers "Pick another time". */
export function isFinalPublicRequestError(kind: PublicRequestErrorKind): boolean {
  return kind === "taken" || kind === "tooFar";
}
