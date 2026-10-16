import { Prisma } from "@/generated/prisma/client";
import type { BookingStatus } from "@/generated/prisma/enums";
import type { TenantTx } from "@/lib/db";
import { getCurrentTenantId } from "@/lib/tenant-context";
import Decimal from "decimal.js";
import { gameDue, requireUsd, shareDue, type GameCurrency } from "@/modules/booking/domain/game-money";
import { asDate, refuseLbpGames, usdSumOnly, type SqlMoney } from "./_shared";

export type OwedParticipationSqlRow = {
  bookingId: string;
  status: string;
  start: Date;
  end: Date;
  collectionMode: string;
  pitchName: string;
  personId: string | null;
  personName: string | null;
  personPhone: string | null;
  isRequester: boolean;
  amountDueUsd: Decimal;
  collectedUsd: Decimal;
  participantDueUsd: Decimal;
  allocatedUsd: Decimal;
};

/**
 * Every participant of every booking with money still due (an ended approved game, any
 * no-show, any cancelled fee), one query and no per-person lookups. Slots with no person
 * come through with a null personId. The caller classifies and groups.
 * The due comparison is in dollars: only USD games are kept, and an LBP game that would match is
 * refused (`booking.lbp_not_supported`) instead of being left out of the total (DR-007).
 */
export async function listOwedParticipations(
  tx: TenantTx,
  now: Date,
): Promise<OwedParticipationSqlRow[]> {
  const tenantId = await getCurrentTenantId();
  const endedOrFee = Prisma.sql`(
        (b.status = 'APPROVED'::"BookingStatus" AND upper(b.during) <= ${now})
        OR b.status IN ('NO_SHOW'::"BookingStatus", 'CANCELLED'::"BookingStatus")
      )`;
  await refuseLbpGames(tx, endedOrFee, "listOwedParticipations");
  const rows = await tx.$queryRaw<
    {
      bookingId: string;
      status: string;
      start: Date | string;
      end: Date | string;
      collectionMode: string;
      pitchName: string;
      personId: string | null;
      personName: string | null;
      personPhone: string | null;
      isRequester: boolean;
      priceCurrency: GameCurrency;
      amountDueUsd: SqlMoney;
      amountDueLbp: SqlMoney;
      collectedUsd: { toString(): string } | null;
      participantDueUsd: SqlMoney;
      participantDueLbp: SqlMoney;
      allocatedUsd: SqlMoney;
      allocatedLbp: SqlMoney;
    }[]
  >`
    SELECT
      b.id AS "bookingId",
      b.status::text AS status,
      lower(b.during) AS start,
      upper(b.during) AS end,
      b."collectionMode"::text AS "collectionMode",
      p.name AS "pitchName",
      bp."personId",
      per.name AS "personName",
      per.phone AS "personPhone",
      bp."isRequester",
      b."priceCurrency"::text AS "priceCurrency",
      b."amountDueUsd",
      b."amountDueLbp",
      collected.usd AS "collectedUsd",
      bp."amountDueUsd" AS "participantDueUsd",
      bp."amountDueLbp" AS "participantDueLbp",
      alloc.usd AS "allocatedUsd",
      alloc.lbp AS "allocatedLbp"
    FROM "Booking" b
    JOIN "Pitch" p ON p.id = b."pitchId"
    JOIN LATERAL (
      SELECT COALESCE(SUM(t."usdEquivalent"), 0) AS usd
      FROM "Payment" pay
      JOIN "PaymentTender" t ON t."paymentId" = pay.id
      WHERE pay."tenantId" = b."tenantId"
        AND pay."sourceType" = 'BOOKING'::"PaymentSourceType"
        AND pay."sourceId" = b.id
    ) collected ON true
    JOIN "BookingParticipant" bp ON bp."bookingId" = b.id AND bp."tenantId" = b."tenantId"
    LEFT JOIN "Person" per ON per.id = bp."personId"
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(a."amountUsd"), 0) AS usd, COALESCE(SUM(a."amountLbp"), 0) AS lbp
      FROM "PaymentAllocation" a
      WHERE a."tenantId" = bp."tenantId"
        AND a."participantId" = bp.id
    ) alloc ON true
    WHERE b."tenantId" = ${tenantId}
      AND b."priceCurrency" = 'USD'::"Currency"
      AND b."amountDueUsd" > collected.usd
      AND ${endedOrFee}
    ORDER BY lower(b.during) DESC, b.id DESC, bp."slotNumber" ASC NULLS FIRST
  `;
  return rows.map((row) => ({
    bookingId: row.bookingId,
    status: row.status,
    start: asDate(row.start),
    end: asDate(row.end),
    collectionMode: row.collectionMode,
    pitchName: row.pitchName,
    personId: row.personId,
    personName: row.personName,
    personPhone: row.personPhone,
    isRequester: row.isRequester,
    amountDueUsd: requireUsd(gameDue(row), "owed.amountDueUsd"),
    collectedUsd: new Decimal((row.collectedUsd ?? 0).toString()),
    participantDueUsd: requireUsd(
      shareDue({ amountDueUsd: row.participantDueUsd, amountDueLbp: row.participantDueLbp }),
      "owed.participantDueUsd",
    ),
    allocatedUsd: usdSumOnly(row.allocatedUsd, row.allocatedLbp, "owed.allocatedUsd"),
  }));
}

