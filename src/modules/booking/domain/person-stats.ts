import Decimal from "decimal.js";
import { classifyDue } from "@/modules/booking/domain/classify-due";
import { bookingRemaining, participantRemaining } from "@/modules/payment/domain/collect";
import {
  personOwedOnBooking,
  personPaidOnBooking,
  type CollectionModeName,
} from "@/modules/booking/domain/person-owed";

export type PersonStatStatus = "APPROVED" | "CANCELLED" | "NO_SHOW";

/**
 * One participation already loaded for a person. Not a Prisma type. A USD game has its amounts in
 * dollars; an LBP game (DR-007) has them in pounds, collected meaning what its settlements applied.
 */
export type PersonStatRow = {
  status: PersonStatStatus;
  start: Date;
  end: Date;
  collectionMode: CollectionModeName;
  isRequester: boolean;
  amountDueUsd: Decimal;
  collectedUsd: Decimal;
  participantDueUsd: Decimal;
  allocatedUsd: Decimal;
  /** Set on an LBP game, whose dollar figures above are then zero. */
  currency?: "USD" | "LBP";
  amountDueLbp?: Decimal;
  settledLbp?: Decimal;
  participantDueLbp?: Decimal;
  allocatedLbp?: Decimal;
};

export type PersonStats = {
  /** APPROVED participations whose start is already in the past. */
  gamesPlayed: number;
  /** APPROVED participations that have not started yet. */
  upcoming: number;
  noShows: number;
  totalPaidUsd: Decimal;
  /** Paid on LBP games, in pounds (never added to the dollars). */
  totalPaidLbp: Decimal;
  /** classifyDue "owed" for this person's remaining. */
  owesNowUsd: Decimal;
  owesNowLbp: Decimal;
  /** classifyDue "expected" for this person's remaining. */
  expectedUsd: Decimal;
  expectedLbp: Decimal;
  /** Start of the owed booking with the latest start. */
  latestOwedAt: Date | null;
};

/**
 * Person-page counters. Owes now is only what classifyDue calls owed.
 * An upcoming game is expected. Paid includes cancelled collections.
 */
export function summarizePersonBookings(
  rows: PersonStatRow[],
  now: Date,
): PersonStats {
  const nowMs = now.getTime();
  let gamesPlayed = 0;
  let upcoming = 0;
  let noShows = 0;
  let totalPaidUsd = new Decimal(0);
  let totalPaidLbp = new Decimal(0);
  let owesNowUsd = new Decimal(0);
  let owesNowLbp = new Decimal(0);
  let expectedUsd = new Decimal(0);
  let expectedLbp = new Decimal(0);
  let latestOwedAt: Date | null = null;

  for (const row of rows) {
    // The row's figures in its game's currency.
    const lbp = row.currency === "LBP";
    const zero = new Decimal(0);
    const figures = lbp
      ? {
          due: row.amountDueLbp ?? zero,
          collected: row.settledLbp ?? zero,
          participantDue: row.participantDueLbp ?? zero,
          allocated: row.allocatedLbp ?? zero,
        }
      : {
          due: row.amountDueUsd,
          collected: row.collectedUsd,
          participantDue: row.participantDueUsd,
          allocated: row.allocatedUsd,
        };
    const paid = personPaidOnBooking({
      collectionMode: row.collectionMode,
      isRequester: row.isRequester,
      collectedUsd: figures.collected,
      allocatedUsd: figures.allocated,
    });
    if (lbp) totalPaidLbp = totalPaidLbp.plus(paid);
    else totalPaidUsd = totalPaidUsd.plus(paid);

    if (row.status === "NO_SHOW") noShows += 1;
    if (row.status === "APPROVED" && row.start.getTime() < nowMs) {
      gamesPlayed += 1;
    }
    if (row.status === "APPROVED" && row.start.getTime() >= nowMs) {
      upcoming += 1;
    }

    const remaining = Decimal.max(
      personOwedOnBooking({
        collectionMode: row.collectionMode,
        isRequester: row.isRequester,
        bookingRemainingUsd: bookingRemaining(figures.due, figures.collected),
        participantRemainingUsd: participantRemaining(
          figures.participantDue,
          figures.allocated,
        ),
      }),
      0,
    );
    const kind = classifyDue({
      status: row.status,
      start: row.start,
      end: row.end,
      remaining,
      now,
    });
    if (kind === "owed") {
      if (lbp) owesNowLbp = owesNowLbp.plus(remaining);
      else owesNowUsd = owesNowUsd.plus(remaining);
      if (
        latestOwedAt === null ||
        row.start.getTime() > latestOwedAt.getTime()
      ) {
        latestOwedAt = row.start;
      }
    }
    if (kind === "expected") {
      if (lbp) expectedLbp = expectedLbp.plus(remaining);
      else expectedUsd = expectedUsd.plus(remaining);
    }
  }

  return {
    gamesPlayed,
    upcoming,
    noShows,
    totalPaidUsd,
    totalPaidLbp,
    owesNowUsd,
    owesNowLbp,
    expectedUsd,
    expectedLbp,
    latestOwedAt,
  };
}
