import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
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
    throw new DomainError("access.not_allowed");
  }

  try {
    const bookingId = await db.$transaction(async (tx) => {
      const pitch = await findPitchById(tx, input.pitchId);
      if (!pitch) {
        throw new DomainError("booking.pitch_not_found");
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
    if (isExclusionViolation(error)) {
      logger.error("Owner-create collision", error, {
        useCase: "createOwnerBooking",
        tenantId: await safeTenantId(),
      });
      throw new DomainError("booking.slot_unavailable");
    }
    await rethrowUnexpected(error, "Owner booking failed", "createOwnerBooking");
  }
}
