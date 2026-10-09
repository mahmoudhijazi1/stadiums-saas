import type { UiLocale } from "@/lib/locale";
import { displayChange, formatChange } from "@/lib/money-display";
import { plural, type PluralForms } from "@/lib/plural";

/**
 * Arabic chrome (DR-005). Keys, not sentences in JSX. Unknown key → the key
 * (missing copy stays visible). Interpolated money/counts are helpers below.
 * Optional English is a second table for the EN/ع toggle — not next-intl.
 */
const ARABIC: Record<string, string> = {
  "owner.extend": "تمديد 30 دقيقة",
  "owner.extendNewTime": "الوقت الجديد",
  "owner.extendAdded": "السعر المضاف",
  "owner.extendDeclines": "سيُرفض {n} من الطلبات.",
  "owner.extendConfirm": "تأكيد",
  "owner.extendDone": "تم تمديد المباراة.",
  "owner.extendNextGame": "المباراة التالية الساعة {time}",
  "owner.extendClosing": "يغلق الملعب الساعة {time}",
  "owner.extendMax": "الحد الأقصى ٣ ساعات",
  "empty.games": "لا مباريات في هذا اليوم.",
  "empty.gamesNext": "الحجوزات المؤكدة لهذا اليوم تظهر هنا.",
  "push.newRequestTitle": "ملاعب",
  "push.newRequestOne": "طلب حجز جديد",
  "push.newRequestMany": "{n} طلبات بانتظارك",
  "owner.notifications": "الإشعارات",
  "push.working": "لحظة…",
  "push.unsupported": "هذا المتصفح لا يدعم الإشعارات.",
  "push.iosInstall": "أضف التطبيق إلى الشاشة الرئيسية أولاً: اضغط زر المشاركة، ثم «إضافة إلى الشاشة الرئيسية»، وافتحه من هناك.",
  "push.askBody": "فعّل الإشعارات ليصلك تنبيه على هذا الجهاز.",
  "push.enable": "تفعيل الإشعارات",
  "push.enabledStatus": "الإشعارات مفعّلة على هذا الجهاز.",
  "push.test": "إرسال إشعار تجريبي",
  "push.turnOff": "إيقاف",
  "push.deniedBody": "الإشعارات محظورة لهذا التطبيق. لتفعيلها: افتح إعدادات الهاتف، ثم إعدادات التطبيق أو المتصفح، ثم الإشعارات، وفعّلها.",
  "push.testSent": "أُرسل الإشعار. يجب أن يصل خلال لحظات.",
  "push.testNoDevice": "لا يوجد جهاز مفعّل لحسابك.",
  "push.testFailed": "تعذّر الوصول إلى هذا الجهاز. حاول مرة أخرى.",
  "push.turnedOff": "أُوقفت الإشعارات على هذا الجهاز.",
  "push.testTitle": "إشعار تجريبي",
  "push.testBody": "الإشعارات تعمل على هذا الجهاز.",
  "doc.title": "ملاعب",
  "public.day": "اليوم",
  "public.today": "اليوم",
  "public.tomorrow": "غداً",
  "public.otherDate": "تاريخ آخر",
  "public.showHours": "عرض الساعات",
  "public.hours": "الساعات",
  "public.taken": "محجوز",
  "public.until": "حتى",
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
  "theme.label": "المظهر",
  "theme.light": "فاتح",
  "theme.dark": "داكن",
  "theme.system": "نظام",
  "public.errName": "أدخل الاسم.",
  "public.errPhone": "أدخل هاتفاً من 8 إلى 15 رقماً.",
  "public.cancelPolicy": "الإلغاء قبل أقل من {hours} من الموعد: رسوم {percent}% من السعر.",
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
  "owner.requestsTab": "الطلبات",
  "owner.record": "تسجيل",
  "owner.recordBooking": "حجز",
  "owner.expenseAction": "مصروف",
  "owner.search": "بحث",
  "owner.searchPlaceholder": "اسم أو رقم",
  "owner.searchHint": "اكتب اسماً أو رقماً",
  "owner.searchEmpty": "لا أحد بهذا الاسم",
  "owner.searchEmptyNext": "جرّب اسماً آخر أو أرقام الهاتف",
  "owner.personGames": "المباريات",
  "owner.noPersonGames": "لا مباريات بعد",
  "owner.noPersonGamesNext": "مبارياته تظهر هنا",
  "owner.loadMore": "عرض المزيد",
  "owner.totalPaid": "إجمالي المدفوع",
  "owner.gameWord": "المباراة",
  "owner.shareWord": "الحصة",
  "owner.expectedLabel": "متوقع",
  "owner.owedLabel": "مستحق",
  "owner.owesNow": "عليه الآن",
  "owner.call": "اتصال",
  "owner.offline": "بدون اتصال",
  "owner.businessMenu": "قائمة العمل",
  "owner.publicPage": "صفحتي العامة",
  "owner.openPublic": "فتح",
  "owner.copyLink": "نسخ الرابط",
  "owner.copied": "تم النسخ",
  "owner.showQr": "إظهار الرمز",
  "owner.shareWhatsApp": "مشاركة عبر واتساب",
  "owner.account": "الحساب",
  "owner.changePassword": "تغيير كلمة المرور",
  "owner.changeLogin": "تغيير اسم الدخول",
  "owner.loginName": "اسم الدخول (الجزء قبل @)",
  "owner.loginWarning": "من الآن تسجّل الدخول بـ:",
  "owner.saveLogin": "حفظ اسم الدخول",
  "owner.loginChanged": "اسم الدخول الجديد:",
  "owner.currentPassword": "كلمة المرور الحالية",
  "owner.newPassword": "كلمة المرور الجديدة",
  "owner.passwordHint": "12 حرفاً أو أكثر. عبارة من عدة كلمات تكفي.",
  "owner.showPassword": "إظهار",
  "owner.hidePassword": "إخفاء",
  "owner.savePassword": "حفظ كلمة المرور",
  "owner.passwordChanged": "تم تغيير كلمة المرور. تم تسجيل الخروج من الأجهزة الأخرى.",
  "owner.logoutOthers": "تسجيل الخروج من الأجهزة الأخرى",
  "owner.logoutOthersAsk": "سيتم تسجيل الخروج من كل الأجهزة الأخرى. هذا الجهاز يبقى مسجلاً.",
  "owner.logoutOthersConfirm": "تسجيل الخروج الآن",
  "owner.notNow": "ليس الآن",
  "owner.back": "رجوع",
  "owner.groupBusiness": "العمل",
  "owner.groupPreferences": "التفضيلات",
  "owner.bookingRules": "قواعد الحجز",
  "owner.bookingRulesValue": "قبل الموعد",
  "owner.bookingRulesBody": "يمكن إلغاء الحجز قبل بداية الموعد ما دام المبلغ مستحقاً. لا نافذة ساعات محفوظة بعد.",
  "owner.updateRate": "تحديث السعر",
  "owner.justNow": "الآن",
  "owner.rateLastChanged": "آخر تغيير",
  "owner.shareWa": "واتساب",
  "owner.qrTitle": "رمز الحجز",
  "owner.qrAlt": "رمز QR لصفحة الحجز",
  "owner.qrHint": "اطبعه وعلّقه على الحائط أو شاركه في مجموعات واتساب",
  "owner.qrShare": "مشاركة",
  "owner.qrDownload": "تنزيل PNG",
  "owner.qrPrint": "طباعة ملصق",
  "owner.qrScan": "امسح الرمز لحجز موعد",
  "owner.print": "طباعة",
  "owner.qrShort": "رمز",
  "owner.copyShort": "نسخ",
  "owner.appearance": "المظهر",
  "owner.language": "اللغة",
  "owner.identifier": "المعرّف",
  "owner.settings": "إعدادات",
  "owner.pending": "قيد الانتظار",
  "owner.confirmed": "مؤكد",
  "owner.requested": "طُلب",
  "owner.due": "مستحق",
  "owner.dueShort": "مستحق",
  "owner.leftShort": "متبقي",
  "owner.live": "مباشر",
  "owner.minLeft": "د متبقية",
  "owner.collect": "تحصيل",
  "owner.newRequests": "طلبات جديدة",
  "owner.remaining": "المتبقي",
  "owner.paid": "مدفوع",
  "owner.approve": "موافقة",
  "owner.theyPlayed": "لعبوا فعلاً",
  "owner.dismiss": "تجاهل",
  "owner.dismissAll": "تجاهل الكل",
  "owner.hourJustBooked": "تم حجز هذه الساعة للتو",
  "owner.reject": "رفض",
  "owner.rejectSheet": "سبب الرفض",
  "owner.rejectConfirm": "تأكيد الرفض",
  "owner.rejectNote": "اكتب السبب",
  "owner.rejectReason.slotTaken": "الساعة محجوزة",
  "owner.rejectReason.pitchClosed": "الملعب مغلق",
  "owner.rejectReason.other": "سبب آخر",
  "owner.notifyConfirmed": "تم التأكيد",
  "owner.notifySheet": "إبلاغ",
  "owner.collectMixed": "دفع بعملتين",
  "owner.payAnotherWay": "الدفع بطريقة أخرى (ليرة، جزئي)",
  "owner.moreActions": "إجراءات أخرى",
  "owner.callPlayer": "اتصال باللاعب",
  "owner.shopAddShort": "+ إضافة",
  "owner.hideCollectMixed": "إخفاء الدفع بعملتين",
  "owner.usd": "دولار",
  "owner.usdRemaining": "المتبقي بالدولار",
  "owner.modeWhole": "الحجز كامل",
  "owner.modePerPlayer": "لكل لاعب",
  "owner.modeLabel": "طريقة التحصيل",
  "owner.playerCount": "عدد اللاعبين",
  "owner.splitConfirm": "قسّم",
  "owner.payPlayer": "دفع",
  "owner.slotPaid": "دفع",
  "owner.slotCovered": "مغطّى بدفعة سابقة",
  "owner.unassigned": "غير مخصّص",
  "owner.perPlayerLocked": "لا يمكن العودة للحجز الكامل بعد تسجيل دفعات اللاعبين.",
  "owner.lbp": "ليرة",
  "owner.tenderTotal": "المجموع",
  "owner.tenderStillDue": "الباقي لإكمال المبلغ",
  "owner.tenderPaidInFull": "المبلغ مكتمل",
  "owner.tenderOver": "أكثر من المطلوب بـ",
  "owner.tenderFillLbp": "أكمل بـ",
  "owner.tenderBadUsd": "اكتب الدولار مثل 20 أو 20.50",
  "owner.tenderBadLbp": "اكتب الليرة أرقاماً فقط، بلا فواصل",
  "owner.cancel": "إلغاء الحجز",
  "owner.cancelHint": "ستُلغى الساعة وتصبح متاحة مجدداً.",
  "owner.slotFree": "الساعة متاحة.",
  "owner.noOneWaiting": "لا أحد ينتظر هذه الساعة.",
  "owner.freeSlots": "ساعات متاحة فيها مهتمون",
  "owner.waitingSince": "ينتظر منذ",
  "owner.debtLead": "⚠ عليه",
  "unavailable.public.title": "غير متاح مؤقتاً",
  "unavailable.public.body": "هذه الصفحة غير متاحة الآن. حاول مرة أخرى لاحقاً.",
  "unavailable.owner.title": "الحساب موقوف مؤقتاً",
  "unavailable.owner.body": "لا يمكن استخدام هذا الحساب الآن. تواصل مع إدارة المنصة.",
  "owner.requestedNameDiffers": "الاسم يختلف عن المسجّل:",
  "owner.debtReason.LATE_CANCELLATION_FEE": "رسوم إلغاء",
  "owner.debtReason.NO_SHOW_FEE": "رسوم عدم الحضور",
  "owner.debtReason.CANCELLATION_NO_FEE": "إلغاء",
  "owner.debtReason.PARTIAL_GAME": "مباراة ناقصة",
  "owner.debtReason.DISCOUNT": "خصم",
  "owner.debtReason.WAIVER": "إعفاء",
  "owner.debtReason.CORRECTION": "تصحيح",
  "owner.yesterday": "أمس",
  "owner.collectedKeptTail": " ويبقى محفوظاً",
  "owner.notified": "تم الإبلاغ",
  "owner.playerCancelled": "اللاعب ألغى",
  "owner.ownerCancelled": "أنا ألغيت",
  "owner.editFee": "تعديل",
  "owner.waiveFee": "إعفاء",
  "owner.feeWord": "الرسوم",
  "owner.cancelledUnderHour": "ألغى قبل أقل من ساعة",
  "owner.noShowFeeLine": "لم يحضر",
  "owner.adjustDue": "تعديل المبلغ",
  "owner.newDue": "المبلغ الجديد",
  "owner.reasonDiscount": "خصم",
  "owner.reasonPartial": "مباراة ناقصة",
  "owner.reasonWaiver": "إعفاء",
  "owner.reasonCorrection": "تصحيح",
  "owner.noteOptional": "ملاحظة (اختياري)",
  "owner.saveRules": "حفظ",
  "owner.splitSetting": "تقسيم الدفع بين اللاعبين",
  "owner.splitSettingHelp": "يتيح لك تقسيم دفعة المباراة بين اللاعبين.",
  "owner.rulesTrailLead": "إلغاء",
  "owner.cancelWindow": "مهلة الإلغاء (ساعات)",
  "owner.lateFee": "رسوم الإلغاء المتأخر",
  "owner.noShowFeeSetting": "رسوم عدم الحضور",
  "owner.collectedPrefix": "تم تحصيل",
  "owner.noRefundYet": "، لا يمكن الاسترداد بعد.",
  "owner.cancelConfirm": "تأكيد إلغاء الحجز",
  "owner.cancelBack": "تراجع",
  "owner.noShow": "لم يحضر",
  "owner.toCollect": "للتحصيل",
  "owner.seeAll": "عرض الكل",
  "owner.freeStrip": "أوقات متاحة",
  "owner.closedCell": "مغلق",
  "owner.nowLabel": "الآن",
  "owner.availableHours": "ساعات متاحة",
  "owner.gamesHeading": "المباريات",
  "owner.earlierDebtsHeading": "للتحصيل من أيام سابقة",
  "owner.owedFromEarlier": "مستحق من أيام سابقة",
  "owner.moreSlots": "أخرى",
  "owner.allPitches": "الكل",
  "owner.prevDay": "اليوم السابق",
  "owner.afterMidnightToday": "بعد منتصف الليل: اليوم مستمر حتى {time}.",
  "owner.dayStartLabel": "متى يبدأ يوم الشغل عندك؟",
  "owner.dayStartMidnight": "منتصف الليل (12:00 ص)",
  "owner.dayStartNote": "تغيير هذا يغيّر اليوم الذي تظهر تحته المباريات بعد منتصف الليل. لا يغيّر أي مبلغ.",
  "owner.dayStartWarning": "عندك ساعات مفتوحة تمتد بعد هذه الساعة: المباريات بعدها ستظهر في اليوم التالي.",
  "owner.nextDay": "اليوم التالي",
  "owner.monthCalendar": "الشهر",
  "owner.gamesWord": "مباريات",
  "owner.collectedWord": "محصّل",
  "owner.owedWord": "مستحق",
  "owner.expectedWord": "متوقع",
  "owner.noShowCount": "لم يحضر",
  "owner.noShowsCount": "لم يحضر",
  "owner.cancelledShort": "ملغى",
  "owner.bookHeading": "احجز ساعة",
  "owner.showSlots": "عرض الساعات",
  "owner.book": "احجز",
  "owner.waitlist": "قائمة الانتظار",
  "owner.waitlistTab": "انتظار",
  "owner.notify": "إبلاغ",
  "owner.notifyWhatsApp": "إبلاغ عبر واتساب",
  "owner.notifyGroup": "إبلاغ",
  "owner.moneyGroup": "تحصيل",
  "owner.openBooking": "عرض التفاصيل",
  "owner.period": "هذه الفترة",
  "owner.difference": "الفرق",
  "owner.net": "الصافي = الداخل − الخارج",
  "owner.in": "داخل",
  "owner.out": "خارج",
  "owner.from": "من",
  "owner.to": "إلى",
  "owner.view": "العرض",
  "owner.displayRate": "سعر العرض",
  "owner.show": "عرض",
  "owner.changePeriod": "تغيير الفترة",
  "owner.periodTitle": "الفترة",
  "owner.owedToYou": "مستحق لك",
  "owner.owedTitle": "مستحق لك",
  "owner.owedNone": "لا أحد مدين لك.",
  "owner.owedNoneNext": "المبالغ غير المدفوعة من المباريات المنتهية تظهر هنا.",
  "owner.unnamedPlayers": "لاعبون بلا أسماء",
  "owner.unnamedPlayer": "لاعب بلا اسم",
  "owner.remindWhatsApp": "تذكير عبر واتساب",
  "empty.noReports": "لا صلاحية لعرض التقارير.",
  "empty.noReportsNext": "اطلب من المالك أن يمنحك صلاحية التقارير.",
  "owner.activity": "النشاط",
  "owner.activityAll": "الكل",
  "owner.activityEmpty": "لا حركة في هذه الفترة.",
  "owner.activityGame": "مباراة",
  "owner.activityPlayer": "لاعب",
  "owner.activityExpense": "مصروف",
  "owner.activityGeneric": "حركة",
  "owner.shopSales": "المبيعات",
  "owner.shopSupplies": "المستلزمات",
  "owner.shopCaption": "المبيعات تشمل أصنافاً على مباريات غير مدفوعة بعد.",
  "owner.shopItems": "الأصناف المباعة",
  "owner.shopSoldLine": "الأصناف",
  "owner.showMore": "عرض المزيد",
  "owner.expenseAmount": "المبلغ",
  "owner.expenseCategory": "الفئة",
  "owner.expenseDate": "التاريخ",
  "owner.paidWith": "الدفع",
  "owner.periodToday": "اليوم",
  "owner.periodWeek": "هذا الأسبوع",
  "owner.periodMonth": "هذا الشهر",
  "owner.periodLast": "الشهر الماضي",
  "owner.periodCustom": "فترة محددة",
  "owner.vsPrevious": "الفترة السابقة",
  "owner.hidePeriod": "إخفاء الفترة",
  "owner.addExpense": "إضافة مصروف",
  "owner.hideExpenseForm": "إخفاء النموذج",
  "owner.rate": "سعر الصرف",
  "owner.noRate": "لم يُحدد سعر",
  "owner.newRate": "سعر جديد",
  "owner.setRate": "تعيين السعر",
  "owner.timeDisplay": "عرض الوقت",
  "owner.timeDisplayH23": "24 ساعة (16:00)",
  "owner.timeDisplayH12": "12 ساعة (4:00 PM)",
  "owner.setTimeDisplay": "حفظ",
  "owner.pitches": "الملاعب",
  "owner.pitchNew": "ملعب جديد",
  "owner.pitchEdit": "تعديل الملعب",
  "owner.pitchName": "الاسم",
  "owner.pitchOpen": "يفتح",
  "owner.pitchClose": "يغلق",
  "owner.pitchDuration": "مدة المباراة (دقائق)",
  "owner.pitchPlayers": "عدد اللاعبين في المباراة",
  "owner.pitchPrice": "سعر المباراة",
  "owner.pitchPriceRules": "سعر مختلف في بعض الأيام",
  "owner.pitchPriceRuleAdd": "+ إضافة سعر",
  "owner.pitchGameLength": "مدة المباراة (دقائق)",
  "owner.pitchOtherLength": "غير ذلك",
  "owner.pitchMinutesFull": "دقيقة",
  "owner.pitchPriceNeeded": "اكتب سعراً لهذه الأيام.",
  "owner.pitchKeptRules": "أسعار خاصة بساعات محددة (محفوظة كما هي)",
  "owner.pitchPriceRuleConfirmDelete": "نعم، احذف",
  "owner.pitchPreview": "معاينة",
  "owner.saveChanges": "حفظ التعديلات",
  "owner.pitchLeaveConfirm": "عندك تعديلات غير محفوظة. هل تريد المغادرة بدون حفظ؟",
  "owner.pitchPriceRuleRemove": "حذف",
  "owner.pitchPriceRuleAmount": "السعر (دولار)",
  "owner.pitchHours": "ساعات الفتح",
  "owner.pitchHoursHint": "كل يوم في مجموعة واحدة. الأيام غير المختارة مغلقة.",
  "owner.pitchHoursAdd": "إضافة ساعات",
  "owner.pitchHoursRemove": "حذف",
  "owner.pitchClosed": "مغلق",
  "owner.pitchEveryDay": "كل يوم",
  "owner.dayOpen": "مفتوح",
  "owner.dayClosed": "مغلق",
  "owner.fromLabel": "من",
  "owner.toLabel": "إلى",
  "owner.pitchNextDay": "(اليوم التالي)",
  "owner.otherTime": "وقت آخر…",
  "owner.sameHoursEveryDay": "نفس الساعات كل يوم",
  "owner.pitchUntil": "حتى",
  "owner.dayFull.mon": "الإثنين",
  "owner.dayFull.tue": "الثلاثاء",
  "owner.dayFull.wed": "الأربعاء",
  "owner.dayFull.thu": "الخميس",
  "owner.dayFull.fri": "الجمعة",
  "owner.dayFull.sat": "السبت",
  "owner.dayFull.sun": "الأحد",
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
  "cat.SHOP_SUPPLIES": "بضاعة المتجر",
  "owner.shop": "المتجر",
  "owner.shopAdd": "إضافة صنف",
  "owner.shopEdit": "تعديل الصنف",
  "owner.shopEmpty": "لا أصناف بعد. أضف أول صنف.",
  "owner.shopName": "الاسم",
  "owner.shopPrice": "السعر (دولار)",
  "owner.shopPriceNote": "تغيير السعر يؤثر على المبيعات القادمة فقط.",
  "owner.shopSave": "حفظ",
  "owner.shopArchive": "أرشفة الصنف",
  "owner.shopArchiveAsk": "لن يظهر للبيع، وتبقى المبيعات السابقة كما هي.",
  "owner.shopArchiveConfirm": "نعم، أرشف",
  "owner.shopNoAccess": "المتجر للمالك فقط.",
  "owner.shopNoAccessNext": "اطلب من المالك.",
  "owner.sell": "بيع",
  "owner.sellTotal": "المجموع",
  "owner.sellMinus": "إنقاص",
  "owner.rateFirst": "حدّد سعر الصرف أولاً لبيع أصناف بالليرة.",
  "owner.rateFirstLink": "سعر الصرف",
  "owner.paidInFull": "مدفوع بالكامل",
  "owner.changeLabel": "الباقي للزبون",
  "owner.shopCurrency": "العملة",
  "owner.addItems": "إضافة أصناف",
  "owner.itemsOnGame": "على المباراة (الحاجز)",
  "owner.itemsChargeTo": "على حساب مَن؟",
  "owner.itemsSomeoneElse": "+ شخص آخر",
  "owner.itemsNameOrPhone": "الاسم أو الهاتف",
  "owner.itemsPhoneField": "الهاتف",
  "owner.itemsPlusPhone": "+ هاتف",
  "owner.addWord": "إضافة",
  "owner.sellNoItems": "لا أصناف للبيع بعد.",
  "owner.sellFirstItem": "أضف أول صنف",
  "owner.sellFirstItemStaff": "اطلب من المالك إضافة أصناف.",
  "owner.sellNoAccess": "لا صلاحية للبيع.",
  "owner.sellNoAccessNext": "اطلب من المالك أن يمنحك صلاحية البيع.",
  "role.OWNER": "مالك",
  "role.STAFF": "موظف",
  lbpNote: "عيّن سعر عرض (أو عيّن سعر الصرف أولاً)",
};

