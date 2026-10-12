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
  const now = new Date("2026-10-12T09:00:00Z"); // 12 Oct 2026 in Beirut

  it("starts from today when the paid-until lapsed two months ago", () => {
    expect(defaultPaidUntil(new Date("2026-08-12T00:00:00Z"), now, "Asia/Beirut")).toBe("2026-11-12");
  });

  it("starts from the paid-until when it is next week", () => {
    expect(defaultPaidUntil(new Date("2026-10-19T00:00:00Z"), now, "Asia/Beirut")).toBe("2026-11-19");
  });

  it("starts from today when it is today, and from today when there is none", () => {
    expect(defaultPaidUntil(new Date("2026-10-12T00:00:00Z"), now, "Asia/Beirut")).toBe("2026-11-12");
    expect(defaultPaidUntil(null, now, "Asia/Beirut")).toBe("2026-11-12");
  });

  it("clamps at the end of a short month", () => {
    const january = new Date("2027-01-05T09:00:00Z");
    expect(defaultPaidUntil(new Date("2027-01-31T00:00:00Z"), january, "Asia/Beirut")).toBe("2027-02-28");
    expect(defaultPaidUntil(null, new Date("2027-01-31T09:00:00Z"), "Asia/Beirut")).toBe("2027-02-28");
  });

  it("takes today from the owner time zone, not from UTC", () => {
    const lateUtc = new Date("2026-10-12T22:30:00Z"); // already 13 Oct in Beirut
    expect(defaultPaidUntil(null, lateUtc, "Asia/Beirut")).toBe("2026-11-13");
    expect(defaultPaidUntil(new Date("2026-10-13T00:00:00Z"), lateUtc, "Asia/Beirut")).toBe("2026-11-13");
  });
});
