import { Prisma } from "@/generated/prisma/client";
import type { BookingStatus } from "@/generated/prisma/enums";
import type { TenantTx } from "@/lib/db";
import { getCurrentTenantId } from "@/lib/tenant-context";
import {
  PENDING_INBOX_MISSED_MAX,
  PENDING_INBOX_UPCOMING_MAX,
} from "@/modules/booking/domain/pending-inbox";
import { asDate } from "./_shared";

export type PendingBookingRow = {
  id: string;
  pitchId: string;
  pitchName: string;
  start: Date;
  end: Date;
  requestedAt: Date;
  requesterPersonId: string;
  requesterName: string;
  requesterPhone: string | null;
  /** Name typed on the request when it differs from requesterName (S-6). */
  requestedName: string | null;
};

type PendingSqlRow = {
  id: string;
  pitchId: string;
  pitchName: string;
  start: Date | string;
  end: Date | string;
  requestedAt: Date | string;
  requesterPersonId: string;
  requesterName: string;
  requesterPhone: string | null;
  requestedName: string | null;
};

/**
 * PENDING inbox for this tenant (guard / ALS). Soonest slot first, then
 * oldest requestedAt (BR-17) inside an identical window.
 * during is raw — Prisma Client omits Unsupported on Booking.
 */
export async function listPendingBookings(
  tx: TenantTx,
): Promise<PendingBookingRow[]> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<PendingSqlRow[]>`
    SELECT
      b.id,
      b."pitchId",
      p.name AS "pitchName",
      lower(b.during) AS start,
      upper(b.during) AS end,
      b."requestedAt",
      per.id AS "requesterPersonId",
      per.name AS "requesterName",
      per.phone AS "requesterPhone",
      b."requestedName"
    FROM "Booking" b
    JOIN "Pitch" p ON p.id = b."pitchId"
    JOIN "BookingParticipant" bp ON bp."bookingId" = b.id AND bp."isRequester" = true
    JOIN "Person" per ON per.id = bp."personId"
    WHERE b."tenantId" = ${tenantId}
      AND b.status = 'PENDING'::"BookingStatus"
    ORDER BY lower(b.during) ASC, b."requestedAt" ASC
  `;

  return rows.map(mapPendingRow);
}

function mapPendingRow(row: PendingSqlRow): PendingBookingRow {
  return {
    id: row.id,
    pitchId: row.pitchId,
    pitchName: row.pitchName,
    start: asDate(row.start),
    end: asDate(row.end),
    requestedAt: asDate(row.requestedAt),
    requesterPersonId: row.requesterPersonId,
    requesterName: row.requesterName,
    requesterPhone: row.requesterPhone,
    requestedName: row.requestedName,
  };
}

/** Real totals behind the capped inbox (the caps are in domain/pending-inbox.ts). One query. */
export async function countPendingInboxTotals(
  tx: TenantTx,
  now: Date,
): Promise<{ upcoming: number; missed: number }> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<{ upcoming: bigint; missed: bigint }[]>`
    SELECT
      COUNT(*) FILTER (WHERE lower(b.during) > ${now})::bigint AS upcoming,
      COUNT(*) FILTER (WHERE lower(b.during) <= ${now})::bigint AS missed
    FROM "Booking" b
    WHERE b."tenantId" = ${tenantId} AND b.status = 'PENDING'::"BookingStatus"`;
  return { upcoming: Number(rows[0]?.upcoming ?? 0), missed: Number(rows[0]?.missed ?? 0) };
}

/**
 * The Requests inbox: the next 200 upcoming PENDING plus the 50 latest missed
 * ones, in start order. Approve and dismiss must see every row, so they keep
 * listPendingBookings.
 */
