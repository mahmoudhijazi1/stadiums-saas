import { bookingFitsOpenHours } from "@/modules/venue/domain/availability";
import type { ScheduleConfig } from "@/modules/venue/schemas/schedule-config";

export type LivePitchWindow = {
  start: Date;
  end: Date;
  status: "APPROVED" | "PENDING";
};

/**
 * Hours shrink vs live bookings. Finished games (end <= now) do not block.
 * Duration is not this check — only whether the range still sits in a window.
 */
export function classifyHoursConflicts(
  config: ScheduleConfig,
  bookings: LivePitchWindow[],
  timeZone: string,
  now: Date,
): { approvedBlocking: boolean; pendingWarning: boolean } {
  let approvedBlocking = false;
  let pendingWarning = false;
  const nowMs = now.getTime();

  for (const row of bookings) {
    if (row.end.getTime() <= nowMs) continue;
    if (bookingFitsOpenHours(config, row, timeZone)) continue;
    if (row.status === "APPROVED") approvedBlocking = true;
    else pendingWarning = true;
  }

  return { approvedBlocking, pendingWarning };
}

/**
 * APPROVED in a removed window never yields to a checkbox.
 * PENDING-only may save on a second submit with confirmPending.
 */
export function hoursSaveBlocker(input: {
  approvedBlocking: boolean;
  pendingWarning: boolean;
  confirmPending: boolean;
}): "venue.hours_approved" | "venue.hours_pending" | null {
  if (input.approvedBlocking) return "venue.hours_approved";
  if (input.pendingWarning && !input.confirmPending) {
    return "venue.hours_pending";
  }
  return null;
}
