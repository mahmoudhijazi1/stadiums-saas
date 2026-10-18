import { describe, expect, it } from "@jest/globals";
import {
  defaultPriceIn,
  generateSlotsForDay,
  priceForSlotIn,
  type CivilDate,
} from "@/modules/venue/domain/availability";
import {
  CLOSED_WEEK_SCHEDULE,
  hasPricesIn,
  isLbpPriceString,
  parseScheduleConfig,
  type ScheduleConfig,
} from "@/modules/venue/domain/schedule-config";

/** DR-007 slice 4: pitch prices in pounds next to the USD ones, and the slot price in a currency. */
const TZ = "Asia/Beirut";
const FRIDAY: CivilDate = { year: 2026, month: 10, day: 16 };
const SATURDAY: CivilDate = { year: 2026, month: 10, day: 17 };

function config(extra: Partial<ScheduleConfig>): ScheduleConfig {
  return parseScheduleConfig({
    ...CLOSED_WEEK_SCHEDULE,
    hours: { ...CLOSED_WEEK_SCHEDULE.hours, fri: [{ start: "18:00", end: "22:00" }], sat: [{ start: "18:00", end: "22:00" }] },
    defaultPriceUsd: "30.00",
    ...extra,
  });
}

/** The Beirut wall clock hh:00 on a day (UTC+3 in October 2026). */
const at = (day: CivilDate, hour: number) => new Date(Date.UTC(day.year, day.month - 1, day.day, hour - 3));
const lbpAt = (cfg: ScheduleConfig, day: CivilDate, hour: number) =>
  priceForSlotIn(cfg, "LBP", { start: at(day, hour), localDate: day, timeZone: TZ }).amount?.toFixed(0) ?? null;

describe("scheduleConfig with LBP prices", () => {
  it("parses every existing row unchanged (no LBP keys)", () => {
    const old = {
      ...CLOSED_WEEK_SCHEDULE,
      defaultPriceUsd: "30.00",
      priceRules: [{ days: ["fri"], priceUsd: "40.00" }, { days: ["sat"], start: "20:00", end: "22:00", priceUsd: "50.00" }],
    };
    expect(parseScheduleConfig(old)).toEqual(old);
    expect(parseScheduleConfig(CLOSED_WEEK_SCHEDULE)).toEqual(CLOSED_WEEK_SCHEDULE);
  });

  it("accepts whole pounds that are a multiple of 5,000", () => {
    const cfg = config({ defaultPriceLbp: "2000000", priceRules: [{ days: ["fri"], priceLbp: "2500000" }] });
    expect(cfg.defaultPriceLbp).toBe("2000000");
    expect(cfg.priceRules[0]).toEqual({ days: ["fri"], priceLbp: "2500000" });
    expect(isLbpPriceString("5000")).toBe(true);
    expect(isLbpPriceString("1000000000")).toBe(true);
  });

  it("refuses 2,500, 12,345, a decimal, zero, a negative and too much", () => {
    for (const bad of ["2500", "12345", "5000.5", "0", "-5000", "1000005000", "2,000,000", ""]) {
      expect(isLbpPriceString(bad)).toBe(false);
      expect(() => config({ defaultPriceLbp: bad })).toThrow();
      expect(() => config({ priceRules: [{ days: ["fri"], priceLbp: bad }] })).toThrow();
    }
  });

  it("a rule needs a price in at least one currency", () => {
    expect(() => config({ priceRules: [{ days: ["fri"] } as ScheduleConfig["priceRules"][number]] })).toThrow();
  });

  it("knows whether a pitch has its full set of prices in a currency", () => {
    expect(hasPricesIn(config({}), "USD")).toBe(true);
    expect(hasPricesIn(config({}), "LBP")).toBe(false);
    expect(hasPricesIn(config({ defaultPriceLbp: "2000000" }), "LBP")).toBe(true);
    // A rule with no price in pounds leaves the set incomplete.
    expect(hasPricesIn(config({ defaultPriceLbp: "2000000", priceRules: [{ days: ["fri"], priceUsd: "40.00" }] }), "LBP")).toBe(false);
    // A pitch made in an LBP stadium: USD default 0.00 means it was never priced in dollars.
    expect(hasPricesIn(config({ defaultPriceUsd: "0.00", defaultPriceLbp: "2000000" }), "USD")).toBe(false);
  });
});

describe("priceForSlotIn", () => {
  it("uses the default when no rule matches", () => {
    expect(lbpAt(config({ defaultPriceLbp: "2000000" }), SATURDAY, 18)).toBe("2000000");
  });

  it("uses a matching rule", () => {
    const cfg = config({ defaultPriceLbp: "2000000", priceRules: [{ days: ["fri"], priceLbp: "2500000", priceUsd: "40.00" }] });
    expect(lbpAt(cfg, FRIDAY, 18)).toBe("2500000");
    expect(lbpAt(cfg, SATURDAY, 18)).toBe("2000000");
  });

  it("lets the last matching rule win when rules overlap", () => {
    const cfg = config({
      defaultPriceLbp: "2000000",
      priceRules: [
        { days: ["fri"], priceLbp: "2500000" },
        { days: ["fri"], start: "20:00", end: "22:00", priceLbp: "3000000" },
      ],
    });
    expect(lbpAt(cfg, FRIDAY, 18)).toBe("2500000");
    expect(lbpAt(cfg, FRIDAY, 20)).toBe("3000000");
  });

  it("says there is no price in pounds rather than giving a wrong one", () => {
    expect(lbpAt(config({}), FRIDAY, 18)).toBeNull();
    // A matching rule with only a USD price: no LBP price for that slot, not the default.
    const cfg = config({ defaultPriceLbp: "2000000", priceRules: [{ days: ["fri"], priceUsd: "40.00" }] });
    expect(lbpAt(cfg, FRIDAY, 18)).toBeNull();
    expect(lbpAt(cfg, SATURDAY, 18)).toBe("2000000");
    expect(defaultPriceIn(config({}), "LBP")).toBeNull();
    expect(defaultPriceIn(config({ defaultPriceLbp: "2000000" }), "LBP")).toEqual({ currency: "LBP", amount: "2000000" });
  });

  it("gives exactly the dollars priceForSlot gives (the slots' priceUsd)", () => {
    const cfg = config({
      priceRules: [
        { days: ["fri"], priceUsd: "40.00" },
        { days: ["fri"], start: "20:00", end: "22:00", priceUsd: "50.00" },
      ],
    });
    for (const slot of generateSlotsForDay({ config: cfg, localDate: FRIDAY, timeZone: TZ, occupied: [] })) {
      const usd = priceForSlotIn(cfg, "USD", { start: slot.start, localDate: FRIDAY, timeZone: TZ });
      expect([usd.currency, usd.amount?.toFixed(2)]).toEqual(["USD", slot.priceUsd.toFixed(2)]);
    }
  });
});
