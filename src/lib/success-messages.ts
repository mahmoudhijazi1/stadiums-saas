/**
 * Arabic copy for success flash keys (ok= on redirect). DR-005; keys stay.
 * Unknown keys → generic done line.
 */
const ARABIC: Record<string, string> = {
  approved: "تمت الموافقة.",
  rejected: "تم الرفض.",
  collected: "تم التحصيل.",
  booked: "تم الحجز.",
  cancelled: "تم الإلغاء.",
  rate_set: "تم تعيين السعر.",
  expense_recorded: "سُجّل المصروف.",
  requested: "وصل الطلب.",
};

const GENERIC = "تم.";

/** Owner/public toast Arabic for a success key. Never a stack. */
export function successMessage(key: string): string {
  return ARABIC[key] ?? GENERIC;
}
