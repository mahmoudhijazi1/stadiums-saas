import Decimal from "decimal.js";
import db from "@/lib/db";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { remainingDue } from "@/modules/payment/domain/collect";
import { sumCollectedUsdBySourceIds } from "@/modules/payment/infrastructure/payments";
import { listApprovedBookingsForCollect } from "@/modules/booking/infrastructure/bookings";

export type DueBooking = {
  id: string;
  pitchName: string;
  start: Date;
  end: Date;
  priceUsd: Decimal;
  remaining: Decimal;
  requesterName: string;
  requesterPhone: string;
};

/**
 * APPROVED games that still have money due. Staff may look (no collect flag).
 * Remaining comes from Payment sums — Booking does not join payment tables.
 */
export async function listDueBookings(): Promise<DueBooking[]> {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new Error("Not allowed");
  }

  const rows = await listApprovedBookingsForCollect(db);
  const collected = await sumCollectedUsdBySourceIds(
    db,
    "BOOKING",
    rows.map((row) => row.id),
  );

  const due: DueBooking[] = [];
  for (const row of rows) {
    const remaining = remainingDue(
      row.priceUsd,
      collected.get(row.id) ?? new Decimal(0),
    );
    if (remaining.lte(0)) continue;
    due.push({
      id: row.id,
      pitchName: row.pitchName,
      start: row.start,
      end: row.end,
      priceUsd: row.priceUsd,
      remaining,
      requesterName: row.requesterName,
      requesterPhone: row.requesterPhone,
    });
  }

  return due;
}
