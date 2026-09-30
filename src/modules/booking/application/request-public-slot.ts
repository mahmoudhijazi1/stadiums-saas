import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { findOrCreatePerson } from "@/modules/people/application/find-or-create-person";
import { overlaps, resolveOfferedSlot } from "@/modules/booking/domain/offered-slot";
import {
  hasSlotInterest,
  insertPendingPublicBooking,
  insertRequesterParticipant,
  insertSlotInterest,
  listApprovedRanges,
  lockPitchForUpdate,
} from "@/modules/booking/infrastructure/bookings";
import type { PublicSlotRequest } from "@/modules/booking/schemas/public-slot-request";
import { civilDateInTimeZone } from "@/modules/venue/domain/availability";
import { findPitchById } from "@/modules/venue/infrastructure/pitches";
import { parseScheduleConfig } from "@/modules/venue/schemas/schedule-config";

const TIME_ZONE = "Asia/Beirut";

/**
 * Public name+phone request → PENDING booking + requester participant.
 * Opens the transaction (DR-001). Does not notify. Price from Venue, not the form.
 *
 * Takes the pitch lock first, like approve and owner-create (lock order: pitch, then
 * booking rows), and checks APPROVED overlap after the lock. So a request racing an
 * approve either lands before it (and is auto-rejected as a sibling with an interest)
 * or sees the approved hour. A taken hour creates no PENDING row: the person is
 * recorded as a SlotInterest on the approved window (BR-21) and the call fails with
 * booking.slot_taken after that interest is committed (audit §1.2).
 */
export async function requestPublicSlot(input: PublicSlotRequest): Promise<{
  bookingId: string;
}> {
  try {
    const outcome = await db.$transaction(async (tx) => {
      await lockPitchForUpdate(tx, input.pitchId);
      const pitch = await findPitchById(tx, input.pitchId);
      if (!pitch) {
        throw new DomainError("booking.pitch_not_found");
      }

      const config = parseScheduleConfig(pitch.scheduleConfig);
      const start = new Date(input.start);
      const end = new Date(input.end);
      // Offered, still ahead, priced. Occupancy is checked below, under the lock.
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

      const approved = await listApprovedRanges(tx, pitch.id);
      const taken = approved.find((row) => overlaps(row, slot));
      if (taken) {
        const window = {
          pitchId: pitch.id,
          start: taken.start,
          end: taken.end,
          personId: person.id,
        };
        if (!(await hasSlotInterest(tx, window))) {
          await insertSlotInterest(tx, window);
        }
        return { taken: true as const };
      }

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

      return { taken: false as const, bookingId: id };
    });

    if (outcome.taken) {
      logger.info("Public request for a taken hour recorded as interest", undefined, {
        useCase: "requestPublicSlot",
        tenantId: await safeTenantId(),
      });
      throw new DomainError("booking.slot_taken");
    }

    logger.info(`Public booking request received ${outcome.bookingId}`, undefined, {
      useCase: "requestPublicSlot",
      tenantId: await safeTenantId(),
    });
    return { bookingId: outcome.bookingId };
  } catch (error) {
    return await rethrowUnexpected(
      error,
      "Public booking request failed",
      "requestPublicSlot",
    );
  }
}
