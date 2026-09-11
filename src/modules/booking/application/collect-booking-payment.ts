import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { rethrowUnexpected } from "@/lib/use-case-error";
import {
  PAYMENTS_COLLECT,
  can,
} from "@/modules/access/domain/can";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import {
  assertCanCollect,
  assertHasDue,
  freezeTenders,
  remainingDue,
  type TenderDraft,
} from "@/modules/payment/domain/collect";
import { recordPayment } from "@/modules/payment/application/record-payment";
import { findLatestExchangeRate } from "@/modules/payment/infrastructure/rates";
import { sumCollectedUsd } from "@/modules/payment/infrastructure/payments";
import { findBookingForCollect } from "@/modules/booking/infrastructure/bookings";

/**
 * Collect cash on an APPROVED booking. Auth before $transaction.
 * recordPayment writes payment + tenders + ledger IN inside this tx (DR-002 §2.21).
 */
export async function collectBookingPayment(input: {
  bookingId: string;
  tenders: TenderDraft[];
}): Promise<void> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, PAYMENTS_COLLECT)) {
    throw new DomainError("access.not_allowed");
  }

  try {
    const paymentId = await db.$transaction(async (tx) => {
      const booking = await findBookingForCollect(tx, input.bookingId);
      if (!booking) {
        throw new DomainError("booking.not_found");
      }
      assertCanCollect(booking.status);

      const rate = await findLatestExchangeRate(tx);
      const collected = await sumCollectedUsd(tx, "BOOKING", booking.id);
      const remaining = remainingDue(booking.priceUsd, collected);
      assertHasDue(remaining);

      const frozen = freezeTenders(input.tenders, rate);

      return recordPayment(tx, {
        direction: "IN",
        sourceType: "BOOKING",
        sourceId: booking.id,
        amountDueUsd: booking.priceUsd,
        tenders: frozen,
      });
    });

    logger.info(`Payment collected ${paymentId} booking ${input.bookingId}`);
  } catch (error) {
    await rethrowUnexpected(error, "Collect payment failed", "collectBookingPayment");
  }
}
