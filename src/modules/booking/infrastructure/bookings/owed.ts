import { Prisma } from "@/generated/prisma/client";
import type { BookingStatus } from "@/generated/prisma/enums";
import type { TenantTx } from "@/lib/db";
import { getCurrentTenantId } from "@/lib/tenant-context";
import Decimal from "decimal.js";
import type { GameCurrency } from "@/modules/booking/domain/game-money";
import { gameOwing, shareOwing } from "@/modules/booking/domain/game-owing";
import { asDate, SETTLED_LBP_SQL, type SqlMoney } from "./_shared";

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
  /** The game's currency; every amount below is in it (DR-007). */
  currency: GameCurrency;
  amountDue: Decimal;
  collected: Decimal;
  participantDue: Decimal;
  allocated: Decimal;
};

/**
 * Every participant of every booking with money still due (an ended approved game, any
 * no-show, any cancelled fee), one query and no per-person lookups. Slots with no person
 * come through with a null personId. The caller classifies and groups.
 * A USD game is owed when its due is above its tenders; an LBP game when its due is above what its
 * settlements applied (DR-007). Each row carries its game's currency and its amounts in it, so the
 * caller totals per currency and an LBP game is never left out or read as dollars.
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
      settledLbp: SqlMoney;
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
      ${SETTLED_LBP_SQL} AS "settledLbp",
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
      AND (
        (b."priceCurrency" = 'USD'::"Currency" AND b."amountDueUsd" > collected.usd)
        OR (b."priceCurrency" = 'LBP'::"Currency" AND b."amountDueLbp" > ${SETTLED_LBP_SQL})
      )
      AND ${endedOrFee}
    ORDER BY lower(b.during) DESC, b.id DESC, bp."slotNumber" ASC NULLS FIRST
  `;
  return rows.map((row) => {
    const game = gameOwing(row);
    const share = shareOwing({
      currency: game.currency,
      amountDueUsd: row.participantDueUsd,
      amountDueLbp: row.participantDueLbp,
      allocatedUsd: row.allocatedUsd,
      allocatedLbp: row.allocatedLbp,
      where: "owed.share",
    });
    return {
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
      currency: game.currency,
      amountDue: game.due,
      collected: game.collected,
      participantDue: share.due,
      allocated: share.allocated,
    };
  });
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
