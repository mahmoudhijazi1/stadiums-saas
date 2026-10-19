import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { PAYMENTS_COLLECT, can } from "@/modules/access/domain/can";
import { forgivenShare } from "@/modules/booking/domain/adjust-due";
import { collectedOn } from "@/modules/booking/application/game-collected";
import { appendDueChange } from "@/modules/booking/application/write-due-change";
import {
  findBookingForUpdate,
  listSlotsForBookings,
  setBookingAmountDue,
  setBookingAmountDueLbp,
  setParticipantDue,
} from "@/modules/booking/infrastructure/bookings";
import { bookingRemaining } from "@/modules/payment/domain/collect";
import { findLatestExchangeRate } from "@/modules/payment/infrastructure/rates";

/**
 * "Consider it paid" on ONE share of a split game (DR-007 slice 7, decision 8): when what is left on
 * the share is forgivable (`isForgivable`: under 5,000 LBP, or worth that in dollars at the current
 * rate), the share and the game's due both drop by exactly that remainder, and one ROUNDING due change
 * records it in the game's currency, so the share reads Paid and the shares still add up to the due.
 * Never automatic. Same permission (payments.collect) and refusals as the whole-game version
 * (`booking.not_forgivable`); a share that money already collected covers is refused too, since
 * lowering the due by it would put the due below what was collected. Under the booking lock; what is
 * left is read again after it.
 */
export async function considerSharePaid(input: { bookingId: string; participantId: string }): Promise<void> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, PAYMENTS_COLLECT)) {
    throw new DomainError("access.not_allowed");
  }

  try {
    await db.$transaction(async (tx) => {
      const game = await findBookingForUpdate(tx, input.bookingId);
      if (!game) throw new DomainError("booking.not_found");
      if (game.collectionMode !== "PER_PLAYER") throw new DomainError("booking.switch_not_per_player");
      if (game.status !== "APPROVED") throw new DomainError("payment.collect_unapproved");

      const slot = (await listSlotsForBookings(tx, [game.id])).find((row) => row.participantId === input.participantId);
      if (!slot) throw new DomainError("booking.not_found");

      const collected = await collectedOn(tx, game);
      const amount = forgivenShare({
        shareRemaining: slot.due.minus(slot.paid),
        bookingRemaining: bookingRemaining(game.due.amount, collected),
        currency: game.due.currency,
        rate: await findLatestExchangeRate(tx),
      });

      const newDue = game.due.amount.minus(amount);
      await setParticipantDue(tx, {
        participantId: slot.participantId,
        due: { currency: game.due.currency, amount: slot.due.minus(amount) },
      });
      if (game.due.currency === "LBP") await setBookingAmountDueLbp(tx, game.id, newDue);
      else await setBookingAmountDue(tx, game.id, newDue);
      await appendDueChange(tx, {
        bookingId: game.id,
        currency: game.due.currency,
        from: game.due.amount,
        to: newDue,
        reason: "ROUNDING",
        note: null,
        actorMembershipId: membership.membershipId,
      });
    });

    logger.info(`Share considered paid ${input.participantId} booking ${input.bookingId}`, undefined, {
      useCase: "considerSharePaid",
      tenantId: await safeTenantId(),
    });
  } catch (error) {
    await rethrowUnexpected(error, "Consider share paid failed", "considerSharePaid");
  }
}
