import Decimal from "decimal.js";
import db from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { BOOKINGS_CANCEL, can } from "@/modules/access/domain/can";
import { writeDueIfChanged } from "@/modules/booking/application/write-due-change";
import {
  collapseToWhole,
  findBookingForUpdate,
  lockPitchForUpdate,
  setApprovedCancelled,
} from "@/modules/booking/infrastructure/bookings";
import { findSeries, listUpcomingApprovedIds } from "@/modules/booking/infrastructure/series";
import { sumCollectedUsd } from "@/modules/payment/infrastructure/payments";

export type KeptWeek = { bookingId: string; start: Date; collectedUsd: Decimal };

export type CancelledRest = {
  cancelled: { bookingId: string; start: Date }[];
  /** Weeks with collected money: left alone, to be cancelled one by one (a fee, a refund decision). */
  kept: KeptWeek[];
};

/**
 * Cancel every APPROVED game of the series that has not started, with NO fee (to charge a fee,
 * cancel that week on its own). A week with any collected money is NOT cancelled and is returned
 * in `kept`. Needs bookings.cancel. Lock order: the pitch, then each booking row FOR UPDATE one at
 * a time in ascending id order (the same order cancelBooking uses: pitch, then booking). Each
 * week is re-read under its lock, so one started or cancelled meanwhile is left as it is.
 */
export async function cancelRestOfSeries(input: { seriesId: string }): Promise<CancelledRest> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, BOOKINGS_CANCEL)) {
    throw new DomainError("access.not_allowed");
  }
  const now = new Date();

  try {
    const done = await db.$transaction(async (tx) => {
      const found = await findSeries(tx, input.seriesId);
      if (!found) {
        throw new DomainError("booking.series_not_found");
      }
      await lockPitchForUpdate(tx, found.pitchId);

      const result: CancelledRest = { cancelled: [], kept: [] };
      for (const id of await listUpcomingApprovedIds(tx, found.id, now)) {
        const booking = await findBookingForUpdate(tx, id);
        if (!booking || booking.status !== "APPROVED" || booking.start.getTime() <= now.getTime()) continue;

        const collected = await sumCollectedUsd(tx, "BOOKING", booking.id);
        if (collected.gt(0)) {
          result.kept.push({ bookingId: booking.id, start: booking.start, collectedUsd: collected });
          continue;
        }
        if (booking.collectionMode === "PER_PLAYER") {
          await collapseToWhole(tx, { bookingId: booking.id, amountDueUsd: booking.amountDueUsd });
        }
        await writeDueIfChanged(tx, {
          bookingId: booking.id,
          fromUsd: booking.amountDueUsd,
          toUsd: new Decimal(0),
          collectedUsd: collected,
          collectionMode: "WHOLE",
          reason: "CANCELLATION_NO_FEE",
          note: "OWNER",
          actorMembershipId: membership.membershipId,
        });
        await setApprovedCancelled(tx, booking.id);
        result.cancelled.push({ bookingId: booking.id, start: booking.start });
      }
      return result;
    });

    logger.info(
      `Rest of series cancelled ${input.seriesId} cancelled=${done.cancelled.length} kept=${done.kept.length}`,
      undefined,
      { useCase: "cancelRestOfSeries", tenantId: await safeTenantId() },
    );
    return done;
  } catch (error) {
    return await rethrowUnexpected(error, "Cancel rest of series failed", "cancelRestOfSeries");
  }
}
