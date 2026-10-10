import { describe, expect, it } from "@jest/globals";
import { messageIntentFor } from "@/modules/notification/domain/message-intent";
import { composeMessage, notifyLink } from "@/modules/notification/domain/whatsapp-link";

/** Written, not run when authored. The weekly-series confirmation text. */
const facts = {
  name: "Hassan",
  stadiumName: "Ahmad Stadium",
  day: "Tuesday 14 October",
  time: "20:00",
  weekday: "Tuesday",
  games: 8,
};

describe("SERIES_CONFIRMED", () => {
  it("is the intent right after a series is booked, and only then", () => {
    expect(messageIntentFor("after_series")).toBe("SERIES_CONFIRMED");
    expect(messageIntentFor("after_approve")).toBe("CONFIRMED");
  });

  it("says the weekday, the time, the first date and the number of games (English)", () => {
    const text = composeMessage("SERIES_CONFIRMED", facts, "en");
    for (const part of ["Hassan", "Ahmad Stadium", "every", "Tuesday", "20:00", "Tuesday 14 October", "8 games"]) {
      expect(text).toContain(part);
    }
  });

  it("says the same in Arabic", () => {
    const text = composeMessage("SERIES_CONFIRMED", { ...facts, weekday: "الثلاثاء", day: "الثلاثاء 14 تشرين الأول" }, "ar");
    for (const part of ["Hassan", "Ahmad Stadium", "كل", "الثلاثاء", "20:00", "14 تشرين الأول", "8 مباريات"]) {
      expect(text).toContain(part);
    }
  });

  it("needs the weekday and the number of games", () => {
    expect(() => composeMessage("SERIES_CONFIRMED", { ...facts, weekday: undefined }, "en")).toThrow(/weekday/);
    expect(() => composeMessage("SERIES_CONFIRMED", { ...facts, games: undefined }, "en")).toThrow(/games/);
  });

  it("builds a wa.me link with the text, and no link without a phone", () => {
    const link = notifyLink({ context: "after_series", phone: "03123456", facts, locale: "en" });
    expect(link.intent).toBe("SERIES_CONFIRMED");
    expect(link.href).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    expect(notifyLink({ context: "after_series", phone: null, facts, locale: "en" }).href).toBeNull();
  });
});
