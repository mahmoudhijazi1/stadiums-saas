import { describe, expect, it } from "@jest/globals";
import { priceOfferedSlot, resolveOfferedSlot } from "@/modules/booking/domain/offered-slot";
import { classifyOccurrence, occurrencePrice, occurrencePriceIn } from "@/modules/booking/domain/series";
import type { CivilDate } from "@/modules/venue/domain/availability";
import { CLOSED_WEEK_SCHEDULE, parseScheduleConfig, type ScheduleConfig } from "@/modules/venue/domain/schedule-config";

/** DR-007 slice 5: a new game is priced in the stadium's currency. Written, not run when authored. */
const TZ = "Asia/Beirut";
const FRIDAY: CivilDate = { year: 2026, month: 10, day: 16 };
const BEFORE = new Date("2026-10-01T00:00:00Z");

function config(extra: Partial<ScheduleConfig>): ScheduleConfig {
  return parseScheduleConfig({
    ...CLOSED_WEEK_SCHEDULE,
    hours: { ...CLOSED_WEEK_SCHEDULE.hours, fri: [{ start: "18:00", end: "22:00" }] },
    defaultPriceUsd: "30.00",
    ...extra,
  });
}

/** The Friday slot starting at hh:00 Beirut (UTC+3 in October 2026). */
const fridayAt = (hour: number) => new Date(Date.UTC(2026, 9, 16, hour - 3));

function offered(cfg: ScheduleConfig, hour: number) {
  const start = fridayAt(hour);
  return resolveOfferedSlot({
    config: cfg,
    localDate: FRIDAY,
    timeZone: TZ,
    start,
    end: new Date(start.getTime() + 3_600_000),
    now: BEFORE,
  });
}

describe("priceOfferedSlot", () => {
  const cfg = config({
    defaultPriceLbp: "2000000",
    priceRules: [
      { days: ["fri"], start: "19:00", end: "20:00", priceUsd: "35.00", priceLbp: "2500000" },
      { days: ["fri"], start: "20:00", end: "22:00", priceUsd: "40.00" },
    ],
  });

  it("gives the window's day with the slot", () => {
    expect(offered(cfg, 18).windowDate).toEqual(FRIDAY);
  });

  it("prices in pounds: the default, a rule in pounds, and the default again under a dollar-only rule", () => {
    expect(priceOfferedSlot(cfg, "LBP", offered(cfg, 18), TZ)).toEqual({ currency: "LBP", amount: expect.anything() });
    expect(priceOfferedSlot(cfg, "LBP", offered(cfg, 18), TZ).amount.toFixed(0)).toBe("2000000");
    expect(priceOfferedSlot(cfg, "LBP", offered(cfg, 19), TZ).amount.toFixed(0)).toBe("2500000");
    expect(priceOfferedSlot(cfg, "LBP", offered(cfg, 20), TZ).amount.toFixed(0)).toBe("2000000");
  });

  it("prices in dollars exactly as the engine's priceUsd", () => {
    for (const hour of [18, 19, 20, 21]) {
      const slot = offered(cfg, hour);
      expect(priceOfferedSlot(cfg, "USD", slot, TZ)).toEqual({ currency: "USD", amount: slot.priceUsd });
    }
  });

  it("refuses a slot with no price in the stadium's currency", () => {
    const usdOnly = config({});
    expect(() => priceOfferedSlot(usdOnly, "LBP", offered(usdOnly, 18), TZ)).toThrow(
      expect.objectContaining({ key: "booking.no_price_in_currency" }),
    );
  });
});

describe("occurrencePriceIn", () => {
  const cfg = config({ defaultPriceLbp: "2000000" });

  it("prices a week in pounds, scaled to the series length and rounded to 5,000", () => {
    expect(occurrencePriceIn(cfg, "LBP", fridayAt(18), 60, TZ)).toEqual({
      offered: true,
      price: { currency: "LBP", amount: expect.anything() },
    });
    expect(occurrencePriceIn(cfg, "LBP", fridayAt(18), 60, TZ).price?.amount.toFixed(0)).toBe("2000000");
    // 90 minutes on a 60-minute grid: 3,000,000. 50 minutes: 1,666,666.67 rounds to 1,665,000.
    expect(occurrencePriceIn(cfg, "LBP", fridayAt(18), 90, TZ).price?.amount.toFixed(0)).toBe("3000000");
    expect(occurrencePriceIn(cfg, "LBP", fridayAt(18), 50, TZ).price?.amount.toFixed(0)).toBe("1665000");
  });

  it("keeps dollars exactly as occurrencePrice", () => {
    expect(occurrencePriceIn(cfg, "USD", fridayAt(18), 90, TZ).price?.amount.toFixed(2)).toBe("45.00");
    expect(occurrencePrice(cfg, fridayAt(18), 90, TZ)?.toFixed(2)).toBe("45.00");
  });

  it("tells no slot apart from no price in the currency", () => {
    expect(occurrencePriceIn(cfg, "LBP", fridayAt(12), 60, TZ)).toEqual({ offered: false, price: null });
    expect(occurrencePriceIn(config({}), "LBP", fridayAt(18), 60, TZ)).toEqual({ offered: true, price: null });
  });

  it("classifies a free week with its price in the stadium's currency", () => {
    const base = { index: 0, start: fridayAt(18), durationMinutes: 60, approved: [], pending: [], now: BEFORE, timeZone: TZ };
    const week = classifyOccurrence({ ...base, config: cfg, currency: "LBP" });
    expect(week.state).toBe("free");
    expect(week.price?.currency).toBe("LBP");
    expect(week.price?.amount.toFixed(0)).toBe("2000000");
    // The grid is the same in both currencies: a free week stays free with no price in pounds.
    const unpriced = classifyOccurrence({ ...base, config: config({}), currency: "LBP" });
    expect([unpriced.state, unpriced.price]).toEqual(["free", null]);
  });
});
