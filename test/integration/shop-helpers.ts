import Decimal from "decimal.js";
import db from "@/lib/db";
import { platformDb } from "@/lib/platform-db";
import { createOwnerBooking } from "@/modules/booking/application/create-owner-booking";
import {
  insertApprovedOwnerBooking,
  insertRequesterParticipant,
} from "@/modules/booking/infrastructure/bookings";
import { findOrCreatePerson } from "@/modules/people/application/find-or-create-person";
import { addCalendarDays, civilDateInTimeZone, generateSlotsForDay } from "@/modules/venue/domain/availability";
import { parseScheduleConfig } from "@/modules/venue/schemas/schedule-config";
import type { TestFixture } from "./fixtures";

/** Bookings for the shop-on-a-game suites: a game in the future, and one that ended. */
const TIME_ZONE = "Asia/Beirut";
let phoneSeq = 0;

export function nextPhone(): string {
  phoneSeq += 1;
  return `03${String(700000 + phoneSeq)}`;
}

export async function slotOn(fixture: TestFixture, daysAhead: number, index = 0) {
  const pitch = await platformDb.pitch.findUniqueOrThrow({ where: { id: fixture.pitchId } });
  const day = addCalendarDays(civilDateInTimeZone(new Date(), TIME_ZONE), daysAhead);
  const slot = generateSlotsForDay({
    config: parseScheduleConfig(pitch.scheduleConfig),
    localDate: day,
    timeZone: TIME_ZONE,
    occupied: [],
  })[index];
  if (!slot) throw new Error(`no slot ${index} on day offset ${daysAhead}`);
  return slot;
}

/** An APPROVED $30 owner booking `daysAhead` days from now, booked for a new person. */
export async function futureBooking(fixture: TestFixture, daysAhead: number, name = "Booker"): Promise<string> {
  const slot = await slotOn(fixture, daysAhead);
  const { bookingId } = await createOwnerBooking({
    pitchId: fixture.pitchId,
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
    name,
    phone: nextPhone(),
  });
  return bookingId;
}

/** An APPROVED $30 game that ended `daysAgo` days ago, booked for `name` (a person with `phone`). */
export async function endedGame(
  fixture: TestFixture,
  daysAgo: number,
  name = "Booker",
  phone: string = nextPhone(),
): Promise<{ bookingId: string; personId: string }> {
  const slot = await slotOn(fixture, -daysAgo);
  return db.$transaction(async (tx) => {
    const person = await findOrCreatePerson(tx, { name, phone });
    const bookingId = await insertApprovedOwnerBooking(tx, {
      pitchId: fixture.pitchId,
      start: slot.start,
      end: slot.end,
      priceUsd: new Decimal("30.00"),
    });
    await insertRequesterParticipant(tx, { bookingId, personId: person.id, amountDueUsd: new Decimal("30.00") });
    return { bookingId, personId: person.id };
  });
}

export async function requesterPersonId(bookingId: string): Promise<string> {
  const row = await platformDb.bookingParticipant.findFirstOrThrow({ where: { bookingId, isRequester: true } });
  return row.personId!;
}

export function outcomes(results: PromiseSettledResult<unknown>[]): string[] {
  return results.map((result) =>
    result.status === "fulfilled" ? "ok" : ((result.reason as { key?: string })?.key ?? String(result.reason)),
  );
}
