import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import { businessDate } from "@/modules/booking/domain/business-day";
import { getDayAvailability } from "@/modules/venue/application/get-day-availability";
import {
  addCalendarDays,
  civilDateInTimeZone,
  localTimeToUtc,
  type CivilDate,
} from "@/modules/venue/domain/availability";
import {
  CLOSED_WEEK_SCHEDULE,
  parseScheduleConfig,
} from "@/modules/venue/domain/schedule-config";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Public page and owner Book page: their default day is the business date
 * (`businessDate(now)`, 06:00 rollover), and a started slot is never offered.
 * This drives the same calls the pages make, with an injected `now`.
 */
const TIME_ZONE = "Asia/Beirut";

let fixture: TestFixture;

describe("slot pages before and after 06:00", () => {
  let friday: CivilDate;
  let saturday: CivilDate;

  beforeEach(async () => {
    await truncateAll();
    clearRequestStubs();
    fixture = await seedMinimalFixture();
    setTenantSlug(fixture.tenantSlug);
    setSessionCookie(fixture.sessionId);
    friday = nextFriday();
    saturday = addCalendarDays(friday, 1);
    // Friday night 22:00–02:00, Saturday evening 16:00–18:00.
    await platformDb.pitch.update({
      where: { id: fixture.pitchId },
      data: {
        scheduleConfig: parseScheduleConfig({
          ...CLOSED_WEEK_SCHEDULE,
          slotDurationMinutes: 60,
          gapMinutes: 0,
          defaultPriceUsd: "30.00",
          priceRules: [],
          hours: {
            ...CLOSED_WEEK_SCHEDULE.hours,
            fri: [{ start: "22:00", end: "02:00" }],
            sat: [{ start: "16:00", end: "18:00" }],
          },
        }),
      },
    });
  });

  afterAll(async () => {
    await truncateAll();
    await finishIntegrationFile();
  });

  it("at 00:30 Saturday opens on Friday and offers only the 01:00 slot still ahead", async () => {
    const now = localTimeToUtc(saturday, 0, 30, TIME_ZONE);
    const today = businessDate(now, 6, TIME_ZONE);
    expect(today).toEqual(friday);

    const slots = await slotsOn(today, now, today);
    expect(slots.clocks).toEqual(["01:00"]);
    expect(slots.emptyKind).toBeNull();

    // The next chip (Saturday) still shows Saturday's own evening.
    expect((await slotsOn(saturday, now, today)).clocks).toEqual(["16:00", "17:00"]);
  });

  it("at 02:30 Saturday Friday is still Today, with hours ended (not a past day)", async () => {
    const now = localTimeToUtc(saturday, 2, 30, TIME_ZONE);
    const today = businessDate(now, 6, TIME_ZONE);
    expect(today).toEqual(friday);
    const slots = await slotsOn(today, now, today);
    expect(slots.clocks).toEqual([]);
    expect(slots.emptyKind).toBe("hoursEnded");
  });

  it("at 06:30 Saturday opens on Saturday; Friday is a past day with nothing offered", async () => {
    const now = localTimeToUtc(saturday, 6, 30, TIME_ZONE);
    const today = businessDate(now, 6, TIME_ZONE);
    expect(today).toEqual(saturday);

    expect((await slotsOn(today, now, today)).clocks).toEqual(["16:00", "17:00"]);
    const fridaySlots = await slotsOn(friday, now, today);
    expect(fridaySlots.clocks).toEqual([]);
    expect(fridaySlots.emptyKind).toBe("past");
  });
});

async function slotsOn(localDate: CivilDate, now: Date, today: CivilDate) {
  const [pitch] = await getDayAvailability({
    localDate,
    timeZone: TIME_ZONE,
    now,
    today,
    occupied: [],
    hourCycle: "h23",
    locale: "en",
  });
  if (!pitch) throw new Error("expected one pitch");
  return { clocks: pitch.slots.map((slot) => slot.startLocal), emptyKind: pitch.emptyKind };
}

function nextFriday(): CivilDate {
  let day = addCalendarDays(civilDateInTimeZone(new Date(), TIME_ZONE), 2);
  while (new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay() !== 5) {
    day = addCalendarDays(day, 1);
  }
  return day;
}
