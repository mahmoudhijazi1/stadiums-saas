import { Prisma } from "@/generated/prisma/client";
import type { BookingStatus } from "@/generated/prisma/enums";
import type { TenantTx } from "@/lib/db";
import { getCurrentTenantId } from "@/lib/tenant-context";
import Decimal from "decimal.js";
import { asDate } from "./_shared";

/**
 * What the players of a game still owe the shop: the sum, over its player tabs, of the tab total
 * minus what was paid on it (never below zero per tab). A tab is a sale put on the booking with a
 * payer; the "on the game" sale is part of the booking due instead and is not counted here.
 * Uses the alias `b` for the booking row.
 */
const TABS_REMAINING_SQL = Prisma.sql`COALESCE((
  SELECT SUM(GREATEST(tab.total - tab.paid, 0))
  FROM (
    SELECT
      (SELECT COALESCE(SUM(si."lineTotalUsd"), 0) FROM "SaleItem" si WHERE si."saleId" = s.id) AS total,
      (SELECT COALESCE(SUM(t."usdEquivalent"), 0)
         FROM "Payment" pay JOIN "PaymentTender" t ON t."paymentId" = pay.id
        WHERE pay."tenantId" = s."tenantId"
          AND pay."sourceType" = 'SALE'::"PaymentSourceType"
          AND pay."sourceId" = s.id) AS paid
    FROM "Sale" s
    WHERE s."bookingId" = b.id AND s."tenantId" = b."tenantId"
      AND (s."payerPersonId" IS NOT NULL OR s."payerName" IS NOT NULL)
  ) tab
), 0)`;

export type LivePitchWindowRow = {
  start: Date;
  end: Date;
  status: "APPROVED" | "PENDING";
};

type LivePitchSqlRow = {
  start: Date | string;
  end: Date | string;
  status: "APPROVED" | "PENDING";
};

/**
 * Live APPROVED + PENDING on one pitch (hours-cover). Finished games
 * (`upper(during) <= now`) stay out of the query. Venue never imports this.
 */
export async function listLiveWindowsOnPitch(
  tx: TenantTx,
  pitchId: string,
  now: Date,
): Promise<LivePitchWindowRow[]> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<LivePitchSqlRow[]>`
    SELECT lower(during) AS start, upper(during) AS end, status
    FROM "Booking"
    WHERE "tenantId" = ${tenantId}
      AND "pitchId" = ${pitchId}
      AND status IN ('APPROVED'::"BookingStatus", 'PENDING'::"BookingStatus")
      AND upper(during) > ${now}
  `;
  return rows.map((row) => ({
    start: asDate(row.start),
    end: asDate(row.end),
    status: row.status,
  }));
}

export type DayBookingStatus = "APPROVED" | "CANCELLED" | "NO_SHOW";

export type DayBookingRow = {
  id: string;
  status: DayBookingStatus;
  pitchId: string;
  pitchName: string;
  start: Date;
  end: Date;
  priceUsd: Decimal;
  amountDueUsd: Decimal;
  collectedUsd: Decimal;
  /** Unpaid player tabs on this game (shop items charged to a player). Never part of the booking due. */
  tabsRemainingUsd: Decimal;
  collectionMode: "WHOLE" | "PER_PLAYER";
  requesterPersonId: string;
  requesterName: string;
  requesterPhone: string | null;
  pitchDefaultPlayerCount: number;
};

type DayBookingSqlRow = {
  id: string;
  status: DayBookingStatus;
  pitchId: string;
  pitchName: string;
  start: Date | string;
  end: Date | string;
  priceUsd: Decimal | string;
  amountDueUsd: Decimal | string;
  collectedUsd: Decimal | string | null;
  tabsRemainingUsd: Decimal | string | null;
  collectionMode: "WHOLE" | "PER_PLAYER";
  requesterPersonId: string;
  requesterName: string;
  requesterPhone: string | null;
  pitchDefaultPlayerCount: number;
};

function mapDayBooking(row: DayBookingSqlRow): DayBookingRow {
  return {
    id: row.id,
    status: row.status,
    pitchId: row.pitchId,
    pitchName: row.pitchName,
    start: asDate(row.start),
    end: asDate(row.end),
    priceUsd: new Decimal(row.priceUsd.toString()),
    amountDueUsd: new Decimal(row.amountDueUsd.toString()),
    collectedUsd: new Decimal((row.collectedUsd ?? 0).toString()),
    tabsRemainingUsd: new Decimal((row.tabsRemainingUsd ?? 0).toString()),
    collectionMode: row.collectionMode,
    requesterPersonId: row.requesterPersonId,
    requesterName: row.requesterName,
    requesterPhone: row.requesterPhone,
    pitchDefaultPlayerCount: row.pitchDefaultPlayerCount,
  };
}

