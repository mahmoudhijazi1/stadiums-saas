import type { BookingStatus } from "@/generated/prisma/enums";
import type { TenantTx } from "@/lib/db";
import { getCurrentTenantId } from "@/lib/tenant-context";
import Decimal from "decimal.js";
import { asDate } from "./_shared";
import { DayBookingStatus } from "./day";

export type PersonHistoryRow = {
  id: string;
  status: DayBookingStatus;
  pitchName: string;
  start: Date;
  end: Date;
  priceUsd: Decimal;
  amountDueUsd: Decimal;
  collectedUsd: Decimal;
  collectionMode: "WHOLE" | "PER_PLAYER";
  isRequester: boolean;
  participantDueUsd: Decimal;
  allocatedUsd: Decimal;
};

type PersonHistorySqlRow = {
  id: string;
  status: DayBookingStatus;
  pitchName: string;
  start: Date | string;
  end: Date | string;
  priceUsd: Decimal | string;
  amountDueUsd: Decimal | string;
  collectedUsd: Decimal | string | null;
  collectionMode: "WHOLE" | "PER_PLAYER";
  isRequester: boolean;
  participantDueUsd: Decimal | string;
  allocatedUsd: Decimal | string | null;
};

function mapPersonHistory(row: PersonHistorySqlRow): PersonHistoryRow {
  return {
    id: row.id,
    status: row.status,
    pitchName: row.pitchName,
    start: asDate(row.start),
    end: asDate(row.end),
    priceUsd: new Decimal(row.priceUsd.toString()),
    amountDueUsd: new Decimal(row.amountDueUsd.toString()),
    collectedUsd: new Decimal((row.collectedUsd ?? 0).toString()),
    collectionMode: row.collectionMode,
    isRequester: row.isRequester,
    participantDueUsd: new Decimal(row.participantDueUsd.toString()),
    allocatedUsd: new Decimal((row.allocatedUsd ?? 0).toString()),
  };
}

/**
 * Participations for one person, newest start first.
 * Keyset is (lower(during), booking id). `limit` includes one extra row.
 */
export async function listPersonBookingRows(
  tx: TenantTx,
  personId: string,
  cursor: { start: Date; id: string } | null,
  limit: number,
): Promise<PersonHistoryRow[]> {
  const tenantId = await getCurrentTenantId();
  const rows = cursor
    ? await tx.$queryRaw<PersonHistorySqlRow[]>`
        SELECT
          b.id,
          b.status,
          p.name AS "pitchName",
          lower(b.during) AS start,
          upper(b.during) AS end,
          b."priceUsd",
          b."amountDueUsd",
          b."collectionMode"::text AS "collectionMode",
          bp."isRequester",
          bp."amountDueUsd" AS "participantDueUsd",
          COALESCE(collected.usd, 0) AS "collectedUsd",
          COALESCE(alloc.usd, 0) AS "allocatedUsd"
        FROM "BookingParticipant" bp
        JOIN "Booking" b ON b.id = bp."bookingId"
        JOIN "Pitch" p ON p.id = b."pitchId"
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(t."usdEquivalent"), 0) AS usd
          FROM "Payment" pay
          JOIN "PaymentTender" t ON t."paymentId" = pay.id
          WHERE pay."tenantId" = b."tenantId"
            AND pay."sourceType" = 'BOOKING'::"PaymentSourceType"
            AND pay."sourceId" = b.id
        ) collected ON true
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(a."amountUsd"), 0) AS usd
          FROM "PaymentAllocation" a
          WHERE a."tenantId" = bp."tenantId"
            AND a."participantId" = bp.id
        ) alloc ON true
        WHERE bp."tenantId" = ${tenantId}
          AND bp."personId" = ${personId}
          AND b.status IN (
            'APPROVED'::"BookingStatus",
            'CANCELLED'::"BookingStatus",
            'NO_SHOW'::"BookingStatus"
          )
          AND (
            lower(b.during) < ${cursor.start}
            OR (lower(b.during) = ${cursor.start} AND b.id < ${cursor.id})
          )
        ORDER BY lower(b.during) DESC, b.id DESC
        LIMIT ${limit}
      `
    : await tx.$queryRaw<PersonHistorySqlRow[]>`
        SELECT
          b.id,
          b.status,
          p.name AS "pitchName",
          lower(b.during) AS start,
          upper(b.during) AS end,
          b."priceUsd",
          b."amountDueUsd",
          b."collectionMode"::text AS "collectionMode",
          bp."isRequester",
          bp."amountDueUsd" AS "participantDueUsd",
          COALESCE(collected.usd, 0) AS "collectedUsd",
          COALESCE(alloc.usd, 0) AS "allocatedUsd"
        FROM "BookingParticipant" bp
        JOIN "Booking" b ON b.id = bp."bookingId"
        JOIN "Pitch" p ON p.id = b."pitchId"
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(t."usdEquivalent"), 0) AS usd
          FROM "Payment" pay
          JOIN "PaymentTender" t ON t."paymentId" = pay.id
          WHERE pay."tenantId" = b."tenantId"
            AND pay."sourceType" = 'BOOKING'::"PaymentSourceType"
            AND pay."sourceId" = b.id
        ) collected ON true
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(a."amountUsd"), 0) AS usd
          FROM "PaymentAllocation" a
          WHERE a."tenantId" = bp."tenantId"
            AND a."participantId" = bp.id
        ) alloc ON true
        WHERE bp."tenantId" = ${tenantId}
          AND bp."personId" = ${personId}
          AND b.status IN (
            'APPROVED'::"BookingStatus",
            'CANCELLED'::"BookingStatus",
            'NO_SHOW'::"BookingStatus"
          )
        ORDER BY lower(b.during) DESC, b.id DESC
        LIMIT ${limit}
      `;
  return rows.map(mapPersonHistory);
}

/** Every participation used by person stats. One query, folded in domain. */
export async function listPersonStatRows(
  tx: TenantTx,
  personId: string,
): Promise<PersonHistoryRow[]> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<PersonHistorySqlRow[]>`
    SELECT
      b.id,
      b.status,
      p.name AS "pitchName",
      lower(b.during) AS start,
      upper(b.during) AS end,
      b."priceUsd",
      b."amountDueUsd",
      b."collectionMode"::text AS "collectionMode",
      bp."isRequester",
      bp."amountDueUsd" AS "participantDueUsd",
      COALESCE(collected.usd, 0) AS "collectedUsd",
      COALESCE(alloc.usd, 0) AS "allocatedUsd"
    FROM "BookingParticipant" bp
    JOIN "Booking" b ON b.id = bp."bookingId"
    JOIN "Pitch" p ON p.id = b."pitchId"
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(t."usdEquivalent"), 0) AS usd
      FROM "Payment" pay
      JOIN "PaymentTender" t ON t."paymentId" = pay.id
      WHERE pay."tenantId" = b."tenantId"
        AND pay."sourceType" = 'BOOKING'::"PaymentSourceType"
        AND pay."sourceId" = b.id
    ) collected ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(a."amountUsd"), 0) AS usd
      FROM "PaymentAllocation" a
      WHERE a."tenantId" = bp."tenantId"
        AND a."participantId" = bp.id
    ) alloc ON true
    WHERE bp."tenantId" = ${tenantId}
      AND bp."personId" = ${personId}
      AND b.status IN (
        'APPROVED'::"BookingStatus",
        'CANCELLED'::"BookingStatus",
        'NO_SHOW'::"BookingStatus"
      )
  `;
  return rows.map(mapPersonHistory);
}
