import { Prisma } from "@/generated/prisma/client";
import type { TenantTx } from "@/lib/db";
import { getCurrentTenantId } from "@/lib/tenant-context";
import { asDate } from "./_shared";

export type BookingLabelRow = {
  id: string;
  start: Date;
  personId: string | null;
  requesterName: string | null;
};

/** The requester of many bookings, one query. For labels (Money activity), not for money. */
export async function listBookingLabelRows(
  tx: TenantTx,
  bookingIds: string[],
): Promise<BookingLabelRow[]> {
  if (bookingIds.length === 0) return [];
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<
    { id: string; start: Date | string; personId: string | null; name: string | null }[]
  >`
    SELECT b.id, lower(b.during) AS start, per.id AS "personId", per.name
    FROM "Booking" b
    LEFT JOIN "BookingParticipant" bp ON bp."bookingId" = b.id AND bp."isRequester" = true
    LEFT JOIN "Person" per ON per.id = bp."personId"
    WHERE b."tenantId" = ${tenantId}
      AND b.id IN (${Prisma.join(bookingIds)})
  `;
  return rows.map((row) => ({
    id: row.id,
    start: asDate(row.start),
    personId: row.personId,
    requesterName: row.name,
  }));
}
