import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { summarizePersonBookings, type PersonStatRow, type PersonStats } from "@/modules/booking/domain/person-stats";
import { listPersonStatRows, type PersonHistoryRow } from "@/modules/booking/infrastructure/bookings";

/** A history row as the stats read it: dollars under the USD names, pounds under the LBP names (DR-007). */
export function toPersonStatRow(row: PersonHistoryRow): PersonStatRow {
  const common = {
    status: row.status,
    start: row.start,
    end: row.end,
    collectionMode: row.collectionMode,
    isRequester: row.isRequester,
  };
  const zero = new Decimal(0);
  return row.currency === "LBP"
    ? {
        ...common,
        currency: "LBP",
        amountDueUsd: zero,
        collectedUsd: zero,
        participantDueUsd: zero,
        allocatedUsd: zero,
        amountDueLbp: row.amountDue,
        settledLbp: row.collected,
        participantDueLbp: row.participantDue,
        allocatedLbp: row.allocated,
      }
    : {
        ...common,
        currency: "USD",
        amountDueUsd: row.amountDue,
        collectedUsd: row.collected,
        participantDueUsd: row.participantDue,
        allocatedUsd: row.allocated,
      };
}

/**
 * Games played, no-shows, total paid, owes now. Owes now uses personOwedOnBooking.
 * Logged-in membership may look (same as the day list). Per currency (DR-007).
 */
export async function getPersonBookingStats(personId: string): Promise<PersonStats> {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new DomainError("access.not_allowed");
  }

  try {
    const rows = await listPersonStatRows(db, personId);
    return summarizePersonBookings(rows.map(toPersonStatRow), new Date());
  } catch (error) {
    return await rethrowUnexpected(
      error,
      "Person booking stats failed",
      "getPersonBookingStats",
    );
  }
}
