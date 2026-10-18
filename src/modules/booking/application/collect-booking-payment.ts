import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import {
  PAYMENTS_COLLECT,
  can,
} from "@/modules/access/domain/can";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import {
  assertCanCollect,
  assertHasDue,
  bookingRemaining,
  type TenderDraft,
} from "@/modules/payment/domain/collect";
import { applyToGameDue, applyToLbpGameDue, handedFromTenders } from "@/modules/booking/domain/game-change";
import { recordPayment } from "@/modules/payment/application/record-payment";
import { findLatestExchangeRate } from "@/modules/payment/infrastructure/rates";
import { sumCollectedUsd } from "@/modules/payment/infrastructure/payments";
import {
  findGameForCollect,
  insertBookingSettlement,
  sumSettledLbp,
} from "@/modules/booking/infrastructure/bookings";

/**
 * Collect cash on an APPROVED, NO_SHOW, or CANCELLED booking with remaining > 0.
 * Auth before $transaction. The booking row is locked first and collected is summed
 * after the lock, so a double submit, a cancel, a no-show, an adjust or a split on the
 * same booking runs one at a time (audit §2.6).
 * Cash beyond what is owed is not recorded: the tenders are reduced to what the game used and the
 * rest comes back as change, in the currency it was handed over in (DR-007 decision 6), so a game's
 * collected total never exceeds its due and the remaining never goes negative.
 * recordPayment writes payment + tenders + ledger IN inside this tx (DR-002 §2.21).
 *
 * An LBP game (DR-007 slice 6) owes its due in pounds minus the pounds its settlements applied,
 * summed after the lock. Pounds count first, dollars at the current rate against what is left; each
 * kept tender is valued at this payment's rate, and one BookingSettlement row records the pounds
 * settled and the dollars kept. The payment's due snapshot is in pounds.
 */
export async function collectBookingPayment(input: {
  bookingId: string;
  tenders: TenderDraft[];
}): Promise<{ changeUsd: Decimal; changeLbp: Decimal }> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, PAYMENTS_COLLECT)) {
    throw new DomainError("access.not_allowed");
  }

  const handed = handedFromTenders(input.tenders);

  try {
    const outcome = await db.$transaction(async (tx) => {
      const booking = await findGameForCollect(tx, input.bookingId);
      if (!booking) {
        throw new DomainError("booking.not_found");
      }
      assertCanCollect(booking.status);
      if (booking.collectionMode === "PER_PLAYER") {
        // A whole-game payment would sit unassigned. Cash goes through the slots.
        throw new DomainError("booking.collect_per_player");
      }

      const rate = await findLatestExchangeRate(tx);
      if (booking.due.currency === "LBP") {
        const settled = await sumSettledLbp(tx, booking.id);
        const remainingLbp = bookingRemaining(booking.due.amount, settled);
        assertHasDue(remainingLbp);

        const kept = applyToLbpGameDue({ remainingLbp, handed, rate });
        const paymentId = await recordPayment(tx, {
          direction: "IN",
          sourceType: "BOOKING",
          sourceId: booking.id,
          amountDueLbp: booking.due.amount,
          tenders: kept.tenders,
        });
        await insertBookingSettlement(tx, {
          bookingId: booking.id,
          paymentId,
          lbpApplied: kept.lbpApplied,
          usdApplied: kept.usdKept,
        });
        return { paymentId, changeUsd: kept.changeUsd, changeLbp: kept.changeLbp };
      }

      const amountDueUsd = booking.due.amount;
      const collected = await sumCollectedUsd(tx, "BOOKING", booking.id);
      const remaining = bookingRemaining(amountDueUsd, collected);
      assertHasDue(remaining);

      const kept = applyToGameDue({ remainingUsd: remaining, handed, rate });

      const paymentId = await recordPayment(tx, {
        direction: "IN",
        sourceType: "BOOKING",
        sourceId: booking.id,
        amountDueUsd,
        tenders: kept.tenders,
      });
      return { paymentId, changeUsd: kept.changeUsd, changeLbp: kept.changeLbp };
    });

    logger.info(`Payment collected ${outcome.paymentId} booking ${input.bookingId}`, undefined, {
      useCase: "collectBookingPayment",
      tenantId: await safeTenantId(),
    });
    return { changeUsd: outcome.changeUsd, changeLbp: outcome.changeLbp };
  } catch (error) {
    return await rethrowUnexpected(error, "Collect payment failed", "collectBookingPayment");
  }
}
