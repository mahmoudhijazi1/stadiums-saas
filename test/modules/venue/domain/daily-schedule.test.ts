import { describe, expect, it } from "@jest/globals";
import {
  assertUniqueHoursDays,
  collapseHoursGroups,
  scheduleFromDailyWindow,
  scheduleFromHoursGroups,
  type HoursGroup,
} from "@/modules/venue/domain/daily-schedule";
import { hoursSaveBlocker } from "@/modules/venue/domain/hours-cover";
import {
  CLOSED_WEEK_SCHEDULE,
  parseScheduleConfig,
} from "@/modules/venue/schemas/schedule-config";
import { DomainError } from "@/lib/errors";

const WEEKEND = [{ days: ["fri" as const, "sat" as const], priceUsd: "40.00" }];
const EVENING = [{ start: "16:00", end: "22:00" }];
const LONG = [{ start: "16:00", end: "23:00" }];

describe("collapseHoursGroups", () => {
  it("collapses Ahmad A1 into two rows and Sun closed", () => {
    const config = parseScheduleConfig({
      ...CLOSED_WEEK_SCHEDULE,
      defaultPriceUsd: "30.00",
      hours: {
        ...CLOSED_WEEK_SCHEDULE.hours,
        mon: EVENING,
        tue: EVENING,
        wed: EVENING,
        thu: EVENING,
        fri: LONG,
        sat: LONG,
      },
      priceRules: WEEKEND,
    });
    const { groups, closed } = collapseHoursGroups(config.hours);
    expect(groups).toEqual([
      {
        days: ["mon", "tue", "wed", "thu"],
        open: "16:00",
        close: "22:00",
      },
      { days: ["fri", "sat"], open: "16:00", close: "23:00" },
    ]);
    expect(closed).toEqual(["sun"]);

    const roundTrip = scheduleFromHoursGroups({
      groups,
      slotDurationMinutes: config.slotDurationMinutes,
      defaultPriceUsd: config.defaultPriceUsd,
      priceRules: config.priceRules,
    });
    expect(roundTrip.hours).toEqual(config.hours);
    expect(roundTrip.priceRules).toEqual(WEEKEND);
    expect(roundTrip.gapMinutes).toBe(0);
  });

  it("uses window[0] when a day has two windows", () => {
    const { groups, closed } = collapseHoursGroups({
      ...CLOSED_WEEK_SCHEDULE.hours,
      mon: [
        { start: "10:00", end: "12:00" },
        { start: "16:00", end: "18:00" },
      ],
    });
    expect(groups).toEqual([
      { days: ["mon"], open: "10:00", close: "12:00" },
    ]);
    expect(closed).toEqual(["tue", "wed", "thu", "fri", "sat", "sun"]);
  });
});

describe("scheduleFromHoursGroups", () => {
  it("leaves unlisted days closed and keeps priceRules", () => {
    const config = scheduleFromHoursGroups({
      groups: [
        {
          days: ["mon", "tue", "wed", "thu"],
          open: "16:00",
          close: "22:00",
        },
      ],
      slotDurationMinutes: 90,
      defaultPriceUsd: "35",
      priceRules: WEEKEND,
    });
    expect(config.hours.fri).toEqual([]);
    expect(config.hours.sun).toEqual([]);
    expect(config.hours.mon).toEqual([{ start: "16:00", end: "22:00" }]);
    expect(config.priceRules).toEqual(WEEKEND);
    expect(config.gapMinutes).toBe(0);
  });

  it("refuses a day in two groups", () => {
    expect(() =>
      assertUniqueHoursDays([
        { days: ["fri", "sat"], open: "16:00", close: "22:00" },
        { days: ["fri"], open: "16:00", close: "23:00" },
      ]),
    ).toThrow(new DomainError("venue.hours_day_overlap"));
  });
});

describe("price/duration-only save", () => {
  it("preserves priceRules and hours groups when hours are unchanged", () => {
    const groups: HoursGroup[] = [
      {
        days: ["mon", "tue", "wed", "thu"],
        open: "16:00",
        close: "22:00",
      },
      { days: ["fri", "sat"], open: "16:00", close: "23:00" },
    ];
    const current = scheduleFromHoursGroups({
      groups: [...groups],
      slotDurationMinutes: 60,
      defaultPriceUsd: "30.00",
      priceRules: WEEKEND,
    });
    const next = scheduleFromHoursGroups({
      groups: [...groups],
      slotDurationMinutes: 90,
      defaultPriceUsd: "35.00",
      priceRules: current.priceRules,
    });
    expect(next.hours).toEqual(current.hours);
    expect(next.priceRules).toEqual(WEEKEND);
    expect(next.slotDurationMinutes).toBe(90);
    expect(
      hoursSaveBlocker({
        approvedBlocking: false,
        pendingWarning: false,
        confirmPending: false,
      }),
    ).toBeNull();
  });
});

describe("scheduleFromDailyWindow", () => {
  it("still copies one window to all seven days for tests", () => {
    const config = scheduleFromDailyWindow({
      open: "16:00",
      close: "22:00",
      slotDurationMinutes: 60,
      defaultPriceUsd: "30",
    });
    expect(config.hours.sun).toEqual([{ start: "16:00", end: "22:00" }]);
    expect(config.hours.fri).toEqual(config.hours.mon);
  });
});
