import type Decimal from "decimal.js";
import { formatUsd, formatUsdCompact } from "@/lib/format/money";
import type { GameMoney } from "@/modules/booking/domain/game-money";
import {
  confirmedFee,
  ownerInitiatorLowersFee,
  suggestFee,
  type FeePolicy,
} from "@/modules/booking/domain/suggest-fee";
import type { UpcomingRowView } from "@/modules/booking/ui/upcoming-panel";

/** The fee fields of a game's card, in the game's own currency (DR-007 slice 8). */
export type GameFeeFields = Pick<
  UpcomingRowView,
  | "hoursBefore"
  | "playerFeeCompact"
  | "playerFeeExact"
  | "ownerFeeCompact"
  | "ownerFeeExact"
  | "ownerCancelLowersFee"
  | "noShowFeeCompact"
  | "noShowFeeExact"
  | "collectedExact"
  | "collectedCompact"
>;

/**
 * What cancelling or marking a no-show would charge, written for the sheet: the suggestions
 * (`suggestFee`, rounded to the money unit), whether "I cancelled" would lower the player's fee, and
 * what has been collected. `due` and `collected` are in the game's currency (dollars from the tenders,
 * pounds from the settlements); the strings are dollars with cents or whole pounds.
 */
export function gameFeeFields(input: {
  due: GameMoney;
  collected: Decimal;
  start: Date;
  now: Date;
  policy: FeePolicy;
}): GameFeeFields {
  const { due, collected, now, policy } = input;
  const pounds = due.currency === "LBP";
  const exact = (amount: Decimal) => (pounds ? amount.toFixed(0) : formatUsd(amount));
  const compact = (amount: Decimal) => (pounds ? amount.toFixed(0) : formatUsdCompact(amount));
  // Nothing to say about a fee of zero when nothing was collected either.
  const feeCompact = (fee: Decimal) => (fee.isZero() && collected.isZero() ? null : compact(fee));

  const booking = { due, start: input.start };
  const player = suggestFee(policy, booking, now, "PLAYER");
  const owner = suggestFee(policy, booking, now, "OWNER");
  const noShow = suggestFee(policy, booking, now, "NO_SHOW");
  return {
    hoursBefore: Math.max(0, Math.floor((input.start.getTime() - now.getTime()) / 3_600_000)),
    playerFeeCompact: feeCompact(player.fee),
    playerFeeExact: exact(player.fee),
    ownerFeeCompact: feeCompact(owner.fee),
    ownerFeeExact: exact(owner.fee),
    ownerCancelLowersFee: ownerInitiatorLowersFee({
      policy,
      booking,
      now,
      resultingFee: confirmedFee({ suggestion: owner, collected }).fee,
    }),
    noShowFeeCompact: feeCompact(noShow.fee),
    noShowFeeExact: exact(noShow.fee),
    collectedExact: exact(collected),
    collectedCompact: compact(collected),
  };
}
