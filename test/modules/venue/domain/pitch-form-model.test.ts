import { describe, expect, it } from "@jest/globals";
import {
  generateSlotsForDay,
  addCalendarDays,
  type CivilDate,
} from "@/modules/venue/domain/availability";
import {
  collapseHoursGroups,
  scheduleFromHoursGroups,
  type HoursGroup,
} from "@/modules/venue/domain/daily-schedule";
import {
  crossesMidnight,
  formatClock,
  formatDays,
  formatHoursSummary,
  hoursToRows,
  priceCardsToRules,
  rulesToPriceCards,
  rowsToHours,
  sameHoursEveryDay,
  type PriceRule,
} from "@/modules/venue/domain/pitch-form-model";
import {
  parseScheduleConfig,
  WEEKDAYS,
  type ScheduleConfig,
  type Weekday,
} from "@/modules/venue/schemas/schedule-config";

const group = (days: Weekday[], open: string, close: string): HoursGroup => ({ days, open, close });

describe("hoursToRows / rowsToHours", () => {
  it("gives seven rows, Monday first, closed days keeping the first group's times", () => {
    const rows = hoursToRows([group(["mon", "tue", "wed", "thu"], "16:00", "22:00"), group(["fri", "sat"], "16:00", "23:00")]);
    expect(rows.map((row) => row.day)).toEqual([...WEEKDAYS]);
    expect(rows.map((row) => row.open)).toEqual([true, true, true, true, true, true, false]);
    expect(rows[6]).toEqual({ day: "sun", open: false, from: "16:00", to: "22:00" });
    expect(rows[4]).toEqual({ day: "fri", open: true, from: "16:00", to: "23:00" });
  });

  it("defaults to 4 PM to 11 PM when nothing is open", () => {
    const rows = hoursToRows([]);
    expect(rows.every((row) => !row.open && row.from === "16:00" && row.to === "23:00")).toBe(true);
    expect(rowsToHours(rows)).toEqual([]);
  });

  it("merges days with identical windows, in day order", () => {
    const rows = hoursToRows([group(["mon"], "18:00", "22:00"), group(["tue", "thu"], "16:00", "22:00")]);
    rows[2] = { ...rows[2]!, open: true, from: "18:00", to: "22:00" }; // wed joins mon's window
    expect(rowsToHours(rows)).toEqual([
      group(["mon", "wed"], "18:00", "22:00"),
      group(["tue", "thu"], "16:00", "22:00"),
    ]);
  });

  it("round-trips groups, including a window that crosses midnight", () => {
    const groups = [group(["fri", "sat"], "22:00", "02:00"), group(["sun"], "10:00", "12:00")];
    expect(rowsToHours(hoursToRows(groups))).toEqual([
      group(["fri", "sat"], "22:00", "02:00"),
      group(["sun"], "10:00", "12:00"),
    ]);
  });

  it("copies the first open day to every day", () => {
    const rows = hoursToRows([group(["tue"], "18:00", "23:30")]);
    const same = sameHoursEveryDay(rows);
    expect(same.every((row) => row.open && row.from === "18:00" && row.to === "23:30")).toBe(true);
    expect(rowsToHours(same)).toEqual([group([...WEEKDAYS], "18:00", "23:30")]);
  });

  it.each([
    ["22:00", "02:00", true],
    ["16:00", "16:00", true],
    ["16:00", "23:00", false],
  ])("crossesMidnight(%s, %s) is %s", (from, to, expected) => {
    expect(crossesMidnight(from, to)).toBe(expected);
  });
});

