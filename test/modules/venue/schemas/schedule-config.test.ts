import { describe, expect, it } from "@jest/globals";
import {
  CLOSED_WEEK_SCHEDULE,
  parseScheduleConfig,
} from "@/modules/venue/schemas/schedule-config";

const validConfig = {
  slotDurationMinutes: 60,
  gapMinutes: 0,
  hours: {
    mon: [{ start: "16:00", end: "22:00" }],
    tue: [{ start: "16:00", end: "22:00" }],
    wed: [{ start: "16:00", end: "22:00" }],
    thu: [{ start: "16:00", end: "22:00" }],
    fri: [{ start: "16:00", end: "23:00" }],
    sat: [{ start: "16:00", end: "23:00" }],
    sun: [],
  },
  defaultPriceUsd: "30.00",
  priceRules: [
    { days: ["fri", "sat"] as const, priceUsd: "40.00" },
    {
      days: ["fri", "sat"] as const,
      start: "20:00",
      end: "23:00",
      priceUsd: "50.00",
    },
  ],
};

describe("parseScheduleConfig", () => {
  it("accepts a valid config and round-trips", () => {
    const parsed = parseScheduleConfig(validConfig);
    expect(parsed).toEqual(validConfig);
  });

  it("accepts the closed-week default used by the database", () => {
    expect(parseScheduleConfig(CLOSED_WEEK_SCHEDULE)).toEqual(
      CLOSED_WEEK_SCHEDULE,
    );
  });

  it("rejects a missing weekday key", () => {
    const { sun: _ignored, ...hoursWithoutSun } = validConfig.hours;
    expect(() =>
      parseScheduleConfig({ ...validConfig, hours: hoursWithoutSun }),
    ).toThrow();
  });

  it("rejects a bad HH:mm", () => {
    expect(() =>
      parseScheduleConfig({
        ...validConfig,
        hours: {
          ...validConfig.hours,
          mon: [{ start: "25:00", end: "22:00" }],
        },
      }),
    ).toThrow();
  });

  it('rejects a price without cents ("30")', () => {
    expect(() =>
      parseScheduleConfig({ ...validConfig, defaultPriceUsd: "30" }),
    ).toThrow();
  });

  it("rejects a JSON number price", () => {
    expect(() =>
      parseScheduleConfig({ ...validConfig, defaultPriceUsd: 30 }),
    ).toThrow();
  });

  it("rejects an unknown extra key", () => {
    expect(() =>
      parseScheduleConfig({ ...validConfig, capacity: 1 }),
    ).toThrow();
  });
});
