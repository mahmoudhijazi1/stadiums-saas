import { describe, expect, it } from "@jest/globals";
import {
  PUBLIC_FUTURE_DAYS,
  clampPublicDay,
  isWithinPublicWindow,
  lastPublicDay,
} from "@/modules/booking/domain/public-window";

/** Written, not run when authored. Hardening 2 item 4 (N-9). */
const today = { year: 2026, month: 10, day: 14 };

describe("public booking window", () => {
  it("the last public day is PUBLIC_FUTURE_DAYS after today, across a month end", () => {
    expect(PUBLIC_FUTURE_DAYS).toBe(60);
    expect(lastPublicDay(today)).toEqual({ year: 2026, month: 12, day: 13 });
  });

  it("the boundary day is allowed and the next day is not", () => {
    const last = lastPublicDay(today);
    expect(isWithinPublicWindow(last, today)).toBe(true);
    expect(isWithinPublicWindow({ ...last, day: last.day + 1 }, today)).toBe(false);
    expect(isWithinPublicWindow({ year: 2027, month: 10, day: 14 }, today)).toBe(false);
  });

  it("today, tomorrow and past days are inside", () => {
    expect(isWithinPublicWindow(today, today)).toBe(true);
    expect(isWithinPublicWindow({ year: 2026, month: 10, day: 15 }, today)).toBe(true);
    expect(isWithinPublicWindow({ year: 2026, month: 10, day: 1 }, today)).toBe(true);
  });

  it("the page shows the fallback for a missing or too-far date and keeps a good one", () => {
    const fallback = today;
    const good = { year: 2026, month: 11, day: 2 };
    expect(clampPublicDay(null, today, fallback)).toBe(fallback);
    expect(clampPublicDay(good, today, fallback)).toBe(good);
    expect(clampPublicDay({ year: 2030, month: 1, day: 1 }, today, fallback)).toBe(fallback);
  });
});
