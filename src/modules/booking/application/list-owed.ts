import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { REPORTS_VIEW, can } from "@/modules/access/domain/can";
import { summarizeOwed, type OwedSummary } from "@/modules/booking/domain/owed";
import { listOwedParticipations, listOwedTabs } from "@/modules/booking/infrastructure/bookings";
import { bookingRemaining, participantRemaining } from "@/modules/payment/domain/collect";

/**
 * Everything owed to this stadium, grouped by person: one query, then `classifyDue` and
 * `personOwedOnBooking` (the same owed rules as Today and the person page). reports.view.
 */
export async function listOwed(now: Date = new Date()): Promise<OwedSummary> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, REPORTS_VIEW)) {
    throw new DomainError("access.not_allowed");
  }

  try {
    const [rows, tabs] = await Promise.all([listOwedParticipations(db, now), listOwedTabs(db, now)]);
    return summarizeOwed(
      rows.map((row) => ({
        bookingId: row.bookingId,
        status: row.status as "APPROVED" | "CANCELLED" | "NO_SHOW",
        start: row.start,
        end: row.end,
        collectionMode: row.collectionMode as "WHOLE" | "PER_PLAYER",
        pitchName: row.pitchName,
        personId: row.personId,
        personName: row.personName,
        personPhone: row.personPhone,
        isRequester: row.isRequester,
        bookingRemainingUsd: bookingRemaining(row.amountDueUsd, row.collectedUsd),
        participantRemainingUsd: participantRemaining(row.participantDueUsd, row.allocatedUsd),
      })),
      now,
      tabs.map((tab) => ({ ...tab, status: tab.status as "APPROVED" | "CANCELLED" | "NO_SHOW" })),
    );
  } catch (error) {
    return await rethrowUnexpected(error, "List owed failed", "listOwed");
  }
}
