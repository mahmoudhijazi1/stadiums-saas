import { describe, expect, it } from "@jest/globals";
import {
  clockRangeFromLocals,
  formatClockRange,
  formatClockRangeText,
  formatLocalHm,
} from "@/lib/format-local-hm";

describe("formatLocalHm", () => {
  it("formats HH:mm in Asia/Beirut", () => {
    // 2026-10-05 13:00 UTC = 16:00 Beirut (UTC+3)
    const instant = new Date("2026-10-05T13:00:00.000Z");
    expect(formatLocalHm(instant, "Asia/Beirut")).toBe("16:00");
  });

  it("maps hour 24 to 00 at local midnight", () => {
    // 2026-10-04 21:00 UTC = 00:00 Beirut next civil day
    const instant = new Date("2026-10-04T21:00:00.000Z");
    expect(formatLocalHm(instant, "Asia/Beirut")).toBe("00:00");
  });

  it("formats h12 with Latin AM/PM in Asia/Beirut", () => {
    const instant = new Date("2026-10-05T13:00:00.000Z");
    expect(formatLocalHm(instant, "Asia/Beirut", "h12")).toBe("4:00 PM");
  });

  it("formats h12 Arabic as صباحاً or مساءً and keeps 24-hour plain", () => {
    const evening = new Date("2026-10-05T16:00:00.000Z");
    expect(formatLocalHm(evening, "Asia/Beirut", "h12", "ar")).toBe("7:00 مساءً");
    expect(formatLocalHm(evening, "Asia/Beirut", "h12", "en")).toBe("7:00 PM");
    expect(formatLocalHm(evening, "Asia/Beirut", "h23", "ar")).toBe("19:00");
    const morning = new Date("2026-10-05T04:00:00.000Z");
    expect(formatLocalHm(morning, "Asia/Beirut", "h12", "ar")).toBe("7:00 صباحاً");
    expect(formatLocalHm(morning, "Asia/Beirut", "h12", "en")).toBe("7:00 AM");
  });
});

describe("formatClockRange", () => {
  const start = new Date("2026-10-05T16:00:00.000Z");
  const end = new Date("2026-10-05T17:00:00.000Z");

  it("keeps 24-hour ranges as digits and a dash", () => {
    expect(formatClockRange(start, end, "Asia/Beirut", "h23", "ar")).toEqual({
      digits: "19:00–20:00",
      period: "",
    });
    expect(formatClockRangeText(start, end, "Asia/Beirut", "h23", "ar")).toBe(
      "19:00–20:00",
    );
  });

  it("puts one Arabic period after the digit range", () => {
    const label = formatClockRange(start, end, "Asia/Beirut", "h12", "ar");
    expect(label.digits).toBe("7:00–8:00");
    expect(label.period).toBe("م");
    expect(label.split).toBeUndefined();
    expect(formatClockRangeText(start, end, "Asia/Beirut", "h12", "ar")).toBe(
      "7:00–8:00 م",
    );
  });

  it("puts one English period after the digit range", () => {
    expect(formatClockRangeText(start, end, "Asia/Beirut", "h12", "en")).toBe(
      "7:00–8:00 PM",
    );
  });

  it("keeps both periods when the range crosses noon", () => {
    const lateMorning = new Date("2026-10-05T08:00:00.000Z");
    const afternoon = new Date("2026-10-05T09:00:00.000Z");
    const label = formatClockRange(
      lateMorning,
      afternoon,
      "Asia/Beirut",
      "h12",
      "ar",
    );
    expect(label.split).toEqual({
      startDigits: "11:00",
      startPeriod: "ص",
      endDigits: "12:00",
      endPeriod: "م",
    });
    expect(formatClockRangeText(lateMorning, afternoon, "Asia/Beirut", "h12", "ar")).toBe(
      "11:00 ص–12:00 م",
    );
  });

  it("compacts two formatted clocks that share a period", () => {
    expect(clockRangeFromLocals("7:00 مساءً", "8:00 مساءً")).toBe("7:00–8:00 م");
    expect(clockRangeFromLocals("7:00 PM", "8:00 PM")).toBe("7:00–8:00 PM");
    expect(clockRangeFromLocals("19:00", "20:00")).toBe("19:00–20:00");
  });
});