const ENGLISH: Record<string, string> = {
  "owner.extend": "Extend 30 min",
  "owner.extendNewTime": "New time",
  "owner.extendAdded": "Added price",
  "owner.extendDeclines": "{n} requests will be declined.",
  "owner.extendConfirm": "Confirm",
  "owner.extendDone": "Game extended.",
  "owner.extendNextGame": "Next game at {time}",
  "owner.extendClosing": "Closes at {time}",
  "owner.extendMax": "Max 3 hours",
  "empty.games": "No games on this day.",
  "empty.gamesNext": "Confirmed bookings for this day show here.",
  "push.newRequestTitle": "Lebstads",
  "push.newRequestOne": "New booking request",
  "push.newRequestMany": "{n} requests waiting",
  "owner.notifications": "Notifications",
  "push.working": "One moment…",
  "push.unsupported": "This browser does not support notifications.",
  "push.iosInstall": "Add the app to your Home Screen first: tap Share, then Add to Home Screen, and open it from there.",
  "push.askBody": "Turn on notifications to get an alert on this device.",
  "push.enable": "Enable notifications",
  "push.enabledStatus": "Notifications are on for this device.",
  "push.test": "Send a test notification",
  "push.turnOff": "Turn off",
  "push.deniedBody": "Notifications are blocked for this app. To allow them: open the phone's Settings, then the app's or browser's settings, then Notifications, and turn them on.",
  "push.testSent": "Sent. It should arrive in a moment.",
  "push.testNoDevice": "No device is turned on for your account.",
  "push.testFailed": "Could not reach this device. Try again.",
  "push.turnedOff": "Notifications are off on this device.",
  "push.testTitle": "Test notification",
  "push.testBody": "Notifications work on this device.",
  "doc.title": "Pitches",
  "public.day": "Day",
  "public.today": "Today",
  "public.tomorrow": "Tomorrow",
  "public.otherDate": "Other date",
  "public.showHours": "Show hours",
  "public.hours": "Hours",
  "public.taken": "Taken",
  "public.until": "until",
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
  "theme.label": "Theme",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "theme.system": "System",
  "public.errName": "Enter a name.",
  "public.errPhone": "Enter a phone with 8–15 digits.",
  "public.cancelPolicy": "Cancelling less than {hours} before the game costs {percent}% of the price.",
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
  "owner.requestsTab": "Requests",
  "owner.record": "Record",
  "owner.recordBooking": "Booking",
  "owner.expenseAction": "Expense",
  "owner.search": "Search",
  "owner.searchPlaceholder": "Name or number",
  "owner.searchHint": "Type a name or a number",
  "owner.searchEmpty": "No one matches",
  "owner.searchEmptyNext": "Try another name or the phone digits",
  "owner.personGames": "Games",
  "owner.noPersonGames": "No games yet",
  "owner.noPersonGamesNext": "Their games show here",
  "owner.loadMore": "Load more",
  "owner.totalPaid": "Total paid",
  "owner.gameWord": "Game",
  "owner.shareWord": "Share",
  "owner.expectedLabel": "Expected",
  "owner.owedLabel": "Owed",
  "owner.owesNow": "Owes now",
  "owner.call": "Call",
  "owner.offline": "Offline",
  "owner.businessMenu": "Business menu",
  "owner.publicPage": "My public page",
  "owner.openPublic": "Open",
  "owner.copyLink": "Copy link",
  "owner.copied": "Copied",
  "owner.showQr": "Show QR",
  "owner.shareWhatsApp": "Share on WhatsApp",
  "owner.account": "Account",
  "owner.changePassword": "Change password",
  "owner.changeLogin": "Change login",
  "owner.loginName": "Login name (the part before @)",
  "owner.loginWarning": "From now on you log in with:",
  "owner.saveLogin": "Save login",
  "owner.loginChanged": "Your login is now:",
  "owner.currentPassword": "Current password",
  "owner.newPassword": "New password",
  "owner.passwordHint": "12+ characters; a phrase works.",
  "owner.showPassword": "Show",
  "owner.hidePassword": "Hide",
  "owner.savePassword": "Save password",
  "owner.passwordChanged": "Password changed. Other devices were logged out.",
  "owner.logoutOthers": "Log out other devices",
  "owner.logoutOthersAsk": "Every other device will be logged out. This one stays logged in.",
  "owner.logoutOthersConfirm": "Log out now",
  "owner.notNow": "Not now",
  "owner.back": "Back",
  "owner.groupBusiness": "Business",
  "owner.groupPreferences": "Preferences",
  "owner.bookingRules": "Booking rules",
  "owner.bookingRulesValue": "Before the slot",
  "owner.bookingRulesBody": "A booking can be cancelled before it starts while money is still due. No hours window is stored yet.",
  "owner.updateRate": "Update rate",
  "owner.justNow": "Just now",
  "owner.rateLastChanged": "Last changed",
  "owner.shareWa": "WhatsApp",
  "owner.qrTitle": "Booking QR",
  "owner.qrAlt": "QR code for the booking page",
  "owner.qrHint": "Print it for your wall or share it in WhatsApp groups",
  "owner.qrShare": "Share",
  "owner.qrDownload": "Download PNG",
  "owner.qrPrint": "Print poster",
  "owner.qrScan": "Scan to book",
  "owner.print": "Print",
  "owner.qrShort": "QR",
  "owner.copyShort": "Copy",
  "owner.appearance": "Appearance",
  "owner.language": "Language",
  "owner.identifier": "Identifier",
  "owner.settings": "Settings",
  "owner.pending": "Pending",
  "owner.confirmed": "Confirmed",
  "owner.requested": "Requested",
  "owner.due": "Due",
  "owner.dueShort": "due",
  "owner.leftShort": "left",
  "owner.live": "Live",
  "owner.minLeft": "min left",
  "owner.collect": "Collect",
  "owner.newRequests": "new requests",
  "owner.remaining": "Remaining",
  "owner.paid": "Paid",
  "owner.approve": "Approve",
  "owner.theyPlayed": "They played",
  "owner.dismiss": "Dismiss",
  "owner.dismissAll": "Dismiss all",
  "owner.hourJustBooked": "This hour was just booked",
  "owner.reject": "Reject",
  "owner.rejectSheet": "Reject reason",
  "owner.rejectConfirm": "Confirm reject",
  "owner.rejectNote": "Write the reason",
  "owner.rejectReason.slotTaken": "Slot taken",
  "owner.rejectReason.pitchClosed": "Pitch closed",
  "owner.rejectReason.other": "Other reason",
  "owner.notifyConfirmed": "Confirmed",
  "owner.notifySheet": "Notify",
  "owner.collectMixed": "Pay in two currencies",
  "owner.payAnotherWay": "Pay another way (LBP, partial)",
  "owner.moreActions": "More actions",
  "owner.callPlayer": "Call player",
  "owner.shopAddShort": "+ Add",
  "owner.hideCollectMixed": "Hide two-currency pay",
  "owner.usd": "USD",
  "owner.usdRemaining": "Remaining USD",
  "owner.modeWhole": "Whole game",
  "owner.modePerPlayer": "Per player",
  "owner.modeLabel": "How to collect",
  "owner.playerCount": "Players",
  "owner.splitConfirm": "Split",
  "owner.payPlayer": "Pay",
  "owner.slotPaid": "Paid",
  "owner.slotCovered": "Covered by earlier payment",
  "owner.unassigned": "Unassigned",
  "owner.perPlayerLocked": "Can't go back to whole game once player payments are recorded.",
  "owner.lbp": "LBP",
  "owner.tenderTotal": "Total",
  "owner.tenderStillDue": "Left to complete",
  "owner.tenderPaidInFull": "Covers the full amount",
  "owner.tenderOver": "More than due by",
  "owner.tenderFillLbp": "Complete with",
  "owner.tenderBadUsd": "Type USD like 20 or 20.50",
  "owner.tenderBadLbp": "Type LBP as digits only, no commas",
  "owner.cancel": "Cancel booking",
  "owner.cancelHint": "This hour will be freed and offered again.",
  "owner.slotFree": "The slot is available.",
  "owner.noOneWaiting": "No one is waiting for this slot.",
  "owner.freeSlots": "Available slots with interested players",
  "owner.waitingSince": "Waiting since",
  "owner.debtLead": "⚠ Owes",
  "unavailable.public.title": "Temporarily unavailable",
  "unavailable.public.body": "This page is not available right now. Please try again later.",
  "unavailable.owner.title": "Account temporarily suspended",
  "unavailable.owner.body": "This account can't be used right now. Please contact the platform team.",
  "owner.requestedNameDiffers": "Name differs from the saved one:",
  "owner.debtReason.LATE_CANCELLATION_FEE": "late cancellation",
  "owner.debtReason.NO_SHOW_FEE": "no-show fee",
  "owner.debtReason.CANCELLATION_NO_FEE": "cancellation",
  "owner.debtReason.PARTIAL_GAME": "partial game",
  "owner.debtReason.DISCOUNT": "discount",
  "owner.debtReason.WAIVER": "waiver",
  "owner.debtReason.CORRECTION": "correction",
  "owner.yesterday": "Yesterday",
  "owner.collectedKeptTail": " already collected is kept",
  "owner.notified": "Notified",
  "owner.playerCancelled": "Player cancelled",
  "owner.ownerCancelled": "I cancelled",
  "owner.editFee": "Edit",
  "owner.waiveFee": "Waive",
  "owner.feeWord": "Fee",
  "owner.cancelledUnderHour": "Cancelled less than an hour before",
  "owner.noShowFeeLine": "No-show",
  "owner.adjustDue": "Adjust amount",
  "owner.newDue": "New amount",
  "owner.reasonDiscount": "Discount",
  "owner.reasonPartial": "Partial game",
  "owner.reasonWaiver": "Waive",
  "owner.reasonCorrection": "Correction",
  "owner.noteOptional": "Note (optional)",
  "owner.saveRules": "Save",
  "owner.splitSetting": "Per-player split",
  "owner.splitSettingHelp": "Lets you split a game's payment between players.",
  "owner.rulesTrailLead": "Cancel",
  "owner.cancelWindow": "Cancellation window (hours)",
  "owner.lateFee": "Late cancellation fee",
  "owner.noShowFeeSetting": "No-show fee",
  "owner.collectedPrefix": "Already collected",
  "owner.noRefundYet": ". Refunds are not supported yet.",
  "owner.cancelConfirm": "Confirm cancel booking",
  "owner.cancelBack": "Never mind",
  "owner.noShow": "No-show",
  "owner.toCollect": "To collect",
  "owner.seeAll": "See all",
  "owner.freeStrip": "Free slots",
  "owner.closedCell": "Closed",
  "owner.nowLabel": "Now",
  "owner.availableHours": "Available hours",
  "owner.gamesHeading": "Games",
  "owner.earlierDebtsHeading": "To collect from earlier days",
  "owner.owedFromEarlier": "owed from earlier days",
  "owner.moreSlots": "more",
  "owner.allPitches": "All",
  "owner.prevDay": "Previous day",
  "owner.afterMidnightToday": "After midnight: Today runs until {time}.",
  "owner.dayStartLabel": "When does your business day start?",
  "owner.dayStartMidnight": "Midnight (12:00 AM)",
  "owner.dayStartNote": "Changing this changes which day games after midnight appear under. It changes no amounts.",
  "owner.dayStartWarning": "Some pitch hours run past this hour: games after it will show on the next day.",
  "owner.nextDay": "Next day",
  "owner.monthCalendar": "Month",
  "owner.gamesWord": "games",
  "owner.collectedWord": "collected",
  "owner.owedWord": "owed",
  "owner.expectedWord": "expected",
  "owner.noShowCount": "no-show",
  "owner.noShowsCount": "no-shows",
  "owner.cancelledShort": "Cancelled",
  "owner.bookHeading": "Book an hour",
  "owner.showSlots": "Show hours",
  "owner.book": "Book",
  "owner.waitlist": "Waitlist",
  "owner.waitlistTab": "Waitlist",
  "owner.notify": "Notify",
  "owner.notifyWhatsApp": "Notify on WhatsApp",
  "owner.notifyGroup": "Notify",
  "owner.moneyGroup": "Collect",
  "owner.openBooking": "View details",
  "owner.period": "This period",
  "owner.difference": "Difference",
  "owner.net": "Net = in − out",
  "owner.in": "In",
  "owner.out": "Out",
  "owner.from": "From",
  "owner.to": "To",
  "owner.view": "View",
  "owner.displayRate": "Display rate",
  "owner.show": "Show",
  "owner.changePeriod": "Change period",
  "owner.periodTitle": "Period",
  "owner.owedToYou": "Owed to you",
  "owner.owedTitle": "Owed to you",
  "owner.owedNone": "Nobody owes you anything.",
  "owner.owedNoneNext": "Unpaid money from games that have ended shows here.",
  "owner.unnamedPlayers": "Unnamed players",
  "owner.unnamedPlayer": "Unnamed player",
  "owner.remindWhatsApp": "Remind on WhatsApp",
  "empty.noReports": "You cannot view reports.",
  "empty.noReportsNext": "Ask the owner to give you the reports permission.",
  "owner.activity": "Activity",
  "owner.activityAll": "All",
  "owner.activityEmpty": "Nothing moved in this period.",
  "owner.activityGame": "Game",
  "owner.activityPlayer": "Player",
  "owner.activityExpense": "Expense",
  "owner.activityGeneric": "Payment",
  "owner.shopSales": "Sales",
  "owner.shopSupplies": "Supplies",
  "owner.shopCaption": "Sales include items on games that are not paid yet.",
  "owner.shopItems": "Items sold",
  "owner.shopSoldLine": "Items",
  "owner.showMore": "Show more",
  "owner.expenseAmount": "Amount",
  "owner.expenseCategory": "Category",
  "owner.expenseDate": "Date",
  "owner.paidWith": "Paid with",
  "owner.periodToday": "Today",
  "owner.periodWeek": "This week",
  "owner.periodMonth": "This month",
  "owner.periodLast": "Last month",
  "owner.periodCustom": "Custom",
  "owner.vsPrevious": "the previous period",
  "owner.hidePeriod": "Hide period",
  "owner.addExpense": "Add expense",
  "owner.hideExpenseForm": "Hide form",
  "owner.rate": "Exchange rate",
  "owner.noRate": "No rate set",
  "owner.newRate": "New rate",
  "owner.setRate": "Set rate",
  "owner.timeDisplay": "Time format",
  "owner.timeDisplayH23": "24-hour (16:00)",
  "owner.timeDisplayH12": "12-hour (4:00 PM)",
  "owner.setTimeDisplay": "Save",
  "owner.pitches": "Pitches",
  "owner.pitchNew": "New pitch",
  "owner.pitchEdit": "Edit pitch",
  "owner.pitchName": "Name",
  "owner.pitchOpen": "Opens",
  "owner.pitchClose": "Closes",
  "owner.pitchDuration": "Game length (minutes)",
  "owner.pitchPlayers": "Players per game",
  "owner.pitchPrice": "Price per game",
  "owner.pitchPriceRules": "Different price on some days",
  "owner.pitchPriceRuleAdd": "+ Add a price",
  "owner.pitchGameLength": "Game length (minutes)",
  "owner.pitchOtherLength": "Other",
  "owner.pitchMinutesFull": "minutes",
  "owner.pitchPriceNeeded": "Enter a price for these days.",
  "owner.pitchKeptRules": "Special prices for set hours (kept as they are)",
  "owner.pitchPriceRuleConfirmDelete": "Yes, delete",
  "owner.pitchPreview": "Preview",
  "owner.saveChanges": "Save changes",
  "owner.pitchLeaveConfirm": "You have unsaved changes. Leave without saving?",
  "owner.pitchPriceRuleRemove": "Remove",
  "owner.pitchPriceRuleAmount": "Price (USD)",
  "owner.pitchHours": "Opening hours",
  "owner.pitchHoursHint": "Each day belongs to one group. Unchecked days are closed.",
  "owner.pitchHoursAdd": "Add hours",
  "owner.pitchHoursRemove": "Remove",
  "owner.pitchClosed": "closed",
  "owner.pitchEveryDay": "Every day",
  "owner.dayOpen": "Open",
  "owner.dayClosed": "Closed",
  "owner.fromLabel": "From",
  "owner.toLabel": "To",
  "owner.pitchNextDay": "(next day)",
  "owner.otherTime": "Other time…",
  "owner.sameHoursEveryDay": "Same hours every day",
  "owner.pitchUntil": "until",
  "owner.dayFull.mon": "Monday",
  "owner.dayFull.tue": "Tuesday",
  "owner.dayFull.wed": "Wednesday",
  "owner.dayFull.thu": "Thursday",
  "owner.dayFull.fri": "Friday",
  "owner.dayFull.sat": "Saturday",
  "owner.dayFull.sun": "Sunday",
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
  "cat.SHOP_SUPPLIES": "Shop supplies",
  "owner.shop": "Shop",
  "owner.shopAdd": "Add item",
  "owner.shopEdit": "Edit item",
  "owner.shopEmpty": "No items yet. Add your first item.",
  "owner.shopName": "Name",
  "owner.shopPrice": "Price (USD)",
  "owner.shopPriceNote": "A new price applies to future sales only.",
  "owner.shopSave": "Save",
  "owner.shopArchive": "Archive item",
  "owner.shopArchiveAsk": "It stops showing for sale. Past sales keep it.",
  "owner.shopArchiveConfirm": "Yes, archive",
  "owner.shopNoAccess": "The shop catalog is for the owner.",
  "owner.shopNoAccessNext": "Ask the owner.",
  "owner.sell": "Sell",
  "owner.sellTotal": "Total",
  "owner.sellMinus": "Remove one",
  "owner.rateFirst": "Set the exchange rate first to sell items priced in LBP.",
  "owner.rateFirstLink": "Exchange rate",
  "owner.paidInFull": "Paid in full",
  "owner.changeLabel": "Change",
  "owner.shopCurrency": "Currency",
  "owner.addItems": "Add items",
  "owner.itemsOnGame": "On the game (booker)",
  "owner.itemsChargeTo": "Charge to",
  "owner.itemsSomeoneElse": "+ Someone else",
  "owner.itemsNameOrPhone": "Name or phone",
  "owner.itemsPhoneField": "Phone",
  "owner.itemsPlusPhone": "+ phone",
  "owner.addWord": "Add",
  "owner.sellNoItems": "No items to sell yet.",
  "owner.sellFirstItem": "Add your first item",
  "owner.sellFirstItemStaff": "Ask the owner to add items.",
  "owner.sellNoAccess": "You cannot sell.",
  "owner.sellNoAccessNext": "Ask the owner to give you the sell permission.",
  "role.OWNER": "Owner",
  "role.STAFF": "Staff",
  lbpNote: "Set a display rate (or set the exchange rate first)",
};

