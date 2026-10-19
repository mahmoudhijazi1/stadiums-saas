import Decimal from "decimal.js";
import { classifyDue, type DueStatus } from "@/modules/booking/domain/classify-due";
import { remainingOf, type Remaining } from "@/modules/booking/domain/game-owing";
import {
  personOwedOnBooking,
  type CollectionModeName,
} from "@/modules/booking/domain/person-owed";
import type { DueChangeReason } from "@/modules/booking/domain/suggest-fee";

/** One participation already loaded for the debt warning. Not a Prisma type. */
export type DebtParticipation = {
  personId: string;
  bookingId: string;
  status: DueStatus;
  start: Date;
  end: Date;
  collectionMode: CollectionModeName;
  isRequester: boolean;
  /** Latest due-change reason on this booking, when one exists. */
  reason: DueChangeReason | null;
} & Remaining;

export type DebtWarning = {
  personId: string;
  totalUsd: Decimal;
  /** The same total in pounds (LBP games); never added to the dollars (DR-007 decision 11). */
  totalLbp: Decimal;
  /** Reason on the owed booking with the latest start. */
  reason: DueChangeReason | null;
  /** Start of that booking. */
  at: Date;
};

/**
 * Sum of classifyDue "owed" via personOwedOnBooking, per person.
 * The note is the owed booking with the latest start.
 */
export function debtWarnings(
  rows: DebtParticipation[],
  now: Date,
): DebtWarning[] {
  const byPerson = new Map<string, DebtWarning & { bookingId: string }>();

  for (const row of rows) {
    const figures = remainingOf(row);
    const remaining = Decimal.max(
      personOwedOnBooking({
        collectionMode: row.collectionMode,
        isRequester: row.isRequester,
        bookingRemainingUsd: figures.booking,
        participantRemainingUsd: figures.participant,
      }),
      0,
    );
    const usd = figures.currency === "LBP" ? new Decimal(0) : remaining;
    const lbp = figures.currency === "LBP" ? remaining : new Decimal(0);
    if (
      classifyDue({
        status: row.status,
        start: row.start,
        end: row.end,
        remaining,
        now,
      }) !== "owed"
    ) {
      continue;
    }

    const current = byPerson.get(row.personId);
    if (!current) {
      byPerson.set(row.personId, {
        personId: row.personId,
        totalUsd: usd,
        totalLbp: lbp,
        reason: row.reason,
        at: row.start,
        bookingId: row.bookingId,
      });
      continue;
    }

    current.totalUsd = current.totalUsd.plus(usd);
    current.totalLbp = current.totalLbp.plus(lbp);
    if (isLaterOwed(row, current)) {
      current.reason = row.reason;
      current.at = row.start;
      current.bookingId = row.bookingId;
    }
  }

  return [...byPerson.values()].map((row) => ({
    personId: row.personId,
    totalUsd: row.totalUsd,
    totalLbp: row.totalLbp,
    reason: row.reason,
    at: row.at,
  }));
}

function isLaterOwed(
  row: DebtParticipation,
  current: { at: Date; bookingId: string },
): boolean {
  const diff = row.start.getTime() - current.at.getTime();
  if (diff !== 0) return diff > 0;
  return row.bookingId > current.bookingId;
}