export type OwedTabSqlRow = {
  saleId: string;
  bookingId: string;
  status: string;
  start: Date;
  end: Date;
  pitchName: string;
  /** Null when the tab was opened under a typed name. */
  personId: string | null;
  name: string;
  phone: string | null;
  remainingUsd: Decimal;
};

/**
 * Every unpaid player tab on a game that is owed (an ended approved game, any no-show, any
 * cancelled booking): one query. A tab is never part of the booking due, so the other owed reads
 * do not see it; the owed summary adds these rows.
 */
export async function listOwedTabs(tx: TenantTx, now: Date): Promise<OwedTabSqlRow[]> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<
    {
      saleId: string;
      bookingId: string;
      status: string;
      start: Date | string;
      end: Date | string;
      pitchName: string;
      personId: string | null;
      name: string;
      phone: string | null;
      remainingUsd: { toString(): string };
    }[]
  >`
    SELECT
      s.id AS "saleId",
      b.id AS "bookingId",
      b.status::text AS status,
      lower(b.during) AS start,
      upper(b.during) AS end,
      p.name AS "pitchName",
      s."payerPersonId" AS "personId",
      COALESCE(per.name, s."payerName") AS name,
      COALESCE(per.phone, s."payerPhone") AS phone,
      (tab.total - tab.paid) AS "remainingUsd"
    FROM "Sale" s
    JOIN "Booking" b ON b.id = s."bookingId"
    JOIN "Pitch" p ON p.id = b."pitchId"
    LEFT JOIN "Person" per ON per.id = s."payerPersonId"
    JOIN LATERAL (
      SELECT
        (SELECT COALESCE(SUM(si."lineTotalUsd"), 0) FROM "SaleItem" si WHERE si."saleId" = s.id) AS total,
        (SELECT COALESCE(SUM(t."usdEquivalent"), 0)
           FROM "Payment" pay JOIN "PaymentTender" t ON t."paymentId" = pay.id
          WHERE pay."tenantId" = s."tenantId"
            AND pay."sourceType" = 'SALE'::"PaymentSourceType"
            AND pay."sourceId" = s.id) AS paid
    ) tab ON true
    WHERE s."tenantId" = ${tenantId}
      AND (s."payerPersonId" IS NOT NULL OR s."payerName" IS NOT NULL)
      AND tab.total - tab.paid > 0
      AND (
        (b.status = 'APPROVED'::"BookingStatus" AND upper(b.during) <= ${now})
        OR b.status IN ('NO_SHOW'::"BookingStatus", 'CANCELLED'::"BookingStatus")
      )
    ORDER BY lower(b.during) DESC, s.id DESC
  `;
  return rows.map((row) => ({
    saleId: row.saleId,
    bookingId: row.bookingId,
    status: row.status,
    start: asDate(row.start),
    end: asDate(row.end),
    pitchName: row.pitchName,
    personId: row.personId,
    name: row.name,
    phone: row.phone,
    remainingUsd: new Decimal(row.remainingUsd.toString()),
  }));
}
