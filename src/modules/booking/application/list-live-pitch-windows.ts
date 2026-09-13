import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { listLiveWindowsOnPitch } from "@/modules/booking/infrastructure/bookings";

/**
 * Live APPROVED + PENDING windows on this pitch. Membership required.
 * Venue classifies the rows — this module does not import hours-cover.
 */
export async function listLivePitchWindows(pitchId: string, now: Date) {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new DomainError("access.not_allowed");
  }

  return listLiveWindowsOnPitch(db, pitchId, now);
}
