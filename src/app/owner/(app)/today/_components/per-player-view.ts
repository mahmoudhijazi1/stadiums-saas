import type Decimal from "decimal.js";
import { formatUsd } from "@/lib/format/money";
import type { OwnerSlot } from "@/modules/booking/application/load-owner-day";
import { planShareCharge, sharePayState } from "@/modules/booking/domain/share-charge";
import type { PerPlayerView } from "@/modules/booking/ui/per-player-collect";

/**
 * The split of one game for the sheet, in the game's own currency (DR-007 slice 7): the same rules
 * for dollars and for pounds (`share-charge.ts`, the ones the server charges with). Amounts are
 * strings in the game's currency: cents for a USD game, whole pounds for an LBP game.
 */
export function perPlayerViewOf(input: {
  bookingId: string;
  currency: "USD" | "LBP";
  mode: "WHOLE" | "PER_PLAYER";
  canSplit: boolean;
  defaultPlayerCount: number;
  slots: OwnerSlot[];
  /** The game's due and what has been collected (dollars) or settled (pounds) against it. */
  due: Decimal;
  collected: Decimal;
  /** Collected or settled minus what the slots hold: money from before the split. */
  unassigned: Decimal;
}): PerPlayerView {
  const text = (amount: Decimal) => (input.currency === "LBP" ? amount.toFixed(0) : formatUsd(amount));
  return {
    bookingId: input.bookingId,
    currency: input.currency,
    mode: input.mode,
    canSplit: input.canSplit,
    defaultPlayerCount: input.defaultPlayerCount,
    slots: input.slots.map((slot) => {
      const state = sharePayState({
        due: input.due,
        collected: input.collected,
        slots: input.slots,
        participantId: slot.participantId,
      });
      return {
        participantId: slot.participantId,
        slotNumber: slot.slotNumber,
        name: slot.name,
        dueUsd: text(slot.due),
        remainingUsd: text(slot.remaining),
        paid: state.kind === "paid",
        state: state.kind,
        chargeUsd: state.kind === "pay" ? text(state.charge) : null,
        partial: state.kind === "pay" && state.partial,
      };
    }),
    unassignedUsd: text(input.unassigned),
    hasAllocations: input.slots.some((slot) => slot.paid.gt(0)),
    // Same function the server charges with: never more than the booking owes.
    unpaidTotalUsd: text(
      planShareCharge({ cap: input.due.minus(input.collected), slots: input.slots, target: "ALL_UNPAID" }).total,
    ),
  };
}
