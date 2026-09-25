import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { debtWarnings, type DebtWarning } from "@/modules/booking/domain/debt-warning";
import type { DueChangeReason } from "@/modules/booking/domain/suggest-fee";
import { listDebtParticipations } from "@/modules/booking/infrastructure/bookings";
import { bookingRemaining, participantRemaining } from "@/modules/payment/domain/collect";

const REASONS: ReadonlySet<string> = new Set<DueChangeReason>([
  "LATE_CANCELLATION_FEE",
  "NO_SHOW_FEE",
  "CANCELLATION_NO_FEE",
  "PARTIAL_GAME",
  "DISCOUNT",
  "WAIVER",
  "CORRECTION",
]);

/**
 * Owed totals for every person on one screen. One SQL query, then classifyDue.
 * Logged-in membership may look. Empty ids do not query.
 */
export async function listDebtWarnings(
  personIds: string[],
): Promise<DebtWarning[]> {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new DomainError("access.not_allowed");
  }
  const unique = [...new Set(personIds)];
  if (unique.length === 0) return [];

  try {
    const now = new Date();
    const rows = await listDebtParticipations(db, unique);
    return debtWarnings(
      rows.map((row) => ({
        personId: row.personId,
        bookingId: row.bookingId,
        status: row.status,
        start: row.start,
        end: row.end,
        collectionMode: row.collectionMode,
        isRequester: row.isRequester,
        bookingRemainingUsd: bookingRemaining(row.amountDueUsd, row.collectedUsd),
        participantRemainingUsd: participantRemaining(
          row.participantDueUsd,
          row.allocatedUsd,
        ),
        reason: asReason(row.reason),
      })),
      now,
    );
  } catch (error) {
    return await rethrowUnexpected(
      error,
      "List debt warnings failed",
      "listDebtWarnings",
    );
  }
}

function asReason(value: string | null): DueChangeReason | null {
  if (value && REASONS.has(value)) return value as DueChangeReason;
  return null;
}
