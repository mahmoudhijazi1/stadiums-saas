import type { UiLocale } from "@/lib/locale";

/**
 * Success flash keys (ok= on redirect). DR-005; keys stay.
 * Unknown keys → generic done line.
 */
const ARABIC: Record<string, string> = {
  approved: "تمت الموافقة.",
  rejected: "تم الرفض.",
  collected: "تم التحصيل.",
  booked: "تم الحجز.",
  cancelled: "تم الإلغاء.",
  no_show: "سُجّل عدم الحضور.",
  rate_set: "تم تعيين السعر.",
  expense_recorded: "سُجّل المصروف.",
  requested: "وصل الطلب.",
  pitch_created: "أُضيف الملعب.",
  pitch_updated: "حُفظ الملعب.",
};

const ENGLISH: Record<string, string> = {
  approved: "Approved.",
  rejected: "Rejected.",
  collected: "Collected.",
  booked: "Booked.",
  cancelled: "Cancelled.",
  no_show: "Marked as no-show.",
  rate_set: "Rate set.",
  expense_recorded: "Expense recorded.",
  requested: "Request received.",
  pitch_created: "Pitch added.",
  pitch_updated: "Pitch saved.",
};

const GENERIC_AR = "تم.";
const GENERIC_EN = "Done.";

/** Owner/public toast for a success key. Never a stack. */
export function successMessage(key: string, locale: UiLocale = "ar"): string {
  if (locale === "en") return ENGLISH[key] ?? GENERIC_EN;
  return ARABIC[key] ?? GENERIC_AR;
}
