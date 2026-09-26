import type { BookingStatusLike } from "@/modules/booking/domain/decision";

/** A PENDING request whose slot has started (or ended). Derived, not stored. */
export function isExpiredPendingRequest(
  input: { status: BookingStatusLike; start: Date },
  now: Date,
): boolean {
  return input.status === "PENDING" && input.start.getTime() <= now.getTime();
}

/** Pending rows still waiting on a future slot. These are the badge and the queue. */
export function actionablePending<T extends { start: Date }>(
  rows: T[],
  now: Date,
): T[] {
  return rows.filter((row) => row.start.getTime() > now.getTime());
}

/** Pending rows whose slot start is now or earlier. */
export function missedPending<T extends { start: Date }>(
  rows: T[],
  now: Date,
): T[] {
  return rows.filter((row) => row.start.getTime() <= now.getTime());
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/**
 * Whole minutes until `start`, when it is still in the future and within 2 hours.
 * Otherwise null. At least 1 so a few seconds still reads as a minute.
 */
export function startsInMinutes(start: Date, now: Date): number | null {
  const delta = start.getTime() - now.getTime();
  if (delta <= 0 || delta > TWO_HOURS_MS) return null;
  return Math.max(1, Math.ceil(delta / 60_000));
}
