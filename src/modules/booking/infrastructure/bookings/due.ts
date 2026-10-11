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
      | "SHOP_ITEMS";
    note: string | null;
    actorMembershipId: string;
  },
): Promise<void> {
  await tx.bookingDueChange.create({
    data: {
      bookingId: input.bookingId,
      fromUsd: formatUsd(input.fromUsd),
      toUsd: formatUsd(input.toUsd),
      reason: input.reason,
      note: input.note,
      actorMembershipId: input.actorMembershipId,
    } as Parameters<typeof tx.bookingDueChange.create>[0]["data"],
  });
}
