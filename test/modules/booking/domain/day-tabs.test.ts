import { describe, expect, it } from "@jest/globals";
import { businessDate } from "@/modules/booking/domain/business-day";
import { buildDayTabs, DAY_TABS_BACK } from "@/modules/booking/domain/day-tabs";
import { OWNER_FUTURE_DAYS } from "@/modules/booking/domain/start-day";

// 2026-09-12 is a Saturday. Beirut is UTC+3 in September (summer time).
const today = { year: 2026, month: 9, day: 12 };

function tabs(locale: "ar" | "en", selected = today) {
  return buildDayTabs({ today, selected, locale });
}

describe("buildDayTabs", () => {
  it("labels yesterday, today and tomorrow", () => {
    const ar = tabs("ar");
    const en = tabs("en");
    const at = (list: typeof ar, date: string) => list.find((tab) => tab.date === date);
    expect(at(ar, "2026-09-11")).toMatchObject({ kind: "yesterday", label: "أمس" });
    expect(at(ar, "2026-09-12")).toMatchObject({ kind: "today", label: "اليوم" });
    expect(at(ar, "2026-09-13")).toMatchObject({ kind: "tomorrow", label: "غداً" });
    expect(at(en, "2026-09-11")?.label).toBe("Yesterday");
    expect(at(en, "2026-09-12")?.label).toBe("Today");
    expect(at(en, "2026-09-13")?.label).toBe("Tomorrow");
  });

  it("uses weekday and day number for every other day", () => {
    const en = tabs("en").find((tab) => tab.date === "2026-09-18");
    expect(en).toMatchObject({ kind: "day", label: "Fri 18", dayNumber: 18 });
    const ar = tabs("ar").find((tab) => tab.date === "2026-09-18");
    expect(ar?.kind).toBe("day");
    expect(ar?.label).toContain("الجمعة");
    expect(ar?.label).toMatch(/18$/);
  });

  it("gives the stacked tab a top label and a day number", () => {
    const en = tabs("en");
    const ar = tabs("ar");
    const at = (list: typeof en, date: string) => list.find((tab) => tab.date === date)!;
    expect(at(en, "2026-09-11")).toMatchObject({ topLabel: "Yesterday", dayNumber: 11 });
    expect(at(en, "2026-09-12")).toMatchObject({ topLabel: "Today", dayNumber: 12 });
    expect(at(en, "2026-09-13")).toMatchObject({ topLabel: "Tomorrow", dayNumber: 13 });
    expect(at(en, "2026-09-18")).toMatchObject({ topLabel: "Fri", dayNumber: 18 });
    expect(at(ar, "2026-09-11").topLabel).toBe("أمس");
    expect(at(ar, "2026-09-18").topLabel).toBe("الجمعة");
    expect(at(ar, "2026-09-18").topLabel).not.toMatch(/\d/);
  });

  it("runs 14 days back to the future limit, oldest first", () => {
    const list = tabs("en");
    expect(list[0]?.date).toBe("2026-08-29");
    expect(list.at(-1)?.date).toBe("2026-11-11");
    expect(list).toHaveLength(DAY_TABS_BACK + 1 + OWNER_FUTURE_DAYS);
  });

  it("keeps a selected day older than the window", () => {
    const list = tabs("en", { year: 2026, month: 8, day: 1 });
    expect(list[0]?.date).toBe("2026-08-01");
    expect(list.some((tab) => tab.date === "2026-08-29")).toBe(true);
  });

  it("follows the 06:00 business-day rule for today", () => {
    // 00:30 Beirut on Sat 12 Sep is 21:30 UTC on Fri 11 Sep: still Friday's business day.
    const early = businessDate(new Date("2026-09-11T21:30:00Z"), 6);
    const earlyTabs = buildDayTabs({ today: early, selected: early, locale: "en" });
    expect(earlyTabs.find((tab) => tab.kind === "today")?.date).toBe("2026-09-11");
    // 06:30 Beirut on Sat 12 Sep is 03:30 UTC: Saturday.
    const later = businessDate(new Date("2026-09-12T03:30:00Z"), 6);
    const laterTabs = buildDayTabs({ today: later, selected: later, locale: "en" });
    expect(laterTabs.find((tab) => tab.kind === "today")?.date).toBe("2026-09-12");
  });
});
