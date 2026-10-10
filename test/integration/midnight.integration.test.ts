import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import db from "@/lib/db";
import { platformDb } from "@/lib/platform-db";
import { approveBooking } from "@/modules/booking/application/approve-booking";
import { loadDecisionNotify } from "@/modules/booking/application/load-decision-notify";
import { createOwnerBooking } from "@/modules/booking/application/create-owner-booking";
import { loadOwnerDay } from "@/modules/booking/application/load-owner-day";
import { requestPublicSlot } from "@/modules/booking/application/request-public-slot";
import {
  insertApprovedOwnerBooking,
  insertRequesterParticipant,
} from "@/modules/booking/infrastructure/bookings";
import { findOrCreatePerson } from "@/modules/people/application/find-or-create-person";
import {
  addCalendarDays,
  civilDateInTimeZone,
  formatCivilDate,
  generateSlotsForDay,
  localTimeToUtc,
  type CivilDate,
} from "@/modules/venue/domain/availability";
import {
  CLOSED_WEEK_SCHEDULE,
  parseScheduleConfig,
  type ScheduleConfig,
  type Weekday,
} from "@/modules/venue/domain/schedule-config";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { assertMoneyInvariants } from "./invariants";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * BR-7: a 22:00–02:00 window offers 00:00 and 01:00 under its own day. Those slots
 * resolve against that window (and its day's price rules), and Today lists them on the
 * same business day (06:00 to 06:00 Beirut, `businessDate`).
 */
const TIME_ZONE = "Asia/Beirut";
const WEEKDAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

let fixture: TestFixture;
let phoneSeq = 0;

describe("midnight-crossing windows", () => {
  beforeEach(async () => {
    await truncateAll();
    clearRequestStubs();
    fixture = await seedMinimalFixture();
    setTenantSlug(fixture.tenantSlug);
    setSessionCookie(fixture.sessionId);
  });

  afterAll(async () => {
    await truncateAll();
    await finishIntegrationFile();
  });

  it("books 00:00 and 01:00 from a 22:00–02:00 window through owner-create", async () => {
    const day = addCalendarDays(civilDateInTimeZone(new Date(), TIME_ZONE), 3);
    const slots = await useOvernightWindow(day);
    const afterMidnight = slots.slice(2);
    expect(afterMidnight.map((slot) => formatCivilDate(civil(slot.start)))).toEqual([
      formatCivilDate(addCalendarDays(day, 1)),
      formatCivilDate(addCalendarDays(day, 1)),
    ]);

    for (const slot of afterMidnight) {
      const { bookingId } = await createOwnerBooking({
        pitchId: fixture.pitchId,
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        name: "ليلي",
        phone: nextPhone(),
      });
      const booking = await platformDb.booking.findUniqueOrThrow({ where: { id: bookingId } });
      expect(booking.status).toBe("APPROVED");
      // The window's weekday rule ($50), not the start's weekday (default $30).
      expect(new Decimal(booking.priceUsd.toString()).equals("50.00")).toBe(true);
    }
    await assertMoneyInvariants([]);
  });

  it("books 00:00 and 01:00 through a public request, then approve", async () => {
    const day = addCalendarDays(civilDateInTimeZone(new Date(), TIME_ZONE), 4);
    const slots = await useOvernightWindow(day);

    for (const slot of slots.slice(2)) {
      const { bookingId } = await requestPublicSlot({
        pitchId: fixture.pitchId,
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        name: "طلب ليلي",
        phone: nextPhone(),
      });
      await approveBooking(bookingId);
      const booking = await platformDb.booking.findUniqueOrThrow({ where: { id: bookingId } });
      expect(booking.status).toBe("APPROVED");
      expect(new Decimal(booking.priceUsd.toString()).equals("50.00")).toBe(true);
    }
  });

  it("lists 00:00 and 01:00 from Friday's window in Friday's Today and day summary, not Saturday's", async () => {
    const friday = nextFriday();
    const slots = await useOvernightWindow(friday);
    const [midnight, oneAm] = [slots[2]!, slots[3]!];
    const { bookingId: ownerMade } = await createOwnerBooking({
      pitchId: fixture.pitchId,
      start: midnight.start.toISOString(),
      end: midnight.end.toISOString(),
      name: "ليلي",
      phone: nextPhone(),
    });
    const { bookingId: requested } = await requestPublicSlot({
      pitchId: fixture.pitchId,
      start: oneAm.start.toISOString(),
      end: oneAm.end.toISOString(),
      name: "طلب ليلي",
      phone: nextPhone(),
    });
    await approveBooking(requested);

    const fridayDay = await loadOwnerDay(formatCivilDate(friday));
    const saturdayDay = await loadOwnerDay(formatCivilDate(addCalendarDays(friday, 1)));
    expect(fridayDay.games.map((game) => game.id)).toEqual([ownerMade, requested]);
    expect(fridayDay.summary.games).toBe(2);
    expect(fridayDay.summary.expectedUsd.equals("100")).toBe(true);
    expect(saturdayDay.games).toEqual([]);
    expect(saturdayDay.summary.games).toBe(0);

    // Real time stays real: the confirm message has Saturday's date plus the night hint.
    const [confirm] = await loadDecisionNotify({ bookingId: requested, kind: "approved" });
    expect(confirm!.message).toContain("السبت");
    expect(confirm!.message).toContain("ليلة الجمعة");
    await assertMoneyInvariants([]);
  });

  it("puts a 05:59 game on the previous day and a 06:00 game on its own civil day", async () => {
    const friday = nextFriday();
    const saturday = addCalendarDays(friday, 1);
    const at0559 = await insertGame(localTimeToUtc(saturday, 5, 59, TIME_ZONE), 1);
    const at0600 = await insertGame(localTimeToUtc(saturday, 6, 0, TIME_ZONE));

    const fridayDay = await loadOwnerDay(formatCivilDate(friday));
    const saturdayDay = await loadOwnerDay(formatCivilDate(saturday));
    expect(fridayDay.games.map((game) => game.id)).toEqual([at0559]);
    expect(saturdayDay.games.map((game) => game.id)).toEqual([at0600]);
  });

  it("opens Today on the previous business day before 06:00 and on the calendar day from 06:00", async () => {
    const friday = nextFriday();
    const saturday = addCalendarDays(friday, 1);
    const nightGame = await insertGame(localTimeToUtc(saturday, 1, 0, TIME_ZONE));

    const at0500 = await loadOwnerDay(undefined, localTimeToUtc(saturday, 5, 0, TIME_ZONE));
    expect(at0500.day).toEqual(friday);
    expect(at0500.isToday).toBe(true);
    expect(at0500.afterMidnight).toBe(true);
    expect(at0500.games.map((game) => game.id)).toEqual([nightGame]);

    const at0600 = await loadOwnerDay(undefined, localTimeToUtc(saturday, 6, 0, TIME_ZONE));
    expect(at0600.day).toEqual(saturday);
    expect(at0600.afterMidnight).toBe(false);
    expect(at0600.games).toEqual([]);
  });

  it("keeps the DST fall-back night on one business day, rolling over at 06:00 local", async () => {
    // Beirut 2025-10-26 00:00 EEST → 2025-10-25 23:00 EET: Saturday has 25 hours.
    const first2300 = await insertGame(new Date("2025-10-25T20:00:00.000Z")); // 23:00 EEST
    const second2300 = await insertGame(new Date("2025-10-25T21:00:00.000Z")); // 23:00 EET
    const sundayMidnight = await insertGame(new Date("2025-10-25T22:00:00.000Z")); // Sun 00:00 EET
    const sunday0600 = await insertGame(new Date("2025-10-26T04:00:00.000Z")); // Sun 06:00 EET

    const saturday = await loadOwnerDay("2025-10-25");
    const sunday = await loadOwnerDay("2025-10-26");
    expect(saturday.games.map((game) => game.id)).toEqual([
      first2300,
      second2300,
      sundayMidnight,
    ]);
    expect(sunday.games.map((game) => game.id)).toEqual([sunday0600]);
    expect(saturday.summary.games).toBe(3);
    expect(sunday.summary.games).toBe(1);
  });
});

/** The first Friday at least two days ahead, so every slot is still in the future. */
function nextFriday(): CivilDate {
  let day = addCalendarDays(civilDateInTimeZone(new Date(), TIME_ZONE), 2);
  while (new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay() !== 5) {
    day = addCalendarDays(day, 1);
  }
  return day;
}

function civil(instant: Date): CivilDate {
  return civilDateInTimeZone(instant, TIME_ZONE);
}

function nextPhone(): string {
  phoneSeq += 1;
  return `03${String(800000 + phoneSeq)}`;
}

/**
 * Pitch open 22:00–02:00 only on `day`'s weekday, with a $50 rule on that weekday.
 * The next day is closed, so a 00:00 slot can only come from `day`'s window.
 */
async function useOvernightWindow(day: CivilDate) {
  const weekday = WEEKDAYS[new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay()]!;
  const config: ScheduleConfig = parseScheduleConfig({
    ...CLOSED_WEEK_SCHEDULE,
    slotDurationMinutes: 60,
    gapMinutes: 0,
    defaultPriceUsd: "30.00",
    priceRules: [{ days: [weekday], priceUsd: "50.00" }],
    hours: { ...CLOSED_WEEK_SCHEDULE.hours, [weekday]: [{ start: "22:00", end: "02:00" }] },
  });
  await platformDb.pitch.update({
    where: { id: fixture.pitchId },
    data: { scheduleConfig: config },
  });
  const slots = generateSlotsForDay({ config, localDate: day, timeZone: TIME_ZONE, occupied: [] });
  expect(slots).toHaveLength(4);
  return slots;
}

/** Past games cannot go through owner-create (slot_ended); insert them directly. */
async function insertGame(start: Date, minutes = 60): Promise<string> {
  const end = new Date(start.getTime() + minutes * 60 * 1000);
  return db.$transaction(async (tx) => {
    const person = await findOrCreatePerson(tx, { name: "تغيير الساعة", phone: nextPhone() });
    const id = await insertApprovedOwnerBooking(tx, {
      pitchId: fixture.pitchId,
      start,
      end,
      priceUsd: new Decimal("30.00"),
    });
    await insertRequesterParticipant(tx, {
      bookingId: id,
      personId: person.id,
      amountDueUsd: new Decimal("30.00"),
    });
    return id;
  });
}
