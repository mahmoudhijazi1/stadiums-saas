import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import type { TenantTx } from "@/lib/db";
import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { PAYMENTS_COLLECT, can } from "@/modules/access/domain/can";
import { applyToLbpGameDue, handedFromTenders } from "@/modules/booking/domain/game-change";
import { planShareCharge, type ShareSlot } from "@/modules/booking/domain/share-charge";
import { planSlotCharge } from "@/modules/booking/domain/slot-charge";
import { assertCanPaySlot } from "@/modules/booking/domain/switch-mode";
import {
  findGameForCollect,
  insertBookingSettlement,
  listSlotsForBookings,
  sumSettledLbp,
  usdSlots,
  type GameForCollect,
  type SlotRow,
} from "@/modules/booking/infrastructure/bookings";
import { recordPayment } from "@/modules/payment/application/record-payment";
import { bookingRemaining, freezeTenders, type TenderDraft } from "@/modules/payment/domain/collect";
import { findLatestExchangeRate } from "@/modules/payment/infrastructure/rates";
import {
  insertAllocations,
  sumCollectedUsd,
} from "@/modules/payment/infrastructure/payments";

async function requireCollector() {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, PAYMENTS_COLLECT)) {
    throw new DomainError("access.not_allowed");
  }
}

/** What goes back to the payer, in the currency it was handed over in. Zero on a game in dollars. */
export type SlotChange = { changeUsd: Decimal; changeLbp: Decimal };

type Paid = SlotChange & { paymentId: string };

/**
 * Pay the chosen slots: one payment, its tenders, one ledger row and one allocation per slot, all in
 * this transaction (DR-002 §2.21). The booking row is locked first and everything is recomputed after
 * the lock, so a double tap finds the slot already paid. The charge never exceeds what the booking still
 * owes, Unassigned included (P3, audit §3.6).
 *
 * A game in dollars takes the charge in USD cash, as always. A game in pounds (DR-007 slice 7) takes
 * the cash that was typed (`tenders`; none means exactly the charge, in pounds): pounds count first,
 * dollars at the current rate against what is left, the rest is change in the currency it was handed
 * over in. The kept tenders are valued at this payment's rate, the allocations are whole pounds per
 * slot, and one BookingSettlement records the pounds settled and the dollars kept, so a payment's
 * allocations always add up to its settlement.
 */
async function payRemaining(input: {
  bookingId: string;
  participantIds: "ALL_UNPAID" | string[];
  tenders?: TenderDraft[];
}): Promise<Paid> {
  return db.$transaction(async (tx) => {
    const booking = await findGameForCollect(tx, input.bookingId);
    if (!booking) throw new DomainError("booking.not_found");

    const slotRows = await listSlotsForBookings(tx, [booking.id]);
    const ids = input.participantIds === "ALL_UNPAID" ? null : input.participantIds;
    const chosen = ids ? slotRows.filter((slot) => ids.includes(slot.participantId)) : slotRows;
    if (ids && chosen.length !== ids.length) {
      throw new DomainError("booking.not_found");
    }

    return booking.due.currency === "LBP"
      ? payInPounds(tx, booking, chosen, input.tenders)
      : payInDollars(tx, booking, chosen);
  });
}

async function payInDollars(tx: TenantTx, booking: GameForCollect, chosen: SlotRow[]): Promise<Paid> {
  const amountDueUsd = booking.due.amount;
  const charge = planSlotCharge({
    amountDueUsd,
    collectedUsd: await sumCollectedUsd(tx, "BOOKING", booking.id),
    slots: usdSlots(chosen),
    target: "ALL_UNPAID",
  });

  assertCanPaySlot({
    status: booking.status,
    collectionMode: booking.collectionMode,
    charge: charge.totalUsd,
  });

  const rate = await findLatestExchangeRate(tx);
  const tenders = freezeTenders([{ currency: "USD", amount: charge.totalUsd }], rate);
  const paymentId = await recordPayment(tx, {
    direction: "IN",
    sourceType: "BOOKING",
    sourceId: booking.id,
    amountDueUsd,
    tenders,
  });
  await insertAllocations(
    tx,
    paymentId,
    charge.allocations.map((row) => ({ participantId: row.participantId, amount: row.amountUsd })),
  );
  return { paymentId, changeUsd: new Decimal(0), changeLbp: new Decimal(0) };
}

