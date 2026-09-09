import { describe, expect, it } from "@jest/globals";
import { overlaps, resolveOfferedSlot } from "@/modules/booking/domain/offered-slot";
import { generateSlotsForDay } from "@/modules/venue/domain/availability";
import {
  CLOSED_WEEK_SCHEDULE,
  parseScheduleConfig,
  type ScheduleConfig,
} from "@/modules/venue/schemas/schedule-config";

const BEIRUT = "Asia/Beirut";
const WED = { year: 2026, month: 9, day: 9 };

const evening: ScheduleConfig = parseScheduleConfig({
  ...CLOSED_WEEK_SCHEDULE,
  defaultPriceUsd: "30.00",
  hours: { ...CLOSED_WEEK_SCHEDULE.hours, wed: [{ start: "16:00", end: "22:00" }] },
});

function firstWedSlot() {
  const slots = generateSlotsForDay({
    config: evening,
    localDate: WED,
    timeZone: BEIRUT,
    occupied: [],
  });
  const slot = slots[0];
  if (!slot) throw new Error("expected a Wednesday slot");
  return slot;
}

describe("resolveOfferedSlot", () => {
  it("fails on a closed day", () => {
    const start = new Date("2026-09-09T13:00:00.000Z");
    const end = new Date("2026-09-09T14:00:00.000Z");
    expect(() =>
      resolveOfferedSlot({
        config: CLOSED_WEEK_SCHEDULE,
        localDate: WED,
        timeZone: BEIRUT,
        start,
        end,
        now: new Date("2026-09-09T10:00:00.000Z"),
      }),
    ).toThrow("Slot is not offered");
  });

  it("fails when the window is not a generated slot", () => {
    const slot = firstWedSlot();
    expect(() =>
      resolveOfferedSlot({
        config: evening,
        localDate: WED,
        timeZone: BEIRUT,
        start: slot.start,
        end: new Date(slot.end.getTime() + 60_000),
        now: new Date(slot.start.getTime() - 60_000),
      }),
    ).toThrow("Slot is not offered");
  });

  it("returns the engine price for a real generated slot still in the future", () => {
    const slot = firstWedSlot();
    const matched = resolveOfferedSlot({
      config: evening,
      localDate: WED,
      timeZone: BEIRUT,
      start: slot.start,
      end: slot.end,
      now: new Date(slot.start.getTime() - 60_000),
    });
    expect(matched.start.getTime()).toBe(slot.start.getTime());
    expect(matched.end.getTime()).toBe(slot.end.getTime());
    expect(matched.priceUsd.toFixed(2)).toBe("30.00");
  });

  it("fails when the slot has already ended", () => {
    const slot = firstWedSlot();
    expect(() =>
      resolveOfferedSlot({
        config: evening,
        localDate: WED,
        timeZone: BEIRUT,
        start: slot.start,
        end: slot.end,
        now: slot.end,
      }),
    ).toThrow("Slot has already ended");
  });
});

describe("overlaps", () => {
  it("treats ranges as half-open so adjacent games do not collide", () => {
    const a = {
      start: new Date("2026-09-09T13:00:00.000Z"),
      end: new Date("2026-09-09T14:00:00.000Z"),
    };
    const adjacent = {
      start: new Date("2026-09-09T14:00:00.000Z"),
      end: new Date("2026-09-09T15:00:00.000Z"),
    };
    const overlapping = {
      start: new Date("2026-09-09T13:30:00.000Z"),
      end: new Date("2026-09-09T14:30:00.000Z"),
    };
    expect(overlaps(a, adjacent)).toBe(false);
    expect(overlaps(a, overlapping)).toBe(true);
  });
});
