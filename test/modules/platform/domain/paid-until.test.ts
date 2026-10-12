import { describe, expect, it } from "@jest/globals";
import { addOneMonth, calendarDateIn, defaultPaidUntil } from "@/modules/platform/domain/paid-until";

describe("addOneMonth", () => {
  it("keeps the day of the month", () => {
    expect(addOneMonth("2026-10-12")).toBe("2026-11-12");
    expect(addOneMonth("2027-01-01")).toBe("2027-02-01");
  });

  it("clamps a day that does not exist next month", () => {
    expect(addOneMonth("2027-01-31")).toBe("2027-02-28");
    expect(addOneMonth("2028-01-31")).toBe("2028-02-29"); // leap year
    expect(addOneMonth("2026-08-31")).toBe("2026-09-30");
  });

  it("rolls over the year", () => {
    expect(addOneMonth("2026-12-24")).toBe("2027-01-24");
    expect(addOneMonth("2026-12-31")).toBe("2027-01-31");
  });
});

describe("calendarDateIn", () => {
  it("uses the calendar date of the time zone, not of UTC", () => {
    const lateUtc = new Date("2026-10-12T22:30:00Z"); // 01:30 on 13 Oct in Beirut (UTC+3)
    expect(calendarDateIn("Asia/Beirut", lateUtc)).toBe("2026-10-13");
    expect(calendarDateIn("UTC", lateUtc)).toBe("2026-10-12");
  });
});

describe("defaultPaidUntil", () => {
  const now = new Date("2026-10-12T09:00:00Z");

  it("is the current paid-until plus one month", () => {
    expect(defaultPaidUntil(new Date("2026-12-24T00:00:00Z"), now, "Asia/Beirut")).toBe("2027-01-24");
  });

  it("is today plus one month when there is no paid-until", () => {
    expect(defaultPaidUntil(null, now, "Asia/Beirut")).toBe("2026-11-12");
  });
});
