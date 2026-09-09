import { describe, expect, it } from "@jest/globals";
import { generateSlotsForDay } from "@/modules/venue/domain/availability";
import {
  CLOSED_WEEK_SCHEDULE,
  parseScheduleConfig,
  type ScheduleConfig,
  type Weekday,
} from "@/modules/venue/schemas/schedule-config";

const BEIRUT = "Asia/Beirut";
/** Wednesday 9 Sep 2026 */
const WED = { year: 2026, month: 9, day: 9 };
/** Friday 11 Sep 2026 */
const FRI = { year: 2026, month: 9, day: 11 };
/** Saturday 12 Sep 2026 */
const SAT = { year: 2026, month: 9, day: 12 };

function configOn(
  day: Weekday,
  window: { start: string; end: string },
  extra: Partial<ScheduleConfig> = {},
): ScheduleConfig {
  return parseScheduleConfig({
    ...CLOSED_WEEK_SCHEDULE,
    defaultPriceUsd: "30.00",
    ...extra,
    hours: { ...CLOSED_WEEK_SCHEDULE.hours, [day]: [window] },
  });
}

function beirutStamp(instant: Date): { ymd: string; hm: string } {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: BEIRUT,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(instant)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  let hour = map.hour ?? "00";
  if (hour === "24") hour = "00";
  return {
    ymd: `${map.year}-${map.month}-${map.day}`,
    hm: `${hour}:${map.minute}`,
  };
}

function generate(config: ScheduleConfig, localDate = WED, occupied: { start: Date; end: Date }[] = []) {
  return generateSlotsForDay({
    config,
    localDate,
    timeZone: BEIRUT,
    occupied,
  });
}

describe("generateSlotsForDay", () => {
  it("returns no slots on a closed weekday", () => {
    expect(generate(CLOSED_WEEK_SCHEDULE, WED)).toEqual([]);
  });

  it("emits every full 60-minute game in 16:00–22:00 (six slots, not a truncated last game)", () => {
    // SPEC table said "four slots"; 16:00–22:00 is six hours. The rule wins: full games only.
    const slots = generate(configOn("wed", { start: "16:00", end: "22:00" }));
    expect(slots.map((s) => beirutStamp(s.start).hm)).toEqual([
      "16:00",
      "17:00",
      "18:00",
      "19:00",
      "20:00",
      "21:00",
    ]);
    expect(beirutStamp(slots[5]!.end).hm).toBe("22:00");
    expect(slots.every((s) => s.available)).toBe(true);
    expect(slots.every((s) => s.priceUsd.toFixed(2) === "30.00")).toBe(true);
  });

  it("does not emit a leftover shorter than 90 minutes", () => {
    const slots = generate(
      configOn("wed", { start: "16:00", end: "19:30" }, { slotDurationMinutes: 90 }),
    );
    expect(slots.map((s) => beirutStamp(s.start).hm)).toEqual(["16:00", "17:30"]);
    expect(beirutStamp(slots[1]!.end).hm).toBe("19:00");
  });

  it("shifts the next start by gapMinutes", () => {
    const slots = generate(
      configOn("wed", { start: "16:00", end: "20:00" }, { gapMinutes: 15 }),
    );
    expect(slots.map((s) => beirutStamp(s.start).hm)).toEqual([
      "16:00",
      "17:15",
      "18:30",
    ]);
  });

  it("applies a weekend price rule (last match wins over default)", () => {
    const config = configOn("sat", { start: "16:00", end: "18:00" }, {
      defaultPriceUsd: "30.00",
      priceRules: [{ days: ["sat"], priceUsd: "40.00" }],
    });
    const saturday = generate(config, SAT);
    expect(saturday).toHaveLength(2);
    expect(saturday.every((s) => s.priceUsd.toFixed(2) === "40.00")).toBe(true);

    const weekday = generate(
      configOn("wed", { start: "16:00", end: "18:00" }, {
        defaultPriceUsd: "30.00",
        priceRules: [{ days: ["sat"], priceUsd: "40.00" }],
      }),
      WED,
    );
    expect(weekday.every((s) => s.priceUsd.toFixed(2) === "30.00")).toBe(true);
  });

  it("applies a time-window price rule after 20:00 (last match wins)", () => {
    const config = configOn("fri", { start: "16:00", end: "23:00" }, {
      defaultPriceUsd: "30.00",
      priceRules: [
        { days: ["fri"], priceUsd: "40.00" },
        { days: ["fri"], start: "20:00", end: "23:00", priceUsd: "50.00" },
      ],
    });
    const slots = generate(config, FRI);
    const byStart = Object.fromEntries(
      slots.map((s) => [beirutStamp(s.start).hm, s.priceUsd.toFixed(2)]),
    );
    expect(byStart["16:00"]).toBe("40.00");
    expect(byStart["19:00"]).toBe("40.00");
    expect(byStart["20:00"]).toBe("50.00");
    expect(byStart["22:00"]).toBe("50.00");
  });

  it("lets a 22:00–02:00 window run past midnight (slots belong to the requested day)", () => {
    const slots = generate(configOn("wed", { start: "22:00", end: "02:00" }));
    expect(slots.map((s) => beirutStamp(s.start).hm)).toEqual([
      "22:00",
      "23:00",
      "00:00",
      "01:00",
    ]);
    expect(beirutStamp(slots[0]!.start).ymd).toBe("2026-09-09");
    // Local morning of the next civil day (Beirut UTC+3 → still 23:00Z on the 9th).
    expect(beirutStamp(slots[3]!.end)).toEqual({ ymd: "2026-09-10", hm: "02:00" });
  });

  it("marks only overlapping occupied ranges unavailable (half-open)", () => {
    const config = configOn("wed", { start: "16:00", end: "19:00" });
    const free = generate(config);
    expect(free).toHaveLength(3);

    const occupiedSlot = free[1]!;
    const overlapping = generate(config, WED, [
      { start: occupiedSlot.start, end: occupiedSlot.end },
    ]);
    expect(overlapping.map((s) => s.available)).toEqual([true, false, true]);

    const adjacent = generate(config, WED, [
      { start: free[0]!.start, end: free[0]!.end },
    ]);
    expect(adjacent.map((s) => s.available)).toEqual([false, true, true]);
    expect(free[0]!.end.getTime()).toBe(free[1]!.start.getTime());
  });
});
