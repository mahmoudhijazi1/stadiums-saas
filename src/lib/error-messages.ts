import type { UiLocale } from "@/lib/locale";

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
  "booking.no_longer_pending": "تم حجز هذه الساعة للتو",
  "booking.confirmed_only": "يمكن إلغاء حجز مؤكد فقط.",
  "booking.cancel_past_unpaid": "لا يمكن إلغاء مباراة مضت وما زال عليها مبلغ.",
  "booking.no_show_only_approved": "يمكن تسجيل عدم الحضور لحجز مؤكد فقط.",
  "booking.no_show_not_ended":
    "يمكن تسجيل عدم الحضور بعد انتهاء الساعة فقط.",
  "booking.slot_not_offered": "هذه الساعة غير معروضة.",
  "booking.slot_taken": "هذه الساعة محجوزة.",
  "booking.slot_ended": "هذه الساعة انتهت.",
  "booking.slot_unavailable": "الساعة لم تعد متاحة.",
  "booking.pitch_not_found": "الملعب غير موجود.",
  "booking.requester_not_found": "صاحب الطلب غير موجود.",
  "booking.split_count": "عدد اللاعبين يجب أن يكون ١ على الأقل.",
  "booking.due_negative": "المبلغ المستحق لا يمكن أن يكون أقل من صفر.",
  "booking.due_below_collected":
    "تم تحصيل مبلغ أكبر من الجديد، لا يمكن الاسترداد بعد.",
  "booking.due_whole_only": "تعديل المبلغ متاح للحجز الكامل فقط.",
  "payment.collect_unapproved": "يمكن التحصيل من حجز مؤكد أو لم يحضر أو ملغى فقط.",
  "payment.nothing_due": "لا يوجد مبلغ مستحق.",
  "payment.rate_required": "عيّن سعر الصرف أولاً.",
  "payment.amount_required": "المبلغ مطلوب.",
  "payment.amount_positive": "يجب أن يكون المبلغ أكبر من صفر.",
  "notification.bad_phone": "لا يمكن استخدام هذا الرقم لواتساب.",
  "ledger.invalid_period": "الفترة غير صالحة.",
  "expense.invalid_date": "تاريخ المصروف غير صالح.",
  "venue.hours_approved":
    "لا يمكن تقليص الساعات: هناك حجز مؤكد في الوقت المحذوف.",
  "venue.hours_pending":
    "هناك طلب معلّق في ساعات ستُحذف. أكّد للحفظ دون رفض الطلب.",
  "venue.hours_day_overlap": "لا يمكن وضع نفس اليوم في مجموعتي ساعات.",
};

const ENGLISH: Record<string, string> = {
  "error.generic": "Something went wrong. Try again.",
  "form.invalid": "Check the form and try again.",
  "access.not_allowed": "You are not allowed to do that.",
  "access.invalid_login": "Invalid login.",
  "booking.not_found": "Booking not found.",
  "booking.pending_only": "Only a pending request can be approved or rejected.",
  "booking.no_longer_pending": "This hour was just booked",
  "booking.confirmed_only": "Only a confirmed booking can be cancelled.",
  "booking.cancel_past_unpaid":
    "Cannot cancel a game that has started while money is still owed.",
  "booking.no_show_only_approved":
    "Only a confirmed booking can be marked no-show.",
  "booking.no_show_not_ended":
    "A no-show can be recorded only after the hour has ended.",
  "booking.slot_not_offered": "That hour is not offered.",
  "booking.slot_taken": "That hour is taken.",
  "booking.slot_ended": "That hour has ended.",
  "booking.slot_unavailable": "The hour is no longer available.",
  "booking.pitch_not_found": "Pitch not found.",
  "booking.requester_not_found": "Requester not found.",
  "booking.split_count": "Player count must be at least 1.",
  "booking.due_negative": "The amount due cannot be below zero.",
  "booking.due_below_collected":
    "Already collected more than the new amount. Refunds are not supported yet.",
  "booking.due_whole_only": "Adjusting the due is only available for a whole-game booking.",
  "payment.collect_unapproved": "Only a confirmed, no-show, or cancelled booking can be collected.",
  "payment.nothing_due": "Nothing is due.",
  "payment.rate_required": "Set the exchange rate first.",
  "payment.amount_required": "An amount is required.",
  "payment.amount_positive": "Amount must be greater than zero.",
  "notification.bad_phone": "That number cannot be used for WhatsApp.",
  "ledger.invalid_period": "That period is not valid.",
  "expense.invalid_date": "That expense date is not valid.",
  "venue.hours_approved":
    "Cannot shrink hours: an approved booking sits in a removed window.",
  "venue.hours_pending":
    "A pending request sits in hours you are removing. Confirm to save without rejecting it.",
  "venue.hours_day_overlap": "A day cannot be in two hours groups.",
};

/** Owner-facing copy for a key. Never returns a stack or Prisma dump. */
export function errorMessage(key: string, locale: UiLocale = "ar"): string {
  if (key === "1") {
    return locale === "en" ? ENGLISH["error.generic"]! : ARABIC["error.generic"]!;
  }
  if (locale === "en") return ENGLISH[key] ?? ARABIC[key] ?? ENGLISH["error.generic"]!;
  return ARABIC[key] ?? ARABIC["error.generic"]!;
}
