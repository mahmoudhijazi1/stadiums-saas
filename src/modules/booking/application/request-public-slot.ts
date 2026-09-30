import { trustedClientIp } from "@/lib/client-ip";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { hitRateLimit } from "@/lib/rate-limit";
import { getCurrentTenantId, safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { findOrCreatePerson } from "@/modules/people/application/find-or-create-person";
import { cleanPersonName } from "@/modules/people/domain/clean-person-name";
import { normalizeName } from "@/modules/people/domain/normalize-name";
import { overlaps, resolveOfferedSlot } from "@/modules/booking/domain/offered-slot";
import {
  PUBLIC_MAX_PENDING_PER_PHONE,
  PUBLIC_MAX_REQUESTS_PER_IP,
  PUBLIC_MAX_REQUESTS_PER_PHONE,
  PUBLIC_REQUEST_LIMIT_KEY,
  PUBLIC_REQUEST_WINDOW_MS,
  publicRequestLimitKeys,
} from "@/modules/booking/domain/public-request-limits";
import {
  countFuturePendingForRequester,
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
 *
 * Limits (security audit S-5), all answered with booking.request_limit:
 * 5 requests per phone per hour and 60 per IP per hour (Postgres counters,
 * before the transaction), then at most 3 future PENDING per phone (inside it).
 */
export async function requestPublicSlot(input: PublicSlotRequest): Promise<{
  bookingId: string;
}> {
  try {
    await assertRequestRate(input.phone);
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

      const open = await countFuturePendingForRequester(tx, person.id, new Date());
      if (open >= PUBLIC_MAX_PENDING_PER_PHONE) {
        // Rolls back a Person created just now too.
        throw new DomainError(PUBLIC_REQUEST_LIMIT_KEY);
      }

      const id = await insertPendingPublicBooking(tx, {
        pitchId: pitch.id,
        start: slot.start,
        end: slot.end,
        priceUsd: slot.priceUsd,
        requestedName: typedNameIfDifferent(input.name, person.name),
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

/** Counters live in platform tables: hit them before the tenant transaction. */
async function assertRequestRate(phone: string): Promise<void> {
  // getCurrentTenantId refuses a suspended tenant before any counter is written.
  const keys = publicRequestLimitKeys(await getCurrentTenantId(), phone, await trustedClientIp());
  if (keys.ip && (await hitRateLimit(keys.ip, PUBLIC_REQUEST_WINDOW_MS)) > PUBLIC_MAX_REQUESTS_PER_IP) {
    throw new DomainError(PUBLIC_REQUEST_LIMIT_KEY);
  }
  if ((await hitRateLimit(keys.phone, PUBLIC_REQUEST_WINDOW_MS)) > PUBLIC_MAX_REQUESTS_PER_PHONE) {
    throw new DomainError(PUBLIC_REQUEST_LIMIT_KEY);
  }
}

/**
 * Security audit S-6: the owner must see what was typed when a known phone
 * comes with another name. Compared with the searchName fold, so spelling
 * variants (أحمد/احمد), case and spacing never count as different.
 */
function typedNameIfDifferent(typed: string, saved: string): string | null {
  const cleaned = cleanPersonName(typed);
  return normalizeName(cleaned) === normalizeName(saved) ? null : cleaned;
}
