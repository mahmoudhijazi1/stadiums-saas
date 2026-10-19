import type { BookingStatus } from "@/generated/prisma/enums";
import type { TenantTx } from "@/lib/db";
import { getCurrentTenantId } from "@/lib/tenant-context";
import Decimal from "decimal.js";
import { gameDue, gamePrice, type GameCurrency, type GameMoney } from "@/modules/booking/domain/game-money";
import { gameOwing, shareOwing } from "@/modules/booking/domain/game-owing";
import { asDate, SETTLED_LBP_SQL, type SqlMoney } from "./_shared";
import { DayBookingStatus } from "./day";

export type PersonHistoryRow = {
  id: string;
  status: DayBookingStatus;
  pitchName: string;
  start: Date;
  end: Date;
  /** The game's currency; every amount below is in it (DR-007). */
  currency: GameCurrency;
  price: Decimal;
  amountDue: Decimal;
  collected: Decimal;
  collectionMode: "WHOLE" | "PER_PLAYER";
  isRequester: boolean;
  participantDue: Decimal;
  allocated: Decimal;
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
  settledLbp: SqlMoney;
  collectionMode: "WHOLE" | "PER_PLAYER";
  isRequester: boolean;
  participantDueUsd: SqlMoney;
  participantDueLbp: SqlMoney;
  allocatedUsd: SqlMoney;
  allocatedLbp: SqlMoney;
};

/**
 * No money filter in these reads: every participation of the person comes back, each with its
 * game's currency and its amounts in it (DR-007), so the person's totals are per currency.
 */
function mapPersonHistory(row: PersonHistorySqlRow): PersonHistoryRow {
  const game = gameOwing(row);
  const share = shareOwing({
    currency: game.currency,
    amountDueUsd: row.participantDueUsd,
    amountDueLbp: row.participantDueLbp,
    allocatedUsd: row.allocatedUsd,
    allocatedLbp: row.allocatedLbp,
    where: "person-history.share",
  });
  return {
    id: row.id,
    status: row.status,
    pitchName: row.pitchName,
    start: asDate(row.start),
    end: asDate(row.end),
    currency: game.currency,
    price: gamePrice(row).amount,
    amountDue: game.due,
    collected: game.collected,
    collectionMode: row.collectionMode,
    isRequester: row.isRequester,
    participantDue: share.due,
    allocated: share.allocated,
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

/** A game in its own currency: dollars from tenders, pounds from settlements (DR-007). */
function mapPersonGame(row: PersonHistorySqlRow): PersonGameRow {
  const game = gameOwing(row);
  const share = shareOwing({
    currency: game.currency,
    amountDueUsd: row.participantDueUsd,
    amountDueLbp: row.participantDueLbp,
    allocatedUsd: row.allocatedUsd,
    allocatedLbp: row.allocatedLbp,
    where: "person-games.share",
  });
  const money = (amount: Decimal): GameMoney => ({ currency: game.currency, amount });
  return {
    id: row.id,
    status: row.status,
    pitchName: row.pitchName,
    start: asDate(row.start),
    end: asDate(row.end),
    collectionMode: row.collectionMode,
    isRequester: row.isRequester,
    price: gamePrice(row),
    amountDue: gameDue(row),
    participantDue: money(share.due),
    collected: money(game.collected),
    allocated: money(share.allocated),
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
          ${SETTLED_LBP_SQL} AS "settledLbp",
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
          ${SETTLED_LBP_SQL} AS "settledLbp",
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
      ${SETTLED_LBP_SQL} AS "settledLbp",
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
