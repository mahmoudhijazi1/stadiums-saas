/**
 * English copy for DomainError keys (DR-004). next-intl later; keys stay.
 * Unknown keys and legacy ?error=1 → generic.
 */
const ENGLISH: Record<string, string> = {
  "error.generic": "Something went wrong. Try again.",
  "form.invalid": "Check the form and try again.",
  "access.not_allowed": "You cannot do that.",
  "access.invalid_login": "Invalid login.",
  "booking.not_found": "Booking not found.",
  "booking.pending_only": "Only a pending request can be approved or rejected.",
  "booking.confirmed_only": "Only a confirmed booking can be cancelled.",
  "booking.slot_not_offered": "That hour is not offered.",
  "booking.slot_taken": "That hour is taken.",
  "booking.slot_ended": "That hour has already ended.",
  "booking.slot_unavailable": "Slot no longer available.",
  "booking.pitch_not_found": "Pitch not found.",
  "booking.requester_not_found": "Requester not found.",
  "payment.collect_unapproved": "Only an approved booking can be collected.",
  "payment.nothing_due": "Nothing due.",
  "payment.rate_required": "Set exchange rate first.",
  "payment.amount_required": "Amount required.",
  "payment.amount_positive": "Amount must be positive.",
  "notification.bad_phone": "Phone cannot be used for WhatsApp.",
  "ledger.invalid_period": "Invalid period.",
  "expense.invalid_date": "Invalid expense date.",
};

const GENERIC = "Something went wrong. Try again.";

/** Owner-facing English for a key. Never returns a stack or Prisma dump. */
export function errorMessage(key: string): string {
  if (key === "1") return GENERIC;
  return ENGLISH[key] ?? GENERIC;
}
