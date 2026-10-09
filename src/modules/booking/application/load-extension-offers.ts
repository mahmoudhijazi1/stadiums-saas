import type Decimal from "decimal.js";
import db from "@/lib/db";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { BOOKINGS_EXTEND, can } from "@/modules/access/domain/can";
import {
  extensionPlan,
  type ExtensionPlan,
} from "@/modules/booking/domain/extension-plan";
import { overlappingPendingIds } from "@/modules/booking/domain/offered-slot";
import { listApprovedRanges, listPendingBookings } from "@/modules/booking/infrastructure/bookings";
import { findPitchById } from "@/modules/venue/infrastructure/pitches";
import { parseScheduleConfig } from "@/modules/venue/schemas/schedule-config";

const TIME_ZONE = "Asia/Beirut";

export type ExtensionOffer = ExtensionPlan & {
  /** Pending requests inside the added time: they would be declined and kept as interests. */
  declineCount: number;
};

type OfferInput = {
  id: string;
  status: string;
  pitchId: string;
  start: Date;
  end: Date;
  priceUsd: Decimal;
  collectionMode: "WHOLE" | "PER_PLAYER";
};

/**
 * What "Extend 30 min" would do for each of these games, for the booking sheet. Empty for a member
 * without bookings.extend, so the button does not exist for them. Only confirmed, whole-pay games
 * that have not ended get an offer (the other cases have nothing to show or hide). This is a
 * preview: the real check is repeated under the locks in `extendBooking`.
 */
export async function loadExtensionOffers(
  rows: readonly OfferInput[],
  now: Date = new Date(),
): Promise<Map<string, ExtensionOffer>> {
  const offers = new Map<string, ExtensionOffer>();
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, BOOKINGS_EXTEND)) return offers;

  const candidates = rows.filter(
    (row) => row.status === "APPROVED" && row.collectionMode === "WHOLE" && row.end.getTime() > now.getTime(),
  );
  if (candidates.length === 0) return offers;

  const pitchIds = [...new Set(candidates.map((row) => row.pitchId))];
  const [pending, perPitch] = await Promise.all([
    listPendingBookings(db),
    Promise.all(
      pitchIds.map(async (pitchId) => ({
        pitchId,
        pitch: await findPitchById(db, pitchId),
        approved: await listApprovedRanges(db, pitchId, now),
      })),
    ),
  ]);
  const byPitch = new Map(perPitch.map((entry) => [entry.pitchId, entry]));

  for (const row of candidates) {
    const entry = byPitch.get(row.pitchId);
    if (!entry?.pitch) continue;
    const following = entry.approved
      .filter((range) => range.start.getTime() >= row.end.getTime())
      .sort((a, b) => a.start.getTime() - b.start.getTime())[0];
    const plan = extensionPlan(
      row,
      parseScheduleConfig(entry.pitch.scheduleConfig),
      now,
      following ? following.start : null,
      TIME_ZONE,
    );
    const declineCount = plan.allowed
      ? overlappingPendingIds(
          { pitchId: row.pitchId, start: row.end, end: plan.newEnd },
          pending.map((p) => ({ id: p.id, pitchId: p.pitchId, start: p.start, end: p.end })),
        ).length
      : 0;
    offers.set(row.id, { ...plan, declineCount });
  }
  return offers;
}
