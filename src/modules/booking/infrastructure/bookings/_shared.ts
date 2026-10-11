import type { BookingStatus } from "@/generated/prisma/enums";
import Decimal from "decimal.js";
import { BookingForDecision } from "./single";

export function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export type BookingSqlRow = {
  id: string;
  pitchId: string;
  status: BookingStatus;
  start: Date | string;
  end: Date | string;
  priceUsd: Decimal | string;
  amountDueUsd: Decimal | string;
  collectionMode: "WHOLE" | "PER_PLAYER";
};

export function toBookingForDecision(row: BookingSqlRow): BookingForDecision {
  return {
    id: row.id,
    pitchId: row.pitchId,
    status: row.status,
    start: asDate(row.start),
    end: asDate(row.end),
    priceUsd: new Decimal(row.priceUsd.toString()),
    amountDueUsd: new Decimal(row.amountDueUsd.toString()),
    collectionMode: row.collectionMode,
  };
}

/**
 * APPROVED windows for occupied (SPEC-05). Optional pitch filter.
 */
/** Occupancy and waitlist windows older than this are never needed (S-8). */
export const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
