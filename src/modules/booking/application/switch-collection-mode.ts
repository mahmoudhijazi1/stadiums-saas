import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { getCurrentTenant, safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { BOOKINGS_ADJUST_DUE, can } from "@/modules/access/domain/can";
import { buildSlots } from "@/modules/booking/domain/build-slots";
import {
  assertCanSwitchToPerPlayer,
  assertCanSwitchToWhole,
} from "@/modules/booking/domain/switch-mode";
import {
  applyPerPlayerSlots,
  applyWholeMode,
  countBookingAllocations,
  findBookingForUpdate,
  findRequesterPersonId,
} from "@/modules/booking/infrastructure/bookings";

async function requireAdjuster() {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, BOOKINGS_ADJUST_DUE)) {
    throw new DomainError("access.not_allowed");
  }
}

/**
 * WHOLE to PER_PLAYER (SPEC-15 §3.1). One transaction: the requester becomes slot 1,
 * slots 2..N are unnamed, shares come from `splitInUnits` in the game's currency (DR-007 slice 7:
 * whole units of $1 or 5,000 LBP, leftover units to the first slots). Payments already taken stay on
 * the booking as Unassigned (nothing is auto-allocated). The due itself does not
 * change, so no BookingDueChange row is written. Works on a game in either currency; an existing
 * split is never recomputed.
 */
export async function switchToPerPlayer(input: {
  bookingId: string;
  count: number;
}): Promise<void> {
  await requireAdjuster();
  // Only the switch INTO split is gated: a booking already split stays usable (money owed).
  if (!(await getCurrentTenant()).perPlayerSplitEnabled) {
    throw new DomainError("booking.split_disabled");
  }

  try {
    await db.$transaction(async (tx) => {
      const booking = await findBookingForUpdate(tx, input.bookingId);
      if (!booking) throw new DomainError("booking.not_found");

      assertCanSwitchToPerPlayer({
        status: booking.status,
        collectionMode: booking.collectionMode,
        due: booking.due.amount,
        allocationCount: await countBookingAllocations(tx, booking.id),
      });

      const requesterPersonId = await findRequesterPersonId(tx, booking.id);
      if (!requesterPersonId) throw new DomainError("booking.not_found");

      const slots = buildSlots(booking.due, input.count, requesterPersonId);
      await applyPerPlayerSlots(tx, { bookingId: booking.id, currency: booking.due.currency, slots });
    });

    logger.info(`Booking split per player ${input.bookingId}`, undefined, {
      useCase: "switchToPerPlayer",
      tenantId: await safeTenantId(),
    });
  } catch (error) {
    await rethrowUnexpected(error, "Switch to per player failed", "switchToPerPlayer");
  }
}

/**
 * PER_PLAYER back to WHOLE, only while no allocation exists (SPEC-15 §3.1).
 */
export async function switchToWhole(input: { bookingId: string }): Promise<void> {
  await requireAdjuster();

  try {
    await db.$transaction(async (tx) => {
      const booking = await findBookingForUpdate(tx, input.bookingId);
      if (!booking) throw new DomainError("booking.not_found");

      assertCanSwitchToWhole({
        collectionMode: booking.collectionMode,
        allocationCount: await countBookingAllocations(tx, booking.id),
      });

      await applyWholeMode(tx, { bookingId: booking.id, due: booking.due });
    });

    logger.info(`Booking back to whole ${input.bookingId}`, undefined, {
      useCase: "switchToWhole",
      tenantId: await safeTenantId(),
    });
  } catch (error) {
    await rethrowUnexpected(error, "Switch to whole failed", "switchToWhole");
  }
}
