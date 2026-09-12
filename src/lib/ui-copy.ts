import type { UiLocale } from "@/lib/locale";

/**
 * Arabic chrome (DR-005). Keys, not sentences in JSX. Unknown key → the key
 * (missing copy stays visible). Interpolated money/counts are helpers below.
 * Optional English is a second table for the public lang/dir toggle — not next-intl.
 */
const ARABIC: Record<string, string> = {
  "doc.title": "ملاعب",
  "public.day": "اليوم",
  "public.today": "اليوم",
  "public.tomorrow": "غداً",
  "public.otherDate": "تاريخ آخر",
  "public.showHours": "عرض الساعات",
  "public.hours": "الساعات",
  "public.taken": "محجوز",
  "public.name": "الاسم",
  "public.phone": "الهاتف",
  "public.request": "اطلب",
  "public.emptyPitches": "لا ملاعب بعد.",
  "public.emptyPitchesNext": "هذا الملعب لم يُدرج ملاعب.",
  "public.closed": "مغلق هذا اليوم.",
  "public.closedNext": "اختر يوماً آخر لرؤية الساعات.",
  "public.pastDate": "هذا التاريخ مضى.",
  "public.pastDateNext": "اختر اليوم أو يوماً قادماً.",
  "public.hoursEnded": "لم تبق ساعات اليوم.",
  "public.hoursEndedNext": "اختر يوماً قادماً.",
  "public.langToEn": "EN",
  "public.langToAr": "ع",
  "public.langEnglish": "English",
  "public.langArabic": "العربية",
  "public.errName": "أدخل الاسم.",
  "public.errPhone": "أدخل هاتفاً من 8 إلى 15 رقماً.",
  "login.title": "تسجيل الدخول",
  "login.identifier": "المعرّف",
  "login.password": "كلمة السر",
  "login.submit": "دخول",
  "owner.logout": "خروج",
  "owner.today": "اليوم",
  "owner.pending": "قيد الانتظار",
  "owner.confirmed": "مؤكد",
  "owner.requested": "طُلب",
  "owner.due": "مستحق",
  "owner.paid": "مدفوع",
  "owner.approve": "موافقة",
  "owner.reject": "رفض",
  "owner.collectMixed": "تحصيل مختلط",
  "owner.usd": "دولار",
  "owner.lbp": "ليرة",
  "owner.cancel": "إلغاء",
  "owner.bookHeading": "احجز ساعة",
  "owner.showSlots": "عرض الساعات",
  "owner.book": "احجز",
  "owner.waitlist": "قائمة الانتظار",
  "owner.notify": "إبلاغ",
  "owner.period": "هذه الفترة",
  "owner.difference": "الفرق",
  "owner.in": "داخل",
  "owner.out": "خارج",
  "owner.from": "من",
  "owner.to": "إلى",
  "owner.view": "العرض",
  "owner.displayRate": "سعر العرض",
  "owner.show": "عرض",
  "owner.rate": "سعر الصرف",
  "owner.noRate": "لم يُحدد سعر",
  "owner.newRate": "سعر جديد",
  "owner.setRate": "تعيين السعر",
  "owner.expenses": "المصاريف",
  "owner.recordExpense": "تسجيل مصروف",
  "owner.category": "الفئة",
  "owner.what": "البيان",
  "owner.when": "التاريخ",
  "owner.recordExpenseSubmit": "تسجيل المصروف",
  "empty.pending": "لا طلبات معلّقة.",
  "empty.pendingNext": "عندما يطلب أحدهم ساعة، تظهر هنا.",
  "empty.confirmed": "لا مباريات مؤكدة اليوم.",
  "empty.confirmedNext": "الساعات الموافق عليها تظهر هنا للتحصيل.",
  "empty.pitches": "لا ملاعب بعد.",
  "empty.pitchesNext": "تظهر الملاعب هنا عندما يُدرجها هذا الملعب.",
  "empty.waitlist": "لا قائمة انتظار.",
  "empty.waitlistNext": "من طلب ساعة محجوزة يظهر هنا بعد الإلغاء.",
  "empty.expenses": "لا مصاريف بعد.",
  "empty.expensesNextRecord": "سجّل واحداً أعلاه.",
  "empty.expensesNextStaff": "لا شيء في هذه القائمة.",
  "cat.ELECTRICITY": "كهرباء",
  "cat.WATER": "مياه",
  "cat.MAINTENANCE": "صيانة",
  "cat.SALARY": "راتب",
  "cat.EQUIPMENT": "تجهيزات",
  "cat.OTHER": "أخرى",
  "role.OWNER": "مالك",
  "role.STAFF": "موظف",
  lbpNote: "عيّن سعر عرض (أو عيّن سعر الصرف أولاً)",
};

const ENGLISH: Record<string, string> = {
  "doc.title": "Pitches",
  "public.day": "Day",
  "public.today": "Today",
  "public.tomorrow": "Tomorrow",
  "public.otherDate": "Other date",
  "public.showHours": "Show hours",
  "public.hours": "Hours",
  "public.taken": "Taken",
  "public.name": "Name",
  "public.phone": "Phone",
  "public.request": "Request",
  "public.emptyPitches": "No pitches yet.",
  "public.emptyPitchesNext": "This stadium has not listed pitches.",
  "public.closed": "Closed this day.",
  "public.closedNext": "Pick another day to see hours.",
  "public.pastDate": "This date has passed.",
  "public.pastDateNext": "Pick today or a coming day.",
  "public.hoursEnded": "No hours left today.",
  "public.hoursEndedNext": "Pick a coming day.",
  "public.langToEn": "EN",
  "public.langToAr": "ع",
  "public.langEnglish": "English",
  "public.langArabic": "العربية",
  "public.errName": "Enter a name.",
  "public.errPhone": "Enter a phone with 8–15 digits.",
};

/** Chrome for a key. Default Arabic. Missing English key falls back to Arabic. */
export function ui(key: string, locale: UiLocale = "ar"): string {
  if (locale === "en") return ENGLISH[key] ?? ARABIC[key] ?? key;
  return ARABIC[key] ?? key;
}

/** Empty hours: closed / past date / today exhausted. */
export function hoursEmptyState(
  kind: "closed" | "past" | "hoursEnded",
  locale: UiLocale = "ar",
): { title: string; next: string } {
  if (kind === "past") {
    return {
      title: ui("public.pastDate", locale),
      next: ui("public.pastDateNext", locale),
    };
  }
  if (kind === "hoursEnded") {
    return {
      title: ui("public.hoursEnded", locale),
      next: ui("public.hoursEndedNext", locale),
    };
  }
  return {
    title: ui("public.closed", locale),
    next: ui("public.closedNext", locale),
  };
}

/** Pending heading with a Western count. */
export function pendingCount(n: number): string {
  return `قيد الانتظار · ${n}`;
}

/** Confirmed heading with a Western count. */
export function confirmedCount(n: number): string {
  return `مؤكد · ${n}`;
}

/** Collect remaining USD — amount is already formatUsd (Latin). */
export function collectUsdLabel(amount: string): string {
  return `تحصيل $${amount}`;
}

/** Confirmed card due line. Amounts are already formatUsd (Latin). */
export function dueRemainingLine(due: string, remaining: string): string {
  return `المستحق $${due} · المتبقي $${remaining}`;
}

/** Exchange-rate card line. Amount is Latin digits, no currency symbol. */
export function lbpPerUsdLine(amount: string): string {
  return `${amount} ليرة لكل دولار`;
}
