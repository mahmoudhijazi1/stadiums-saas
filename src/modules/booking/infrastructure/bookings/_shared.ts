import { Prisma } from "@/generated/prisma/client";
import type { BookingStatus } from "@/generated/prisma/enums";
import Decimal from "decimal.js";
import { gameDue, gamePrice, type GameCurrency } from "@/modules/booking/domain/game-money";
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
 * Every use case that decides on a booking (cancel, no-show, extend, adjust, collect, split) loads
 * it through here: its price and due in its own currency (DR-007). Nothing here is dollars-only.
 */
export function toBookingForDecision(row: BookingSqlRow): BookingForDecision {
  return {
    id: row.id,
    pitchId: row.pitchId,
    status: row.status,
    start: asDate(row.start),
    end: asDate(row.end),
    price: gamePrice(row),
    due: gameDue(row),
    collectionMode: row.collectionMode,
  };
}

/**
 * APPROVED windows for occupied (SPEC-05). Optional pitch filter.
 */
/** Occupancy and waitlist windows older than this are never needed (S-8). */
export const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
