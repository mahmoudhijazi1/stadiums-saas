import Decimal from "decimal.js";
import type { TenantTx } from "@/lib/db";
import { assertAdjustDue } from "@/modules/booking/domain/adjust-due";
import type { GameCurrency } from "@/modules/booking/domain/game-money";
import type { CollectionModeName } from "@/modules/booking/domain/person-owed";
import type { DueChangeReason } from "@/modules/booking/domain/suggest-fee";
import {
  insertBookingDueChange,
  insertBookingDueChangeLbp,
  setBookingAmountDue,
  setBookingAmountDueLbp,
} from "@/modules/booking/infrastructure/bookings";

type DueChange = {
  bookingId: string;
  /** The game's currency: `from`, `to` are dollars on a USD game and whole pounds on an LBP game. */
  currency: GameCurrency;
  from: Decimal;
  to: Decimal;
  reason: DueChangeReason;
  note: string | null;
  actorMembershipId: string;
};

/**
 * Append one due change in the game's currency (never updated or deleted). Written in the same
 * transaction as the due it records.
 */
export async function appendDueChange(tx: TenantTx, change: DueChange): Promise<void> {
  if (change.currency === "LBP") {
    await insertBookingDueChangeLbp(tx, {
      bookingId: change.bookingId,
      fromLbp: change.from,
      toLbp: change.to,
      reason: change.reason,
      note: change.note,
      actorMembershipId: change.actorMembershipId,
    });
    return;
  }
  await insertBookingDueChange(tx, {
    bookingId: change.bookingId,
    fromUsd: change.from,
    toUsd: change.to,
    reason: change.reason,
    note: change.note,
    actorMembershipId: change.actorMembershipId,
  });
}

/**
 * Update the denormalized due and append the log in the caller's transaction, in the game's currency
 * (DR-007). Unchanged amounts write nothing. `collected` is what the game has collected in that
 * currency: dollars from its tenders, pounds from its settlements.
 */
export async function writeDueIfChanged(
  tx: TenantTx,
  input: DueChange & {
    collected: Decimal;
    collectionMode: CollectionModeName;
  },
): Promise<void> {
  const verdict = assertAdjustDue({
    currency: input.currency,
    from: input.from,
    to: input.to,
    collected: input.collected,
    collectionMode: input.collectionMode,
  });
  if (verdict === "noop") return;

  if (input.currency === "LBP") {
    await setBookingAmountDueLbp(tx, input.bookingId, input.to);
  } else {
    await setBookingAmountDue(tx, input.bookingId, input.to);
  }
  await appendDueChange(tx, input);
}
