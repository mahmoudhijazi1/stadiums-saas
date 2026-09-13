import { describe, expect, it } from "@jest/globals";
import {
  bookingFitsOpenHours,
  generateSlotsForDay,
} from "@/modules/venue/domain/availability";
import {
  classifyHoursConflicts,
  hoursSaveBlocker,
} from "@/modules/venue/domain/hours-cover";
import { scheduleFromDailyWindow } from "@/modules/venue/domain/daily-schedule";

const BEIRUT = "Asia/Beirut";
const WED = { year: 2026, month: 9, day: 9 };

function wide() {
  return scheduleFromDailyWindow({
    open: "16:00",
    close: "22:00",
    slotDurationMinutes: 60,
    defaultPriceUsd: "30.00",
  });
}

function shortEvening() {
  return scheduleFromDailyWindow({
    open: "16:00",
    close: "18:00",
    slotDurationMinutes: 60,
    defaultPriceUsd: "30.00",
  });
}

describe("classifyHoursConflicts", () => {
  it("refuses a live APPROVED game outside the new hours", () => {
    const slots = generateSlotsForDay({
      config: wide(),
      localDate: WED,
      timeZone: BEIRUT,
      occupied: [],
    });
    const late = slots.find((slot) => {
      const hour = slot.start.toLocaleString("en-GB", {
        timeZone: BEIRUT,
        hour: "2-digit",
        hourCycle: "h23",
      });
      return hour === "20";
    });
    expect(late).toBeDefined();
    const now = new Date("2026-09-01T00:00:00.000Z");
    const result = classifyHoursConflicts(
      shortEvening(),
      [{ start: late!.start, end: late!.end, status: "APPROVED" }],
      BEIRUT,
      now,
    );
    expect(result.approvedBlocking).toBe(true);
    expect(bookingFitsOpenHours(wide(), late!, BEIRUT)).toBe(true);
    expect(bookingFitsOpenHours(shortEvening(), late!, BEIRUT)).toBe(false);
  });

  it("warns on live PENDING in a removed window, ignores finished APPROVED", () => {
    const slots = generateSlotsForDay({
      config: wide(),
      localDate: WED,
      timeZone: BEIRUT,
      occupied: [],
    });
    const late = slots.at(-1)!;
    const now = new Date("2026-09-01T00:00:00.000Z");
    const pending = classifyHoursConflicts(
      shortEvening(),
      [{ start: late.start, end: late.end, status: "PENDING" }],
      BEIRUT,
      now,
    );
    expect(pending).toEqual({ approvedBlocking: false, pendingWarning: true });

    const past = classifyHoursConflicts(
      shortEvening(),
      [{ start: late.start, end: late.end, status: "APPROVED" }],
      BEIRUT,
      new Date("2026-09-20T00:00:00.000Z"),
    );
    expect(past).toEqual({ approvedBlocking: false, pendingWarning: false });
  });

  it("allows a duration-only change when hours still cover the old range", () => {
    const slots = generateSlotsForDay({
      config: wide(),
      localDate: WED,
      timeZone: BEIRUT,
      occupied: [],
    });
    const first = slots[0]!;
    const ninety = scheduleFromDailyWindow({
      open: "16:00",
      close: "22:00",
      slotDurationMinutes: 90,
      defaultPriceUsd: "30.00",
    });
    const now = new Date("2026-09-01T00:00:00.000Z");
    expect(
      classifyHoursConflicts(
        ninety,
        [{ start: first.start, end: first.end, status: "APPROVED" }],
        BEIRUT,
        now,
      ),
    ).toEqual({ approvedBlocking: false, pendingWarning: false });
    const nextSlots = generateSlotsForDay({
      config: ninety,
      localDate: WED,
      timeZone: BEIRUT,
      occupied: [],
    });
    expect(nextSlots[0]!.end.getTime() - nextSlots[0]!.start.getTime()).toBe(
      90 * 60_000,
    );
    expect(first.end.getTime() - first.start.getTime()).toBe(60 * 60_000);
  });
});

describe("hoursSaveBlocker", () => {
  it("refuses approved overlap before any confirm", () => {
    expect(
      hoursSaveBlocker({
        approvedBlocking: true,
        pendingWarning: true,
        confirmPending: true,
      }),
    ).toBe("venue.hours_approved");
  });

  it("warns on pending-only", () => {
    expect(
      hoursSaveBlocker({
        approvedBlocking: false,
        pendingWarning: true,
        confirmPending: false,
      }),
    ).toBe("venue.hours_pending");
  });

  it("allows save when pending is confirmed", () => {
    expect(
      hoursSaveBlocker({
        approvedBlocking: false,
        pendingWarning: true,
        confirmPending: true,
      }),
    ).toBeNull();
  });
});
