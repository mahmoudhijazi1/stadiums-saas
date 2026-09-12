/**
 * Arabic copy for DomainError keys (DR-005). Keys stay (DR-004); next-intl later.
 * Unknown keys and legacy ?error=1 → generic.
 */
const ARABIC: Record<string, string> = {
  "error.generic": "حدث خطأ. حاول مرة أخرى.",
  "form.invalid": "راجع النموذج وحاول مرة أخرى.",
  "access.not_allowed": "لا يمكنك فعل ذلك.",
  "access.invalid_login": "تسجيل الدخول غير صالح.",
  "booking.not_found": "الحجز غير موجود.",
  "booking.pending_only": "يمكن الموافقة على طلب معلّق أو رفضه فقط.",
  "booking.confirmed_only": "يمكن إلغاء حجز مؤكد فقط.",
  "booking.slot_not_offered": "هذه الساعة غير معروضة.",
  "booking.slot_taken": "هذه الساعة محجوزة.",
  "booking.slot_ended": "هذه الساعة انتهت.",
  "booking.slot_unavailable": "الساعة لم تعد متاحة.",
  "booking.pitch_not_found": "الملعب غير موجود.",
  "booking.requester_not_found": "صاحب الطلب غير موجود.",
  "payment.collect_unapproved": "يمكن التحصيل من حجز موافق عليه فقط.",
  "payment.nothing_due": "لا يوجد مبلغ مستحق.",
  "payment.rate_required": "عيّن سعر الصرف أولاً.",
  "payment.amount_required": "المبلغ مطلوب.",
  "payment.amount_positive": "يجب أن يكون المبلغ أكبر من صفر.",
  "notification.bad_phone": "لا يمكن استخدام هذا الرقم لواتساب.",
  "ledger.invalid_period": "الفترة غير صالحة.",
  "expense.invalid_date": "تاريخ المصروف غير صالح.",
};

const GENERIC = "حدث خطأ. حاول مرة أخرى.";

/** Owner-facing Arabic for a key. Never returns a stack or Prisma dump. */
export function errorMessage(key: string): string {
  if (key === "1") return GENERIC;
  return ARABIC[key] ?? GENERIC;
}
