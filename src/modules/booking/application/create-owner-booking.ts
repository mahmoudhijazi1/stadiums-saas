import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { BOOKINGS_CREATE, can } from "@/modules/access/domain/can";
import { rejectOverlappingPending } from "@/modules/booking/application/reject-overlapping-pending";
import { isExclusionViolation } from "@/modules/booking/domain/exclusion";
import { resolveOfferedSlot } from "@/modules/booking/domain/offered-slot";
import {
  insertApprovedOwnerBooking,
  insertRequesterParticipant,
  listApprovedRanges,
} from "@/modules/booking/infrastructure/bookings";
import type { OwnerCreateBooking } from "@/modules/booking/schemas/owner-create-booking";
import { findOrCreatePerson } from "@/modules/people/application/find-or-create-person";
import { civilDateInTimeZone } from "@/modules/venue/domain/availability";
import { findPitchById } from "@/modules/venue/infrastructure/pitches";
import { parseScheduleConfig } from "@/modules/venue/schemas/schedule-config";

const TIME_ZONE = "Asia/Beirut";

const EXPECTED = new Set([
  "Not allowed",
  "Pitch not found",
  "Slot is not offered",
  "Slot is taken",
  "Slot has already ended",
  "Slot no longer available",
  "Requester not found",
]);

/**
 * Phone-call booking: APPROVED immediately (BR-14). Auth before $transaction.
 * Price from Venue. Overlapping PUBLIC PENDING rejected like approve.
 * Does not collect.
 */
export async function createOwnerBooking(
  input: OwnerCreateBooking,
): Promise<{ bookingId: string }> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, BOOKINGS_CREATE)) {
    throw new Error("Not allowed");
  }

  try {
    const bookingId = await db.$transaction(async (tx) => {
      const pitch = await findPitchById(tx, input.pitchId);
      if (!pitch) {
        throw new Error("Pitch not found");
      }

      const config = parseScheduleConfig(pitch.scheduleConfig);
      const start = new Date(input.start);
      const end = new Date(input.end);
      const approved = await listApprovedRanges(tx, pitch.id);
      const slot = resolveOfferedSlot({
        config,
        localDate: civilDateInTimeZone(start, TIME_ZONE),
        timeZone: TIME_ZONE,
        start,
        end,
        now: new Date(),
        occupied: approved.map((row) => ({ start: row.start, end: row.end })),
      });

      const person = await findOrCreatePerson(tx, {
        name: input.name,
        phone: input.phone,
      });

      const id = await insertApprovedOwnerBooking(tx, {
        pitchId: pitch.id,
        start: slot.start,
        end: slot.end,
        priceUsd: slot.priceUsd,
      });

      await insertRequesterParticipant(tx, {
        bookingId: id,
        personId: person.id,
        amountDueUsd: slot.priceUsd,
      });

      await rejectOverlappingPending(tx, {
        id,
        pitchId: pitch.id,
        start: slot.start,
        end: slot.end,
      });

      return id;
    });

    logger.info(`Owner booking created ${bookingId}`);
    return { bookingId };
  } catch (error) {
    if (error instanceof Error && EXPECTED.has(error.message)) {
      throw error;
    }
    if (isExclusionViolation(error)) {
      logger.error("Owner-create collision", error);
      throw new Error("Slot no longer available");
    }
    logger.error("Owner booking failed", error);
    throw error;
  }
}
