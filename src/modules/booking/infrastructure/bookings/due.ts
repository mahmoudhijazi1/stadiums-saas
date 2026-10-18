import { DomainError } from "@/lib/errors";
import type { TenantTx } from "@/lib/db";
import { formatUsd } from "@/lib/format/money";
import Decimal from "decimal.js";

export async function setBookingAmountDue(
  tx: TenantTx,
  bookingId: string,
  amountDueUsd: Decimal,
): Promise<void> {
  const result = await tx.booking.updateMany({
    where: { id: bookingId },
    data: { amountDueUsd: formatUsd(amountDueUsd) },
  });
  if (result.count !== 1) {
    throw new DomainError("booking.not_found");
  }
}

/**
 * Append one due change. tenantId is stamped by the extension.
 * Written in the same transaction as Booking.amountDueUsd.
 */
export async function insertBookingDueChange(
  tx: TenantTx,
  input: {
    bookingId: string;
    fromUsd: Decimal;
    toUsd: Decimal;
    reason:
      | "LATE_CANCELLATION_FEE"
      | "NO_SHOW_FEE"
      | "CANCELLATION_NO_FEE"
      | "PARTIAL_GAME"
      | "DISCOUNT"
      | "WAIVER"
      | "CORRECTION"
      | "EXTENSION"
      | "SHOP_ITEMS"
      | "ROUNDING";
    note: string | null;
    actorMembershipId: string;
  },
): Promise<void> {
  await tx.bookingDueChange.create({
    data: {
      bookingId: input.bookingId,
      // USD only until LBP games exist (DR-007 slice 6).
      currency: "USD",
      fromUsd: formatUsd(input.fromUsd),
      toUsd: formatUsd(input.toUsd),
      reason: input.reason,
      note: input.note,
      actorMembershipId: input.actorMembershipId,
    } as Parameters<typeof tx.bookingDueChange.create>[0]["data"],
  });
}

/**
 * The due of an LBP game, in whole pounds (DR-007). Written in the same transaction as its due change.
 */
export async function setBookingAmountDueLbp(
  tx: TenantTx,
  bookingId: string,
  amountDueLbp: Decimal,
): Promise<void> {
  const result = await tx.booking.updateMany({
    where: { id: bookingId, priceCurrency: "LBP" },
    data: { amountDueLbp: amountDueLbp.toFixed(0) },
  });
  if (result.count !== 1) {
    throw new DomainError("booking.not_found");
  }
}

/**
 * Append one due change of an LBP game: the pair in pounds (CHECK BookingDueChange_pair_by_currency).
 * tenantId is stamped by the extension.
 */
export async function insertBookingDueChangeLbp(
  tx: TenantTx,
  input: {
    bookingId: string;
    fromLbp: Decimal;
    toLbp: Decimal;
    reason: Parameters<typeof insertBookingDueChange>[1]["reason"];
    note: string | null;
    actorMembershipId: string;
  },
): Promise<void> {
  await tx.bookingDueChange.create({
    data: {
      bookingId: input.bookingId,
      currency: "LBP",
      fromLbp: input.fromLbp.toFixed(0),
      toLbp: input.toLbp.toFixed(0),
      reason: input.reason,
      note: input.note,
      actorMembershipId: input.actorMembershipId,
    } as Parameters<typeof tx.bookingDueChange.create>[0]["data"],
  });
}