export async function listPendingInbox(
  tx: TenantTx,
  now: Date,
): Promise<PendingBookingRow[]> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<PendingSqlRow[]>`
    WITH picked AS (
      (SELECT b.id FROM "Booking" b
        WHERE b."tenantId" = ${tenantId}
          AND b.status = 'PENDING'::"BookingStatus"
          AND lower(b.during) > ${now}
        ORDER BY lower(b.during) ASC, b."requestedAt" ASC
        LIMIT ${PENDING_INBOX_UPCOMING_MAX})
      UNION ALL
      (SELECT b.id FROM "Booking" b
        WHERE b."tenantId" = ${tenantId}
          AND b.status = 'PENDING'::"BookingStatus"
          AND lower(b.during) <= ${now}
        ORDER BY lower(b.during) DESC, b."requestedAt" DESC
        LIMIT ${PENDING_INBOX_MISSED_MAX})
    )
    SELECT
      b.id,
      b."pitchId",
      p.name AS "pitchName",
      lower(b.during) AS start,
      upper(b.during) AS end,
      b."requestedAt",
      per.id AS "requesterPersonId",
      per.name AS "requesterName",
      per.phone AS "requesterPhone",
      b."requestedName"
    FROM picked
    JOIN "Booking" b ON b.id = picked.id AND b."tenantId" = ${tenantId}
    JOIN "Pitch" p ON p.id = b."pitchId"
    JOIN "BookingParticipant" bp ON bp."bookingId" = b.id AND bp."isRequester" = true
    JOIN "Person" per ON per.id = bp."personId"
    ORDER BY lower(b.during) ASC, b."requestedAt" ASC
  `;
  return rows.map(mapPendingRow);
}

/**
 * One read for the live badge: actionable PENDING only (slot start still ahead).
 * tenantId is in the SQL — the extension does not stamp $queryRaw.
 */
export async function countActionablePending(
  tx: TenantTx,
  now: Date,
): Promise<{ pendingCount: number; latestRequestedAt: Date | null }> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<
    { pendingCount: bigint; latestRequestedAt: Date | null }[]
  >`
    SELECT
      COUNT(*)::bigint AS "pendingCount",
      MAX(b."requestedAt") AS "latestRequestedAt"
    FROM "Booking" b
    WHERE b."tenantId" = ${tenantId}
      AND b.status = 'PENDING'::"BookingStatus"
      AND lower(b.during) > ${now}
  `;
  const row = rows[0];
  return {
    pendingCount: Number(row?.pendingCount ?? 0),
    latestRequestedAt: row?.latestRequestedAt
      ? asDate(row.latestRequestedAt)
      : null,
  };
}

/**
 * PENDING requests per pitch and slot start inside [from, to), one grouped query
 * (Today free strip badge). Never a row per request, never one query per slot.
 */
export async function countPendingBySlot(
  tx: TenantTx,
  from: Date,
  to: Date,
): Promise<{ pitchId: string; start: Date; count: number }[]> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<
    { pitchId: string; start: Date | string; count: bigint | number }[]
  >`
    SELECT "pitchId", lower(during) AS start, COUNT(*) AS count
    FROM "Booking"
    WHERE "tenantId" = ${tenantId}
      AND status = 'PENDING'::"BookingStatus"
      AND lower(during) >= ${from}
      AND lower(during) < ${to}
    GROUP BY "pitchId", lower(during)
  `;
  return rows.map((row) => ({
    pitchId: row.pitchId,
    start: asDate(row.start),
    count: Number(row.count),
  }));
}

/** Future PENDING requests where this person is the requester (public request cap, S-5). */
export async function countFuturePendingForRequester(
  tx: TenantTx,
  personId: string,
  now: Date,
): Promise<number> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n
    FROM "Booking" b
    JOIN "BookingParticipant" p ON p."bookingId" = b.id AND p."isRequester"
    WHERE b."tenantId" = ${tenantId}
      AND b.status = 'PENDING'
      AND p."personId" = ${personId}
      AND lower(b.during) > ${now}
  `;
  return Number(rows[0]?.n ?? 0);
}
