import { describe, expect, it } from "@jest/globals";
import {
  collectUsdLabel,
  confirmedCount,
  dueRemainingLine,
  hoursEmptyState,
  lbpPerUsdLine,
  overdueCount,
  pendingCount,
  relativePastLabel,
  requestsCount,
  cancelPolicyLine,
  rejectReasonText,
  ui,
} from "@/lib/ui-copy";

describe("ui", () => {
  it("returns catalog Arabic for a known key", () => {
    expect(ui("login.submit")).toBe("دخول");
    expect(ui("public.request")).toBe("اطلب");
    expect(ui("public.today")).toBe("اليوم");
    expect(ui("public.tomorrow")).toBe("غداً");
    expect(ui("public.hours", "en")).toBe("Hours");
    expect(ui("public.today", "en")).toBe("Today");
    expect(ui("owner.today", "en")).toBe("Today");
    expect(ui("owner.home", "en")).toBe("Home");
    expect(ui("owner.home")).toBe("رئيسية");
    expect(ui("owner.homeHeading")).toBe("الرئيسية");
    expect(ui("owner.hourJustBooked")).toBe("تم حجز هذه الساعة للتو");
    expect(ui("owner.hourJustBooked", "en")).toBe("This hour was just booked");
    expect(ui("owner.requests")).toBe("طلبات");
    expect(ui("owner.upcoming")).toBe("القادم");
    expect(ui("owner.upcomingTag")).toBe("قادم");
    expect(ui("owner.overdue")).toBe("متأخر");
    expect(ui("owner.collectMixed")).toBe("دفع بعملتين");
    expect(ui("owner.hideCollectMixed")).toBe("إخفاء الدفع بعملتين");
    expect(ui("owner.hideCollectMixed", "en")).toBe("Hide two-currency pay");
    expect(ui("owner.usdRemaining")).toBe("المتبقي بالدولار");
    expect(ui("owner.usdRemaining", "en")).toBe("Remaining USD");
    expect(ui("owner.remaining")).toBe("المتبقي");
    expect(ui("owner.remaining", "en")).toBe("Remaining");
    expect(ui("owner.book", "en")).toBe("Book");
    expect(ui("owner.reports")).toBe("تقارير");
    expect(ui("owner.reports", "en")).toBe("Reports");
    expect(ui("owner.more")).toBe("المزيد");
    expect(ui("owner.more", "en")).toBe("More");
    expect(ui("owner.settings")).toBe("إعدادات");
    expect(ui("owner.settings", "en")).toBe("Settings");
    expect(ui("owner.waitlist")).toBe("قائمة الانتظار");
    expect(ui("owner.waitlistTab")).toBe("انتظار");
    expect(ui("owner.waitlistTab", "en")).toBe("Waitlist");
    expect(ui("owner.notifyGroup")).toBe("إبلاغ");
    expect(ui("owner.notifyWhatsApp")).toBe("إبلاغ عبر واتساب");
    expect(ui("owner.notifyWhatsApp", "en")).toBe("Notify on WhatsApp");
    expect(ui("owner.notifyGroup", "en")).toBe("Notify");
    expect(ui("owner.moneyGroup")).toBe("تحصيل");
    expect(ui("owner.moneyGroup", "en")).toBe("Collect");
    expect(ui("owner.openBooking")).toBe("عرض التفاصيل");
    expect(ui("owner.openBooking", "en")).toBe("View details");
    expect(ui("owner.cancel")).toBe("إلغاء الحجز");
    expect(ui("owner.cancel", "en")).toBe("Cancel booking");
    expect(ui("owner.cancelConfirm")).toBe("تأكيد إلغاء الحجز");
    expect(ui("owner.cancelBack")).toBe("تراجع");
    expect(ui("owner.changePeriod")).toBe("تغيير الفترة");
    expect(ui("owner.changePeriod", "en")).toBe("Change period");
    expect(ui("owner.addExpense")).toBe("إضافة مصروف");
    expect(ui("owner.addExpense", "en")).toBe("Add expense");
  });

  it("returns the key itself when unknown", () => {
    expect(ui("not.a.real.key")).toBe("not.a.real.key");
  });
});

