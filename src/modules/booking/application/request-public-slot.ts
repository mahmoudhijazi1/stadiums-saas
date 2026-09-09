import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { findOrCreatePerson } from "@/modules/people/application/find-or-create-person";
import { resolveOfferedSlot } from "@/modules/booking/domain/offered-slot";
import {
  insertPendingPublicBooking,
  insertRequesterParticipant,
} from "@/modules/booking/infrastructure/bookings";
import type { PublicSlotRequest } from "@/modules/booking/schemas/public-slot-request";
import { civilDateInTimeZone } from "@/modules/venue/domain/availability";
import { findPitchById } from "@/modules/venue/infrastructure/pitches";
import { parseScheduleConfig } from "@/modules/venue/schemas/schedule-config";

const TIME_ZONE = "Asia/Beirut";

/**
 * Public name+phone request → PENDING booking + requester participant.
 * Opens the transaction (DR-001). Does not notify. Price from Venue, not the form.
 */
export async function requestPublicSlot(input: PublicSlotRequest): Promise<{
  bookingId: string;
}> {
  try {
    const bookingId = await db.$transaction(async (tx) => {
      const pitch = await findPitchById(tx, input.pitchId);
      if (!pitch) {
        throw new Error("Pitch not found");
      }

      const config = parseScheduleConfig(pitch.scheduleConfig);
      const start = new Date(input.start);
      const end = new Date(input.end);
      const slot = resolveOfferedSlot({
        config,
        localDate: civilDateInTimeZone(start, TIME_ZONE),
        timeZone: TIME_ZONE,
        start,
        end,
        now: new Date(),
      });

      const person = await findOrCreatePerson(tx, {
        name: input.name,
        phone: input.phone,
      });

      const id = await insertPendingPublicBooking(tx, {
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

      return id;
    });

    logger.info(`Public booking request received ${bookingId}`);
    return { bookingId };
  } catch (error) {
    logger.error("Public booking request failed", error);
    throw error;
  }
}
