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
  "owner.home": "رئيسية",
  "owner.homeHeading": "الرئيسية",
  "owner.today": "اليوم",
  "owner.requests": "طلبات",
  "owner.upcoming": "القادم",
  "owner.upcomingTag": "قادم",
  "owner.overdue": "متأخر",
  "owner.showComingDays": "عرض الأيام القادمة",
  "owner.hideComingDays": "إخفاء الأيام القادمة",
  "owner.money": "المال",
  "owner.reports": "تقارير",
  "owner.more": "المزيد",
  "owner.settings": "إعدادات",
  "owner.pending": "قيد الانتظار",
  "owner.confirmed": "مؤكد",
  "owner.requested": "طُلب",
  "owner.due": "مستحق",
  "owner.remaining": "المتبقي",
  "owner.paid": "مدفوع",
  "owner.approve": "موافقة",
  "owner.reject": "رفض",
  "owner.collectMixed": "دفع بعملتين",
  "owner.usd": "دولار",
  "owner.lbp": "ليرة",
  "owner.cancel": "إلغاء",
  "owner.noShow": "لم يحضر",
  "owner.bookHeading": "احجز ساعة",
  "owner.showSlots": "عرض الساعات",
  "owner.book": "احجز",
  "owner.waitlist": "قائمة الانتظار",
  "owner.waitlistTab": "انتظار",
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
  "owner.changePeriod": "تغيير الفترة",
  "owner.hidePeriod": "إخفاء الفترة",
  "owner.addExpense": "إضافة مصروف",
  "owner.hideExpenseForm": "إخفاء النموذج",
  "owner.rate": "سعر الصرف",
  "owner.noRate": "لم يُحدد سعر",
  "owner.newRate": "سعر جديد",
  "owner.setRate": "تعيين السعر",
  "owner.pitches": "الملاعب",
  "owner.pitchNew": "ملعب جديد",
  "owner.pitchEdit": "تعديل الملعب",
  "owner.pitchName": "الاسم",
  "owner.pitchOpen": "يفتح",
  "owner.pitchClose": "يغلق",
  "owner.pitchDuration": "مدة المباراة (دقائق)",
  "owner.pitchPrice": "السعر الافتراضي (دولار)",
  "owner.pitchPriceRules": "سعر حسب اليوم",
  "owner.pitchPriceRuleHint": "الصف الأخير يغلب إذا تداخلت الأيام.",
  "owner.pitchPriceRuleAdd": "إضافة سعر",
  "owner.pitchPriceRuleRemove": "حذف",
  "owner.pitchPriceRuleAmount": "السعر (دولار)",
  "owner.pitchHours": "ساعات الفتح",
  "owner.pitchHoursHint": "كل يوم في مجموعة واحدة. الأيام غير المختارة مغلقة.",
  "owner.pitchHoursAdd": "إضافة ساعات",
  "owner.pitchHoursRemove": "حذف",
  "owner.pitchClosed": "مغلق",
  "owner.pitchAllClosed": "مغلق كل الأيام.",
  "owner.wd.mon": "إثنين",
  "owner.wd.tue": "ثلاثاء",
  "owner.wd.wed": "أربعاء",
  "owner.wd.thu": "خميس",
  "owner.wd.fri": "جمعة",
  "owner.wd.sat": "سبت",
  "owner.wd.sun": "أحد",
  "owner.pitchSave": "حفظ الملعب",
  "owner.pitchCreate": "إضافة الملعب",
  "owner.pitchBack": "الإعدادات",
  "owner.pitchMinutes": "دق",
  "owner.pitchConfirmPending": "نعم، احفظ واترك الطلبات المعلّقة",
  "owner.expenses": "المصاريف",
  "owner.recordExpense": "تسجيل مصروف",
  "owner.category": "الفئة",
  "owner.what": "البيان",
  "owner.when": "التاريخ",
  "owner.recordExpenseSubmit": "تسجيل المصروف",
  "empty.pending": "لا طلبات معلّقة.",
  "empty.pendingNext": "عندما يطلب أحدهم ساعة، تظهر هنا.",
  "empty.confirmed": "لا مباريات مؤكدة اليوم.",
  "empty.confirmedNext": "الساعات الموافق عليها تظهر هنا.",
  "empty.pitches": "لا ملاعب بعد.",
  "empty.pitchesNext": "تظهر الملاعب هنا عندما يُدرجها هذا الملعب.",
  "empty.noCreate": "لا صلاحية للحجز.",
  "empty.noCreateNext": "هذه الصفحة للمالك أو لمن أُعطي صلاحية الحجز.",
  "empty.waitlist": "لا قائمة انتظار.",
  "empty.waitlistNext": "من طلب ساعة محجوزة يظهر هنا بعد الإلغاء.",
  "empty.expenses": "لا مصاريف بعد.",
  "empty.expensesNextRecord": "أضف مصروفاً بالزر أعلاه.",
  "empty.expensesNextStaff": "لا شيء في هذه القائمة.",
  "empty.noPitchEdit": "لا صلاحية لتعديل الملاعب.",
  "empty.noPitchEditNext": "هذه الصفحة للمالك.",
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
  "owner.home": "Home",
  "owner.homeHeading": "Home",
  "owner.today": "Today",
  "owner.requests": "Requests",
  "owner.upcoming": "Upcoming",
  "owner.upcomingTag": "Upcoming",
  "owner.overdue": "Overdue",
  "owner.showComingDays": "Show coming days",
  "owner.hideComingDays": "Hide coming days",
  "owner.money": "Money",
  "owner.reports": "Reports",
  "owner.more": "More",
  "owner.settings": "Settings",
  "owner.pending": "Pending",
  "owner.confirmed": "Confirmed",
  "owner.requested": "Requested",
  "owner.due": "Due",
  "owner.remaining": "Remaining",
  "owner.paid": "Paid",
  "owner.approve": "Approve",
  "owner.reject": "Reject",
  "owner.collectMixed": "Pay in two currencies",
  "owner.usd": "USD",
  "owner.lbp": "LBP",
  "owner.cancel": "Cancel",
  "owner.noShow": "No-show",
  "owner.bookHeading": "Book an hour",
  "owner.showSlots": "Show hours",
  "owner.book": "Book",
  "owner.waitlist": "Waitlist",
  "owner.waitlistTab": "Waitlist",
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
  "owner.changePeriod": "Change period",
  "owner.hidePeriod": "Hide period",
  "owner.addExpense": "Add expense",
  "owner.hideExpenseForm": "Hide form",
  "owner.rate": "Exchange rate",
  "owner.noRate": "No rate set",
  "owner.newRate": "New rate",
  "owner.setRate": "Set rate",
  "owner.pitches": "Pitches",
  "owner.pitchNew": "New pitch",
  "owner.pitchEdit": "Edit pitch",
  "owner.pitchName": "Name",
  "owner.pitchOpen": "Opens",
  "owner.pitchClose": "Closes",
  "owner.pitchDuration": "Game length (minutes)",
  "owner.pitchPrice": "Default price (USD)",
  "owner.pitchPriceRules": "Day prices",
  "owner.pitchPriceRuleHint": "The last row wins when days overlap.",
  "owner.pitchPriceRuleAdd": "Add price",
  "owner.pitchPriceRuleRemove": "Remove",
  "owner.pitchPriceRuleAmount": "Price (USD)",
  "owner.pitchHours": "Opening hours",
  "owner.pitchHoursHint": "Each day belongs to one group. Unchecked days are closed.",
  "owner.pitchHoursAdd": "Add hours",
  "owner.pitchHoursRemove": "Remove",
  "owner.pitchClosed": "closed",
  "owner.pitchAllClosed": "Closed every day.",
  "owner.wd.mon": "Mon",
  "owner.wd.tue": "Tue",
  "owner.wd.wed": "Wed",
  "owner.wd.thu": "Thu",
  "owner.wd.fri": "Fri",
  "owner.wd.sat": "Sat",
  "owner.wd.sun": "Sun",
  "owner.pitchSave": "Save pitch",
  "owner.pitchCreate": "Add pitch",
  "owner.pitchBack": "Settings",
  "owner.pitchMinutes": "min",
  "owner.pitchConfirmPending": "Yes, save and leave pending requests as they are",
  "owner.expenses": "Expenses",
  "owner.recordExpense": "Record expense",
  "owner.category": "Category",
  "owner.what": "Description",
  "owner.when": "Date",
  "owner.recordExpenseSubmit": "Record expense",
  "empty.pending": "No pending requests.",
  "empty.pendingNext": "When someone requests an hour, it shows here.",
  "empty.confirmed": "No confirmed matches today.",
  "empty.confirmedNext": "Approved hours show here.",
  "empty.pitches": "No pitches yet.",
  "empty.pitchesNext": "Pitches show here when this stadium lists them.",
  "empty.noCreate": "No permission to book.",
  "empty.noCreateNext": "This page is for the owner or anyone given booking access.",
  "empty.waitlist": "No waitlist.",
  "empty.waitlistNext": "Anyone who requested a taken hour shows here after a cancel.",
  "empty.expenses": "No expenses yet.",
  "empty.expensesNextRecord": "Add an expense with the button above.",
  "empty.expensesNextStaff": "Nothing in this list.",
  "empty.noPitchEdit": "No permission to edit pitches.",
  "empty.noPitchEditNext": "This page is for the owner.",
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

/** Home Requests heading with a Western count. */
export function requestsCount(n: number, locale: UiLocale = "ar"): string {
  return `${ui("owner.requests", locale)} · ${n}`;
}

/** Confirmed heading with a Western count. */
export function confirmedCount(n: number, locale: UiLocale = "ar"): string {
  return `${ui("owner.confirmed", locale)} · ${n}`;
}

/** Overdue heading with a Western count. */
export function overdueCount(n: number, locale: UiLocale = "ar"): string {
  return `${ui("owner.overdue", locale)} · ${n}`;
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
