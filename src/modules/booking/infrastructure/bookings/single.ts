import type { BookingStatus } from "@/generated/prisma/enums";
import type { TenantTx } from "@/lib/db";
import { getCurrentTenantId } from "@/lib/tenant-context";
import Decimal from "decimal.js";
import { asDate, BookingSqlRow, toBookingForDecision } from "./_shared";

export type BookingForDecision = {
  id: string;
  pitchId: string;
  status: BookingStatus;
  start: Date;
  end: Date;
  priceUsd: Decimal;
  amountDueUsd: Decimal;
  collectionMode: "WHOLE" | "PER_PLAYER";
};

/**
 * One booking on this tenant, with during. Missing → null (wrong id or other stadium).
 */
export async function findBookingForDecision(
  tx: TenantTx,
  bookingId: string,
): Promise<BookingForDecision | null> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<BookingSqlRow[]>`
    SELECT
      id,
      "pitchId",
      status,
      lower(during) AS start,
      upper(during) AS end,
      "priceUsd",
      "amountDueUsd",
      "collectionMode"::text AS "collectionMode"
    FROM "Booking"
    WHERE id = ${bookingId} AND "tenantId" = ${tenantId}
  `;
  const row = rows[0];
  return row ? toBookingForDecision(row) : null;
}

export type BookingRequesterRow = {
  id: string;
  status: BookingStatus;
  pitchId: string;
  pitchName: string;
  start: Date;
  end: Date;
  requesterPersonId: string;
  requesterName: string;
  requesterPhone: string | null;
};

type BookingRequesterSqlRow = {
  id: string;
  status: BookingStatus;
  pitchId: string;
  pitchName: string;
  start: Date | string;
  end: Date | string;
  requesterPersonId: string;
  requesterName: string;
  requesterPhone: string | null;
};

/**
 * One booking plus its requester, any status. Missing → null.
 */
export async function findBookingRequester(
  tx: TenantTx,
  bookingId: string,
): Promise<BookingRequesterRow | null> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<BookingRequesterSqlRow[]>`
    SELECT
      b.id,
      b.status::text AS status,
      b."pitchId",
      p.name AS "pitchName",
      lower(b.during) AS start,
      upper(b.during) AS end,
      per.id AS "requesterPersonId",
      per.name AS "requesterName",
      per.phone AS "requesterPhone"
    FROM "Booking" b
    JOIN "Pitch" p ON p.id = b."pitchId"
    JOIN "BookingParticipant" bp ON bp."bookingId" = b.id AND bp."isRequester" = true
    JOIN "Person" per ON per.id = bp."personId"
    WHERE b.id = ${bookingId} AND b."tenantId" = ${tenantId}
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    pitchId: row.pitchId,
    pitchName: row.pitchName,
    start: asDate(row.start),
    end: asDate(row.end),
    requesterPersonId: row.requesterPersonId,
    requesterName: row.requesterName,
    requesterPhone: row.requesterPhone,
  };
}

export type BookingFeeState = {
  id: string;
  status: BookingStatus;
  pitchName: string;
  start: Date;
  amountDueUsd: Decimal;
  collectedUsd: Decimal;
  requesterPersonId: string;
  requesterName: string;
  requesterPhone: string | null;
  dueNote: string | null;
  dueToUsd: Decimal | null;
};

type BookingFeeSqlRow = {
  id: string;
  status: BookingStatus;
  pitchName: string;
  start: Date | string;
  amountDueUsd: Decimal | string;
  collectedUsd: Decimal | string | null;
  requesterPersonId: string;
  requesterName: string;
  requesterPhone: string | null;
  dueNote: string | null;
  dueToUsd: Decimal | string | null;
};

/**
 * Saved due, collected, and the latest due-change note. Used to build a
 * WhatsApp body after cancel, no-show, or adjust — not from the form.
 */
export async function findBookingFeeState(
  tx: TenantTx,
  bookingId: string,
): Promise<BookingFeeState | null> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<BookingFeeSqlRow[]>`
    SELECT
      b.id,
      b.status::text AS status,
      p.name AS "pitchName",
      lower(b.during) AS start,
      b."amountDueUsd",
      COALESCE(collected.usd, 0) AS "collectedUsd",
      per.id AS "requesterPersonId",
      per.name AS "requesterName",
      per.phone AS "requesterPhone",
      latest.note AS "dueNote",
      latest."toUsd" AS "dueToUsd"
    FROM "Booking" b
    JOIN "Pitch" p ON p.id = b."pitchId"
    JOIN "BookingParticipant" bp ON bp."bookingId" = b.id AND bp."isRequester" = true
    JOIN "Person" per ON per.id = bp."personId"
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(t."usdEquivalent"), 0) AS usd
      FROM "Payment" pay
      JOIN "PaymentTender" t ON t."paymentId" = pay.id
      WHERE pay."tenantId" = b."tenantId"
        AND pay."sourceType" = 'BOOKING'::"PaymentSourceType"
        AND pay."sourceId" = b.id
    ) collected ON true
    LEFT JOIN LATERAL (
      SELECT d.note, d."toUsd"
      FROM "BookingDueChange" d
      WHERE d."tenantId" = b."tenantId"
        AND d."bookingId" = b.id
      ORDER BY d."createdAt" DESC
      LIMIT 1
    ) latest ON true
    WHERE b.id = ${bookingId} AND b."tenantId" = ${tenantId}
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    pitchName: row.pitchName,
    start: asDate(row.start),
    amountDueUsd: new Decimal(row.amountDueUsd.toString()),
    collectedUsd: new Decimal((row.collectedUsd ?? 0).toString()),
    requesterPersonId: row.requesterPersonId,
    requesterName: row.requesterName,
    requesterPhone: row.requesterPhone,
    dueNote: row.dueNote,
    dueToUsd:
      row.dueToUsd === null || row.dueToUsd === undefined
        ? null
        : new Decimal(row.dueToUsd.toString()),
  };
}

/**
 * Requester person on this booking (for slot_interests). Guard scopes the participant.
 */
export async function findRequesterPersonId(
  tx: TenantTx,
  bookingId: string,
): Promise<string | null> {
  const row = await tx.bookingParticipant.findFirst({
    where: { bookingId, isRequester: true },
    select: { personId: true },
  });
  return row?.personId ?? null;
}
