import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { rethrowUnexpected } from "@/lib/use-case-error";
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

  try {
    return await listLiveWindowsOnPitch(db, pitchId, now);
  } catch (error) {
    return await rethrowUnexpected(
      error,
      "List live pitch windows failed",
      "listLivePitchWindows",
    );
  }
}
