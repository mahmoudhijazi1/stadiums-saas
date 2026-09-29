import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { PAYMENTS_COLLECT, can } from "@/modules/access/domain/can";
import { assertCanPaySlot } from "@/modules/booking/domain/switch-mode";
import {
  findBookingForUpdate,
  listSlotsForBookings,
} from "@/modules/booking/infrastructure/bookings";
import { recordPayment } from "@/modules/payment/application/record-payment";
import { freezeTenders, participantRemaining } from "@/modules/payment/domain/collect";
import { findLatestExchangeRate } from "@/modules/payment/infrastructure/rates";
import { insertAllocations } from "@/modules/payment/infrastructure/payments";

async function requireCollector() {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, PAYMENTS_COLLECT)) {
    throw new DomainError("access.not_allowed");
  }
}

/**
 * Pay the chosen slots' full remaining in USD cash: one payment, one tender, one ledger
 * row and one allocation per slot, all in this transaction (DR-002 §2.21).
 * The booking row is locked first and remaining is recomputed after the lock, so a
 * double tap finds the slot already paid. Only the slots' own remaining is checked,
 * never the booking remaining (RULE-9, P3).
 */
async function payRemaining(input: {
  bookingId: string;
  participantIds: "ALL_UNPAID" | string[];
}): Promise<string> {
  return db.$transaction(async (tx) => {
    const booking = await findBookingForUpdate(tx, input.bookingId);
    if (!booking) throw new DomainError("booking.not_found");

    const slots = await listSlotsForBookings(tx, [booking.id]);
    const ids = input.participantIds === "ALL_UNPAID" ? null : input.participantIds;
    const chosen = ids ? slots.filter((slot) => ids.includes(slot.participantId)) : slots;
    if (ids && chosen.length !== ids.length) {
      throw new DomainError("booking.not_found");
    }

    const owing = chosen
      .map((slot) => ({
        participantId: slot.participantId,
        remaining: participantRemaining(slot.dueUsd, slot.paidUsd),
      }))
      .filter((slot) => slot.remaining.gt(0));
    const total = owing.reduce((sum, slot) => sum.plus(slot.remaining), new Decimal(0));

    assertCanPaySlot({
      status: booking.status,
      collectionMode: booking.collectionMode,
      slotRemainingUsd: total,
    });

    const rate = await findLatestExchangeRate(tx);
    const tenders = freezeTenders([{ currency: "USD", amount: total }], rate);
    const paymentId = await recordPayment(tx, {
      direction: "IN",
      sourceType: "BOOKING",
      sourceId: booking.id,
      amountDueUsd: booking.amountDueUsd,
      tenders,
    });
    await insertAllocations(
      tx,
      paymentId,
      owing.map((slot) => ({
        participantId: slot.participantId,
        amountUsd: slot.remaining,
      })),
    );
    return paymentId;
  });
}

/** One tap: this player paid his remaining in USD. */
export async function collectSlotPayment(input: {
  bookingId: string;
  participantId: string;
}): Promise<void> {
  await requireCollector();
  try {
    const paymentId = await payRemaining({
      bookingId: input.bookingId,
      participantIds: [input.participantId],
    });
    logger.info(`Slot payment ${paymentId} booking ${input.bookingId}`, undefined, {
      useCase: "collectSlotPayment",
      tenantId: await safeTenantId(),
    });
  } catch (error) {
    await rethrowUnexpected(error, "Collect slot payment failed", "collectSlotPayment");
  }
}

/** Booker pays all remaining: every unpaid slot, one payment. */
export async function collectAllRemaining(input: {
  bookingId: string;
}): Promise<void> {
  await requireCollector();
  try {
    const paymentId = await payRemaining({
      bookingId: input.bookingId,
      participantIds: "ALL_UNPAID",
    });
    logger.info(`Pay-all payment ${paymentId} booking ${input.bookingId}`, undefined, {
      useCase: "collectAllRemaining",
      tenantId: await safeTenantId(),
    });
  } catch (error) {
    await rethrowUnexpected(error, "Collect all remaining failed", "collectAllRemaining");
  }
}
