import type { CopyArea } from "./types";

/** The owner Help page (More, Help): groups, topics, and the support line. */
export const help: CopyArea = {
  ar: {
    "owner.help": "المساعدة",
    "help.intro": "كل ما يقدّمه التطبيق، حسب الموضوع. اضغط على موضوع لفتحه.",
    "help.where": "أين:",
    "help.goodToKnow": "معلومة مفيدة:",
    "help.stuck": "هل تحتاج مساعدة؟ راسلنا على واتساب",
    "help.whatsappMessage": "مرحباً، أحتاج مساعدة في تطبيق {name}.",

    "help.group.bookings": "الحجوزات والطلبات",
    "help.group.today": "اليوم",
    "help.group.weekly": "الحجوزات الثابتة",
    "help.group.collect": "تحصيل المال",
    "help.group.shop": "المتجر وحسابات اللاعبين",
    "help.group.money": "صفحة المال والمصاريف",
    "help.group.players": "اللاعبون",
    "help.group.stadium": "ملعبك",
    "help.group.phone": "التطبيق على هاتفك",
    "help.group.account": "حسابك",

    "help.approve.title": "قبول طلب أو رفضه",
    "help.approve.what": "طلبات الحجز من صفحتك العامة تنتظر في الطلبات حتى تقبلها أو ترفضها.",
    "help.approve.where": "الطلبات",
    "help.approve.tip": "قبول طلب يرفض الطلبات الأخرى على الساعة نفسها، ويحفظ أصحابها كمهتمين.",

    "help.missed.title": "طلبات فات وقتها",
    "help.missed.what": "الطلب الذي بدأت ساعته ينتقل إلى قائمة الطلبات الفائتة. اضغط «لعبوا فعلاً» إذا جرت المباراة، أو «تجاهل الكل».",
    "help.missed.where": "الطلبات",

    "help.interested.title": "اللاعبون المهتمون",
    "help.interested.what": "عند إلغاء مباراة، يظهر من طلبوا تلك الساعة تحت «ساعات متاحة فيها مهتمون» لتبلغهم.",
    "help.interested.where": "الطلبات",

    "help.publicRequests.title": "الطلبات من صفحتك العامة",
    "help.publicRequests.what": "يختار اللاعب ساعة متاحة في صفحتك العامة ويرسل اسمه ورقمه، فيصلك طلب.",
    "help.publicRequests.where": "المزيد، صفحتي العامة",
    "help.publicRequests.tip": "للرقم الواحد 3 طلبات منتظرة كحد أقصى في ملعبك، وحتى 60 يوماً إلى الأمام.",

    "help.book.title": "احجز ساعة بنفسك",
    "help.book.what": "احجز ساعة متاحة للاعب اتصل بك أو جاء إلى الملعب.",
    "help.book.where": "احجز ساعة",
    "help.book.tip": "لا يمكن حجز ساعة مؤكدة مرتين، والطلبات المنتظرة على تلك الساعة تُرفض.",

    "help.todayScreen.title": "شاشة اليوم",
    "help.todayScreen.what": "تعرض مباريات اليوم المؤكدة، والساعات المتاحة، والمال المستحق من أيام سابقة.",
    "help.todayScreen.where": "اليوم",

    "help.cancel.title": "إلغاء مباراة أو تسجيل عدم الحضور",
    "help.cancel.what": "ألغِ حجزاً مؤكداً، أو سجّل أن اللاعبين لم يحضروا.",
    "help.cancel.where": "اليوم",
    "help.cancel.step1": "افتح المباراة واضغط «إجراءات أخرى».",
    "help.cancel.step2": "اختر «إلغاء الحجز»، أو «لم يحضر».",
    "help.cancel.tip": "الساعة الملغاة تصبح متاحة وتُعرض من جديد.",

    "help.extend.title": "تمديد مباراة 30 دقيقة",
    "help.extend.what": "يضيف 30 دقيقة إلى مباراة مؤكدة، بسعر يتبع السعر المتفق عليه.",
    "help.extend.where": "اليوم",
    "help.extend.tip": "غير ممكن بعد وقت الإغلاق، أو قبل المباراة التالية بأقل من 30 دقيقة، أو فوق 3 ساعات بالمجموع، أو لمباراة مقسّمة بين اللاعبين.",

    "help.adjust.title": "تعديل المبلغ المستحق",
    "help.adjust.what": "غيّر ما على اللاعب لخصم أو مباراة ناقصة أو إعفاء أو تصحيح، ويُحفظ السبب.",
    "help.adjust.where": "اليوم",
    "help.adjust.step1": "افتح المباراة واضغط «إجراءات أخرى».",
    "help.adjust.step2": "اختر «تعديل المبلغ» ثم السبب.",
    "help.adjust.tip": "المال المحصّل يبقى كما هو، والاسترجاع غير متاح بعد.",

    "help.makeWeekly.title": "جعل حجز ثابتاً كل أسبوع",
    "help.makeWeekly.what": "كرّر مباراة في اليوم والساعة نفسيهما كل أسبوع.",
    "help.makeWeekly.where": "اليوم",
    "help.makeWeekly.step1": "افتح المباراة واضغط «إجراءات أخرى».",
    "help.makeWeekly.step2": "اختر «كرّر كل أسبوع» وعدد الأسابيع.",
    "help.makeWeekly.step3": "راجع الأسابيع المحجوزة أو خارج الساعات، ثم أكّد.",

    "help.weeklyList.title": "قائمة الحجوزات الثابتة",
    "help.weeklyList.what": "كل حجز ثابت مع عدد المباريات الباقية. «تجديد» يضيف 8 أسابيع أخرى.",
    "help.weeklyList.where": "الحجوزات الثابتة",

    "help.cancelRest.title": "إلغاء باقي الأسابيع",
    "help.cancelRest.what": "«إلغاء الباقي» يلغي كل مباريات الحجز الثابت التي لم تبدأ، بلا رسوم.",
    "help.cancelRest.where": "الحجوزات الثابتة",
    "help.cancelRest.tip": "الأسابيع التي فيها دفعة تبقى. ألغِها واحداً واحداً.",

    "help.collect.title": "تحصيل دفعة",
    "help.collect.what": "افتح المباراة واضغط «تحصيل». للدفع بالليرة أو لجزء من المبلغ اختر «الدفع بطريقة أخرى».",
    "help.collect.where": "اليوم",

    "help.split.title": "تقسيم المباراة بين اللاعبين",
    "help.split.what": "يقسم سعر المباراة بالتساوي، فيدفع كل لاعب حصته.",
    "help.split.where": "اليوم",
    "help.split.step1": "فعّل «تقسيم الدفع بين اللاعبين» مرة واحدة في المزيد، قواعد الحجز.",
    "help.split.step2": "افتح المباراة واختر «لكل لاعب» في طريقة التحصيل.",
    "help.split.tip": "قسّم قبل أن تحصّل: المال المحصّل قبل التقسيم لا يُحسب لأي لاعب.",

    "help.owed.title": "من عليه مال لك",
    "help.owed.what": "المال غير المدفوع من مباريات انتهت، حسب اللاعب.",
    "help.owed.where": "مستحق لك",

    "help.sell.title": "البيع على الطاولة",
    "help.sell.what": "بِع المشروبات والأصناف لأي شخص.",
    "help.sell.where": "بيع",
    "help.sell.tip": "لا يمكن تعديل البيع أو حذفه بعد الحفظ. إذا كان خطأ، راسلنا.",

    "help.items.title": "أصناف على حساب المباراة",
    "help.items.what": "أضف أصنافاً إلى مباراة مؤكدة، على صاحب الحجز أو على شخص آخر.",
    "help.items.where": "اليوم",
    "help.items.tip": "يمكن إضافة الأصناف من قبل بدء المباراة بـ 60 دقيقة.",

    "help.catalog.title": "أصنافك وأسعارها",
    "help.catalog.what": "أضف الأصناف التي تبيعها، أو عدّلها، أو أرشفها.",
    "help.catalog.where": "المتجر",
    "help.catalog.tip": "السعر الجديد يُطبّق على المبيعات القادمة فقط.",

    "help.moneyPage.title": "صفحة المال",
    "help.moneyPage.what": "الداخل والخارج للفترة التي تختارها، وما هو مستحق لك، وكل دفعة ومصروف في «النشاط».",
    "help.moneyPage.where": "المال",
    "help.moneyPage.tip": "«النقد اليوم» يعدّ الأوراق والقطع في يوم الشغل، وليس جزءاً من المجاميع.",

    "help.shopReport.title": "مبيعات المتجر",
    "help.shopReport.what": "المبيعات والمشتريات للفترة. المبيعات تشمل أصنافاً على مباريات لم تُدفع بعد.",
    "help.shopReport.where": "المال، المتجر",

    "help.expense.title": "تسجيل مصروف",
    "help.expense.what": "في صفحة المال اضغط «+ مصروف» وأدخل المبلغ والفئة والتاريخ.",
    "help.expense.where": "المال",
    "help.expense.tip": "لا يمكن تعديل المصروف أو حذفه بعد الحفظ. إذا كان خطأ، راسلنا.",

    "help.search.title": "البحث عن لاعب",
    "help.search.what": "ابحث بالاسم أو بجزء من الرقم، ثم افتح اللاعب لترى مبارياته.",
    "help.search.where": "البحث",

    "help.editPerson.title": "تعديل اسم لاعب أو رقمه",
    "help.editPerson.what": "من صفحة اللاعب، غيّر اسمه أو رقمه.",
    "help.editPerson.where": "البحث",

    "help.info.title": "معلومات الملعب",
    "help.info.what": "الاسم والعنوان ورابط الخريطة والرقم وواتساب ولون ملعبك.",
    "help.info.where": "معلومات الملعب",
    "help.info.tip": "اختر الاسم واللون قبل تثبيت التطبيق. الأيقونة المثبّتة لا تتغيّر بعد ذلك.",

    "help.pitches.title": "الملاعب والساعات",
    "help.pitches.what": "ساعات الفتح، ومدة المباراة، وعدد اللاعبين، والأسعار، لكل ملعب.",
    "help.pitches.where": "الملاعب",

    "help.share.title": "مشاركة صفحتك والرمز",
    "help.share.what": "اللاعبون يحجزون من صفحتك العامة. شارك رابطها أو رمزها.",
    "help.share.where": "المزيد",
    "help.share.step1": "في المزيد، اضغط «صفحتي العامة».",
    "help.share.step2": "انسخ الرابط، أو شاركه على واتساب، أو اعرض الرمز لطباعة ملصق.",

    "help.rate.title": "سعر الصرف",
    "help.rate.what": "كم ليرة في الدولار، للدفعات بالليرة من الآن فصاعداً.",
    "help.rate.where": "المزيد، سعر الصرف",
    "help.rate.tip": "تغيير السعر لا يغيّر الدفعات السابقة أبداً.",

    "help.rules.title": "قواعد الحجز",
    "help.rules.what": "مهلة الإلغاء، ورسوم الإلغاء المتأخر وعدم الحضور، وبداية يوم الشغل، وتقسيم الدفع.",
    "help.rules.where": "المزيد، قواعد الحجز",
    "help.rules.tip": "بداية يوم الشغل تحدّد تحت أي يوم تظهر مباريات ما بعد منتصف الليل، ولا تغيّر أي مبلغ.",

    "help.install.title": "إضافة التطبيق إلى هاتفك",
    "help.install.what": "أضف التطبيق إلى الشاشة الرئيسية لتفتحه مثل أي تطبيق.",
    "help.install.step1": "على آيفون، اضغط زر المشاركة في المتصفح.",
    "help.install.step2": "اختر «إضافة إلى الشاشة الرئيسية».",
    "help.install.step3": "افتح التطبيق من الأيقونة الجديدة.",

    "help.notifications.title": "الإشعارات",
    "help.notifications.what": "يصلك تنبيه على هذا الهاتف عند وصول طلب حجز جديد.",
    "help.notifications.where": "المزيد، الإشعارات",
    "help.notifications.step1": "في المزيد، اضغط «الإشعارات».",
    "help.notifications.step2": "اضغط «تفعيل الإشعارات»، ثم «إرسال إشعار تجريبي».",
    "help.notifications.tip": "على آيفون، أضف التطبيق إلى الشاشة الرئيسية أولاً وافتحه من هناك.",

    "help.account.title": "كلمة المرور واسم الدخول",
    "help.account.what": "في المزيد، اضغط معرّفك لتغيير كلمة المرور أو اسم الدخول، أو للخروج من الأجهزة الأخرى.",
    "help.account.where": "المزيد، الحساب",
    "help.account.tip": "تغيير كلمة المرور يُخرجك من أجهزتك الأخرى.",

    "help.staff.title": "حسابات الموظفين",
    "help.staff.what": "حسابات الموظفين وما يُسمح لكل واحد به نضبطها نحن. لا توجد شاشة لذلك في التطبيق.",
  },
  en: {
    "owner.help": "Help",
    "help.intro": "Everything the app does, by topic. Tap a topic to open it.",
    "help.where": "Where:",
    "help.goodToKnow": "Good to know:",
    "help.stuck": "Still stuck? Message us on WhatsApp",
    "help.whatsappMessage": "Hello, I need help with the app for {name}.",

    "help.group.bookings": "Bookings and requests",
    "help.group.today": "Today",
    "help.group.weekly": "Weekly bookings",
    "help.group.collect": "Collecting money",
    "help.group.shop": "Shop and player tabs",
    "help.group.money": "Money page and expenses",
    "help.group.players": "Players",
    "help.group.stadium": "Your stadium",
    "help.group.phone": "The app on your phone",
    "help.group.account": "Your account",

    "help.approve.title": "Approve or reject a request",
    "help.approve.what": "Booking requests from your public page wait in Requests until you approve or reject them.",
    "help.approve.where": "Requests",
    "help.approve.tip": "Approving a request rejects the others for the same hour and keeps those players as interested.",

    "help.missed.title": "Requests whose hour has passed",
    "help.missed.what": "A request whose hour has started moves to the missed requests. Tap They played if the game happened, or Dismiss all.",
    "help.missed.where": "Requests",

    "help.interested.title": "Interested players",
    "help.interested.what": "When a game is cancelled, the players who asked for that hour show under Available slots with interested players, so you can tell them.",
    "help.interested.where": "Requests",

    "help.publicRequests.title": "Requests from your public page",
    "help.publicRequests.what": "A player picks a free hour on your public page and sends their name and phone, and you get a request.",
    "help.publicRequests.where": "More, My public page",
    "help.publicRequests.tip": "One phone can have at most 3 waiting requests at your stadium, up to 60 days ahead.",

    "help.book.title": "Book an hour yourself",
    "help.book.what": "Book a free hour for a player who called or came in.",
    "help.book.where": "Book an hour",
    "help.book.tip": "A confirmed hour cannot be booked twice, and waiting requests for that hour are declined.",

    "help.todayScreen.title": "The Today screen",
    "help.todayScreen.what": "It shows the day's confirmed games, the free hours, and money still owed from earlier days.",
    "help.todayScreen.where": "Today",

    "help.cancel.title": "Cancel a game or record a no-show",
    "help.cancel.what": "Cancel a confirmed booking, or record that the players did not come.",
    "help.cancel.where": "Today",
    "help.cancel.step1": "Open the game and tap More actions.",
    "help.cancel.step2": "Choose Cancel booking, or No-show.",
    "help.cancel.tip": "A cancelled hour is freed and offered again.",

    "help.extend.title": "Extend a game by 30 minutes",
    "help.extend.what": "Adds 30 minutes to a confirmed game, at a price that follows the agreed price.",
    "help.extend.where": "Today",
    "help.extend.tip": "Not possible past closing time, when the next game starts less than 30 minutes after, beyond 3 hours in total, or on a game split per player.",

    "help.adjust.title": "Change the amount due",
    "help.adjust.what": "Change what the player owes for a discount, a partial game, a waiver or a correction; the reason is kept.",
    "help.adjust.where": "Today",
    "help.adjust.step1": "Open the game and tap More actions.",
    "help.adjust.step2": "Choose Adjust amount, then the reason.",
    "help.adjust.tip": "Money already collected stays as it is; refunds are not supported yet.",

    "help.makeWeekly.title": "Make a booking weekly",
    "help.makeWeekly.what": "Repeat a game on the same day and hour every week.",
    "help.makeWeekly.where": "Today",
    "help.makeWeekly.step1": "Open the game and tap More actions.",
    "help.makeWeekly.step2": "Choose Repeat weekly and the number of weeks.",
    "help.makeWeekly.step3": "Check the weeks that are taken or outside your hours, then confirm.",

    "help.weeklyList.title": "Your weekly bookings",
    "help.weeklyList.what": "Each weekly booking with the games left. Renew adds 8 more weeks.",
    "help.weeklyList.where": "Weekly bookings",

    "help.cancelRest.title": "Cancel the remaining weeks",
    "help.cancelRest.what": "Cancel the rest cancels every game of a weekly booking that has not started, with no fee.",
    "help.cancelRest.where": "Weekly bookings",
    "help.cancelRest.tip": "Weeks that already have a payment stay. Cancel those one by one.",

    "help.collect.title": "Collect a payment",
    "help.collect.what": "Open the game and tap Collect. For pounds or part of the amount, choose Pay another way.",
    "help.collect.where": "Today",

    "help.split.title": "Split a game between players",
    "help.split.what": "Divides the game's price evenly, so each player pays their share.",
    "help.split.where": "Today",
    "help.split.step1": "Turn on Per-player split once in More, Booking rules.",
    "help.split.step2": "Open the game and choose Per player under How to collect.",
    "help.split.tip": "Split before you collect: money taken before the split is not credited to any player.",

    "help.owed.title": "Who owes you",
    "help.owed.what": "Unpaid money from games that have ended, by player.",
    "help.owed.where": "Owed to you",

    "help.sell.title": "Sell at the counter",
    "help.sell.what": "Sell drinks and items to anyone.",
    "help.sell.where": "Sell",
    "help.sell.tip": "A sale cannot be edited or deleted after saving. If it is wrong, message us.",

    "help.items.title": "Items on a game's tab",
    "help.items.what": "Add items to a confirmed game, for the booker or for someone else.",
    "help.items.where": "Today",
    "help.items.tip": "Items can be added from 60 minutes before the game starts.",

    "help.catalog.title": "Your items and prices",
    "help.catalog.what": "Add, edit or archive the items you sell.",
    "help.catalog.where": "Shop",
    "help.catalog.tip": "A new price applies to future sales only.",

    "help.moneyPage.title": "The Money page",
    "help.moneyPage.what": "Money in and out for the period you choose, what is owed to you, and every payment and expense in Activity.",
    "help.moneyPage.where": "Money",
    "help.moneyPage.tip": "Cash today counts the notes and coins of the business day; it is not part of the totals.",

    "help.shopReport.title": "Shop sales",
    "help.shopReport.what": "Sales and supplies for the period. Sales include items on games that are not paid yet.",
    "help.shopReport.where": "Money, Shop",

    "help.expense.title": "Record an expense",
    "help.expense.what": "On the Money page, tap + Expense and enter the amount, category and date.",
    "help.expense.where": "Money",
    "help.expense.tip": "An expense cannot be edited or deleted after saving. If it is wrong, message us.",

    "help.search.title": "Find a player",
    "help.search.what": "Search by name or part of a phone number, then open the player to see their games.",
    "help.search.where": "Search",

    "help.editPerson.title": "Change a player's name or phone",
    "help.editPerson.what": "On a player's page, change their name or phone.",
    "help.editPerson.where": "Search",

    "help.info.title": "Stadium info",
    "help.info.what": "Your stadium's name, address, map link, phone, WhatsApp and colour.",
    "help.info.where": "Stadium info",
    "help.info.tip": "Set your name and colour before installing the app; the installed icon does not update afterwards.",

    "help.pitches.title": "Pitches and hours",
    "help.pitches.what": "Opening hours, game length, players per game and prices, for each pitch.",
    "help.pitches.where": "Pitches",

    "help.share.title": "Share your page and QR code",
    "help.share.what": "Players book from your public page. Share its link or its QR code.",
    "help.share.where": "More",
    "help.share.step1": "In More, tap My public page.",
    "help.share.step2": "Copy the link, share it on WhatsApp, or show the QR code to print a poster.",

    "help.rate.title": "Exchange rate",
    "help.rate.what": "How many pounds make a dollar, for payments in pounds from now on.",
    "help.rate.where": "More, Exchange rate",
    "help.rate.tip": "Changing the rate never changes past payments.",

    "help.rules.title": "Booking rules",
    "help.rules.what": "The cancellation window, the late cancellation and no-show fees, when your business day starts, and per-player split.",
    "help.rules.where": "More, Booking rules",
    "help.rules.tip": "The day start decides which day games after midnight show under; it changes no amounts.",

    "help.install.title": "Add the app to your phone",
    "help.install.what": "Add the app to your home screen to open it like any other app.",
    "help.install.step1": "On iPhone, tap the browser's Share button.",
    "help.install.step2": "Choose Add to Home Screen.",
    "help.install.step3": "Open the app from the new icon.",

    "help.notifications.title": "Notifications",
    "help.notifications.what": "Get an alert on this phone when a new booking request arrives.",
    "help.notifications.where": "More, Notifications",
    "help.notifications.step1": "In More, tap Notifications.",
    "help.notifications.step2": "Tap Enable notifications, then Send a test notification.",
    "help.notifications.tip": "On iPhone, add the app to your home screen first and open it from there.",

    "help.account.title": "Password and login",
    "help.account.what": "In More, tap your identifier to change your password or login, or to log out other devices.",
    "help.account.where": "More, Account",
    "help.account.tip": "Changing your password logs out your other devices.",

    "help.staff.title": "Staff accounts",
    "help.staff.what": "Staff accounts and what each one may do are set by us. There is no screen for it in the app.",
  },
};
