import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { PAYMENTS_COLLECT, can } from "@/modules/access/domain/can";
import { assertDueAdjustableStatus, forgivenDue } from "@/modules/booking/domain/adjust-due";
import { writeDueIfChanged } from "@/modules/booking/application/write-due-change";
import {
  findGameForCollect,
  insertBookingDueChangeLbp,
  setBookingAmountDueLbp,
  sumSettledLbp,
} from "@/modules/booking/infrastructure/bookings";
import { bookingRemaining } from "@/modules/payment/domain/collect";
import { sumCollectedUsd } from "@/modules/payment/infrastructure/payments";
import { findLatestExchangeRate } from "@/modules/payment/infrastructure/rates";

/**
 * "Consider it paid" (DR-007 decision 8): the owner forgives what is left on a game when it is under
 * 5,000 LBP (or worth that in dollars at the current rate, on a USD game). One due change with reason
 * ROUNDING, in the game's currency, lowers the due by exactly what is left, so the game reads Paid.
 * Never automatic: only this use case writes it, on the owner's tap (permission payments.collect).
 * The booking row is locked and what is left is read after the lock, so a payment landing at the same
 * moment is seen; the check runs again here, whatever the screen showed.
 */
export async function considerGamePaid(input: { bookingId: string }): Promise<void> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, PAYMENTS_COLLECT)) {
    throw new DomainError("access.not_allowed");
  }

  try {
    await db.$transaction(async (tx) => {
      const game = await findGameForCollect(tx, input.bookingId);
      if (!game) {
        throw new DomainError("booking.not_found");
      }
      assertDueAdjustableStatus(game.status);
      const rate = await findLatestExchangeRate(tx);

      if (game.due.currency === "LBP") {
        const settled = await sumSettledLbp(tx, game.id);
        const toLbp = forgivenDue({
          due: game.due.amount,
          remaining: bookingRemaining(game.due.amount, settled),
          currency: "LBP",
          rate,
          collectionMode: game.collectionMode,
        });
        await setBookingAmountDueLbp(tx, game.id, toLbp);
        await insertBookingDueChangeLbp(tx, {
          bookingId: game.id,
          fromLbp: game.due.amount,
          toLbp,
          reason: "ROUNDING",
          note: null,
          actorMembershipId: membership.membershipId,
        });
        return;
      }

      const collected = await sumCollectedUsd(tx, "BOOKING", game.id);
      const toUsd = forgivenDue({
        due: game.due.amount,
        remaining: bookingRemaining(game.due.amount, collected),
        currency: "USD",
        rate,
        collectionMode: game.collectionMode,
      });
      await writeDueIfChanged(tx, {
        bookingId: game.id,
        fromUsd: game.due.amount,
        toUsd,
        collectedUsd: collected,
        collectionMode: game.collectionMode,
        reason: "ROUNDING",
        note: null,
        actorMembershipId: membership.membershipId,
      });
    });

    logger.info(`Game considered paid ${input.bookingId}`, undefined, {
      useCase: "considerGamePaid",
      tenantId: await safeTenantId(),
    });
  } catch (error) {
    await rethrowUnexpected(error, "Consider it paid failed", "considerGamePaid");
  }
}