describe("rulesToPriceCards / priceCardsToRules", () => {
  it("drops from an earlier rule the days a later all-day rule covers (last wins)", () => {
    const { cards, timed } = rulesToPriceCards([
      { days: ["fri", "sat"], priceUsd: "40.00" },
      { days: ["sat", "sun"], priceUsd: "50.00" },
    ]);
    expect(cards).toEqual([
      { days: ["fri"], priceUsd: "40.00" },
      { days: ["sat", "sun"], priceUsd: "50.00" },
    ]);
    expect(timed).toEqual([]);
  });

  it("removes a rule that a later rule fully overrides", () => {
    const { cards } = rulesToPriceCards([
      { days: ["fri"], priceUsd: "40.00" },
      { days: ["fri", "sat"], priceUsd: "50.00" },
    ]);
    expect(cards).toEqual([{ days: ["fri", "sat"], priceUsd: "50.00" }]);
  });

  it("keeps rules with a time range aside, in place, untouched", () => {
    const evening: PriceRule = { days: ["fri"], priceUsd: "60.00", start: "20:00", end: "23:00" };
    const rules: PriceRule[] = [{ days: ["fri"], priceUsd: "40.00" }, evening, { days: ["sun"], priceUsd: "30.00" }];
    const { cards, timed } = rulesToPriceCards(rules);
    expect(cards).toHaveLength(2);
    expect(timed).toEqual([{ rule: evening, at: 1 }]);
    expect(priceCardsToRules(cards, timed)).toEqual(rules);
  });

  it("puts timed rules back by position even after a card is removed", () => {
    const evening: PriceRule = { days: ["fri"], priceUsd: "60.00", start: "20:00", end: "23:00" };
    const out = priceCardsToRules([{ days: ["sun"], priceUsd: "30.00" }], [{ rule: evening, at: 5 }]);
    expect(out).toEqual([{ days: ["sun"], priceUsd: "30.00" }, evening]);
  });
});

describe("formatClock / formatDays / formatHoursSummary", () => {
  it.each([
    ["16:00", "h12", "en", "4:00 PM"],
    ["00:30", "h12", "en", "12:30 AM"],
    ["12:00", "h12", "en", "12:00 PM"],
    ["16:00", "h12", "ar", "4:00 م"],
    ["09:05", "h12", "ar", "9:05 ص"],
    ["16:00", "h23", "en", "16:00"],
    ["09:05", "h23", "ar", "09:05"],
  ] as const)("%s %s %s -> %s", (hhmm, cycle, locale, expected) => {
    expect(formatClock(hhmm, cycle, locale)).toBe(expected);
  });

  it("compresses consecutive days and says every day", () => {
    expect(formatDays(["mon", "tue", "wed", "thu"], "en")).toBe("Mon–Thu");
    expect(formatDays(["fri", "sat"], "en")).toBe("Fri–Sat");
    expect(formatDays(["mon", "wed", "thu", "sun"], "en")).toBe("Mon, Wed–Thu, Sun");
    expect(formatDays([...WEEKDAYS], "en")).toBe("Every day");
    expect(formatDays([...WEEKDAYS], "ar")).toBe("كل يوم");
    expect(formatDays(["fri", "sat"], "ar")).toBe("جمعة–سبت");
  });

  it("writes the whole pitch on one line", () => {
    const rows = hoursToRows([group(["mon", "tue", "wed", "thu"], "16:00", "22:00"), group(["fri", "sat"], "16:00", "23:00")]);
    expect(formatHoursSummary(rows, "en")).toBe("Mon–Thu 4:00–10:00 PM · Fri–Sat until 11:00 PM · Sun closed");
    expect(formatHoursSummary(rows, "ar")).toBe("إثنين–خميس 4:00–10:00 م · جمعة–سبت حتى 11:00 م · أحد مغلق");
    expect(formatHoursSummary(rows, "en", "h23")).toBe("Mon–Thu 16:00–22:00 · Fri–Sat until 23:00 · Sun closed");
  });

  it("handles every day, nothing open and a window that closes after midnight", () => {
    expect(formatHoursSummary(hoursToRows([group([...WEEKDAYS], "16:00", "22:00")]), "en")).toBe("Every day 4:00–10:00 PM");
    expect(formatHoursSummary(hoursToRows([]), "en")).toBe("Closed every day.");
    expect(formatHoursSummary(hoursToRows([group(["fri"], "22:00", "02:00")]), "en")).toBe(
      "Fri 10:00 PM–2:00 AM · Mon–Thu, Sat–Sun closed",
    );
  });
});

