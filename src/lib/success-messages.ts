/**
 * English copy for success flash keys (ok= on redirect). next-intl later; keys stay.
 * Unknown keys → generic done line.
 */
const ENGLISH: Record<string, string> = {
  approved: "Approved.",
  rejected: "Rejected.",
  collected: "Collected.",
  booked: "Booked.",
  cancelled: "Cancelled.",
  rate_set: "Rate set.",
  expense_recorded: "Expense recorded.",
  requested: "Request received.",
};

const GENERIC = "Done.";

/** Owner/public toast English for a success key. Never a stack. */
export function successMessage(key: string): string {
  return ENGLISH[key] ?? GENERIC;
}
