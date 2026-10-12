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
import { parseScheduleConfig } from "@/modules/venue/domain/schedule-config";
import type { TestFixture } from "./fixtures";

/** Bookings for the shop-on-a-game suites: a game in the future, and one that ended. */
const TIME_ZONE = "Asia/Beirut";
let phoneSeq = 0;

export function nextPhone(): string {
  phoneSeq += 1;
  return `9613${String(700000 + phoneSeq)}`;
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

/**
 * An APPROVED $30 game of the same length that starts `minutes` from now (a negative number is a
 * game that already began). Items open 60 minutes before the start, so the shop suites use this
 * instead of `futureBooking`. Only `during` is moved, by raw SQL; if another game of the pitch is in
 * the way, the game steps 90 minutes earlier until it is free (still open, since it is in the past).
 */
export async function bookingStartingIn(fixture: TestFixture, minutes: number, name = "Booker"): Promise<string> {
  const bookingId = await futureBooking(fixture, 30, name);
  for (let step = 0; step < 24; step += 1) {
    const start = new Date(Date.now() + (minutes - step * 90) * 60_000);
    const [{ clash }] = await platformDb.$queryRaw<{ clash: bigint }[]>`
      SELECT count(*) AS clash FROM "Booking" b, "Booking" me
      WHERE me.id = ${bookingId} AND b.id <> me.id AND b."pitchId" = me."pitchId"
        AND b.during && tstzrange(${start}::timestamptz, ${start}::timestamptz + (upper(me.during) - lower(me.during)), '[)')`;
    if (clash === BigInt(0)) {
      await platformDb.$executeRaw`
        UPDATE "Booking" SET during = tstzrange(${start}::timestamptz, ${start}::timestamptz + (upper(during) - lower(during)), '[)')
        WHERE id = ${bookingId}`;
      return bookingId;
    }
  }
  throw new Error("no free time for the booking near now");
}

/** A game whose items are open (it starts in 30 minutes). */
export function soonBooking(fixture: TestFixture, name = "Booker"): Promise<string> {
  return bookingStartingIn(fixture, 30, name);
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
