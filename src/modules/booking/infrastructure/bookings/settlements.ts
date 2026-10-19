import Decimal from "decimal.js";
import type { TenantTx } from "@/lib/db";
import { formatUsd } from "@/lib/format/money";

/**
 * The pounds an LBP game's payments settled so far (DR-007 decision 4): the sum of its
 * `BookingSettlement.lbpApplied`. Read after the booking row is locked. tenantId is stamped.
 */
export async function sumSettledLbp(tx: TenantTx, bookingId: string): Promise<Decimal> {
  const result = await tx.bookingSettlement.aggregate({
    where: { bookingId },
    _sum: { lbpApplied: true },
  });
  const sum = result._sum.lbpApplied;
  return sum ? new Decimal(sum.toString()) : new Decimal(0);
}

/** One payment's settlement of a game: the pounds it settled and the dollars it kept. Insert only. */
export async function insertBookingSettlement(
  tx: TenantTx,
  input: { bookingId: string; paymentId: string; lbpApplied: Decimal; usdApplied: Decimal },
): Promise<void> {
  await tx.bookingSettlement.create({
    data: {
      bookingId: input.bookingId,
      paymentId: input.paymentId,
      lbpApplied: input.lbpApplied.toFixed(0),
      usdApplied: formatUsd(input.usdApplied),
    } as Parameters<typeof tx.bookingSettlement.create>[0]["data"],
  });
}