describe("interpolated chrome", () => {
  it("uses Western digits and a Latin money amount", () => {
    expect(pendingCount(3)).toBe("قيد الانتظار · 3");
    expect(requestsCount(1)).toBe("طلب واحد");
    expect(requestsCount(2)).toBe("طلبان");
    expect(requestsCount(3)).toBe("3 طلبات");
    expect(overdueCount(1)).toBe("متأخر · 1");
    expect(confirmedCount(0)).toBe("مؤكد · 0");
    expect(collectUsdLabel("30.00")).toBe("تحصيل $30.00");
    expect(dueRemainingLine("30.00", "10.00")).toBe(
      "المستحق $30.00 · المتبقي $10.00",
    );
    expect(lbpPerUsdLine("90000")).toBe("90000 ليرة لكل دولار");
    expect(pendingCount(3, "en")).toBe("Pending · 3");
    expect(lbpPerUsdLine("90000", "en")).toBe("90000 LBP per USD");
  });
});

describe("relativePastLabel", () => {
  const now = new Date("2026-09-25T12:00:00.000Z");

  it("uses full words for minutes, hours, yesterday, and days", () => {
    expect(relativePastLabel(new Date("2026-09-25T11:55:00.000Z"), now)).toBe(
      "قبل 5 دقائق",
    );
    expect(relativePastLabel(new Date("2026-09-25T11:00:00.000Z"), now)).toBe(
      "قبل ساعة",
    );
    expect(relativePastLabel(new Date("2026-09-25T10:00:00.000Z"), now)).toBe(
      "قبل ساعتين",
    );
    expect(relativePastLabel(new Date("2026-09-25T09:00:00.000Z"), now)).toBe(
      "قبل 3 ساعات",
    );
    expect(relativePastLabel(new Date("2026-09-24T12:00:00.000Z"), now)).toBe(
      "أمس",
    );
    expect(relativePastLabel(new Date("2026-09-22T12:00:00.000Z"), now)).toBe(
      "قبل 3 أيام",
    );
  });

  it("uses English equivalents", () => {
    expect(
      relativePastLabel(new Date("2026-09-25T11:55:00.000Z"), now, "en"),
    ).toBe("5 minutes ago");
    expect(
      relativePastLabel(new Date("2026-09-24T12:00:00.000Z"), now, "en"),
    ).toBe("Yesterday");
    expect(
      relativePastLabel(new Date("2026-09-22T12:00:00.000Z"), now, "en"),
    ).toBe("3 days ago");
  });
});

describe("hoursEmptyState", () => {
  it("maps closed / past / hoursEnded in Arabic and English", () => {
    expect(hoursEmptyState("closed")).toEqual({
      title: "مغلق هذا اليوم.",
      next: "اختر يوماً آخر لرؤية الساعات.",
    });
    expect(hoursEmptyState("past", "en")).toEqual({
      title: "This date has passed.",
      next: "Pick today or a coming day.",
    });
    expect(hoursEmptyState("hoursEnded", "en")).toEqual({
      title: "No hours left today.",
      next: "Pick a coming day.",
    });
  });
});

describe("cancelPolicyLine", () => {
  it("states the window and the percent, and hides a zero fee", () => {
    expect(cancelPolicyLine(24, 50)).toBe(
      "الإلغاء قبل أقل من 24 ساعة من الموعد: رسوم 50% من السعر.",
    );
    expect(cancelPolicyLine(24, 50, "en")).toBe(
      "Cancelling less than 24 hours before the game costs 50% of the price.",
    );
    expect(cancelPolicyLine(24, 0)).toBe("");
  });
});

describe("rejectReasonText", () => {
  it("uses the chip label, or the note for other", () => {
    expect(rejectReasonText("slot_taken", "", "ar")).toBe("الساعة محجوزة");
    expect(rejectReasonText("pitch_closed", "", "en")).toBe("Pitch closed");
    expect(rejectReasonText("other", "  ملعب صغير  ")).toBe("ملعب صغير");
    expect(rejectReasonText("other", "   ")).toBeNull();
    expect(rejectReasonText("nope", "x")).toBeNull();
  });
});
