import { DomainError } from "@/lib/errors";
import type { TenantTx } from "@/lib/db";
import { overlappingPendingIds } from "@/modules/booking/domain/offered-slot";
import {
  findRequesterPersonId,
  insertSlotInterest,
  listPendingBookings,
  lockPendingRowsInOrder,
  setPendingStatus,
  type PendingBookingRow,
} from "@/modules/booking/infrastructure/bookings";

export type AutoRejectedPerson = {
  personId: string;
  name: string;
  phone: string | null;
};

type Claimed = { id?: string; pitchId: string; start: Date; end: Date };

/** Other PENDING rows on this pitch whose window overlaps the claimed one. */
export async function listOverlappingPending(
  tx: TenantTx,
  claimed: Claimed,
): Promise<PendingBookingRow[]> {
  const pending = await listPendingBookings(tx);
  const ids = new Set(
    overlappingPendingIds(
      { pitchId: claimed.pitchId, start: claimed.start, end: claimed.end },
      pending
        .filter((row) => row.id !== claimed.id)
        .map((row) => ({ id: row.id, pitchId: row.pitchId, start: row.start, end: row.end })),
    ),
  );
  return pending.filter((row) => ids.has(row.id));
}

/**
 * Other PENDING on this pitch/window → REJECTED + slot_interests on the filled
 * hour (BR-20 / BR-21). Used by approve and owner-create so the rules stay one.
 * The losers are locked in id order first (`lockPendingRowsInOrder`); a row that a
 * concurrent dismiss already rejected is skipped. Returns the people just rejected,
 * in pending-list order.
 */
export async function rejectOverlappingPending(
  tx: TenantTx,
  claimed: Claimed,
): Promise<AutoRejectedPerson[]> {
  const pending = await listOverlappingPending(tx, claimed);
  const loserIds = await lockPendingRowsInOrder(
    tx,
    pending.map((row) => row.id),
  );

  const rejected: AutoRejectedPerson[] = [];
  for (const loser of pending) {
    if (!loserIds.has(loser.id)) continue;
    await setPendingStatus(tx, loser.id, "REJECTED");
    const personId = await findRequesterPersonId(tx, loser.id);
    if (!personId) {
      throw new DomainError("booking.requester_not_found");
    }
    await insertSlotInterest(tx, {
      pitchId: claimed.pitchId,
      start: claimed.start,
      end: claimed.end,
      personId,
    });
    rejected.push({
      personId,
      name: loser.requesterName,
      phone: loser.requesterPhone,
    });
  }
  return rejected;
}
