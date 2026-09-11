import { DomainError } from "@/lib/errors";
import type { TenantTx } from "@/lib/db";
import { overlappingPendingIds } from "@/modules/booking/domain/offered-slot";
import {
  findRequesterPersonId,
  insertSlotInterest,
  listPendingBookings,
  setPendingStatus,
} from "@/modules/booking/infrastructure/bookings";

/**
 * Other PENDING on this pitch/window → REJECTED + slot_interests on the filled
 * hour (BR-20 / BR-21). Used by approve and owner-create so the rules stay one.
 */
export async function rejectOverlappingPending(
  tx: TenantTx,
  claimed: { id?: string; pitchId: string; start: Date; end: Date },
): Promise<void> {
  const pending = await listPendingBookings(tx);
  const loserIds = overlappingPendingIds(
    { pitchId: claimed.pitchId, start: claimed.start, end: claimed.end },
    pending
      .filter((row) => row.id !== claimed.id)
      .map((row) => ({
        id: row.id,
        pitchId: row.pitchId,
        start: row.start,
        end: row.end,
      })),
  );

  for (const loserId of loserIds) {
    await setPendingStatus(tx, loserId, "REJECTED");
    const personId = await findRequesterPersonId(tx, loserId);
    if (!personId) {
      throw new DomainError("booking.requester_not_found");
    }
    await insertSlotInterest(tx, {
      pitchId: claimed.pitchId,
      start: claimed.start,
      end: claimed.end,
      personId,
    });
  }
}
