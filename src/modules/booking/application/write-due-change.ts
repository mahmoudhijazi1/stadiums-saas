import Decimal from "decimal.js";
import type { TenantTx } from "@/lib/db";
import { assertAdjustDue } from "@/modules/booking/domain/adjust-due";
import type { CollectionModeName } from "@/modules/booking/domain/person-owed";
import type { DueChangeReason } from "@/modules/booking/domain/suggest-fee";
import {
  insertBookingDueChange,
  setBookingAmountDue,
} from "@/modules/booking/infrastructure/bookings";

/**
 * Update the denormalized due and append the log in the caller's transaction.
 * Unchanged amounts write nothing.
 */
export async function writeDueIfChanged(
  tx: TenantTx,
  input: {
    bookingId: string;
    fromUsd: Decimal;
    toUsd: Decimal;
    collectedUsd: Decimal;
    collectionMode: CollectionModeName;
    reason: DueChangeReason;
    note: string | null;
    actorMembershipId: string;
  },
): Promise<void> {
  const verdict = assertAdjustDue({
    fromUsd: input.fromUsd,
    toUsd: input.toUsd,
    collectedUsd: input.collectedUsd,
    collectionMode: input.collectionMode,
  });
  if (verdict === "noop") return;

  await setBookingAmountDue(tx, input.bookingId, input.toUsd);
  await insertBookingDueChange(tx, {
    bookingId: input.bookingId,
    fromUsd: input.fromUsd,
    toUsd: input.toUsd,
    reason: input.reason,
    note: input.note,
    actorMembershipId: input.actorMembershipId,
  });
}
