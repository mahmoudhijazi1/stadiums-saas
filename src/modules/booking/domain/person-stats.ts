import Decimal from "decimal.js";
import { classifyDue } from "@/modules/booking/domain/classify-due";
import { bookingRemaining, participantRemaining } from "@/modules/payment/domain/collect";
import {
  personOwedOnBooking,
  personPaidOnBooking,
  type CollectionModeName,
} from "@/modules/booking/domain/person-owed";

export type PersonStatStatus = "APPROVED" | "CANCELLED" | "NO_SHOW";

/** One participation already loaded for a person. Not a Prisma type. */
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
};

export type PersonStats = {
  /** APPROVED participations whose start is already in the past. */
  gamesPlayed: number;
  noShows: number;
  totalPaidUsd: Decimal;
  /** classifyDue "owed" for this person's remaining. */
  owesNowUsd: Decimal;
  /** classifyDue "expected" for this person's remaining. */
  expectedUsd: Decimal;
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
  let noShows = 0;
  let totalPaidUsd = new Decimal(0);
  let owesNowUsd = new Decimal(0);
  let expectedUsd = new Decimal(0);
  let latestOwedAt: Date | null = null;

  for (const row of rows) {
    totalPaidUsd = totalPaidUsd.plus(
      personPaidOnBooking({
        collectionMode: row.collectionMode,
        isRequester: row.isRequester,
        collectedUsd: row.collectedUsd,
        allocatedUsd: row.allocatedUsd,
      }),
    );

    if (row.status === "NO_SHOW") noShows += 1;
    if (row.status === "APPROVED" && row.start.getTime() < nowMs) {
      gamesPlayed += 1;
    }

    const remaining = Decimal.max(
      personOwedOnBooking({
        collectionMode: row.collectionMode,
        isRequester: row.isRequester,
        bookingRemainingUsd: bookingRemaining(row.amountDueUsd, row.collectedUsd),
        participantRemainingUsd: participantRemaining(
          row.participantDueUsd,
          row.allocatedUsd,
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
      owesNowUsd = owesNowUsd.plus(remaining);
      if (
        latestOwedAt === null ||
        row.start.getTime() > latestOwedAt.getTime()
      ) {
        latestOwedAt = row.start;
      }
    }
    if (kind === "expected") expectedUsd = expectedUsd.plus(remaining);
  }

  return {
    gamesPlayed,
    noShows,
    totalPaidUsd,
    owesNowUsd,
    expectedUsd,
    latestOwedAt,
  };
}
