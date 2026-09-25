import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { BOOKINGS_ADJUST_DUE, can } from "@/modules/access/domain/can";
import type { DueChangeReason } from "@/modules/booking/domain/suggest-fee";
import {
  findBookingForDecision,
} from "@/modules/booking/infrastructure/bookings";
import { sumCollectedUsd } from "@/modules/payment/infrastructure/payments";
import { writeDueIfChanged } from "@/modules/booking/application/write-due-change";

/**
 * Change what is collectible and log why, in one transaction.
 * No-op when the amount is already that value.
 */
export async function adjustBookingDue(input: {
  bookingId: string;
  toUsd: Decimal;
  reason: DueChangeReason;
  note: string | null;
}): Promise<void> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, BOOKINGS_ADJUST_DUE)) {
    throw new DomainError("access.not_allowed");
  }

  try {
    await db.$transaction(async (tx) => {
      const booking = await findBookingForDecision(tx, input.bookingId);
      if (!booking) {
        throw new DomainError("booking.not_found");
      }
      const collected = await sumCollectedUsd(tx, "BOOKING", booking.id);
      await writeDueIfChanged(tx, {
        bookingId: booking.id,
        fromUsd: booking.amountDueUsd,
        toUsd: input.toUsd,
        collectedUsd: collected,
        collectionMode: booking.collectionMode,
        reason: input.reason,
        note: input.note,
        actorMembershipId: membership.membershipId,
      });
    });

    logger.info(`Booking due adjusted ${input.bookingId}`, undefined, {
      useCase: "adjustBookingDue",
      tenantId: await safeTenantId(),
    });
  } catch (error) {
    await rethrowUnexpected(error, "Adjust booking due failed", "adjustBookingDue");
  }
}
