import type { UiLocale } from "@/lib/locale";

/**
 * Arabic chrome (DR-005). Keys, not sentences in JSX. Unknown key → the key
 * (missing copy stays visible). Interpolated money/counts are helpers below.
 * Optional English is a second table for the EN/ع toggle — not next-intl.
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
  "dialog.close": "إغلاق",
  "login.title": "تسجيل الدخول",
  "login.identifier": "المعرّف",
  "login.password": "كلمة السر",
  "login.submit": "دخول",
  "owner.logout": "خروج",
  "owner.tabs": "الأقسام",
  "owner.today": "اليوم",
  "owner.money": "المال",
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
  "empty.noCreate": "لا صلاحية للحجز.",
  "empty.noCreateNext": "هذه الصفحة للمالك أو لمن أُعطي صلاحية الحجز.",
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
  "dialog.close": "Close",
  "login.title": "Log in",
  "login.identifier": "Identifier",
  "login.password": "Password",
  "login.submit": "Log in",
  "owner.logout": "Log out",
  "owner.tabs": "Sections",
  "owner.today": "Today",
  "owner.money": "Money",
  "owner.pending": "Pending",
  "owner.confirmed": "Confirmed",
  "owner.requested": "Requested",
  "owner.due": "Due",
  "owner.paid": "Paid",
  "owner.approve": "Approve",
  "owner.reject": "Reject",
  "owner.collectMixed": "Collect mixed",
  "owner.usd": "USD",
  "owner.lbp": "LBP",
  "owner.cancel": "Cancel",
  "owner.bookHeading": "Book an hour",
  "owner.showSlots": "Show hours",
  "owner.book": "Book",
  "owner.waitlist": "Waitlist",
  "owner.notify": "Notify",
  "owner.period": "This period",
  "owner.difference": "Difference",
  "owner.in": "In",
  "owner.out": "Out",
  "owner.from": "From",
  "owner.to": "To",
  "owner.view": "View",
  "owner.displayRate": "Display rate",
  "owner.show": "Show",
  "owner.rate": "Exchange rate",
  "owner.noRate": "No rate set",
  "owner.newRate": "New rate",
  "owner.setRate": "Set rate",
  "owner.expenses": "Expenses",
  "owner.recordExpense": "Record expense",
  "owner.category": "Category",
  "owner.what": "Description",
  "owner.when": "Date",
  "owner.recordExpenseSubmit": "Record expense",
  "empty.pending": "No pending requests.",
  "empty.pendingNext": "When someone requests an hour, it shows here.",
  "empty.confirmed": "No confirmed matches today.",
  "empty.confirmedNext": "Approved hours show here for collection.",
  "empty.pitches": "No pitches yet.",
  "empty.pitchesNext": "Pitches show here when this stadium lists them.",
  "empty.noCreate": "No permission to book.",
  "empty.noCreateNext": "This page is for the owner or anyone given booking access.",
  "empty.waitlist": "No waitlist.",
  "empty.waitlistNext": "Anyone who requested a taken hour shows here after a cancel.",
  "empty.expenses": "No expenses yet.",
  "empty.expensesNextRecord": "Record one above.",
  "empty.expensesNextStaff": "Nothing in this list.",
  "cat.ELECTRICITY": "Electricity",
  "cat.WATER": "Water",
  "cat.MAINTENANCE": "Maintenance",
  "cat.SALARY": "Salary",
  "cat.EQUIPMENT": "Equipment",
  "cat.OTHER": "Other",
  "role.OWNER": "Owner",
  "role.STAFF": "Staff",
  lbpNote: "Set a display rate (or set the exchange rate first)",
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
export function pendingCount(n: number, locale: UiLocale = "ar"): string {
  return `${ui("owner.pending", locale)} · ${n}`;
}

/** Confirmed heading with a Western count. */
export function confirmedCount(n: number, locale: UiLocale = "ar"): string {
  return `${ui("owner.confirmed", locale)} · ${n}`;
}

/** Collect remaining USD — amount is already formatUsd (Latin). */
export function collectUsdLabel(amount: string, locale: UiLocale = "ar"): string {
  return locale === "en" ? `Collect $${amount}` : `تحصيل $${amount}`;
}

/** Confirmed card due line. Amounts are already formatUsd (Latin). */
export function dueRemainingLine(
  due: string,
  remaining: string,
  locale: UiLocale = "ar",
): string {
  return locale === "en"
    ? `Due $${due} · remaining $${remaining}`
    : `المستحق $${due} · المتبقي $${remaining}`;
}

/** Exchange-rate card line. Amount is Latin digits, no currency symbol. */
export function lbpPerUsdLine(amount: string, locale: UiLocale = "ar"): string {
  return locale === "en"
    ? `${amount} LBP per USD`
    : `${amount} ليرة لكل دولار`;
}