async function payInPounds(
  tx: TenantTx,
  booking: GameForCollect,
  chosen: SlotRow[],
  tenders: TenderDraft[] | undefined,
): Promise<Paid> {
  const slots: ShareSlot[] = chosen.map((slot) => ({
    participantId: slot.participantId,
    slotNumber: slot.slotNumber,
    due: slot.due,
    paid: slot.paid,
  }));
  const charge = planShareCharge({
    cap: bookingRemaining(booking.due.amount, await sumSettledLbp(tx, booking.id)),
    slots,
    target: "ALL_UNPAID",
  });

  assertCanPaySlot({
    status: booking.status,
    collectionMode: booking.collectionMode,
    charge: charge.total,
  });

  const rate = await findLatestExchangeRate(tx);
  const handed = tenders && tenders.length > 0 ? handedFromTenders(tenders) : { lbp: charge.total, usd: new Decimal(0) };
  const kept = applyToLbpGameDue({ remainingLbp: charge.total, handed, rate });
  // The slots are credited with what was actually settled, in slot order: cash short of the charge
  // fills the first slots and may leave the last one partial.
  const credited = planShareCharge({ cap: kept.lbpApplied, slots, target: "ALL_UNPAID" });

  const paymentId = await recordPayment(tx, {
    direction: "IN",
    sourceType: "BOOKING",
    sourceId: booking.id,
    amountDueLbp: booking.due.amount,
    tenders: kept.tenders,
  });
  await insertAllocations(tx, paymentId, credited.allocations, "LBP");
  await insertBookingSettlement(tx, {
    bookingId: booking.id,
    paymentId,
    lbpApplied: kept.lbpApplied,
    usdApplied: kept.usdKept,
  });
  return { paymentId, changeUsd: kept.changeUsd, changeLbp: kept.changeLbp };
}

/**
 * One tap: this player paid his remaining, capped at what the booking owes. On a game in pounds the
 * cash that was typed can ride along (`tenders`); the change comes back.
 */
export async function collectSlotPayment(input: {
  bookingId: string;
  participantId: string;
  tenders?: TenderDraft[];
}): Promise<SlotChange> {
  await requireCollector();
  try {
    const paid = await payRemaining({
      bookingId: input.bookingId,
      participantIds: [input.participantId],
      tenders: input.tenders,
    });
    logger.info(`Slot payment ${paid.paymentId} booking ${input.bookingId}`, undefined, {
      useCase: "collectSlotPayment",
      tenantId: await safeTenantId(),
    });
    return { changeUsd: paid.changeUsd, changeLbp: paid.changeLbp };
  } catch (error) {
    return await rethrowUnexpected(error, "Collect slot payment failed", "collectSlotPayment");
  }
}

/** Booker pays all remaining: unpaid slots in order up to what the booking owes, one payment. */
export async function collectAllRemaining(input: {
  bookingId: string;
  tenders?: TenderDraft[];
}): Promise<SlotChange> {
  await requireCollector();
  try {
    const paid = await payRemaining({
      bookingId: input.bookingId,
      participantIds: "ALL_UNPAID",
      tenders: input.tenders,
    });
    logger.info(`Pay-all payment ${paid.paymentId} booking ${input.bookingId}`, undefined, {
      useCase: "collectAllRemaining",
      tenantId: await safeTenantId(),
    });
    return { changeUsd: paid.changeUsd, changeLbp: paid.changeLbp };
  } catch (error) {
    return await rethrowUnexpected(error, "Collect all remaining failed", "collectAllRemaining");
  }
}
