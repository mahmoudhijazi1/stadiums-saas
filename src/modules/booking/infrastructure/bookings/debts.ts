import { Prisma } from "@/generated/prisma/client";
import type { BookingStatus } from "@/generated/prisma/enums";
import type { TenantTx } from "@/lib/db";
import { getCurrentTenantId } from "@/lib/tenant-context";
import Decimal from "decimal.js";
import { asDate } from "./_shared";

export type DebtParticipationSqlRow = {
  personId: string;
  bookingId: string;
  status: "APPROVED" | "CANCELLED" | "NO_SHOW";
  start: Date;
  end: Date;
  collectionMode: "WHOLE" | "PER_PLAYER";
  isRequester: boolean;
  amountDueUsd: Decimal;
  collectedUsd: Decimal;
  participantDueUsd: Decimal;
  allocatedUsd: Decimal;
  reason: string | null;
};

type DebtParticipationRaw = {
  personId: string;
  bookingId: string;
  status: "APPROVED" | "CANCELLED" | "NO_SHOW";
  start: Date | string;
  end: Date | string;
  collectionMode: "WHOLE" | "PER_PLAYER";
  isRequester: boolean;
  amountDueUsd: Decimal | string;
  collectedUsd: Decimal | string | null;
  participantDueUsd: Decimal | string;
  allocatedUsd: Decimal | string | null;
  reason: string | null;
};

/**
 * Participations for many people, one query. Latest due-change reason rides along.
 * Caller passes the person ids on this screen. Empty list does not hit the database.
 */
export async function listDebtParticipations(
  tx: TenantTx,
  personIds: string[],
): Promise<DebtParticipationSqlRow[]> {
  if (personIds.length === 0) return [];
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<DebtParticipationRaw[]>`
    SELECT
      bp."personId",
      b.id AS "bookingId",
      b.status::text AS status,
      lower(b.during) AS start,
      upper(b.during) AS end,
      b."collectionMode"::text AS "collectionMode",
      bp."isRequester",
      b."amountDueUsd",
      bp."amountDueUsd" AS "participantDueUsd",
      COALESCE(collected.usd, 0) AS "collectedUsd",
      COALESCE(alloc.usd, 0) AS "allocatedUsd",
      latest.reason::text AS reason
    FROM "BookingParticipant" bp
    JOIN "Booking" b ON b.id = bp."bookingId"
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
    LEFT JOIN LATERAL (
      SELECT d.reason
      FROM "BookingDueChange" d
      WHERE d."tenantId" = b."tenantId"
        AND d."bookingId" = b.id
      ORDER BY d."createdAt" DESC
      LIMIT 1
    ) latest ON true
    WHERE bp."tenantId" = ${tenantId}
      AND bp."personId" IN (${Prisma.join(personIds)})
      AND bp."personId" IS NOT NULL
      AND b.status IN (
        'APPROVED'::"BookingStatus",
        'CANCELLED'::"BookingStatus",
        'NO_SHOW'::"BookingStatus"
      )
  `;
  return rows.map((row) => ({
    personId: row.personId,
    bookingId: row.bookingId,
    status: row.status,
    start: asDate(row.start),
    end: asDate(row.end),
    collectionMode: row.collectionMode,
    isRequester: row.isRequester,
    amountDueUsd: new Decimal(row.amountDueUsd.toString()),
    collectedUsd: new Decimal((row.collectedUsd ?? 0).toString()),
    participantDueUsd: new Decimal(row.participantDueUsd.toString()),
    allocatedUsd: new Decimal((row.allocatedUsd ?? 0).toString()),
    reason: row.reason,
  }));
}