/**
 * APPROVED, CANCELLED, and NO_SHOW whose start falls in `[from, to)`.
 * `from`/`to` are one business day's UTC bounds (`businessDayUtcRange`, 06:00 to 06:00
 * Beirut). Filtering on lower(during) keeps the ("tenantId", lower(during)) index.
 * Collected USD is the sum of tenders, any collection date.
 */
export async function listBookingsForStartDay(
  tx: TenantTx,
  from: Date,
  to: Date,
): Promise<DayBookingRow[]> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<DayBookingSqlRow[]>`
    SELECT
      b.id,
      b.status,
      b."pitchId",
      p.name AS "pitchName",
      p."defaultPlayerCount" AS "pitchDefaultPlayerCount",
      lower(b.during) AS start,
      upper(b.during) AS end,
      b."priceUsd",
      b."amountDueUsd",
      b."collectionMode"::text AS "collectionMode",
      COALESCE((
        SELECT SUM(t."usdEquivalent")
        FROM "Payment" pay
        JOIN "PaymentTender" t ON t."paymentId" = pay.id
        WHERE pay."tenantId" = b."tenantId"
          AND pay."sourceType" = 'BOOKING'::"PaymentSourceType"
          AND pay."sourceId" = b.id
      ), 0) AS "collectedUsd",
      ${TABS_REMAINING_SQL} AS "tabsRemainingUsd",
      per.id AS "requesterPersonId",
      per.name AS "requesterName",
      per.phone AS "requesterPhone"
    FROM "Booking" b
    JOIN "Pitch" p ON p.id = b."pitchId"
    JOIN "BookingParticipant" bp ON bp."bookingId" = b.id AND bp."isRequester" = true
    JOIN "Person" per ON per.id = bp."personId"
    WHERE b."tenantId" = ${tenantId}
      AND b.status IN (
        'APPROVED'::"BookingStatus",
        'CANCELLED'::"BookingStatus",
        'NO_SHOW'::"BookingStatus"
      )
      AND lower(b.during) >= ${from}
      AND lower(b.during) < ${to}
    ORDER BY lower(b.during) ASC, b.id ASC
  `;
  return rows.map(mapDayBooking);
}

/**
 * Owed bookings, oldest start first. Same split as classifyDue:
 * ended APPROVED, any NO_SHOW, any CANCELLED, each with due above collected or an unpaid player tab.
 * `limit` includes one extra row so the caller can tell there is more.
 */
export async function listEndedWithRemaining(
  tx: TenantTx,
  now: Date,
  limit: number,
): Promise<DayBookingRow[]> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<DayBookingSqlRow[]>`
    SELECT
      b.id,
      b.status,
      b."pitchId",
      p.name AS "pitchName",
      p."defaultPlayerCount" AS "pitchDefaultPlayerCount",
      lower(b.during) AS start,
      upper(b.during) AS end,
      b."priceUsd",
      b."amountDueUsd",
      b."collectionMode"::text AS "collectionMode",
      COALESCE(collected.usd, 0) AS "collectedUsd",
      tabs.usd AS "tabsRemainingUsd",
      per.id AS "requesterPersonId",
      per.name AS "requesterName",
      per.phone AS "requesterPhone"
    FROM "Booking" b
    JOIN "Pitch" p ON p.id = b."pitchId"
    JOIN "BookingParticipant" bp ON bp."bookingId" = b.id AND bp."isRequester" = true
    JOIN "Person" per ON per.id = bp."personId"
    JOIN LATERAL (
      SELECT COALESCE(SUM(t."usdEquivalent"), 0) AS usd
      FROM "Payment" pay
      JOIN "PaymentTender" t ON t."paymentId" = pay.id
      WHERE pay."tenantId" = b."tenantId"
        AND pay."sourceType" = 'BOOKING'::"PaymentSourceType"
        AND pay."sourceId" = b.id
    ) collected ON true
    JOIN LATERAL (SELECT ${TABS_REMAINING_SQL} AS usd) tabs ON true
    WHERE b."tenantId" = ${tenantId}
      AND (b."amountDueUsd" > collected.usd OR tabs.usd > 0)
      AND (
        (
          b.status = 'APPROVED'::"BookingStatus"
          AND upper(b.during) <= ${now}
        )
        OR b.status IN (
          'NO_SHOW'::"BookingStatus",
          'CANCELLED'::"BookingStatus"
        )
      )
    ORDER BY lower(b.during) ASC, b.id ASC
    LIMIT ${limit}
  `;
  return rows.map(mapDayBooking);
}