// ---------------------------------------------------------------------------
// Property test: converting a config to the editor's model and back changes nothing the
// engine computes.

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clock = (minutes: number) => {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

function randomConfig(random: () => number): ScheduleConfig {
  const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  const pick = <T,>(items: readonly T[]): T => items[int(0, items.length - 1)]!;
  const price = () => `${int(5, 80)}.${pick(["00", "50", "25"])}`;

  const hours: ScheduleConfig["hours"] = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
  let previous: { start: string; end: string } | null = null;
  for (const day of WEEKDAYS) {
    if (random() < 0.35) continue;
    if (previous && random() < 0.4) {
      hours[day] = [previous];
      continue;
    }
    const start = int(6 * 4, 23 * 4 + 3) * 15; // 06:00 to 23:45
    const length = int(8, 36) * 15; // 2h to 9h
    previous = { start: clock(start), end: clock(start + length) };
    hours[day] = [previous];
  }

  const priceRules: ScheduleConfig["priceRules"] = [];
  for (let i = int(0, 5); i > 0; i -= 1) {
    const days = WEEKDAYS.filter(() => random() < 0.4);
    if (days.length === 0) days.push(pick(WEEKDAYS));
    if (random() < 0.25) {
      const start = int(0, 95) * 15;
      priceRules.push({ days, priceUsd: price(), start: clock(start), end: clock(start + int(2, 24) * 15) });
    } else {
      priceRules.push({ days, priceUsd: price() });
    }
  }

  return parseScheduleConfig({
    slotDurationMinutes: pick([30, 45, 60, 90, 120]),
    gapMinutes: 0,
    hours,
    defaultPriceUsd: price(),
    priceRules,
  });
}

function throughTheEditor(config: ScheduleConfig): ScheduleConfig {
  const { groups } = collapseHoursGroups(config.hours);
  const rows = hoursToRows(groups);
  const { cards, timed } = rulesToPriceCards(config.priceRules);
  return scheduleFromHoursGroups({
    groups: rowsToHours(rows),
    slotDurationMinutes: config.slotDurationMinutes,
    defaultPriceUsd: config.defaultPriceUsd,
    priceRules: priceCardsToRules(cards, timed),
  });
}

function week(config: ScheduleConfig, start: CivilDate) {
  const out: string[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const slots = generateSlotsForDay({
      config,
      localDate: addCalendarDays(start, offset),
      timeZone: "Asia/Beirut",
      occupied: [],
    });
    for (const slot of slots) out.push(`${slot.start.toISOString()}|${slot.end.toISOString()}|${slot.priceUsd.toFixed(2)}`);
  }
  return out;
}

describe("round trip through the editor model", () => {
  const random = mulberry32(20261008);
  const configs = Array.from({ length: 500 }, () => randomConfig(random));

  it("keeps every slot and price identical on 500 generated configs, including midnight windows and overlapping rules", () => {
    // A normal week, plus one that holds the spring-forward night (29 Mar 2026).
    const weeks: CivilDate[] = [
      { year: 2026, month: 9, day: 7 },
      { year: 2026, month: 3, day: 23 },
    ];
    let crossing = 0;
    let overlapping = 0;
    for (const config of configs) {
      const back = throughTheEditor(config);
      // Slots every 15 minutes check availability and price at every 15-minute time.
      const fine = { ...config, slotDurationMinutes: 15 };
      const fineBack = { ...back, slotDurationMinutes: 15 };
      for (const start of weeks) {
        expect(week(back, start)).toEqual(week(config, start));
        expect(week(fineBack, start)).toEqual(week(fine, start));
      }
      if (Object.values(config.hours).some((windows) => windows.some((w) => w.end <= w.start))) crossing += 1;
      const seen = new Set<string>();
      if (config.priceRules.some((rule) => rule.days.some((day) => (seen.has(day) ? true : (seen.add(day), false))))) {
        overlapping += 1;
      }
    }
    expect(crossing).toBeGreaterThan(50);
    expect(overlapping).toBeGreaterThan(50);
  });

  it("produces day cards where no day is in two cards", () => {
    for (const config of configs) {
      const { cards } = rulesToPriceCards(config.priceRules);
      const days = cards.flatMap((card) => card.days);
      expect(new Set(days).size).toBe(days.length);
    }
  });
});
