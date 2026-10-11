import type { BookingStatus } from "@/generated/prisma/enums";
import type { TenantTx } from "@/lib/db";
import { getCurrentTenantId } from "@/lib/tenant-context";
import { asDate, RECENT_WINDOW_MS } from "./_shared";

export type ApprovedRangeRow = {
  pitchId: string;
  start: Date;
  end: Date;
};

type ApprovedSqlRow = {
  pitchId: string;
  start: Date | string;
  end: Date | string;
};

/**
 * APPROVED windows ending after now − 24 h (security audit S-8: bounded by
 * time, not a row cap, so an overlap check never misses a future booking).
 * Every caller checks a slot that has not ended, or shows occupancy from today on.
 */
export async function listApprovedRanges(
  tx: TenantTx,
  pitchId?: string,
  now: Date = new Date(),
): Promise<ApprovedRangeRow[]> {
  const tenantId = await getCurrentTenantId();
  const since = new Date(now.getTime() - RECENT_WINDOW_MS);
  const rows = pitchId
    ? await tx.$queryRaw<ApprovedSqlRow[]>`
        SELECT "pitchId", lower(during) AS start, upper(during) AS end
        FROM "Booking"
        WHERE "tenantId" = ${tenantId}
          AND status = 'APPROVED'::"BookingStatus"
          AND "pitchId" = ${pitchId}
          AND upper(during) > ${since}
      `
    : await tx.$queryRaw<ApprovedSqlRow[]>`
        SELECT "pitchId", lower(during) AS start, upper(during) AS end
        FROM "Booking"
        WHERE "tenantId" = ${tenantId}
          AND status = 'APPROVED'::"BookingStatus"
          AND upper(during) > ${since}
      `;

  return rows.map((row) => ({
    pitchId: row.pitchId,
    start: asDate(row.start),
    end: asDate(row.end),
  }));
}
