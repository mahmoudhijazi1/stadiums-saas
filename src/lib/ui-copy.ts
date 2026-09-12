/**
 * Arabic chrome (DR-005). Keys, not sentences in JSX. Unknown key → the key
 * (missing copy stays visible). Interpolated money/counts are helpers below.
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

/** Chrome Arabic for a key. Missing key returns itself. */
export function ui(key: string): string {
  return ARABIC[key] ?? key;
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