/** Chrome for a key. Default Arabic. Missing English key falls back to Arabic. */
export function ui(key: string, locale: UiLocale = "ar"): string {
  if (locale === "en") return ENGLISH[key] ?? ARABIC[key] ?? key;
  return ARABIC[key] ?? key;
}

const REJECT_REASON_NOTE_MAX = 80;

/**
 * Chip label, or the free-text note for "other". Empty or too long → null.
 * The note is not stored; it only fills the WhatsApp {reason}.
 */
export function rejectReasonText(
  kind: string,
  note: string,
  locale: UiLocale = "ar",
): string | null {
  if (kind === "slot_taken") return ui("owner.rejectReason.slotTaken", locale);
  if (kind === "pitch_closed") return ui("owner.rejectReason.pitchClosed", locale);
  if (kind !== "other") return null;
  const text = note.trim().replace(/\s+/g, " ");
  if (!text || text.length > REJECT_REASON_NOTE_MAX) return null;
  return text;
}

/**
 * Counted nouns. `{n}` is the number. Arabic has every PluralRules category.
 * English has `one` and `other`; `zero` is optional for a count of 0.
 */
const COUNTED: Record<string, Record<UiLocale, PluralForms>> = {
  "owner.games": {
    ar: {
      zero: "لا مباريات",
      one: "مباراة واحدة",
      two: "مباراتان",
      few: "{n} مباريات",
      many: "{n} مباراة",
      other: "{n} مباراة",
    },
    en: {
      zero: "No games",
      one: "{n} game",
      other: "{n} games",
    },
  },
  "owner.toCollectGames": {
    ar: {
      one: "مباراة واحدة للتحصيل",
      two: "مباراتان للتحصيل",
      few: "{n} مباريات للتحصيل",
      many: "{n} مباراة للتحصيل",
      other: "{n} مباراة للتحصيل",
    },
    en: {
      one: "{n} game to collect",
      other: "{n} games to collect",
    },
  },
  "owner.gamesPlayed": {
    ar: {
      zero: "لا مباريات لُعبت",
      one: "مباراة واحدة لُعبت",
      two: "مباراتان لُعبتا",
      few: "{n} مباريات لُعبت",
      many: "{n} مباراة لُعبت",
      other: "{n} مباراة لُعبت",
    },
    en: {
      zero: "No games played",
      one: "{n} game played",
      other: "{n} games played",
    },
  },
  "owner.gamesUpcoming": {
    ar: {
      one: "مباراة واحدة قادمة",
      two: "مباراتان قادمتان",
      few: "{n} مباريات قادمة",
      many: "{n} مباراة قادمة",
      other: "{n} مباراة قادمة",
    },
    en: {
      one: "{n} upcoming",
      other: "{n} upcoming",
    },
  },
  "owner.freeCount": {
    ar: {
      one: "{n} متاح",
      two: "{n} متاحان",
      few: "{n} متاحة",
      many: "{n} متاحة",
      other: "{n} متاحة",
    },
    en: {
      one: "{n} free",
      other: "{n} free",
    },
  },
  "owner.interested": {
    ar: {
      zero: "لا مهتمين",
      one: "مهتم واحد",
      two: "مهتمان",
      few: "{n} مهتمين",
      many: "{n} مهتماً",
      other: "{n} مهتم",
    },
    en: {
      one: "{n} person interested",
      other: "{n} people interested",
    },
  },
  "owner.hoursBefore": {
    ar: {
      one: "ألغى قبل ساعة",
      two: "ألغى قبل ساعتين",
      few: "ألغى قبل {n} ساعات",
      many: "ألغى قبل {n} ساعة",
      other: "ألغى قبل {n} ساعة",
    },
    en: {
      one: "Cancelled {n} hour before",
      other: "Cancelled {n} hours before",
    },
  },
  "owner.ruleHours": {
    ar: {
      one: "ساعة",
      two: "ساعتين",
      few: "{n} ساعات",
      many: "{n} ساعة",
      other: "{n} ساعة",
    },
    en: {
      one: "{n} hour",
      other: "{n} hours",
    },
  },
  "owner.requests": {
    ar: {
      zero: "لا طلبات",
      one: "طلب واحد",
      two: "طلبان",
      few: "{n} طلبات",
      many: "{n} طلباً",
      other: "{n} طلب",
    },
    en: {
      zero: "No requests",
      one: "{n} request",
      other: "{n} requests",
    },
  },
  "owner.spanMinutes": {
    ar: {
      one: "دقيقة",
      two: "دقيقتين",
      few: "{n} دقائق",
      many: "{n} دقيقة",
      other: "{n} دقيقة",
    },
    en: {
      one: "{n} minute",
      other: "{n} minutes",
    },
  },
  "owner.agoMinutes": {
    ar: {
      one: "قبل دقيقة",
      two: "قبل دقيقتين",
      few: "قبل {n} دقائق",
      many: "قبل {n} دقيقة",
      other: "قبل {n} دقيقة",
    },
    en: {
      one: "{n} minute ago",
      other: "{n} minutes ago",
    },
  },
  "owner.agoHours": {
    ar: {
      one: "قبل ساعة",
      two: "قبل ساعتين",
      few: "قبل {n} ساعات",
      many: "قبل {n} ساعة",
      other: "قبل {n} ساعة",
    },
    en: {
      one: "{n} hour ago",
      other: "{n} hours ago",
    },
  },
  "owner.agoDays": {
    ar: {
      two: "قبل يومين",
      few: "قبل {n} أيام",
      many: "قبل {n} يوماً",
      other: "قبل {n} يوم",
    },
    en: {
      other: "{n} days ago",
    },
  },
  "owner.noShows": {
    ar: {
      zero: "لا غيابات",
      one: "غياب واحد",
      two: "غيابان",
      few: "{n} غيابات",
      many: "{n} غياب",
      other: "{n} غياب",
    },
    en: {
      one: "{n} no-show",
      other: "{n} no-shows",
    },
  },
};

