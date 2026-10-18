import type Decimal from "decimal.js";
import type { TenantTx } from "@/lib/db";
import type { GameMoney } from "@/modules/booking/domain/game-money";
import { sumSettledLbp } from "@/modules/booking/infrastructure/bookings";
import { sumCollectedUsd } from "@/modules/payment/infrastructure/payments";

/**
 * What a game has collected, in its own currency (DR-007): the USD value of its tenders on a game in
 * dollars, the pounds its settlements applied on a game in pounds. Read after the booking row is
 * locked. This is the figure a due can never drop below.
 */
export async function collectedOn(tx: TenantTx, game: { id: string; due: GameMoney }): Promise<Decimal> {
  return game.due.currency === "LBP" ? sumSettledLbp(tx, game.id) : sumCollectedUsd(tx, "BOOKING", game.id);
}
