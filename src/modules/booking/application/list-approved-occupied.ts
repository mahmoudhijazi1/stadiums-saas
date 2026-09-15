import db from "@/lib/db";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { listApprovedRanges } from "@/modules/booking/infrastructure/bookings";

/**
 * APPROVED windows for the URL tenant. Public day occupied (SPEC-05). No login.
 * Venue never imports this — the page (or requestPublicSlot) passes ranges in.
 */
export async function listApprovedOccupied() {
  try {
    return await listApprovedRanges(db);
  } catch (error) {
    return await rethrowUnexpected(
      error,
      "List approved occupied failed",
      "listApprovedOccupied",
    );
  }
}