export function countedForms(key: string, locale: UiLocale): PluralForms | undefined {
  return COUNTED[key]?.[locale];
}

/** Counted noun for `locale`. Missing English forms fall back to Arabic rules. */
export function uiCount(key: string, count: number, locale: UiLocale = "ar"): string {
  const forms = COUNTED[key]?.[locale] ?? COUNTED[key]?.ar;
  if (!forms) return String(count);
  const rulesLocale = COUNTED[key]?.[locale] ? locale : "ar";
  return plural(rulesLocale, count, forms);
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

/** Requests heading. Digits stay inside the phrase so the caller can isolate them. */
export function requestsCount(n: number, locale: UiLocale = "ar"): string {
  return uiCount("owner.requests", n, locale);
}

/** Collapsed missed-request heading. Digits stay in the phrase. */
export function missedRequestsCount(n: number, locale: UiLocale = "ar"): string {
  return locale === "en" ? `Missed requests (${n})` : `طلبات فائتة (${n})`;
}

/** Amber line for a future request starting within 2 hours. */
export function startsInLabel(minutes: number, locale: UiLocale = "ar"): string {
  const span = uiCount("owner.spanMinutes", minutes, locale);
  return locale === "en" ? `Starts in ${span}` : `يبدأ بعد ${span}`;
}

/**
 * Public late-cancel line. Empty when the percent is 0.
 * `{hours}` is the plural hour phrase ("24 ساعة").
 */
export function cancelPolicyLine(
  hours: number,
  percent: number,
  locale: UiLocale = "ar",
): string {
  if (percent <= 0) return "";
  return ui("public.cancelPolicy", locale)
    .replace("{hours}", uiCount("owner.ruleHours", hours, locale))
    .replace("{percent}", String(percent));
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

/** Slot name before anyone is named. */
export function playerLabel(slotNumber: number, locale: UiLocale = "ar"): string {
  return locale === "en" ? `Player ${slotNumber}` : `لاعب ${slotNumber}`;
}

/** Per-player progress on the booking sheet. Counts are plain numbers. */
export function paidOfLine(
  paid: number,
  total: number,
  locale: UiLocale = "ar",
): string {
  return locale === "en"
    ? `${paid} of ${total} paid`
    : `${paid} من ${total} دفعوا`;
}

/** Booker pays every unpaid slot. Amount is already formatUsd (Latin). */
/** Night hint beside a real date for a 00:00–05:59 start. `weekday` is already localized. */
export function nightOfLabel(weekday: string, locale: UiLocale = "ar"): string {
  return locale === "en" ? `night of ${weekday}` : `ليلة ${weekday}`;
}

/** The day-start hour as a clock label: "6:00 ص" / "6:00 AM"; 0 is "12:00". */
export function dayStartClock(hour: number, locale: UiLocale = "ar"): string {
  return `${hour === 0 ? 12 : hour}:00 ${locale === "en" ? "AM" : "ص"}`;
}

/** Toast after "log out other devices": how many were closed. */
export function devicesClosedLabel(count: number, locale: UiLocale = "ar"): string {
  if (locale === "en") {
    return count === 0
      ? "No other devices were logged in."
      : `Logged out of ${count} other ${count === 1 ? "device" : "devices"}.`;
  }
  return count === 0 ? "لا توجد أجهزة أخرى مسجّلة." : `تم تسجيل الخروج من ${count} جهاز.`;
}

/** Preview line: "5 games · $20 each" or "5 games · $20–$30". Prices are already "20.00". */
export function previewSummaryLabel(
  games: number,
  min: string,
  max: string,
  locale: UiLocale = "ar",
): string {
  const price = (value: string) => (value.endsWith(".00") ? value.slice(0, -3) : value);
  const range = min === max ? price(min) : `${price(min)}–$${price(max)}`;
  if (locale === "en") {
    return `${games} ${games === 1 ? "game" : "games"} · $${range}${min === max ? " each" : ""}`;
  }
  return `${games} ${games === 1 ? "مباراة" : "مباريات"} · $${range}${min === max ? " للمباراة" : ""}`;
}

/** Muted note when the end of the opening hours cannot fit another game. */
export function unusedTimeLabel(minutes: number, locale: UiLocale = "ar"): string {
  return locale === "en"
    ? `The last ${minutes} min of the opening hours are too short for a game.`
    : `آخر ${minutes} دقيقة من ساعات الفتح لا تكفي لمباراة.`;
}

export function gameLongerLabel(minutes: number, locale: UiLocale = "ar"): string {
  return locale === "en"
    ? `A game of ${minutes} min does not fit in these hours.`
    : `مباراة من ${minutes} دقيقة لا تتسع لهذه الساعات.`;
}

/** The Money headline label: "Profit in October", "Loss this week", "Profit, 12 Oct – 18 Oct". */
export function profitHeadline(
  kind: "today" | "week" | "month" | "last" | "custom",
  name: string,
  loss: boolean,
  locale: UiLocale = "ar",
): string {
  if (locale === "en") {
    const word = loss ? "Loss" : "Profit";
    if (kind === "today") return `${word} today`;
    if (kind === "week") return `${word} this week`;
    if (kind === "custom") return `${word}, ${name}`;
    return `${word} in ${name}`;
  }
  const word = loss ? "الخسارة" : "الربح";
  if (kind === "today") return `${word} اليوم`;
  if (kind === "week") return `${word} هذا الأسبوع`;
  if (kind === "custom") return `${word}، ${name}`;
  return `${word} في ${name}`;
}

/** "↑ $5 vs September" / "Same as September". Amounts are already formatted. */
export function comparisonLine(
  direction: "up" | "down" | "same",
  amount: string,
  against: string,
  locale: UiLocale = "ar",
): string {
  if (direction === "same") return locale === "en" ? `Same as ${against}` : `مثل ${against}`;
  const arrow = direction === "up" ? "↑" : "↓";
  return locale === "en" ? `${arrow} ${amount} vs ${against}` : `${arrow} ${amount} مقارنة بـ${against}`;
}

/** The Activity row of a sale: "Shop · 3 items". */
export function shopActivityLabel(items: number, locale: UiLocale = "ar"): string {
  if (items <= 0) return locale === "en" ? "Shop" : "المتجر";
  if (locale === "en") return `Shop · ${items} ${items === 1 ? "item" : "items"}`;
  const word = items === 1 ? "صنف" : items === 2 ? "صنفان" : items <= 10 ? "أصناف" : "صنفاً";
  return items === 2 ? `المتجر · صنفان` : `المتجر · ${items} ${word}`;
}

/**
 * "Change: 40,000 ل.ل" / "الباقي للزبون: 40,000 ل.ل": what to hand back, in the currency it was
 * handed over in, with cents of dollars shown as pounds at the current rate (`displayChange`).
 * Empty when there is none.
 */
export function changeDescription(
  change: { lbp: string; usd: string },
  locale: UiLocale = "ar",
  rate: string | null = null,
): string | undefined {
  const text = formatChange(displayChange(change, rate), locale);
  return text === "0" ? undefined : `${ui("owner.changeLabel", locale)}: ${text}`;
}

/** The last suggestion of the payer search: add the typed text as a new person. */
export function addNewLabel(text: string, locale: UiLocale = "ar"): string {
  return locale === "en" ? `Add "${text}" as new` : `إضافة "${text}" كجديد`;
}

/** The toast after items are put on a game: "Added 3 items · $12". `total` is already formatted. */
export function itemsAddedToast(items: number, total: string, locale: UiLocale = "ar"): string {
  if (locale === "en") return `Added ${items} ${items === 1 ? "item" : "items"} · ${total}`;
  const word = items === 1 ? "صنف" : items === 2 ? "صنفان" : items <= 10 ? "أصناف" : "صنفاً";
  return items === 2 ? `أُضيف صنفان · ${total}` : `أُضيف ${items} ${word} · ${total}`;
}

/** The toast after a walk-in sale: "Sold 3 items · $12". `total` is already formatted. */
export function soldToast(items: number, total: string, locale: UiLocale = "ar"): string {
  if (locale === "en") return `Sold ${items} ${items === 1 ? "item" : "items"} · ${total}`;
  const word = items === 1 ? "صنف" : items === 2 ? "صنفان" : items <= 10 ? "أصناف" : "صنفاً";
  return items === 2 ? `بيع صنفان · ${total}` : `بيع ${items} ${word} · ${total}`;
}

export function bookerPaysAllLabel(amount: string, locale: UiLocale = "ar"): string {
  return locale === "en"
    ? `Booker pays all remaining $${amount}`
    : `الحاجز يدفع كل المتبقي $${amount}`;
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

/** Western thousands separator for a whole-number digit string. */
export function groupedDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

