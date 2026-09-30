import { describe, expect, it } from "@jest/globals";
import {
  OWNER_FUTURE_DAYS,
  resolveOwnerDay,
} from "@/modules/booking/domain/start-day";

describe("resolveOwnerDay", () => {
  const today = { year: 2026, month: 9, day: 24 };

  it("uses today when the param is missing or not a date", () => {
    expect(resolveOwnerDay(undefined, today)).toEqual(today);
    expect(resolveOwnerDay("09-24", today)).toEqual(today);
    expect(resolveOwnerDay("2026-02-31", today)).toEqual(today);
  });

  it("keeps a past day and a day on the future limit", () => {
    expect(resolveOwnerDay("2020-01-02", today)).toEqual({
      year: 2020,
      month: 1,
      day: 2,
    });
    expect(resolveOwnerDay("2026-11-23", today)).toEqual({
      year: 2026,
      month: 11,
      day: 23,
    });
    expect(OWNER_FUTURE_DAYS).toBe(60);
  });

  it("rejects a day past the future limit", () => {
    expect(resolveOwnerDay("2026-11-24", today)).toEqual(today);
  });
});
