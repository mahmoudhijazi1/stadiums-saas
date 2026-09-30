import { describe, expect, it } from "@jest/globals";
import { messageDayLabel, nightHint } from "@/modules/booking/application/night-hint";

// Friday 11 Sep 2026, Beirut UTC+3.
const saturday0030 = new Date("2026-09-11T21:30:00.000Z");
const saturday0600 = new Date("2026-09-12T03:00:00.000Z");
const friday2300 = new Date("2026-09-11T20:00:00.000Z");

describe("nightHint", () => {
  it("names the evening a 00:30 game belongs to", () => {
    expect(nightHint(saturday0030, "en")).toBe("night of Friday");
    expect(nightHint(saturday0030, "ar")).toBe("ليلة الجمعة");
  });

  it("is absent from 06:00 and for a game before midnight", () => {
    expect(nightHint(saturday0600, "en")).toBeNull();
    expect(nightHint(saturday0600, "ar")).toBeNull();
    expect(nightHint(friday2300, "en")).toBeNull();
  });
});

describe("messageDayLabel", () => {
  it("keeps the real calendar date and adds the hint for a night start", () => {
    expect(messageDayLabel(saturday0030, "en")).toBe("Saturday, September 12 (night of Friday)");
    expect(messageDayLabel(saturday0030, "ar")).toContain("السبت");
    expect(messageDayLabel(saturday0030, "ar")).toContain("(ليلة الجمعة)");
  });

  it("has no hint at 06:00", () => {
    expect(messageDayLabel(saturday0600, "en")).toBe("Saturday, September 12");
  });
});
