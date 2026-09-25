import { describe, expect, it } from "@jest/globals";
import { formatLocalHm } from "@/lib/format-local-hm";

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
