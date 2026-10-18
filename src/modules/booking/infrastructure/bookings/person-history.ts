import type { BookingStatus } from "@/generated/prisma/enums";
import type { TenantTx } from "@/lib/db";
import { getCurrentTenantId } from "@/lib/tenant-context";
import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import {
  gameDue,
  gamePrice,
  requireUsd,
  shareDue,
  type GameCurrency,
  type GameMoney,
} from "@/modules/booking/domain/game-money";
import { asDate, usdSumOnly, type SqlMoney } from "./_shared";
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
  priceCurrency: GameCurrency;
  priceUsd: SqlMoney;
  amountDueUsd: SqlMoney;
  priceLbp: SqlMoney;
  amountDueLbp: SqlMoney;
  collectedUsd: Decimal | string | null;
  collectionMode: "WHOLE" | "PER_PLAYER";
  isRequester: boolean;
  participantDueUsd: SqlMoney;
  participantDueLbp: SqlMoney;
  allocatedUsd: SqlMoney;
  allocatedLbp: SqlMoney;
};

/**
 * No money filter in these reads: every participation of the person comes back, and an LBP game
 * throws `booking.lbp_not_supported` here (DR-007) instead of being read as dollars or left out.
 */
function mapPersonHistory(row: PersonHistorySqlRow): PersonHistoryRow {
  return {
    id: row.id,
    status: row.status,
    pitchName: row.pitchName,
    start: asDate(row.start),
    end: asDate(row.end),
    priceUsd: requireUsd(gamePrice(row), "person-history.priceUsd"),
    amountDueUsd: requireUsd(gameDue(row), "person-history.amountDueUsd"),
    collectedUsd: new Decimal((row.collectedUsd ?? 0).toString()),
    collectionMode: row.collectionMode,
    isRequester: row.isRequester,
    participantDueUsd: requireUsd(
      shareDue({ amountDueUsd: row.participantDueUsd, amountDueLbp: row.participantDueLbp }),
      "person-history.participantDueUsd",
    ),
    allocatedUsd: usdSumOnly(row.allocatedUsd, row.allocatedLbp, "person-history.allocatedUsd"),
  };
}

/** One participation on the person page's game list, its money in the game's own currency (DR-007). */
export type PersonGameRow = {
  id: string;
  status: DayBookingStatus;
  pitchName: string;
  start: Date;
  end: Date;
  collectionMode: "WHOLE" | "PER_PLAYER";
  isRequester: boolean;
  price: GameMoney;
  amountDue: GameMoney;
  participantDue: GameMoney;
  /** Paid on the game, and on this person's share, in the game's currency. */
  collected: GameMoney;
  allocated: GameMoney;
};

/**
 * Slice 5: an LBP game is listed in pounds. Nothing can be collected on it until DR-007 slice 6, so
 * a dollar tender or allocation on one is refused here instead of being shown as pounds.
 */
function mapPersonGame(row: PersonHistorySqlRow): PersonGameRow {
  const amountDue = gameDue(row);
  const base = {
    id: row.id,
    status: row.status,
    pitchName: row.pitchName,
    start: asDate(row.start),
    end: asDate(row.end),
    collectionMode: row.collectionMode,
    isRequester: row.isRequester,
    price: gamePrice(row),
    amountDue,
    participantDue: shareDue({ amountDueUsd: row.participantDueUsd, amountDueLbp: row.participantDueLbp }),
  };
  const collectedUsd = new Decimal((row.collectedUsd ?? 0).toString());
  if (amountDue.currency === "LBP") {
    if (collectedUsd.gt(0) || new Decimal((row.allocatedUsd ?? 0).toString()).gt(0)) {
      throw new DomainError("booking.lbp_not_supported", { where: "person-games.collected" });
    }
    return {
      ...base,
      collected: { currency: "LBP", amount: new Decimal(0) },
      allocated: { currency: "LBP", amount: new Decimal((row.allocatedLbp ?? 0).toString()) },
    };
  }
  return {
    ...base,
    collected: { currency: "USD", amount: collectedUsd },
    allocated: { currency: "USD", amount: usdSumOnly(row.allocatedUsd, row.allocatedLbp, "person-games.allocatedUsd") },
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
): Promise<PersonGameRow[]> {
  const tenantId = await getCurrentTenantId();
  const rows = cursor
    ? await tx.$queryRaw<PersonHistorySqlRow[]>`
        SELECT
          b.id,
          b.status,
          p.name AS "pitchName",
          lower(b.during) AS start,
          upper(b.during) AS end,
          b."priceCurrency"::text AS "priceCurrency",
          b."priceUsd",
          b."amountDueUsd",
          b."priceLbp",
          b."amountDueLbp",
          b."collectionMode"::text AS "collectionMode",
          bp."isRequester",
          bp."amountDueUsd" AS "participantDueUsd",
          bp."amountDueLbp" AS "participantDueLbp",
          COALESCE(collected.usd, 0) AS "collectedUsd",
          COALESCE(alloc.usd, 0) AS "allocatedUsd",
          COALESCE(alloc.lbp, 0) AS "allocatedLbp"
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
          SELECT COALESCE(SUM(a."amountUsd"), 0) AS usd, COALESCE(SUM(a."amountLbp"), 0) AS lbp
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
          b."priceCurrency"::text AS "priceCurrency",
          b."priceUsd",
          b."amountDueUsd",
          b."priceLbp",
          b."amountDueLbp",
          b."collectionMode"::text AS "collectionMode",
          bp."isRequester",
          bp."amountDueUsd" AS "participantDueUsd",
          bp."amountDueLbp" AS "participantDueLbp",
          COALESCE(collected.usd, 0) AS "collectedUsd",
          COALESCE(alloc.usd, 0) AS "allocatedUsd",
          COALESCE(alloc.lbp, 0) AS "allocatedLbp"
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
          SELECT COALESCE(SUM(a."amountUsd"), 0) AS usd, COALESCE(SUM(a."amountLbp"), 0) AS lbp
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
  return rows.map(mapPersonGame);
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
      b."priceCurrency"::text AS "priceCurrency",
      b."priceUsd",
      b."amountDueUsd",
      b."priceLbp",
      b."amountDueLbp",
      b."collectionMode"::text AS "collectionMode",
      bp."isRequester",
      bp."amountDueUsd" AS "participantDueUsd",
      bp."amountDueLbp" AS "participantDueLbp",
      COALESCE(collected.usd, 0) AS "collectedUsd",
      COALESCE(alloc.usd, 0) AS "allocatedUsd",
      COALESCE(alloc.lbp, 0) AS "allocatedLbp"
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
      SELECT COALESCE(SUM(a."amountUsd"), 0) AS usd, COALESCE(SUM(a."amountLbp"), 0) AS lbp
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
