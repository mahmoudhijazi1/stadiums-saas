import { describe, expect, it } from "@jest/globals";
import {
  collectUsdLabel,
  confirmedCount,
  dueRemainingLine,
  hoursEmptyState,
  lbpPerUsdLine,
  overdueCount,
  pendingCount,
  requestsCount,
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
    expect(ui("owner.requests")).toBe("طلبات");
    expect(ui("owner.upcoming")).toBe("القادم");
    expect(ui("owner.upcomingTag")).toBe("قادم");
    expect(ui("owner.overdue")).toBe("متأخر");
    expect(ui("owner.collectMixed")).toBe("دفع بعملتين");
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
    expect(requestsCount(2)).toBe("طلبات · 2");
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
