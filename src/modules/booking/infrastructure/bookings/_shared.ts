import { Prisma } from "@/generated/prisma/client";
import type { BookingStatus } from "@/generated/prisma/enums";
import Decimal from "decimal.js";
import type { TenantTx } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { getCurrentTenantId } from "@/lib/tenant-context";
import { gameDue, gamePrice, requireUsd, type GameCurrency } from "@/modules/booking/domain/game-money";
import { BookingForDecision } from "./single";

export function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/** A money value as a raw SQL row gives it back. */
export type SqlMoney = Decimal | string | null;

/**
 * The pounds a booking's settlements applied (`BookingSettlement.lbpApplied`, DR-007 decision 4):
 * what an LBP game has collected. Zero until the collecting slice writes settlements. An expression
 * over the booking alias `b`; the settlement's own tenant is matched.
 */
export const SETTLED_LBP_SQL = Prisma.sql`COALESCE((
  SELECT SUM(s."lbpApplied")
  FROM "BookingSettlement" s
  WHERE s."tenantId" = b."tenantId" AND s."bookingId" = b.id
), 0)`;

/**
 * For a USD-only statement that keeps only USD games (`b."priceCurrency" = 'USD'`): refuse when an
 * LBP game matches the same condition, so it never silently leaves one out (DR-007). Only the write
 * paths that are USD-only on purpose use it now. `match` is a condition on the booking alias `b`; the
 * tenant is stamped here.
 */
export async function refuseLbpGames(tx: TenantTx, match: Prisma.Sql, where: string): Promise<void> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<{ count: bigint | number }[]>`
    SELECT count(*) AS count
    FROM "Booking" b
    WHERE b."tenantId" = ${tenantId}
      AND b."priceCurrency" = 'LBP'::"Currency"
      AND ${match}
  `;
  if (Number(rows[0]?.count ?? 0) > 0) {
    throw new DomainError("booking.lbp_not_supported", { where });
  }
}

export type BookingSqlRow = {
  id: string;
  pitchId: string;
  status: BookingStatus;
  start: Date | string;
  end: Date | string;
  priceCurrency: GameCurrency;
  priceUsd: Decimal | string | null;
  amountDueUsd: Decimal | string | null;
  priceLbp: Decimal | string | null;
  amountDueLbp: Decimal | string | null;
  collectionMode: "WHOLE" | "PER_PLAYER";
};

/** The columns BookingSqlRow reads, for the SELECT lists that build it. */
export const BOOKING_MONEY_COLUMNS = Prisma.sql`"priceCurrency"::text AS "priceCurrency", "priceUsd", "amountDueUsd", "priceLbp", "amountDueLbp"`;

/**
 * Every money-changing use case loads its booking through here, so an LBP game is refused with
 * `booking.lbp_not_supported` until its slice lands (DR-007). A USD game reads exactly as before.
 */
export function toBookingForDecision(row: BookingSqlRow): BookingForDecision {
  return {
    id: row.id,
    pitchId: row.pitchId,
    status: row.status,
    start: asDate(row.start),
    end: asDate(row.end),
    priceUsd: requireUsd(gamePrice(row), "booking.priceUsd"),
    amountDueUsd: requireUsd(gameDue(row), "booking.amountDueUsd"),
    collectionMode: row.collectionMode,
  };
}

/**
 * APPROVED windows for occupied (SPEC-05). Optional pitch filter.
 */
/** Occupancy and waitlist windows older than this are never needed (S-8). */
export const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
